export async function getExpenses(startDate, endDate, db) {
    try {
        const query = `
            SELECT e.id, e.amount, e.description, TO_CHAR(e.date, 'YYYY-MM-DD') as date, u.username 
            FROM expenses e
            LEFT JOIN users u ON e.user_id = u.id
            WHERE e.date >= $1::date AND e.date < ($2::date + interval '1 day')
            ORDER BY e.date DESC, e.id DESC
        `;
        const res = await db.query(query, [startDate, endDate]);
        return res.rows;
    } catch (err) {
        throw err;
    }
}

export async function addExpense(amount, description, date, userId, db) {
    try {
        const query = `
            INSERT INTO expenses (amount, description, date, user_id) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id, amount, description, TO_CHAR(date, 'YYYY-MM-DD') as date
        `;
        const res = await db.query(query, [amount, description, date, userId]);
        return res.rows[0];
    } catch (err) {
        throw err;
    }
}

export async function deleteExpense(id, db) {
    try {
        const query = `DELETE FROM expenses WHERE id = $1 RETURNING id`;
        const res = await db.query(query, [id]);
        return res.rows[0];
    } catch (err) {
        throw err;
    }
}

export async function getBanks(db) {
    try {
        const query = `SELECT id, bank_name, account_number FROM banks ORDER BY bank_name ASC`;
        const res = await db.query(query);
        return res.rows;
    } catch (err) {
        throw err;
    }
}

export async function addBank(bankName, accountNumber, db) {
    try {
        // accountNumber could be empty or null
        const query = `
            INSERT INTO banks (bank_name, account_number) 
            VALUES ($1, $2) 
            RETURNING id, bank_name, account_number
        `;
        const res = await db.query(query, [bankName, accountNumber || null]);
        return res.rows[0];
    } catch (err) {
        throw err;
    }
}

export async function updateBank(id, bankName, accountNumber, db) {
    try {
        const query = `
            UPDATE banks 
            SET bank_name = $1, account_number = $2 
            WHERE id = $3 
            RETURNING id, bank_name, account_number
        `;
        const res = await db.query(query, [bankName, accountNumber || null, id]);
        return res.rows[0];
    } catch (err) {
        throw err;
    }
}

export async function deleteBank(id, db) {
    try {
        const query = `DELETE FROM banks WHERE id = $1 RETURNING id`;
        const res = await db.query(query, [id]);
        return res.rows[0];
    } catch (err) {
        throw err;
    }
}
