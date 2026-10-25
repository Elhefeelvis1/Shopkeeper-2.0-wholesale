import logStockTransaction from './updateStockChanges.js';

/**
 * Fetch detailed expiry data with filtering, sorting, and aggregate KPI statistics.
 */
export async function getExpiryData(params, db) {
    const {
        range = '1m', // 'expired', '1m', '3m', '6m', '1y', 'all'
        category = 'all',
        search = '',
        sortBy = 'expiry_asc'
    } = params;

    // 1. Fetch overall KPI aggregates across all active lots with an expiry date
    const kpiQuery = `
        SELECT
            COUNT(*) FILTER (WHERE sl.expiry_date < CURRENT_DATE) AS expired_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit) FILTER (WHERE sl.expiry_date < CURRENT_DATE), 0) AS expired_value,

            COUNT(*) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '30 days')) AS one_month_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '30 days')), 0) AS one_month_value,

            COUNT(*) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '90 days')) AS three_month_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '90 days')), 0) AS three_month_value,

            COUNT(*) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '180 days')) AS six_month_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '180 days')), 0) AS six_month_value,

            COUNT(*) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '365 days')) AS one_year_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit) FILTER (WHERE sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '365 days')), 0) AS one_year_value,

            COUNT(*) AS total_lots_count,
            COALESCE(SUM(sl.quantity_in_lot * sl.cost_per_unit), 0) AS total_at_risk_value
        FROM stock_lots sl
        WHERE sl.quantity_in_lot > 0 AND sl.expiry_date IS NOT NULL;
    `;
    const kpiRes = await db.query(kpiQuery);
    const kpis = kpiRes.rows[0] || {};

    // 2. Build filtered list query
    const whereClauses = [
        'sl.quantity_in_lot > 0',
        'sl.expiry_date IS NOT NULL'
    ];
    const queryParams = [];

    // Range conditions
    if (range === 'expired') {
        whereClauses.push('sl.expiry_date < CURRENT_DATE');
    } else if (range === '1m') {
        whereClauses.push("sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '30 days')");
    } else if (range === '3m') {
        whereClauses.push("sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '90 days')");
    } else if (range === '6m') {
        whereClauses.push("sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '180 days')");
    } else if (range === '1y') {
        whereClauses.push("sl.expiry_date >= CURRENT_DATE AND sl.expiry_date <= (CURRENT_DATE + interval '365 days')");
    }

    // Category filter
    if (category && category !== 'all') {
        queryParams.push(category);
        whereClauses.push(`ctg.name = $${queryParams.length}`);
    }

    // Search filter
    if (search && search.trim() !== '') {
        queryParams.push(`%${search.trim()}%`);
        const pIdx = queryParams.length;
        whereClauses.push(`(
            ast.name ILIKE $${pIdx} OR 
            ast.generic_name ILIKE $${pIdx} OR 
            ast.barcode ILIKE $${pIdx} OR 
            sl.lot_id::text ILIKE $${pIdx}
        )`);
    }

    // Sorting
    let orderByClause = 'ORDER BY sl.expiry_date ASC, ast.name ASC';
    if (sortBy === 'expiry_desc') {
        orderByClause = 'ORDER BY sl.expiry_date DESC, ast.name ASC';
    } else if (sortBy === 'qty_desc') {
        orderByClause = 'ORDER BY sl.quantity_in_lot DESC, sl.expiry_date ASC';
    } else if (sortBy === 'value_desc') {
        orderByClause = 'ORDER BY total_cost_value DESC';
    } else if (sortBy === 'name_asc') {
        orderByClause = 'ORDER BY ast.name ASC, sl.expiry_date ASC';
    }

    const listQuery = `
        SELECT 
            sl.lot_id,
            sl.product_id,
            sl.quantity_in_lot,
            sl.cost_per_unit,
            TO_CHAR(sl.expiry_date, 'YYYY-MM-DD') AS expiry_date,
            TO_CHAR(sl.entry_date, 'YYYY-MM-DD') AS entry_date,
            sl.is_closed,
            ast.name AS product_name,
            ast.generic_name,
            ast.barcode,
            ast.unit_selling_price,
            ast.wholesale_price,
            ast.total_quantity_in_stock,
            COALESCE(u.name, 'Unit') AS unit_name,
            COALESCE(wu.name, 'Wholesale Unit') AS wholesale_unit_name,
            COALESCE(ctg.name, 'Uncategorized') AS category_name,
            COALESCE(cmp.name, 'Unknown') AS company_name,
            (sl.expiry_date - CURRENT_DATE) AS days_until_expiry,
            ROUND((sl.quantity_in_lot * sl.cost_per_unit)::numeric, 2) AS total_cost_value,
            ROUND((sl.quantity_in_lot * ast.unit_selling_price)::numeric, 2) AS total_retail_value
        FROM stock_lots sl
        JOIN all_stocks ast ON sl.product_id = ast.id
        LEFT JOIN units u ON ast.unit_id = u.id
        LEFT JOIN wholesale_units wu ON ast.wholesale_unit_id = wu.id
        LEFT JOIN categories ctg ON ast.category_id = ctg.id
        LEFT JOIN companies cmp ON ast.company_id = cmp.id
        WHERE ${whereClauses.join(' AND ')}
        ${orderByClause};
    `;

    const listRes = await db.query(listQuery, queryParams);

    return {
        summary: {
            expiredCount: parseInt(kpis.expired_count || 0, 10),
            expiredCostValue: parseFloat(kpis.expired_value || 0),
            oneMonthCount: parseInt(kpis.one_month_count || 0, 10),
            oneMonthCostValue: parseFloat(kpis.one_month_value || 0),
            threeMonthCount: parseInt(kpis.three_month_count || 0, 10),
            threeMonthCostValue: parseFloat(kpis.three_month_value || 0),
            sixMonthCount: parseInt(kpis.six_month_count || 0, 10),
            sixMonthCostValue: parseFloat(kpis.six_month_value || 0),
            oneYearCount: parseInt(kpis.one_year_count || 0, 10),
            oneYearCostValue: parseFloat(kpis.one_year_value || 0),
            totalLotsCount: parseInt(kpis.total_lots_count || 0, 10),
            totalAtRiskCostValue: parseFloat(kpis.total_at_risk_value || 0)
        },
        items: listRes.rows
    };
}

/**
 * Fast summary for Dashboard Alert Banner
 */
export async function getExpiryAlertSummary(db) {
    try {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired_count,
                COALESCE(SUM(quantity_in_lot * cost_per_unit) FILTER (WHERE expiry_date < CURRENT_DATE), 0) AS expired_value,
                COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= (CURRENT_DATE + interval '30 days')) AS critical_count,
                COALESCE(SUM(quantity_in_lot * cost_per_unit) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= (CURRENT_DATE + interval '30 days')), 0) AS critical_value
            FROM stock_lots
            WHERE quantity_in_lot > 0 AND expiry_date IS NOT NULL;
        `;
        const res = await db.query(query);
        const row = res.rows[0] || {};
        return {
            expiredCount: parseInt(row.expired_count || 0, 10),
            expiredValue: parseFloat(row.expired_value || 0),
            criticalCount: parseInt(row.critical_count || 0, 10),
            criticalValue: parseFloat(row.critical_value || 0)
        };
    } catch (err) {
        console.error('Error fetching expiry alert summary:', err);
        return { expiredCount: 0, expiredValue: 0, criticalCount: 0, criticalValue: 0 };
    }
}

/**
 * Write off specific expired stock lots with transaction audit logging
 */
export async function writeOffLots(client, userId, items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required for writing off expired stock.');
    }

    for (const item of items) {
        const lotId = parseInt(item.lotId, 10);
        const productId = parseInt(item.productId, 10);
        const writeOffQty = parseFloat(item.quantity);

        if (isNaN(writeOffQty) || writeOffQty <= 0) {
            throw new Error(`Invalid write-off quantity for lot ${lotId || 'unknown'}`);
        }

        // Verify lot exists and has enough quantity
        const lotRes = await client.query(
            `SELECT lot_id, product_id, quantity_in_lot, cost_per_unit, expiry_date 
             FROM stock_lots 
             WHERE lot_id = $1 FOR UPDATE`,
            [lotId]
        );

        if (lotRes.rows.length === 0) {
            throw new Error(`Stock lot #${lotId} not found.`);
        }

        const lot = lotRes.rows[0];
        const currentLotQty = parseFloat(lot.quantity_in_lot || 0);

        if (currentLotQty < writeOffQty) {
            throw new Error(`Requested write-off quantity (${writeOffQty}) exceeds available lot quantity (${currentLotQty}) for lot #${lotId}.`);
        }

        const costPerUnit = parseFloat(lot.cost_per_unit || 0);
        const costImpact = -(writeOffQty * costPerUnit);
        const newLotQty = currentLotQty - writeOffQty;
        const isClosed = newLotQty <= 0;

        // Fetch current total quantity in all_stocks for logging snapshot
        const stockRes = await client.query(
            `SELECT total_quantity_in_stock FROM all_stocks WHERE id = $1`,
            [lot.product_id]
        );
        const initialTotal = parseFloat(stockRes.rows[0]?.total_quantity_in_stock || 0);
        const newTotal = Math.max(0, initialTotal - writeOffQty);

        // Update the stock lot
        await client.query(
            `UPDATE stock_lots 
             SET quantity_in_lot = $1, is_closed = $2, last_updated_date = CURRENT_TIMESTAMP 
             WHERE lot_id = $3`,
            [newLotQty, isClosed, lotId]
        );

        // Explicitly update all_stocks total in case DB trigger is absent
        await client.query(
            `UPDATE all_stocks 
             SET total_quantity_in_stock = (
                 SELECT COALESCE(SUM(quantity_in_lot), 0) FROM stock_lots WHERE product_id = $1
             ),
             last_updated_date = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [lot.product_id]
        );

        // Log the stock change transaction
        await logStockTransaction(client, {
            productId: lot.product_id,
            changeAmount: -writeOffQty,
            oldQty: initialTotal,
            newQty: newTotal,
            changeType: 'Expired',
            costImpact,
            userId,
            lotId
        });
    }
}

/**
 * Update the expiry date for a specific stock lot (e.g. to fix a mistake made during purchase).
 * If newExpiryDate is null or empty, it sets expiry_date to NULL (for non-perishables).
 */
export async function updateLotExpiryDate(clientOrDb, lotId, newExpiryDate) {
    const parsedLotId = parseInt(lotId, 10);
    if (isNaN(parsedLotId) || parsedLotId <= 0) {
        throw new Error("Invalid stock lot ID.");
    }

    let formattedDate = null;
    if (newExpiryDate && String(newExpiryDate).trim() !== '') {
        const d = new Date(newExpiryDate);
        if (isNaN(d.getTime())) {
            throw new Error("Invalid date format. Please provide a valid expiry date.");
        }
        formattedDate = String(newExpiryDate).trim().slice(0, 10);
    }

    const result = await clientOrDb.query(
        `UPDATE stock_lots 
         SET expiry_date = $1, last_updated_date = CURRENT_TIMESTAMP 
         WHERE lot_id = $2
         RETURNING lot_id, product_id, expiry_date, quantity_in_lot;`,
        [formattedDate, parsedLotId]
    );

    if (result.rowCount === 0) {
        throw new Error(`Stock lot #${parsedLotId} not found.`);
    }

    return result.rows[0];
}
