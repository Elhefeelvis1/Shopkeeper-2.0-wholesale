import logStockTransaction from './updateStockChanges.js';

export default async function adjustment(client, userId, items, adjustmentType) {
    try {
        await client.query('BEGIN');

        for (const item of items) {
            const productId = item.item_id;
            const adjustmentQty = parseInt(item.adjustment_qty);
            const currentTotalStock = Number(item.current_qty);

            if (adjustmentQty === 0) continue;

            if (adjustmentQty > 0) {
                // --- CASE 1: EXCESS ---
                const result = await client.query(`
                    INSERT INTO stock_lots (product_id, quantity_in_lot, cost_per_unit, expiry_date)
                    VALUES ($1, $2, $3, NULL) RETURNING lot_id;
                `, [productId, adjustmentQty, item.last_cost_price || 0]);

                await logStockTransaction(client, {
                    productId: productId,
                    changeAmount: adjustmentQty,
                    oldQty: currentTotalStock,
                    newQty: currentTotalStock + adjustmentQty,
                    changeType: adjustmentType,
                    costImpact: (item.last_cost_price || 0) * adjustmentQty,
                    userId: userId,
                    lotId: result.rows[0].lot_id,
                });

            } else {
                // --- CASE 2: SHORTAGE ---
                const qtyToReduce = Math.abs(adjustmentQty);

                const availableLotsResult = await client.query(`
                    SELECT lot_id, quantity_in_lot, cost_per_unit 
                    FROM stock_lots
                    WHERE product_id = $1 AND quantity_in_lot > 0
                    ORDER BY expiry_date ASC NULLS LAST, entry_date ASC;
                `, [productId]);

                let remainingToReduce = qtyToReduce;
                const lotUpdates = [];

                for (const lot of availableLotsResult.rows) {
                    if (remainingToReduce <= 0) break;
                    const reductionFromLot = Math.min(remainingToReduce, lot.quantity_in_lot);
                    if (reductionFromLot > 0) {
                        lotUpdates.push({ lotId: lot.lot_id, quantity: reductionFromLot });
                        remainingToReduce -= reductionFromLot;
                    }
                }

                if (remainingToReduce > 0) {
                    throw new Error(`Insufficient stock for Product ${productId}.`);
                }

                const lotIds = lotUpdates.map(u => u.lotId);
                let caseStatement = `CASE lot_id `;
                lotUpdates.forEach(u => {
                    caseStatement += `WHEN ${u.lotId} THEN quantity_in_lot - ${u.quantity} `;
                });
                caseStatement += `ELSE quantity_in_lot END`;

                await client.query(`
                    UPDATE stock_lots
                    SET quantity_in_lot = ${caseStatement}
                    WHERE lot_id = ANY($1::int[]);
                `, [lotIds]);

                await logStockTransaction(client, {
                    productId: productId,
                    changeAmount: adjustmentQty,
                    oldQty: currentTotalStock,
                    newQty: currentTotalStock + adjustmentQty,
                    changeType: adjustmentType,
                    costImpact: (item.last_cost_price || 0) * adjustmentQty,
                    userId: userId
                });
            }
        }

        await client.query('COMMIT');
        return { success: true };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}