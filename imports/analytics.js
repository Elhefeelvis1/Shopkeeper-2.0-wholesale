export async function getMainMetrics(startDate, endDate, db) {
    const values = [startDate, endDate];

    try {
        // Total Sales (Revenue)
        const salesRes = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) AS total_sales 
            FROM sales 
            WHERE sale_date >= $1::date AND sale_date < ($2::date + interval '1 day')
        `, values);
        const totalSales = parseFloat(salesRes.rows[0].total_sales);

        // Total COGS and Items Sold
        // Note: sli.cost_at_sale already stores (quantity_sold * costPerUnit) for the line item
        const cogsRes = await db.query(`
            SELECT COALESCE(SUM(sli.cost_at_sale), 0) AS total_cogs,
                   COALESCE(SUM(sli.quantity_sold), 0) AS items_sold
            FROM sale_line_items sli
            JOIN sales s ON sli.sale_id = s.id
            WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + interval '1 day')
        `, values);
        const totalCogs = parseFloat(cogsRes.rows[0].total_cogs);
        const itemsSold = parseInt(cogsRes.rows[0].items_sold);

        // Total Expenses
        const expensesRes = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS total_expenses 
            FROM expenses 
            WHERE date >= $1::date AND date < ($2::date + interval '1 day')
        `, values);
        const totalExpenses = parseFloat(expensesRes.rows[0].total_expenses);

        const grossProfit = totalSales - totalCogs;
        const netProfit = grossProfit - totalExpenses;

        // Best Staff
        const bestStaffRes = await db.query(`
            SELECT u.username, COALESCE(SUM(s.total_amount), 0) AS total_sales 
            FROM sales s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + interval '1 day') 
            GROUP BY u.id, u.username 
            ORDER BY total_sales DESC 
            LIMIT 1
        `, values);
        const bestStaff = bestStaffRes.rows.length > 0 ? bestStaffRes.rows[0] : null;

        // Best Customer
        const bestCustomerRes = await db.query(`
            SELECT c.name, COALESCE(SUM(s.total_amount), 0) AS total_sales 
            FROM sales s 
            JOIN customers c ON s.customer_id = c.id 
            WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + interval '1 day') 
            GROUP BY c.id, c.name
            ORDER BY total_sales DESC 
            LIMIT 1
        `, values);
        const bestCustomer = bestCustomerRes.rows.length > 0 ? bestCustomerRes.rows[0] : null;

        // Top Supplier
        const topSupplierRes = await db.query(`
            SELECT sup.name, COALESCE(SUM(p.total_amount), 0) AS total_purchased 
            FROM purchases p 
            JOIN suppliers sup ON p.supplier_id = sup.id 
            WHERE p.date >= $1::date AND p.date < ($2::date + interval '1 day') 
            GROUP BY sup.id, sup.name
            ORDER BY total_purchased DESC 
            LIMIT 1
        `, values);
        const topSupplier = topSupplierRes.rows.length > 0 ? topSupplierRes.rows[0] : null;

        // Chart Data (Sales by Date)
        const chartDataRes = await db.query(`
            SELECT TO_CHAR(DATE(sale_date), 'YYYY-MM-DD') as date, SUM(total_amount) as sales 
            FROM sales 
            WHERE sale_date >= $1::date AND sale_date < ($2::date + interval '1 day') 
            GROUP BY DATE(sale_date) 
            ORDER BY DATE(sale_date)
        `, values);
        
        return {
            totalSales,
            grossProfit,
            netProfit,
            itemsSold,
            bestStaff,
            bestCustomer,
            topSupplier,
            chartData: chartDataRes.rows
        };
    } catch (err) {
        console.error("Error in getMainMetrics:", err);
        throw err;
    }
}

export async function getStaffPerformance(staffId, startDate, endDate, db) {
    try {
        const values = [startDate, endDate];
        let salesFilter = `WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + interval '1 day')`;
        if (staffId) {
            values.push(staffId);
            salesFilter += ` AND s.user_id = $3`;
        }

        const metricsRes = await db.query(`
            SELECT u.id, u.username,
                   COALESCE(sales_summary.total_sales, 0) AS total_sales,
                   COALESCE(sales_summary.total_transactions, 0) AS total_transactions,
                   COALESCE(items_summary.items_sold, 0) AS items_sold,
                   COALESCE(sales_summary.total_sales - COALESCE(items_summary.total_cogs, 0), 0) AS profit_generated
            FROM users u
            JOIN (
                SELECT s.user_id,
                       SUM(s.total_amount) AS total_sales,
                       COUNT(s.id) AS total_transactions
                FROM sales s
                ${salesFilter}
                GROUP BY s.user_id
            ) sales_summary ON u.id = sales_summary.user_id
            LEFT JOIN (
                SELECT s.user_id,
                       SUM(sli.quantity_sold) AS items_sold,
                       SUM(sli.cost_at_sale) AS total_cogs
                FROM sale_line_items sli
                JOIN sales s ON sli.sale_id = s.id
                ${salesFilter}
                GROUP BY s.user_id
            ) items_summary ON u.id = items_summary.user_id
            ORDER BY total_sales DESC
        `, values);

        return metricsRes.rows;
    } catch (err) {
        console.error("Error in getStaffPerformance:", err);
        throw err;
    }
}

export async function getCustomersAnalytics(searchQuery, offset, limit, startDate, endDate, db) {
    try {
        const values = [limit, offset];
        let paramIndex = 3;
        
        let dateFilterSales = "";
        if (startDate && endDate) {
            values.push(startDate, endDate);
            dateFilterSales = `WHERE s.sale_date >= $${paramIndex}::date AND s.sale_date < ($${paramIndex + 1}::date + interval '1 day')`;
            paramIndex += 2;
        }

        let searchCondition = "";
        if (searchQuery) {
            values.push(`%${searchQuery}%`);
            searchCondition = `WHERE c.name ILIKE $${paramIndex} OR c.phone_number::text ILIKE $${paramIndex}`;
            paramIndex++;
        }

        const query = `
            SELECT c.id, c.name, c.phone_number, c.email,
                   COALESCE(s_summary.amount_spent, 0) AS amount_spent,
                   COALESCE(s_summary.total_discounts, 0) AS total_discounts,
                   COALESCE(sli_summary.items_bought, 0) AS items_bought,
                   COALESCE(s_summary.total_transactions, 0) AS total_transactions
            FROM customers c
            LEFT JOIN (
                SELECT s.customer_id,
                       SUM(s.total_amount) AS amount_spent,
                       SUM(s.discount_applied) AS total_discounts,
                       COUNT(s.id) AS total_transactions
                FROM sales s
                ${dateFilterSales}
                GROUP BY s.customer_id
            ) s_summary ON c.id = s_summary.customer_id
            LEFT JOIN (
                SELECT s.customer_id,
                       SUM(sli.quantity_sold) AS items_bought
                FROM sale_line_items sli
                JOIN sales s ON sli.sale_id = s.id
                ${dateFilterSales}
                GROUP BY s.customer_id
            ) sli_summary ON c.id = sli_summary.customer_id
            ${searchCondition}
            ORDER BY c.name ASC
            LIMIT $1 OFFSET $2
        `;

        const res = await db.query(query, values);
        
        // Get total count for pagination
        const countValues = [];
        let countParam = 1;
        let countSearchCondition = "";
        if (searchQuery) {
            countValues.push(`%${searchQuery}%`);
            countSearchCondition = `WHERE c.name ILIKE $${countParam} OR c.phone_number::text ILIKE $${countParam}`;
        }
        
        const countQuery = `SELECT COUNT(*) FROM customers c ${countSearchCondition}`;
        const countRes = await db.query(countQuery, countValues);

        return {
            customers: res.rows,
            totalCount: parseInt(countRes.rows[0].count)
        };
    } catch (err) {
        console.error("Error in getCustomersAnalytics:", err);
        throw err;
    }
}

export async function getProductPerformance(startDate, endDate, limit, sort, db) {
    const orderDirection = sort === 'worst' ? 'ASC' : 'DESC';
    const limitValue = limit ? parseInt(limit) : 50;

    const query = `
        SELECT 
            ast.id AS product_id,
            ast.name AS product_name,
            ast.total_quantity_in_stock AS remaining_in_stock,
            SUM(sli.quantity_sold) AS number_sold,
            SUM(sli.quantity_sold * sli.selling_price_per_unit) AS total_amount,
            SUM((sli.quantity_sold * sli.selling_price_per_unit) - sli.cost_at_sale) AS profit,
            MAX(s.sale_date) AS last_sold
        FROM sale_line_items sli
        JOIN sales s ON sli.sale_id = s.id
        JOIN all_stocks ast ON sli.product_id = ast.id
        WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + interval '1 day')
        GROUP BY ast.id, ast.name, ast.total_quantity_in_stock
        ORDER BY number_sold ${orderDirection}
        LIMIT $3
    `;
    
    try {
        const res = await db.query(query, [startDate, endDate, limitValue]);
        return res.rows;
    } catch (err) {
        console.error("Error in getProductPerformance:", err);
        throw err;
    }
}
