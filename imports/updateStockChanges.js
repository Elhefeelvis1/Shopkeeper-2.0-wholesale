export default async function logStockTransaction(client, {
    productId, 
    changeAmount, 
    oldQty, 
    newQty, 
    changeType, 
    costImpact = 0,
    userId, 
    saleId = null,
    purchaseId = null,
    lotId = null 
}) {
    const queryText = `
        INSERT INTO stock_changes (
            product_id, 
            change_type, 
            quantity_change, 
            old_quantity, 
            new_quantity, 
            cost_impact,
            user_id,
            sale_id,
            purchase_id,
            lot_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id;
    `;

    const values = [
        productId,
        changeType,
        changeAmount,
        oldQty,
        newQty,
        costImpact,
        userId,
        saleId,
        purchaseId,
        lotId
    ];

    try {
        const result = await client.query(queryText, values);
        return result.rows[0].id;
    } catch (error) {
        console.error("Failed to log stock transaction:", error);
        throw error; 
    }
}