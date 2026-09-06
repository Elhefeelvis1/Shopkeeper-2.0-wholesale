export default async function checkTransaction(startDate, endDate, transactionType, user, db, res) {
    if (!startDate || !endDate) {
        return 'Start date and end date are required.';
    }

    const queryParts = [];
    const params = [];
    let paramCounter = 1;

    // --- 1. Dynamic WHERE Clause Construction ---

    // CORRECTED: Using 'sc.change_date' from the table schema
    if (startDate) {
        queryParts.push(`sc.change_date >= $${paramCounter}`);
        params.push(startDate);
        paramCounter++;
    }

    if (endDate) {
        queryParts.push(`sc.change_date < ($${paramCounter}::date + interval '1 day')`);
        params.push(endDate);
        paramCounter++;
    }

    if (transactionType !== 'all' && transactionType !== undefined) {
        queryParts.push(`sc.change_type = $${paramCounter}`);
        params.push(transactionType);
        paramCounter++;
    }

    // Convert user input to integer and validate
    if (user !== undefined && user !== null && user !== 'all') {
        const parsedUser = parseInt(user, 10);
        if (!isNaN(parsedUser) && parsedUser > 0) {
            queryParts.push(`sc.user_id = $${paramCounter}`);
            params.push(parsedUser);
            paramCounter++;
        } else {
            console.warn(`Invalid user value: ${user}`);
        }
    }

    // --- 2. Base SQL Query ---
    let sqlQuery = `
        SELECT
            sc.id AS change_id,
            sc.change_type,
            sc.change_date AS transaction_date,
            ast.name AS product_name,
            sc.quantity_change,
            sc.new_quantity,
            sc.cost_impact,
            u.username AS transacted_by,
            CASE
                WHEN sc.change_type = 'Sales' THEN s.id
                ELSE NULL
            END AS sale_id,
            CASE
                WHEN sc.change_type = 'Sales' THEN (
                    SELECT sli.selling_price_per_unit
                    FROM sale_line_items sli
                    WHERE sli.sale_id = sc.sale_id AND sli.product_id = sc.product_id
                    LIMIT 1 -- We only need one instance of the price for this product in this sale
                )
                ELSE NULL
            END AS selling_price_per_unit,
            CASE
                WHEN sc.change_type = 'Sales' THEN s.discount_applied
                ELSE NULL
            END AS sale_discount,
            CASE
                WHEN sc.change_type = 'Sales' THEN s.pay_route
                ELSE NULL
            END AS pay_route
        FROM
            stock_changes sc
        JOIN
            all_stocks ast ON sc.product_id = ast.id
        LEFT JOIN
            users u ON sc.user_id = u.id
        LEFT JOIN
            sales s ON sc.sale_id = s.id AND sc.change_type = 'Sales'
    `;

    // --- 3. Append Dynamic WHERE Clause ---
    if (queryParts.length > 0) {
        sqlQuery += ` WHERE ${queryParts.join(' AND ')}`;
    }

    // --- 4. Append ORDER BY Clause and Execution ---
    sqlQuery += ` ORDER BY sc.change_date DESC, sc.id DESC;`; // CORRECTED: Ordering by change_date

    try {
        const result = await db.query(sqlQuery, params);

        if (result.rows.length === 0) {
            return 'No transactions found for the specified criteria.';
        }

        return result.rows;

    } catch (error) {
        console.error('Database Error during transaction search:', error.message || error);
        throw new Error('Failed to retrieve transactions due to a server error.');
    }
} 