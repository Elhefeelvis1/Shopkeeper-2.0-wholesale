export async function addNew(name, tableName, db){
    try{
        const result = await db.query(`INSERT INTO ${tableName} (name) VALUES ($1) RETURNING *`,
        [name]);

        return result.rows[0];

    }catch(err){
        console.error('Database query error:', err);
        throw new Error(`Failed to add new item: ${err.message}`);
    }
}

export async function edit(name, id, tableName, db){
    try{
        const result = await db.query(`UPDATE ${tableName} SET name = $1 WHERE id = $2 RETURNING *`,
        [name, id]);
        
        if (result.rowCount === 0) {
            throw new Error(`Item with id ${id} not found.`);
        }
        return result.rows[0];

    }catch(err){
        console.error('Database query error:', err);
        throw new Error(`Failed to edit item: ${err.message}`);
    }
}

export async function deleteLabel(id, tableName, db){
    try{
        const result = await db.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`,
        [id]);
        
        if (result.rowCount === 0) {
            throw new Error(`Item with id ${id} not found.`);
        }
        return result.rows[0];

    }catch(err){
        console.error('Database query error:', err);
        if (err.code === '23503') { // Foreign key constraint violation code in Postgres
            throw new Error(`Cannot delete this item because it is referenced by existing products or records.`);
        }
        throw new Error(`Failed to delete item: ${err.message}`);
    }
}