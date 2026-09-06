import logStockTransaction from './updateStockChanges.js'; // Ensure path is correct

export default async function savePurchase(userId, purchaseData, db, res) {
    try {
        await db.query('BEGIN');

        const items = purchaseData.items;
        const supplierId = purchaseData.supplierId;

        // 1. Initial Validation
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid purchase data provided.' });
        }

        // 2. Create Purchase Header
        const purchaseResult = await db.query(
            `INSERT INTO purchases (user_id, total_amount, supplier_id) VALUES ($1, $2, $3) RETURNING id;`,
            [userId, 0.00, supplierId]
        );
        const purchaseId = purchaseResult.rows[0].id;

        let totalPurchaseAmount = 0;

        // 3. Loop through items
        for (const item of items) {
            const { item_id: productId, item_name: itemName, quantity: rawQty, unit_cost: rawUnitCost, unit_price: rawUnitSellPrice, expiry_date: expiryDate } = item;
            const quantity = parseFloat(rawQty) || 0;
            const unitCost = parseFloat(rawUnitCost) || 0;
            const unitSellPrice = parseFloat(rawUnitSellPrice) || 0;
            const displayName = itemName || `Product ID: ${productId}`;

            // Strict Validation
            if (quantity <= 0 || unitCost <= 0 || !productId || !expiryDate || String(expiryDate).trim() === '') {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Invalid item data or missing expiry date for ${displayName}` });
            }

            const eDate = new Date(expiryDate);
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            if (eDate < currentDate) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `${displayName} has an expiry date in the past.` });
            }

            if (parseFloat(unitCost) > parseFloat(unitSellPrice)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Unit cost cannot be greater than unit price for ${displayName}` });
            }

            const lineTotalCost = quantity * unitCost;
            totalPurchaseAmount += lineTotalCost;

            // A. Insert Line Item
            const purchaseLineResult = await db.query(
                `INSERT INTO purchase_line_items (purchase_id, product_id, quantity_purchased, cost_per_unit)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [purchaseId, productId, quantity, unitCost]
            );
            const purchaseLineItemId = purchaseLineResult.rows[0].id;

            // B. Create Stock Lot (This increases quantity via your database trigger)
            const lotResult = await db.query(
                `INSERT INTO stock_lots (product_id, quantity_in_lot, cost_per_unit, expiry_date)
                 VALUES ($1, $2, $3, $4) RETURNING lot_id;`,
                [productId, quantity, unitCost, expiryDate]
            );
            const newLotId = lotResult.rows[0].lot_id;

            // C. Link Lot to Line Item
            await db.query('UPDATE purchase_line_items SET lot_id = $1 WHERE id = $2', [newLotId, purchaseLineItemId]);

            // D. Fetch quantity for Ledger (The snapshot)
            // Note: If you have a trigger on stock_lots that updates total_quantity_in_stock, 
            // you need to fetch the 'new' quantity and subtract change to get 'old'
            const stockCheck = await db.query(
                `SELECT total_quantity_in_stock FROM all_stocks WHERE id = $1`,
                [productId]
            );

            const newTotalStock = parseInt(stockCheck.rows[0].total_quantity_in_stock);
            const oldTotalStock = newTotalStock - quantity; // Because the lot insert already added the quantity

            // E. Record Audit Log using your helper
            await logStockTransaction(db, {
                productId: productId,
                changeAmount: quantity,
                oldQty: oldTotalStock,
                newQty: newTotalStock,
                changeType: 'Purchase',
                costImpact: lineTotalCost, // Monetary value added to inventory
                userId: userId,
                purchaseId: purchaseId, // Links to this specific purchase
                lotId: newLotId
            });

            // F. Update Product Metadata (Prices)
            await db.query(
                `UPDATE all_stocks SET 
                    last_updated_date = NOW(),
                    unit_selling_price = $1 
                WHERE id = $2;`,
                [unitSellPrice, productId]
            );
        }

        // 4. Update Header Total
        await db.query(
            `UPDATE purchases SET total_amount = $1 WHERE id = $2;`,
            [totalPurchaseAmount, purchaseId]
        );

        await db.query('COMMIT');
        return { success: true, purchaseId: purchaseId };

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Purchase Error:', error.message);
        throw error;
    }
}