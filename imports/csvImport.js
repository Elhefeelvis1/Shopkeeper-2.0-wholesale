export const allowedTables = ['all_stocks', 'customers', 'suppliers', 'categories', 'units', 'companies'];

export const importGenericCsv = async (req, res, db) => {
    try {
        const { tableName, mappings, data } = req.body;
        
        if (!allowedTables.includes(tableName)) {
            return res.status(403).json({ success: false, message: "Table not allowed for import" });
        }
        
        if (!data || data.length === 0) {
            return res.status(400).json({ success: false, message: "No data provided" });
        }

        // Get actual schema to validate mappings
        const schemaResult = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public';
        `, [tableName]);
        const schemaCols = schemaResult.rows.map(r => r.column_name);
        const schemaTypes = {};
        schemaResult.rows.forEach(r => { schemaTypes[r.column_name] = r.data_type; });

        const targetCols = Object.keys(mappings).filter(col => schemaCols.includes(col));
        if (targetCols.length === 0) {
            return res.status(400).json({ success: false, message: "No valid mappings provided" });
        }

        await db.query('BEGIN');
        
        let insertedCount = 0;
        for (const row of data) {
            const cols = [];
            const vals = [];
            const params = [];
            let pCounter = 1;

            for (const tCol of targetCols) {
                const csvCol = mappings[tCol];
                if (row[csvCol] !== undefined && row[csvCol] !== null && row[csvCol] !== "") {
                    let val = row[csvCol];
                    const dataType = schemaTypes[tCol];
                    if (dataType && ['numeric', 'integer', 'real', 'double precision', 'decimal', 'money'].includes(dataType) && typeof val === 'string') {
                        val = val.replace(/,/g, '');
                    }
                    cols.push(tCol);
                    params.push(val);
                    vals.push(`$${pCounter}`);
                    pCounter++;
                }
            }

            if (cols.length > 0) {
                const query = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
                await db.query(query, params);
                insertedCount++;
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, message: `Successfully imported ${insertedCount} rows into ${tableName}` });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Bulk import error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

export const importStocksCsv = async (req, res, db) => {
    try {
        const { mappings, data } = req.body;
        
        if (!data || data.length === 0) {
            return res.status(400).json({ success: false, message: "No data provided" });
        }

        // 1. Dry-run Validation Phase
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const qtyCol = mappings['quantity'];
            const qtyStr = qtyCol && row[qtyCol] ? String(row[qtyCol]).replace(/,/g, '') : '0';
            const quantity = parseFloat(qtyStr);
            
            if (quantity > 0) {
                const expiryCol = mappings['expiry_date'];
                const costCol = mappings['cost_per_unit'];
                
                if (!costCol || !row[costCol]) {
                    return res.status(400).json({ success: false, message: `Validation Failed: Row ${i + 1} has quantity > 0 but is missing a cost per unit.` });
                }

                if (expiryCol && row[expiryCol] && String(row[expiryCol]).trim() !== '') {
                    const expiryDate = new Date(row[expiryCol]);
                    const currentDate = new Date();
                    currentDate.setHours(0, 0, 0, 0);

                    if (expiryDate < currentDate) {
                        const itemName = mappings['name'] ? row[mappings['name']] : 'Unknown Item';
                        return res.status(400).json({ success: false, message: `Validation Failed: Item "${itemName}" on row ${i + 1} has an expiry date in the past.` });
                    }
                }
            }
            
            // Validate required fields for all_stocks
            const unitCol = mappings['unit'];
            if (!unitCol || !row[unitCol]) {
                return res.status(400).json({ success: false, message: `Validation Failed: Row ${i + 1} is missing the required unit field.` });
            }
            
            const nameCol = mappings['name'];
            if (!nameCol || !row[nameCol]) {
                 return res.status(400).json({ success: false, message: `Validation Failed: Row ${i + 1} is missing the required name field.` });
            }
            
            const priceCol = mappings['unit_selling_price'];
            if (!priceCol || !row[priceCol]) {
                 return res.status(400).json({ success: false, message: `Validation Failed: Row ${i + 1} is missing the required unit_selling_price field.` });
            }
            
            const reorderCol = mappings['reorder_level'];
            if (!reorderCol || row[reorderCol] === undefined || row[reorderCol] === "") {
                 return res.status(400).json({ success: false, message: `Validation Failed: Row ${i + 1} is missing the required reorder_level field.` });
            }
        }

        const userId = req.user ? req.user.id : (req.session?.passport?.user?.id || 1);

        const actualSchemaResult = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'all_stocks' AND table_schema = 'public';
        `);
        const allStockValidCols = actualSchemaResult.rows.map(r => r.column_name);
        const allStockTypes = {};
        actualSchemaResult.rows.forEach(r => { allStockTypes[r.column_name] = r.data_type; });

        // 2. Database Transaction Phase
        await db.query('BEGIN');
        
        let insertedCount = 0;
        
        for (const row of data) {
            // Resolve Unit ID
            let unitId = null;
            const unitCol = mappings['unit'];
            const unitName = row[unitCol];
            const unitRes = await db.query('SELECT id FROM units WHERE name = $1', [unitName]);
            if (unitRes.rows.length > 0) {
                unitId = unitRes.rows[0].id;
            } else {
                const newUnit = await db.query('INSERT INTO units (name) VALUES ($1) RETURNING id', [unitName]);
                unitId = newUnit.rows[0].id;
            }

            // Resolve Category ID
            let categoryId = null;
            const catCol = mappings['category'];
            if (catCol && row[catCol]) {
                const catName = row[catCol];
                const catRes = await db.query('SELECT id FROM categories WHERE name = $1', [catName]);
                if (catRes.rows.length > 0) {
                    categoryId = catRes.rows[0].id;
                } else {
                    const newCat = await db.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [catName]);
                    categoryId = newCat.rows[0].id;
                }
            } else {
                categoryId = 0; // Uncategorized default
            }

            // Resolve Company ID
            let companyId = null;
            const compCol = mappings['company'];
            if (compCol && row[compCol]) {
                const compName = row[compCol];
                const compRes = await db.query('SELECT id FROM companies WHERE name = $1', [compName]);
                if (compRes.rows.length > 0) {
                    companyId = compRes.rows[0].id;
                } else {
                    const newComp = await db.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [compName]);
                    companyId = newComp.rows[0].id;
                }
            } else {
                companyId = 0; // Unknown Company default
            }

            // Build all_stocks insert
            const stockCols = ['unit_id', 'category_id', 'company_id', 'user_id'];
            const stockVals = [unitId, categoryId, companyId, userId];
            
            for (const [dbCol, csvCol] of Object.entries(mappings)) {
                // Ignore virtual columns and overridden IDs
                if (['unit', 'category', 'company', 'quantity', 'cost_per_unit', 'expiry_date', 'unit_id', 'category_id', 'company_id', 'user_id'].includes(dbCol)) {
                    continue;
                }
                
                if (allStockValidCols.includes(dbCol)) {
                    if (row[csvCol] !== undefined && row[csvCol] !== null && row[csvCol] !== "") {
                        let val = row[csvCol];
                        const dataType = allStockTypes[dbCol];
                        if (dataType && ['numeric', 'integer', 'real', 'double precision', 'decimal', 'money'].includes(dataType) && typeof val === 'string') {
                            val = val.replace(/,/g, '');
                        }
                        stockCols.push(dbCol);
                        stockVals.push(val);
                    }
                }
            }
            
            const paramsList = stockCols.map((_, i) => `$${i + 1}`).join(', ');
            const insertQuery = `INSERT INTO all_stocks (${stockCols.join(', ')}) VALUES (${paramsList}) RETURNING id`;
            const result = await db.query(insertQuery, stockVals);
            const productId = result.rows[0].id;
            
            // Handle stock_lots if quantity > 0
            const qtyCol = mappings['quantity'];
            const qtyStr = qtyCol && row[qtyCol] ? String(row[qtyCol]).replace(/,/g, '') : '0';
            const quantity = parseFloat(qtyStr);
            if (quantity > 0) {
                const costCol = mappings['cost_per_unit'];
                let costVal = row[costCol];
                if (typeof costVal === 'string') {
                    costVal = costVal.replace(/,/g, '');
                }
                const expiryCol = mappings['expiry_date'];
                
                const expiryDateVal = (expiryCol && row[expiryCol] && String(row[expiryCol]).trim() !== '') ? row[expiryCol] : null;

                await db.query(`
                    INSERT INTO stock_lots (product_id, quantity_in_lot, cost_per_unit, expiry_date)
                    VALUES ($1, $2, $3, $4)
                `, [productId, quantity, costVal, expiryDateVal]);
            }
            
            insertedCount++;
        }
        
        await db.query('COMMIT');
        res.json({ success: true, message: `Successfully imported ${insertedCount} stock items.` });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Bulk stock import error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
