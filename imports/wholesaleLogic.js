import logStockTransaction from "./updateStockChanges.js";

/**
 * Perform a database search for products with wholesale pricing and packaging details
 */
export async function searchWholesaleDb(name, category, startPrice, stopPrice, db) {
    const queryParts = [];
    const params = [];
    let paramCounter = 1;

    if (name) {
        queryParts.push(`(ast.name ILIKE $${paramCounter} OR ast.barcode ILIKE $${paramCounter} OR ast.generic_name ILIKE $${paramCounter})`);
        params.push(`%${name}%`);
        paramCounter++;
    }

    if (category) {
        queryParts.push(`categories.name ILIKE $${paramCounter}`);
        params.push(`%${category}%`);
        paramCounter++;
    }

    const parsedStartPrice = parseFloat(startPrice);
    if (!isNaN(parsedStartPrice)) {
        queryParts.push(`ast.wholesale_price >= $${paramCounter}`);
        params.push(parsedStartPrice);
        paramCounter++;
    }

    const parsedStopPrice = parseFloat(stopPrice);
    if (!isNaN(parsedStopPrice)) {
        queryParts.push(`ast.wholesale_price <= $${paramCounter}`);
        params.push(parsedStopPrice);
        paramCounter++;
    }

    let sqlQuery = `
        SELECT 
            ast.id AS item_id, 
            ast.barcode, 
            ast.name AS item_name, 
            ast.generic_name,
            ast.unit_selling_price, 
            ast.wholesale_price,
            ast.wholesale_unit_id,
            wu.name AS wholesale_unit,
            COALESCE(ast.wholesale_multiplier, 1) AS wholesale_multiplier,
            ast.total_quantity_in_stock, 
            ast.last_cost_price, 
            categories.name AS category_name, 
            units.name AS unit_name 
        FROM all_stocks ast 
        LEFT JOIN units ON ast.unit_id = units.id 
        LEFT JOIN wholesale_units wu ON ast.wholesale_unit_id = wu.id
        LEFT JOIN categories ON ast.category_id = categories.id
    `;

    if (queryParts.length > 0) {
        sqlQuery += ' WHERE ' + queryParts.join(' AND ');
    }

    sqlQuery += ' ORDER BY ast.name ASC';

    try {
        const result = await db.query(sqlQuery, params);
        return result.rows;
    } catch (err) {
        console.error('Wholesale search error:', err);
        throw new Error(`Failed to perform wholesale search: ${err.message}`);
    }
}

let isWholesaleSchemaChecked = false;
async function ensureClientWholesaleIdColumn(db) {
    if (isWholesaleSchemaChecked) return;
    try {
        await db.query(`
            ALTER TABLE wholesales ADD COLUMN IF NOT EXISTS client_wholesale_id VARCHAR(100);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesales_client_wholesale_id ON wholesales (client_wholesale_id) WHERE client_wholesale_id IS NOT NULL;
        `);
        isWholesaleSchemaChecked = true;
    } catch (e) {
        console.warn('Note: client_wholesale_id check in wholesales:', e.message);
    }
}

/**
 * Record a Wholesale transaction (FEFO stock lot deduction with unit multipliers)
 */
export async function saveWholesale(userId, wholesaleData, db, res) {
    try {
        await ensureClientWholesaleIdColumn(db);
        await db.query('BEGIN');

        const items = wholesaleData.items;
        const totalDiscountValue = parseFloat(wholesaleData.totalDiscount) || 0;
        const clientWholesaleId = wholesaleData.clientWholesaleId || wholesaleData.client_wholesale_id || null;

        // Validation
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Invalid wholesale data provided. User ID and items array are required.' });
        }

        if (totalDiscountValue < 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Invalid discount value provided (cannot be negative).' });
        }

        // Idempotency Check: Avoid Duplicate Wholesales
        if (clientWholesaleId) {
            const existingWholesale = await db.query(
                `SELECT w.id, w.user_id, w.total_amount, w.discount_applied, w.wholesale_date, u.username 
                 FROM wholesales w 
                 LEFT JOIN users u ON w.user_id = u.id 
                 WHERE w.client_wholesale_id = $1;`,
                [clientWholesaleId]
            );

            if (existingWholesale.rows.length > 0) {
                await db.query('COMMIT');
                const wholesaleRecord = existingWholesale.rows[0];
                return {
                    wholesaleId: wholesaleRecord.id,
                    username: wholesaleRecord.username || 'Wholesale Rep',
                    wholesaleData: items,
                    totalAmount: parseFloat(wholesaleRecord.total_amount).toFixed(2),
                    discountApplied: parseFloat(wholesaleRecord.discount_applied).toFixed(2),
                    wholesaleDate: wholesaleRecord.wholesale_date,
                    isDuplicate: true
                };
            }
        }

        // 1. Create Initial Wholesale Header
        let totalWholesaleAmount = 0;
        const wholesaleResult = await db.query(
            `INSERT INTO wholesales (user_id, total_amount, discount_applied, customer_id, pay_route, bank_id, client_wholesale_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, wholesale_date;`,
            [
                userId,
                0.00,
                0.00,
                wholesaleData.customerId ? parseInt(wholesaleData.customerId, 10) : null,
                wholesaleData.payRoute || 'Cash',
                wholesaleData.bank ? parseInt(wholesaleData.bank, 10) : null,
                clientWholesaleId
            ]
        );
        const wholesaleId = wholesaleResult.rows[0].id;
        const wholesaleDate = wholesaleResult.rows[0].wholesale_date;

        // 2. Process Line Items (FEFO Stock Lot Deductions)
        for (const item of items) {
            const productId = item.productId || item.item_id;
            const quantity = Number(item.quantity); // Number of wholesale units (e.g., 5 packs)
            const unitMultiplier = Math.max(1, Number(item.unitMultiplier || item.wholesale_multiplier || 1));
            const wholesalePrice = parseFloat(item.wholesalePrice || item.sellPrice || item.selling_price || 0);
            const wholesaleUnitName = item.wholesaleUnit || item.wholesale_unit || 'Pack';

            const totalBaseUnitsToSell = quantity * unitMultiplier;

            if (quantity <= 0 || wholesalePrice < 0 || !productId) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Invalid wholesale item data. Product ID: ${productId}, Quantity: ${quantity}, Price: ${wholesalePrice}.`
                });
            }

            // Retrieve available lots sorted by expiry date (FEFO)
            const availableLotsResult = await db.query(
                `SELECT lot_id, quantity_in_lot, cost_per_unit, expiry_date
                 FROM stock_lots
                 WHERE product_id = $1 AND quantity_in_lot > 0
                 ORDER BY expiry_date ASC, entry_date ASC;`,
                [productId]
            );

            let currentTotalStock = 0;
            availableLotsResult.rows.forEach(lot => {
                currentTotalStock += Number(lot.quantity_in_lot);
            });

            if (currentTotalStock < totalBaseUnitsToSell) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product. Required: ${totalBaseUnitsToSell} base units (${quantity} ${wholesaleUnitName}s), Available: ${currentTotalStock} base units.`
                });
            }

            let remainingBaseUnitsToSell = totalBaseUnitsToSell;
            const soldFromLots = [];
            const lotUpdates = [];

            for (const lot of availableLotsResult.rows) {
                if (remainingBaseUnitsToSell <= 0) break;

                const deductFromLot = Math.min(remainingBaseUnitsToSell, Number(lot.quantity_in_lot));
                if (deductFromLot > 0) {
                    lotUpdates.push({
                        lotId: lot.lot_id,
                        quantity: deductFromLot
                    });
                    soldFromLots.push({
                        lotId: lot.lot_id,
                        quantity: deductFromLot,
                        costPerUnit: parseFloat(lot.cost_per_unit) || 0
                    });
                    remainingBaseUnitsToSell -= deductFromLot;
                }
            }

            // Batched stock_lots update
            const lotIds = lotUpdates.map(u => u.lotId);
            let caseStatement = `CASE lot_id `;
            lotUpdates.forEach(u => {
                caseStatement += `WHEN ${u.lotId} THEN quantity_in_lot - ${u.quantity} `;
            });
            caseStatement += `ELSE quantity_in_lot END`;

            if (lotIds.length > 0) {
                await db.query(
                    `UPDATE stock_lots
                     SET quantity_in_lot = ${caseStatement}
                     WHERE lot_id = ANY($1::int[]);`,
                    [lotIds]
                );
            }

            // Calculate line totals
            const lineItemWholesaleTotal = quantity * wholesalePrice;
            totalWholesaleAmount += lineItemWholesaleTotal;

            let wholesaleUnitId = item.wholesaleUnitId || item.wholesale_unit_id || null;
            if (!wholesaleUnitId && wholesaleUnitName) {
                const wuRes = await db.query('SELECT id FROM wholesale_units WHERE name = $1', [wholesaleUnitName]);
                if (wuRes.rows.length > 0) {
                    wholesaleUnitId = wuRes.rows[0].id;
                }
            }

            // Insert into wholesale_line_items
            for (const soldLot of soldFromLots) {
                const proportionOfLot = soldLot.quantity / totalBaseUnitsToSell;
                const lotPackShare = quantity * proportionOfLot;
                const lotCost = soldLot.quantity * soldLot.costPerUnit;

                await db.query(
                    `INSERT INTO wholesale_line_items 
                     (wholesale_id, product_id, lot_id, quantity_sold, wholesale_unit_id, unit_multiplier, total_base_units, selling_price_per_unit, cost_at_sale)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
                    [
                        wholesaleId,
                        productId,
                        soldLot.lotId,
                        lotPackShare,
                        wholesaleUnitId,
                        unitMultiplier,
                        soldLot.quantity,
                        wholesalePrice,
                        lotCost
                    ]
                );
            }

            // Log stock transaction for wholesale
            const newQty = currentTotalStock - totalBaseUnitsToSell;
            const primaryCost = soldFromLots[0]?.costPerUnit || 0;
            const totalCostImpact = totalBaseUnitsToSell * primaryCost;

            await logStockTransaction(db, {
                productId: productId,
                changeAmount: -totalBaseUnitsToSell,
                oldQty: currentTotalStock,
                newQty: newQty,
                changeType: 'Wholesale',
                costImpact: -totalCostImpact,
                userId: userId,
                wholesaleId: wholesaleId
            });
        }

        // 3. Apply Discount & Finalize Wholesale Total
        let discountToApply = totalDiscountValue;
        if (discountToApply > totalWholesaleAmount) {
            discountToApply = totalWholesaleAmount;
        }
        const finalNetWholesaleAmount = totalWholesaleAmount - discountToApply;

        const updatedWholesaleResult = await db.query(
            `UPDATE wholesales 
             SET total_amount = $1, discount_applied = $2 
             WHERE id = $3
             RETURNING id, user_id, total_amount, discount_applied, wholesale_date;`,
            [finalNetWholesaleAmount, discountToApply, wholesaleId]
        );
        const wholesaleRecord = updatedWholesaleResult.rows[0];

        const userResult = await db.query(`SELECT username FROM users WHERE id = $1;`, [wholesaleRecord.user_id]);
        const username = userResult.rows[0] ? userResult.rows[0].username : 'Unknown User';

        await db.query('COMMIT');

        return {
            wholesaleId: wholesaleRecord.id,
            username: username,
            wholesaleData: items,
            totalAmount: parseFloat(wholesaleRecord.total_amount).toFixed(2),
            discountApplied: parseFloat(wholesaleRecord.discount_applied).toFixed(2),
            wholesaleDate: wholesaleRecord.wholesale_date
        };

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing wholesale:', error);
        throw new Error(`Failed to process wholesale: ${error.message || 'Unknown error'}`);
    }
}
