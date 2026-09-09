import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from "passport-local";
import env from "dotenv";
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Importing database login from another file(ignored on git)
import db from "./imports/dbConn.js";
// Importing login and register from imports folder
import * as userAuth from "./imports/login_register.js";
// Importing add/edit labels functions
import * as addEdit from "./imports/add_edit_labels.js";
// Importing add/edit labels functions
import * as sales from "./imports/salesLogic.js";
// Importing wholesaleLogic functions
import * as wholesale from "./imports/wholesaleLogic.js";
// Importing checkTransaction function
import checkTransaction from './imports/checkTransaction.js';
// importing addPurchase function
import savePurchase from './imports/addPurchase.js';
// importing internal stock updates
import { saveReturn, removeStock } from './imports/internalStockUpdates.js';
// import analytics module
import * as analytics from './imports/analytics.js';
// import dashboard data module
import * as dashboardData from './imports/dashboardData.js';
// Importing adjustment logic
import adjustment from './imports/adjustmentLogic.js';
// Importing csv import logic
import * as csvImport from './imports/csvImport.js';

const app = express();
const port = 3000;
const HOST = '0.0.0.0'; // Listens on all local network paths
const saltRounds = 5;
env.config();

app.use(express.json({ limit: '50mb' })); // To parse JSON bodies
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static("public"));

// Express Session
app.use(session({
    secret: process.env.SECRET_SESSION || 'fallback-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    } //24hrs cookie
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//Starting database connection
db.connect();

// ---- Auth / Role Middleware ----

// Requires an active login session
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() && req.user) return next();
    res.status(401).json({ success: false, message: 'Unauthorized: Please log in to continue.' });
};

// Requires administrator role
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.role === 'administrator') return next();
    res.status(403).json({ success: false, message: "You don't have permission to access this page. Contact your admin or developer." });
};

// API ROUTES

app.get("/api/shopDetails", isAdmin, async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        // Extract the object part using regex
        const match = fileContent.match(/const\s+shopDetails\s*=\s*({[\s\S]*?})/);
        if (match && match[1]) {
            // Using a safe eval (new Function) to parse the string object
            const shopDetails = new Function(`return ${match[1]}`)();
            res.json(shopDetails);
        } else {
            res.status(500).json({ error: "Could not parse shopDetails.js" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/shopDetails", isAdmin, async (req, res) => {
    try {
        const newDetails = req.body;
        const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
        const content = `const shopDetails = {
    shopName: ${JSON.stringify(newDetails.shopName || '')},
    shopAddress: ${JSON.stringify(newDetails.shopAddress || '')},
    shopPhone: ${JSON.stringify(newDetails.shopPhone || '')},
    shopEmail: ${JSON.stringify(newDetails.shopEmail || '')},
    shopLogo: ${JSON.stringify(newDetails.shopLogo || '')},
}

export default shopDetails;`;
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: "Shop details updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/me", isAuthenticated, (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/change-password', isAuthenticated, async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Both old and new passwords are required' });
    }

    try {
        const result = await userAuth.changeUserPassword(req.user.id, oldPassword, newPassword, db);
        if (result.success) {
            res.status(200).json({ message: 'Password updated successfully' });
        } else {
            res.status(400).json({ message: result.message });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update User Theme Preference
app.post('/api/change-theme', isAuthenticated, async (req, res) => {
    const { theme } = req.body;
    if (!theme || !['light', 'dark'].includes(theme)) {
        return res.status(400).json({ success: false, message: "Valid theme ('light' or 'dark') is required." });
    }
    try {
        await db.query("UPDATE users SET theme = $1 WHERE id = $2", [theme, req.user.id]);
        req.user.theme = theme;
        res.json({ success: true, theme, message: "Theme preference saved successfully." });
    } catch (err) {
        console.error("Change theme error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/salesPage", isAuthenticated, async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories');
        const banks = await db.query('SELECT * FROM banks');
        const customers = await db.query('SELECT id, name FROM customers');

        let shopDetails = {};
        try {
            const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const match = fileContent.match(/const\s+shopDetails\s*=\s*({[\s\S]*?})/);
            if (match && match[1]) {
                shopDetails = new Function(`return ${match[1]}`)();
            }
        } catch (e) {
            console.error('Failed to load shop details', e);
        }

        res.json({
            categories: categories.rows,
            banks: banks.rows,
            customers: customers.rows,
            shopDetails: shopDetails
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/sync/master-data", isAuthenticated, async (req, res) => {
    try {
        const productsQuery = `
            SELECT 
                ast.id AS item_id, 
                ast.name AS item_name, 
                ast.barcode, 
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
            ORDER BY ast.name ASC
        `;
        const productsRes = await db.query(productsQuery);
        const categoriesRes = await db.query('SELECT id, name FROM categories ORDER BY name ASC');
        const banksRes = await db.query('SELECT * FROM banks ORDER BY bank_name ASC');
        const customersRes = await db.query('SELECT id, name, phone_number, address, email, customer_notes FROM customers ORDER BY name ASC');

        let shopDetails = {};
        try {
            const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const match = fileContent.match(/const\s+shopDetails\s*=\s*({[\s\S]*?})/);
            if (match && match[1]) {
                shopDetails = new Function(`return ${match[1]}`)();
            }
        } catch (e) {
            console.error('Failed to load shop details for sync', e);
        }

        res.json({
            success: true,
            products: productsRes.rows,
            categories: categoriesRes.rows,
            banks: banksRes.rows,
            customers: customersRes.rows,
            shopDetails: shopDetails,
            syncedAt: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/dashboard", isAdmin, async (req, res) => {
    try {
        const allUsers = await db.query('SELECT username, role FROM users');
        const salesData = await db.query("SELECT ast.name, change_type, quantity_change, unit_selling_price, last_cost_price FROM stock_changes AS sc JOIN all_stocks AS ast ON sc.product_id = ast.id WHERE sc.change_type = 'Sales' ORDER BY change_date DESC LIMIT 15");
        const stockValueResult = await db.query("SELECT COALESCE(SUM(total_quantity_in_stock * last_cost_price), 0) AS total_stock_value, COALESCE(SUM(total_quantity_in_stock * unit_selling_price), 0) AS total_stock_sell_value FROM all_stocks");
        const customersCount = await db.query("SELECT COUNT(*) FROM customers");

        res.json({
            users: allUsers.rows,
            recentSales: salesData.rows,
            totalStockValue: stockValueResult.rows[0].total_stock_value,
            totalStockSellValue: stockValueResult.rows[0].total_stock_sell_value,
            totalCustomers: parseInt(customersCount.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Page
app.get("/api/stockPage", isAdmin, async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories ORDER BY name ASC');
        const units = await db.query('SELECT name FROM units ORDER BY name ASC');
        const wholesaleUnits = await db.query('SELECT name FROM wholesale_units ORDER BY name ASC');
        const companies = await db.query('SELECT name FROM companies ORDER BY name ASC');
        res.json({
            categories: categories.rows,
            units: units.rows,
            wholesaleUnits: wholesaleUnits.rows,
            companies: companies.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/purchasePage", isAuthenticated, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suppliers');
        res.json({
            suppliers: result.rows
        });
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve suppliers: ${err.message}`,
            error: err.message
        });
    }
});

// Get transactions
app.get("/api/transactionPage", isAdmin, async (req, res) => {
    try {
        const userData = await db.query('SELECT id, username FROM users');
        res.json({
            users: userData.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Product Tracker
app.get("/api/productTracker", isAdmin, async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories');
        res.json({
            categories: categories.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ********* Analytics Routes
app.get("/api/analytics/main", isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const metrics = await analytics.getMainMetrics(startDate, endDate, db);
        res.json({ success: true, ...metrics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/staff", isAdmin, async (req, res) => {
    try {
        const { staffId, startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const staffPerformance = await analytics.getStaffPerformance(staffId, startDate, endDate, db);
        res.json({ success: true, data: staffPerformance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/customers", isAdmin, async (req, res) => {
    try {
        const { search, page = 1, startDate, endDate } = req.query;
        const limit = 15;
        const offset = (parseInt(page) - 1) * limit;
        const customerData = await analytics.getCustomersAnalytics(search, offset, limit, startDate, endDate, db);
        res.json({ success: true, ...customerData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/products", isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, limit, sort } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const productData = await analytics.getProductPerformance(startDate, endDate, limit, sort, db);
        res.json({ success: true, data: productData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ********* Dashboard Data Routes
app.get("/api/expenses", isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const expenses = await dashboardData.getExpenses(startDate, endDate, db);
        res.json({ success: true, expenses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/expenses", isAdmin, async (req, res) => {
    try {
        const { amount, description, date } = req.body;
        if (!amount || !description || !date) return res.status(400).json({ success: false, message: "Missing required fields" });
        const userId = req.user ? req.user.id : null;
        const newExpense = await dashboardData.addExpense(amount, description, date, userId, db);
        res.json({ success: true, expense: newExpense });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/expenses/:id", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await dashboardData.deleteExpense(id, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/banks", isAuthenticated, async (req, res) => {
    try {
        const banks = await dashboardData.getBanks(db);
        res.json({ success: true, banks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/banks", isAdmin, async (req, res) => {
    try {
        const { bankName, accountNumber } = req.body;
        if (!bankName) return res.status(400).json({ success: false, message: "Bank name is required" });
        const newBank = await dashboardData.addBank(bankName, accountNumber, db);
        res.json({ success: true, bank: newBank });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put("/api/banks/:id", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber } = req.body;
        if (!bankName) return res.status(400).json({ success: false, message: "Bank name is required" });
        const updatedBank = await dashboardData.updateBank(id, bankName, accountNumber, db);
        res.json({ success: true, bank: updatedBank });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/banks/:id", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await dashboardData.deleteBank(id, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// *********Sales processing
app.get("/api/searchItems", isAuthenticated, async (req, res) => {
    const { itemName, category, minPrice, maxPrice } = req.query;
    try {
        const data = await sales.searchDb(itemName, category, minPrice, maxPrice, db);
        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} item(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "Item not found, check the name or criteria!",
                contents: []
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't search for item: ${err.message}`,
            error: err.message
        });
    }
});

// Search customers
app.get("/api/searchCustomers", isAuthenticated, async (req, res) => {
    const customerName = req.query.customerName;
    try {
        const result = await db.query('SELECT * FROM customers WHERE name ILIKE $1', [`%${customerName}%`])
        const data = result.rows;

        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} customer(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "",
                contents: []
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve customers: ${err.message}`,
            error: err.message
        });
    }
});

// Update customer notes
app.put("/api/updateCustomerNotes", isAuthenticated, async (req, res) => {
    const { id, notes } = req.body;
    try {
        await db.query('UPDATE customers SET customer_notes = $1 WHERE id = $2', [notes, id]);
        res.json({
            success: true,
            message: "Customer notes updated successfully!"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't update customer notes: ${err.message}`,
            error: err.message
        });
    }
});

// Add new customer
app.post("/api/addCustomer", isAuthenticated, async (req, res) => {
    const { name, phone_number, address, email, customer_notes } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO customers (name, phone_number, address, email, customer_notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, phone_number || null, address || null, email || null, customer_notes || null]
        );
        res.json({
            success: true,
            message: "Customer added successfully!",
            customer: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't add customer: ${err.message}`,
            error: err.message
        });
    }
});

// Get all customers
app.get("/api/allCustomers", isAuthenticated, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM customers ORDER BY name ASC');
        res.json({
            success: true,
            contents: result.rows
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve customers: ${err.message}`,
            error: err.message
        });
    }
});

// Update customer (full)
app.put("/api/updateCustomer", isAuthenticated, async (req, res) => {
    const { id, name, phone_number, address, email, customer_notes } = req.body;
    try {
        const result = await db.query(
            'UPDATE customers SET name = $1, phone_number = $2, address = $3, email = $4, customer_notes = $5 WHERE id = $6 RETURNING *',
            [name, phone_number || null, address || null, email || null, customer_notes || null, id]
        );
        if (result.rows.length > 0) {
            res.json({
                success: true,
                message: "Customer updated successfully!",
                customer: result.rows[0]
            });
        } else {
            res.status(404).json({ success: false, message: "Customer not found." });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't update customer: ${err.message}`,
            error: err.message
        });
    }
});

// ********* Customer Debts Routes

// Get paginated customer debts with filters
app.get("/api/customer-debts", isAdmin, async (req, res) => {
    const { status = 'pending', customerName = '', startDate, endDate, offset = 0 } = req.query;
    const limit = 15;
    const offsetVal = parseInt(offset);

    try {
        const params = [status, limit, offsetVal];
        let paramIdx = 4;

        const conditions = [];
        if (customerName) {
            conditions.push(`c.name ILIKE $${paramIdx}`);
            params.push(`%${customerName}%`);
            paramIdx++;
        }
        if (startDate) {
            conditions.push(`cd.created_at >= $${paramIdx}::date`);
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            conditions.push(`cd.created_at < ($${paramIdx}::date + '1 day'::interval)`);
            params.push(endDate);
            paramIdx++;
        }

        const extraWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

        const queryText = `
            SELECT
                cd.id,
                cd.sale_id,
                cd.customer_id,
                cd.amount,
                cd.status,
                cd.last_updated,
                c.name AS customer_name,
                c.phone_number AS customer_phone
            FROM customer_debts cd
            JOIN customers c ON cd.customer_id = c.id
            WHERE cd.status = $1
            ${extraWhere}
            ORDER BY cd.last_updated DESC
            LIMIT $2 OFFSET $3;
        `;

        const countParams = [status, ...params.slice(3)];
        const countText = `
            SELECT COUNT(*)
            FROM customer_debts cd
            JOIN customers c ON cd.customer_id = c.id
            WHERE cd.status = $1
            ${extraWhere};
        `;

        const [result, countResult] = await Promise.all([
            db.query(queryText, params),
            db.query(countText, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count, 10);
        const debts = result.rows;

        res.json({
            success: true,
            debts,
            total,
            hasMore: offsetVal + debts.length < total
        });
    } catch (err) {
        res.status(500).json({ success: false, message: `Couldn't retrieve debts: ${err.message}` });
    }
});

// Clear a pending debt and update the linked sale's pay_route
app.patch("/api/customer-debts/:id/clear", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { payRoute, bankId } = req.body;

    if (!payRoute) return res.status(400).json({ success: false, message: 'Payment route is required.' });

    try {
        await db.query('BEGIN');

        // Fetch the debt to get sale_id and confirm it's pending
        const debtResult = await db.query(
            'SELECT id, sale_id, status FROM customer_debts WHERE id = $1',
            [id]
        );
        if (debtResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Debt not found.' });
        }
        const debt = debtResult.rows[0];
        if (debt.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Debt is already cleared.' });
        }

        // Mark debt as cleared
        await db.query(
            "UPDATE customer_debts SET status = 'cleared', last_updated = NOW() WHERE id = $1",
            [id]
        );

        // Update the linked sale's pay_route (and bank_id if applicable)
        await db.query(
            'UPDATE sales SET pay_route = $1, bank_id = $2 WHERE id = $3',
            [payRoute, bankId ? parseInt(bankId) : null, debt.sale_id]
        );

        await db.query('COMMIT');

        res.json({ success: true, message: 'Debt cleared successfully.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ success: false, message: `Couldn't clear debt: ${err.message}` });
    }
});

// Item Tracker
app.get("/api/track-product", isAdmin, async (req, res) => {
    const { productId, startDate, stopDate } = req.query;
    try {
        const queryText = `
            SELECT 
                sc.id,
                sc.change_type,
                sc.old_quantity,
                sc.new_quantity,
                sc.quantity_change,
                sc.cost_impact,
                sc.change_date,
                sl.lot_id,
                u.username
            FROM stock_changes sc
            LEFT JOIN stock_lots sl ON sc.lot_id = sl.lot_id
            LEFT JOIN users u ON sc.user_id = u.id
            WHERE sc.product_id = $1
                AND sc.change_date >= $2::date 
                AND sc.change_date < ($3::date + '1 day'::interval)
            ORDER BY sc.change_date DESC;
        `;
        const values = [parseInt(productId), startDate, stopDate];
        const result = await db.query(queryText, values);
        const data = result.rows;

        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} transaction(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "No transactions found for this item.",
                contents: []
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve data: ${error.message}`,
            error: error.message
        });
    }
});

// Fetch all stocks
app.get("/api/all-inventory", isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', filter = '' } = req.query;
        const limitVal = limit === 'all' ? null : parseInt(limit);
        const offset = limit === 'all' ? 0 : (parseInt(page) - 1) * limitVal;

        let queryParams = [];
        let countParams = [];
        let whereConditions = [];

        if (search) {
            whereConditions.push(`(ast.name ILIKE $1 OR ctg.name ILIKE $1 OR ast.generic_name ILIKE $1 OR ast.barcode ILIKE $1)`);
            queryParams.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (filter === 'reorder') {
            whereConditions.push(`ast.total_quantity_in_stock <= ast.reorder_level AND ast.total_quantity_in_stock > 0`);
        } else if (filter === 'zero') {
            whereConditions.push(`ast.total_quantity_in_stock = 0`);
        }

        let whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

        const countQuery = `
            SELECT COUNT(*) 
            FROM all_stocks ast
            LEFT JOIN categories ctg ON ast.category_id = ctg.id
            ${whereClause}
        `;

        let queryText = `
            SELECT 
                ast.id,
                ast.barcode,
                ast.name,
                ast.generic_name,
                ast.last_cost_price,
                ast.unit_selling_price,
                ast.wholesale_price,
                ast.wholesale_unit_id,
                wu.name AS wholesale_unit,
                COALESCE(ast.wholesale_multiplier, 1) AS wholesale_multiplier,
                units.name AS unit,
                ctg.name AS category,
                cmp.name AS company,
                ast.reorder_level,
                ast.description,
                ast.total_quantity_in_stock,
                ast.entry_date,
                ast.last_updated_date
            FROM all_stocks ast
            LEFT JOIN units ON ast.unit_id = units.id
            LEFT JOIN wholesale_units wu ON ast.wholesale_unit_id = wu.id
            LEFT JOIN categories ctg ON ast.category_id = ctg.id
            LEFT JOIN companies cmp ON ast.company_id = cmp.id
            ${whereClause}
            ORDER BY ast.name ASC
        `;

        if (limitVal !== null) {
            queryParams.push(limitVal);
            queryText += ` LIMIT $${queryParams.length}`;

            queryParams.push(offset);
            queryText += ` OFFSET $${queryParams.length}`;
        }

        const [countResult, result] = await Promise.all([
            db.query(countQuery, countParams),
            db.query(queryText, queryParams)
        ]);

        const inventory = result.rows;
        const totalCount = parseInt(countResult.rows[0].count, 10);

        res.json({
            success: true,
            message: inventory.length > 0 ? `${inventory.length} items(s) found!` : "No inventory items found.",
            contents: inventory,
            totalCount: totalCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve data: ${error.message}`,
            error: error.message
        });
    }
});

// Delete stock item
app.delete("/api/delete-item/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM all_stocks WHERE id = $1', [id]);
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't delete item. It might be referenced in other records.`,
            error: error.message
        });
    }
});

// Add Stock Item
app.post("/api/addStock", isAdmin, async (req, res) => {
    const { 
        name, genericName, barcode, category, company, unit, cost, price, 
        reorderLevel, description, quantity,
        wholesalePrice, wholesaleUnit, wholesaleMultiplier,
        wholesale_price, wholesale_unit, wholesale_multiplier
    } = req.body;
    try {
        const nameCheck = await db.query('SELECT id FROM all_stocks WHERE name = $1', [name]);
        if (nameCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Item name already exists!' });
        }

        const catRes = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
        const categoryId = catRes.rows.length > 0 ? catRes.rows[0].id : null;

        const unitRes = await db.query('SELECT id FROM units WHERE name = $1', [unit]);
        const unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;

        const compRes = await db.query('SELECT id FROM companies WHERE name = $1', [company]);
        const companyId = compRes.rows.length > 0 ? compRes.rows[0].id : null;

        const initialQuantity = Number(quantity) > 0 ? Number(quantity) : 0;
        const userId = req.user?.id || req.session?.passport?.user || 1;

        const effectiveWholesalePrice = parseFloat(wholesalePrice ?? wholesale_price ?? 0) || 0;
        const rawWholesaleUnit = (wholesaleUnit ?? wholesale_unit ?? '').toString().trim();
        const effectiveWholesaleMultiplier = parseInt(wholesaleMultiplier ?? wholesale_multiplier ?? 1, 10) || 1;

        let wholesaleUnitId = null;
        if (rawWholesaleUnit) {
            const wuRes = await db.query('SELECT id FROM wholesale_units WHERE name = $1', [rawWholesaleUnit]);
            if (wuRes.rows.length > 0) {
                wholesaleUnitId = wuRes.rows[0].id;
            } else {
                const newWu = await db.query('INSERT INTO wholesale_units (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id', [rawWholesaleUnit]);
                wholesaleUnitId = newWu.rows[0].id;
            }
        }

        const insertQuery = `
            INSERT INTO all_stocks 
            (name, generic_name, barcode, category_id, unit_id, company_id, last_cost_price, unit_selling_price, reorder_level, description, user_id, wholesale_price, wholesale_unit_id, wholesale_multiplier)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *;
        `;
        const values = [
            name,
            genericName || null,
            barcode || null,
            categoryId,
            unitId,
            companyId,
            cost || 0,
            price || 0,
            reorderLevel || 0,
            description || null,
            userId,
            effectiveWholesalePrice,
            wholesaleUnitId,
            effectiveWholesaleMultiplier
        ];

        const result = await db.query(insertQuery, values);
        const newItem = result.rows[0];

        if (initialQuantity > 0) {
            const items = [{
                item_id: newItem.id,
                adjustment_qty: initialQuantity,
                current_qty: 0,
                last_cost_price: cost || 0
            }];
            await adjustment(db, userId, items);
        }

        res.json({ success: true, message: 'Product saved successfully!', item: newItem });
    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ success: false, message: 'Failed to save product: ' + error.message });
    }
});

// Update Stock Item
app.put("/api/update-item", isAdmin, async (req, res) => {
    const { 
        id, name, genericName, barcode, category, company, unit, cost, price, 
        reorderLevel, description, quantity,
        wholesalePrice, wholesaleUnit, wholesaleMultiplier,
        wholesale_price, wholesale_unit, wholesale_multiplier
    } = req.body;
    try {
        const catRes = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
        const categoryId = catRes.rows.length > 0 ? catRes.rows[0].id : null;

        const unitRes = await db.query('SELECT id FROM units WHERE name = $1', [unit]);
        const unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;

        const compRes = await db.query('SELECT id FROM companies WHERE name = $1', [company]);
        const companyId = compRes.rows.length > 0 ? compRes.rows[0].id : null;

        const effectiveWholesalePrice = parseFloat(wholesalePrice ?? wholesale_price ?? 0) || 0;
        const rawWholesaleUnit = (wholesaleUnit ?? wholesale_unit ?? '').toString().trim();
        const effectiveWholesaleMultiplier = parseInt(wholesaleMultiplier ?? wholesale_multiplier ?? 1, 10) || 1;

        let wholesaleUnitId = null;
        if (rawWholesaleUnit) {
            const wuRes = await db.query('SELECT id FROM wholesale_units WHERE name = $1', [rawWholesaleUnit]);
            if (wuRes.rows.length > 0) {
                wholesaleUnitId = wuRes.rows[0].id;
            } else {
                const newWu = await db.query('INSERT INTO wholesale_units (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id', [rawWholesaleUnit]);
                wholesaleUnitId = newWu.rows[0].id;
            }
        }

        const updateQuery = `
            UPDATE all_stocks 
            SET name = $1, generic_name = $2, barcode = $3, category_id = $4, unit_id = $5, company_id = $6, 
                last_cost_price = $7, unit_selling_price = $8, reorder_level = $9, description = $10,
                wholesale_price = $11, wholesale_unit_id = $12, wholesale_multiplier = $13,
                last_updated_date = CURRENT_TIMESTAMP
            WHERE id = $14
            RETURNING *;
        `;
        const values = [
            name,
            genericName || null,
            barcode || null,
            categoryId,
            unitId,
            companyId,
            cost || 0,
            price || 0,
            reorderLevel || 0,
            description || null,
            effectiveWholesalePrice,
            wholesaleUnitId,
            effectiveWholesaleMultiplier,
            id
        ];

        const result = await db.query(updateQuery, values);
        let updatedItem = result.rows[0];

        if (quantity !== undefined && quantity !== null && quantity !== '') {
            const currentQty = Number(updatedItem.total_quantity_in_stock);
            const newQty = Number(quantity);
            const adjustmentQty = newQty - currentQty;

            if (adjustmentQty !== 0) {
                const userId = req.user ? req.user.id : 1;
                const adjustmentItem = {
                    item_id: id,
                    adjustment_qty: adjustmentQty,
                    current_qty: currentQty,
                    last_cost_price: updatedItem.last_cost_price
                };

                const client = await db.connect();
                try {
                    await adjustment(client, userId, [adjustmentItem], "Adjustment");
                } finally {
                    client.release();
                }

                const freshRes = await db.query('SELECT * FROM all_stocks WHERE id = $1', [id]);
                updatedItem = freshRes.rows[0];
            }
        }

        res.json({ success: true, message: 'Product updated successfully!', item: updatedItem });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ success: false, message: 'Failed to update product: ' + error.message });
    }
});

// Internal Updates
app.post("/api/process-return", isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await saveReturn(client, userId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Return processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-expired", isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Expired");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Expired items processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-office-use", isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Office Use");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Office use processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-damaged", isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Damaged");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Damaged items processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Process Purchase
app.post("/api/process-purchase", isAuthenticated, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await savePurchase(userId, req.body, client, res);
        if (!res.headersSent) {
            res.status(201).json({ success: true, message: "Purchase processed successfully!" });
        }
    } catch (err) {
        if (!res.headersSent) {
            res.status(err.status || 500).json({ success: false, message: err.message });
        }
    } finally { client.release(); }
});

// Save Sale
app.post("/api/process-sale", isAuthenticated, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const saleData = req.body;
    try {
        const newSale = await sales.saveSale(userId, saleData, db, res);
        if (newSale && newSale.saleId) {
            res.status(201).json({
                success: true,
                message: `Sale successfully processed!`,
                contents: newSale
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Sale could not be saved. Invalid data or internal issue.",
                contents: {}
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Failed to process sale: ${err.message}`,
            error: err.message
        });
    }
});

// Save Wholesale
app.post("/api/process-wholesale", isAuthenticated, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const wholesaleData = req.body;
    try {
        const newWholesale = await wholesale.saveWholesale(userId, wholesaleData, db, res);
        if (newWholesale && newWholesale.wholesaleId) {
            res.status(201).json({
                success: true,
                message: `Wholesale successfully processed!`,
                contents: newWholesale
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Wholesale could not be saved. Invalid data or internal issue.",
                contents: {}
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Failed to process wholesale: ${err.message}`,
            error: err.message
        });
    }
});

// ********Transaction checking
app.post("/api/searchTransactions", isAdmin, async (req, res) => {
    const { startDate, endDate, transactionType, userId } = req.body;
    try {
        const data = await checkTransaction(startDate, endDate, transactionType, userId, db, res);
        const userData = await db.query('SELECT id, username FROM users');

        if (Array.isArray(data) && data.length > 0) {
            const transactionsWithRevenue = data.map(transaction => {
                if (transaction.change_type === 'Sales') {
                    const price = parseFloat(transaction.selling_price_per_unit);
                    const quantity = Math.abs(transaction.quantity_change);
                    transaction.gross_revenue_impact = (price * quantity).toFixed(2);
                } else {
                    transaction.gross_revenue_impact = null;
                }
                return transaction;
            });

            const totalSalesRevenue = transactionsWithRevenue.reduce((acc, curr) => {
                return acc + (parseFloat(curr.gross_revenue_impact) || 0);
            }, 0);

            const processedSaleIds = new Set();
            const totalDiscount = transactionsWithRevenue.reduce((acc, curr) => {
                if (curr.change_type === 'Sales' && curr.sale_id && !processedSaleIds.has(curr.sale_id)) {
                    processedSaleIds.add(curr.sale_id);
                    return acc + (parseFloat(curr.sale_discount) || 0);
                }
                return acc;
            }, 0);

            const payRouteTotals = {};
            transactionsWithRevenue.forEach(transaction => {
                if (transaction.change_type === 'Sales' && transaction.pay_route) {
                    const impact = parseFloat(transaction.gross_revenue_impact) || 0;
                    if (!payRouteTotals[transaction.pay_route]) {
                        payRouteTotals[transaction.pay_route] = 0;
                    }
                    payRouteTotals[transaction.pay_route] += impact;
                }
            });

            for (const route in payRouteTotals) {
                payRouteTotals[route] = payRouteTotals[route].toFixed(2);
            }

            res.json({
                success: true,
                contents: transactionsWithRevenue,
                totalSalesRevenue: totalSalesRevenue.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                payRouteTotals: payRouteTotals,
                users: userData.rows,
            });
        } else if (!Array.isArray(data)) {
            res.status(400).json({ success: false, message: data });
        } else {
            res.status(404).json({ success: false, message: "No transactions found for this timeline" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Search Previous Sales
app.post("/api/searchSales", isAuthenticated, async (req, res) => {
    const { startDate, endDate, customerId, userId } = req.body;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }
    try {
        const queryParts = [];
        const params = [];
        let paramCounter = 1;

        queryParts.push(`s.sale_date >= $${paramCounter}::date`);
        params.push(startDate);
        paramCounter++;

        queryParts.push(`s.sale_date < ($${paramCounter}::date + interval '1 day')`);
        params.push(endDate);
        paramCounter++;

        if (customerId && parseInt(customerId, 10) > 0) {
            queryParts.push(`s.customer_id = $${paramCounter}`);
            params.push(parseInt(customerId, 10));
            paramCounter++;
        }

        if (userId && parseInt(userId, 10) > 0) {
            queryParts.push(`s.user_id = $${paramCounter}`);
            params.push(parseInt(userId, 10));
            paramCounter++;
        }

        const salesQuery = `
            SELECT 
                s.id AS sale_id,
                s.sale_date,
                s.total_amount,
                s.discount_applied,
                s.pay_route,
                s.customer_id,
                c.name AS customer_name,
                s.user_id,
                u.username AS cashier_name,
                s.bank_id,
                b.bank_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN banks b ON s.bank_id = b.id
            WHERE ${queryParts.join(' AND ')}
            ORDER BY s.sale_date DESC
        `;
        const salesResult = await db.query(salesQuery, params);

        if (salesResult.rows.length === 0) {
            return res.json({ success: true, sales: [] });
        }

        const isAdminUser = req.user && req.user.role === 'administrator';
        const saleIds = salesResult.rows.map(r => r.sale_id);
        const lineItemsQuery = `
            SELECT 
                sli.id AS line_item_id,
                sli.sale_id,
                sli.product_id,
                ast.name AS product_name,
                sli.quantity_sold,
                sli.selling_price_per_unit
                ${isAdminUser ? ', sli.cost_at_sale' : ''}
            FROM sale_line_items sli
            JOIN all_stocks ast ON sli.product_id = ast.id
            WHERE sli.sale_id = ANY($1::int[])
            ORDER BY sli.id ASC
        `;
        const lineItemsResult = await db.query(lineItemsQuery, [saleIds]);

        const itemsBySaleId = {};
        lineItemsResult.rows.forEach(item => {
            if (!itemsBySaleId[item.sale_id]) {
                itemsBySaleId[item.sale_id] = [];
            }
            itemsBySaleId[item.sale_id].push(item);
        });

        const sales = salesResult.rows.map(sale => ({
            ...sale,
            items: itemsBySaleId[sale.sale_id] || []
        }));

        res.json({ success: true, sales });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Previous Wholesales
app.post("/api/previous-wholesales", isAuthenticated, async (req, res) => {
    const { startDate, endDate, customerId, userId } = req.body;
    try {
        const queryParts = [];
        const params = [];
        let paramCounter = 1;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Start date and End date are required." });
        }

        queryParts.push(`w.wholesale_date >= $${paramCounter}::date`);
        params.push(startDate);
        paramCounter++;

        queryParts.push(`w.wholesale_date < ($${paramCounter}::date + interval '1 day')`);
        params.push(endDate);
        paramCounter++;

        if (customerId && parseInt(customerId, 10) > 0) {
            queryParts.push(`w.customer_id = $${paramCounter}`);
            params.push(parseInt(customerId, 10));
            paramCounter++;
        }

        if (userId && parseInt(userId, 10) > 0) {
            queryParts.push(`w.user_id = $${paramCounter}`);
            params.push(parseInt(userId, 10));
            paramCounter++;
        }

        const wholesaleQuery = `
            SELECT 
                w.id AS wholesale_id,
                w.wholesale_date,
                w.total_amount,
                w.discount_applied,
                w.pay_route,
                w.customer_id,
                c.name AS customer_name,
                w.user_id,
                u.username AS cashier_name,
                w.bank_id,
                b.bank_name
            FROM wholesales w
            LEFT JOIN customers c ON w.customer_id = c.id
            LEFT JOIN users u ON w.user_id = u.id
            LEFT JOIN banks b ON w.bank_id = b.id
            WHERE ${queryParts.join(' AND ')}
            ORDER BY w.wholesale_date DESC
        `;
        const wholesaleResult = await db.query(wholesaleQuery, params);

        if (wholesaleResult.rows.length === 0) {
            return res.json({ success: true, wholesales: [] });
        }

        const isAdminUser = req.user && req.user.role === 'administrator';
        const wholesaleIds = wholesaleResult.rows.map(r => r.wholesale_id);
        const lineItemsQuery = `
            SELECT 
                wli.id AS line_item_id,
                wli.wholesale_id,
                wli.product_id,
                ast.name AS product_name,
                wli.quantity_sold,
                wli.wholesale_unit_id,
                COALESCE(wu.name, 'Pack') AS wholesale_unit_name,
                wli.unit_multiplier,
                wli.total_base_units,
                wli.selling_price_per_unit
                ${isAdminUser ? ', wli.cost_at_sale' : ''}
            FROM wholesale_line_items wli
            JOIN all_stocks ast ON wli.product_id = ast.id
            LEFT JOIN wholesale_units wu ON wli.wholesale_unit_id = wu.id
            WHERE wli.wholesale_id = ANY($1::int[])
            ORDER BY wli.id ASC
        `;
        const lineItemsResult = await db.query(lineItemsQuery, [wholesaleIds]);

        const itemsByWholesaleId = {};
        lineItemsResult.rows.forEach(item => {
            if (!itemsByWholesaleId[item.wholesale_id]) {
                itemsByWholesaleId[item.wholesale_id] = [];
            }
            itemsByWholesaleId[item.wholesale_id].push(item);
        });

        const wholesales = wholesaleResult.rows.map(w => ({
            ...w,
            items: itemsByWholesaleId[w.wholesale_id] || []
        }));

        res.json({ success: true, wholesales });
    } catch (err) {
        console.error('Previous wholesales error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stock adjustments
app.post('/api/process-adjustments', isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided." });
    }

    const client = await db.connect();
    try {
        const result = await adjustment(client, userId, items);
        if (result.success) {
            res.status(200).json({
                success: true,
                message: "Adjustments processed successfully",
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Failed to process adjustments: ${err.message}`
        });
    } finally {
        client.release();
    }
});



// Process Inventory Count
app.post("/api/inventory-count", isAdmin, async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const { items } = req.body;

    const adjustmentItems = [];
    for (const item of items) {
        const countedQty = Number(item.counted_qty);
        const currentQty = Number(item.current_qty);
        const adjustmentQty = countedQty - currentQty;

        if (adjustmentQty !== 0) {
            adjustmentItems.push({
                item_id: item.item_id,
                adjustment_qty: adjustmentQty,
                current_qty: currentQty,
                last_cost_price: item.last_cost_price
            });
        }
    }

    if (adjustmentItems.length === 0) {
        return res.json({ success: true, message: 'No discrepancies found to adjust.' });
    }

    const client = await db.connect();
    try {
        await adjustment(client, userId, adjustmentItems, "Stock Count");
        res.json({ success: true, message: 'Inventory count applied successfully.' });
    } catch (err) {
        console.error('Error applying inventory count:', err);
        res.status(500).json({ success: false, message: 'Failed to process inventory count: ' + err.message });
    } finally {
        client.release();
    }
});

app.get("/api/inventory-count-history", isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, startDate, endDate, all } = req.query;

        let dateFilter = " sc.change_type = 'Stock Count' ";
        const queryParams = [];
        let paramCount = 1;

        if (startDate && endDate) {
            dateFilter += ` AND DATE(sc.change_date) >= $${paramCount} AND DATE(sc.change_date) <= $${paramCount + 1}`;
            queryParams.push(startDate, endDate);
            paramCount += 2;
        }

        let limitClause = '';
        if (all === 'true') {
            limitClause = ''; // Return all matching records
        } else {
            const offset = (page - 1) * limit;
            limitClause = ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            queryParams.push(limit, offset);
        }

        const detailsQuery = `
            SELECT sc.id, sc.product_id, ast.name as item_name, sc.quantity_change, 
                   sc.old_quantity, sc.new_quantity, sc.cost_impact, sc.change_date as created_at, u.username
            FROM stock_changes sc
            LEFT JOIN all_stocks ast ON sc.product_id = ast.id
            LEFT JOIN users u ON sc.user_id = u.id
            WHERE ${dateFilter}
            ORDER BY sc.change_date DESC
            ${limitClause}
        `;
        const historyDetails = await db.query(detailsQuery, queryParams);

        let statsDateFilter = " sc.change_type = 'Stock Count' ";
        const statsQueryParams = [];
        if (startDate && endDate) {
            statsDateFilter += ` AND DATE(sc.change_date) >= $1 AND DATE(sc.change_date) <= $2`;
            statsQueryParams.push(startDate, endDate);
        }

        const countQuery = `SELECT COUNT(*) FROM stock_changes sc WHERE ${statsDateFilter}`;
        const totalCount = await db.query(countQuery, statsQueryParams);

        const statsQuery = `
            SELECT 
                COUNT(DISTINCT CASE WHEN sc.quantity_change > 0 THEN sc.product_id END) as excess_item_count,
                COALESCE(SUM(CASE WHEN sc.quantity_change > 0 THEN sc.cost_impact ELSE 0 END), 0) as excess_item_value,
                COALESCE(SUM(CASE WHEN sc.quantity_change > 0 THEN (sc.quantity_change * ast.unit_selling_price) ELSE 0 END), 0) as excess_item_sell_value,
                COUNT(DISTINCT CASE WHEN sc.quantity_change < 0 THEN sc.product_id END) as shorting_item_count,
                COALESCE(SUM(CASE WHEN sc.quantity_change < 0 THEN ABS(sc.cost_impact) ELSE 0 END), 0) as shorting_item_value,
                COALESCE(SUM(CASE WHEN sc.quantity_change < 0 THEN ABS(sc.quantity_change * ast.unit_selling_price) ELSE 0 END), 0) as shorting_item_sell_value
            FROM stock_changes sc
            LEFT JOIN all_stocks ast ON sc.product_id = ast.id
            WHERE ${statsDateFilter}
        `;
        const stats = await db.query(statsQuery, statsQueryParams);

        res.json({
            success: true,
            history: historyDetails.rows,
            total: parseInt(totalCount.rows[0].count),
            stats: stats.rows[0]
        });
    } catch (err) {
        console.error('Error fetching inventory count history:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
});

//********Register new / Edit user 
app.post("/api/editUser", isAdmin, async (req, res) => {
    let id = req.body.userId;
    let username = req.body.username ? req.body.username.toLowerCase() : null;
    let password = req.body.password;
    let role = req.body.role;

    const queryParts = [];
    const params = [];
    let paramCounter = 1;

    if (username) {
        queryParts.push(`username = $${paramCounter}`);
        params.push(`${username}`);
        paramCounter++;
    }

    if (password) {
        try {
            const hash = await bcrypt.hash(password, saltRounds);
            queryParts.push(`password = $${paramCounter}`);
            params.push(`${hash}`);
            paramCounter++;
        } catch (err) {
            return res.status(500).json({ success: false, message: "Failed to hash password" });
        }
    }

    if (role) {
        queryParts.push(`role = $${paramCounter}`);
        params.push(`${role}`);
        paramCounter++;
    }

    let sqlQuery = 'UPDATE users SET ';
    if (queryParts.length > 0) {
        sqlQuery += queryParts.join(', ') + ' WHERE ' + `id = $${paramCounter}`;
        params.push(`${id}`);
    } else {
        return res.status(400).json({ success: false, message: "No fields provided for update." });
    }

    try {
        const result = await db.query(sqlQuery, params);
        if (result.rowCount > 0) {
            res.json({ success: true, message: "User Updated Successfully" });
        } else {
            res.status(404).json({ success: false, message: "User not found or no changes made." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to update user: ${err.message}` });
    }
});

app.post("/api/registerUser", isAdmin, async (req, res) => {
    let username = req.body.username ? req.body.username.toLowerCase() : null;
    let password = req.body.password;
    let role = req.body.role;

    const result = await userAuth.registerUser(username, password, role, db);
    if (result === "Already exists") {
        res.status(409).json({ success: false, message: "This username already exists" });
    } else if (result === "error") {
        res.status(500).json({ success: false, message: "There was an unexpected error, please try again" });
    } else {
        res.status(201).json({ success: true, message: `New user: ${username}, added successfully` });
    }
});

// Expenses
app.post("/api/addExpenses", isAdmin, async (req, res) => {
    let amount = req.body.amount;
    let description = req.body.description;
    let userId = req.user ? req.user.id : 1;

    try {
        const result = await db.query("INSERT INTO expenses (amount, description, user_id) VALUES ($1, $2, $3)",
            [amount, description, userId]);

        if (result.rowCount > 0) {
            res.status(201).json({ success: true, message: "New expense successfully added" });
        } else {
            res.status(400).json({ success: false, message: "Expense not added, try again!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to add expense: ${err.message}` });
    }
});

app.post("/api/deleteExpense", isAdmin, async (req, res) => {
    let id = req.body.id;
    try {
        const result = await db.query("DELETE FROM expenses WHERE id = $1", [id]);
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Row successfully deleted" });
        } else {
            res.status(404).json({ success: false, message: "Row not deleted, try again!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to delete expense: ${err.message}` });
    }
});

// Customer route
app.post("/api/editCustomer", isAuthenticated, async (req, res) => {
    let id = req.body.customerId;
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try {
        const result = await db.query('UPDATE customers SET name = $1, phone_number = $2, address = $3, email = $4 WHERE id = $5',
            [name, phone, address, email, id]
        );
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Customer's data successfully edited" });
        } else {
            res.status(404).json({ success: false, message: "Data not edited, please try again..." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/addNewCustomer", isAuthenticated, async (req, res) => {
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try {
        const result = await db.query('INSERT INTO customers(name, phone_number, address, email) VALUES ($1, $2, $3, $4)',
            [name, phone, address, email]
        );
        if (result.rowCount > 0) {
            res.status(201).json({ success: true, message: "New customer successfully added" });
        } else {
            res.status(400).json({ success: false, message: "Customer not added, please try again..." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Label routes (Admin Only)
app.get('/api/labels/:type', isAdmin, async (req, res) => {
    const validTables = ['suppliers', 'categories', 'units', 'wholesale_units', 'companies'];
    const tableName = req.params.type;

    if (!validTables.includes(tableName)) {
        return res.status(400).json({ success: false, message: 'Invalid label type' });
    }

    try {
        const result = await db.query(`SELECT id, name FROM ${tableName} ORDER BY id ASC`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/labels/:type', isAdmin, async (req, res) => {
    const validTables = ['suppliers', 'categories', 'units', 'wholesale_units', 'companies'];
    const tableName = req.params.type;
    const { name } = req.body;

    if (!validTables.includes(tableName)) return res.status(400).json({ success: false, message: 'Invalid label type' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    try {
        const newItem = await addEdit.addNew(name, tableName, db);
        res.status(201).json({ success: true, data: newItem, message: `Successfully added to ${tableName}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/labels/:type/:id', isAdmin, async (req, res) => {
    const validTables = ['suppliers', 'categories', 'units', 'wholesale_units', 'companies'];
    const tableName = req.params.type;
    const id = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!validTables.includes(tableName)) return res.status(400).json({ success: false, message: 'Invalid label type' });
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    try {
        const updatedItem = await addEdit.edit(name, id, tableName, db);
        res.json({ success: true, data: updatedItem, message: `Successfully updated in ${tableName}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/labels/:type/:id', isAdmin, async (req, res) => {
    const validTables = ['suppliers', 'categories', 'units', 'wholesale_units', 'companies'];
    const tableName = req.params.type;
    const id = parseInt(req.params.id, 10);

    if (!validTables.includes(tableName)) return res.status(400).json({ success: false, message: 'Invalid label type' });
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

    try {
        const deletedItem = await addEdit.deleteLabel(id, tableName, db);
        res.json({ success: true, data: deletedItem, message: `Successfully deleted from ${tableName}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// User Settings endpoints (Admin Only)

app.get('/api/users', isAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, role FROM users ORDER BY id ASC');
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users', isAdmin, async (req, res) => {
    let { username, password, role } = req.body;
    if (username) username = username.toLowerCase();
    try {
        const result = await userAuth.registerUser(username, password, role, db);
        if (result === "Already exists") {
            res.status(409).json({ success: false, message: "This username already exists" });
        } else if (result === "error") {
            res.status(500).json({ success: false, message: "Error registering user" });
        } else {
            res.status(201).json({ success: true, message: `User ${username} added successfully` });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/users/:id', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    let { username, role } = req.body;
    if (username) username = username.toLowerCase();
    try {
        const result = await db.query('UPDATE users SET username = $1, role = $2 WHERE id = $3 RETURNING *', [username, role, targetUserId]);
        if (result.rowCount > 0) {
            // Log the user out by destroying their sessions
            const sessions = req.sessionStore.sessions;
            if (sessions) {
                for (const sessionId in sessions) {
                    try {
                        const sessionObj = JSON.parse(sessions[sessionId]);
                        if (sessionObj.passport && sessionObj.passport.user && sessionObj.passport.user.id === targetUserId) {
                            if (targetUserId !== req.user.id) {
                                req.sessionStore.destroy(sessionId);
                            } else {
                                req.session.passport.user.username = username;
                                req.session.passport.user.role = role;
                                req.session.save();
                            }
                        }
                    } catch (e) { }
                }
            }
            res.json({ success: true, message: 'User updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ success: false, message: 'Username already exists' });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

// CSV Import Endpoints
app.get('/api/schema/:tableName', isAuthenticated, async (req, res) => {
    try {
        const { tableName } = req.params;
        if (!csvImport.allowedTables.includes(tableName)) {
            return res.status(403).json({ success: false, message: "Table not allowed for import" });
        }

        const result = await db.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public';
        `, [tableName]);

        // Filter out auto-generated ID columns and audit fields
        let columns = result.rows.filter(col =>
            col.column_name !== 'id' &&
            col.column_name !== 'entry_date' &&
            col.column_name !== 'last_updated_date' &&
            col.column_name !== 'user_id'
        );

        if (tableName === 'all_stocks') {
            // Remove raw ID columns so they are not mapped directly (replaced with string equivalents)
            columns = columns.filter(col =>
                !['unit_id', 'wholesale_unit_id', 'category_id', 'company_id', 'total_quantity_in_stock'].includes(col.column_name)
            );

            // Add virtual string columns for foreign keys
            columns.push({ column_name: 'unit', data_type: 'text', is_nullable: 'NO' });
            columns.push({ column_name: 'wholesale_unit', data_type: 'text', is_nullable: 'YES' });
            columns.push({ column_name: 'category', data_type: 'text', is_nullable: 'YES' });
            columns.push({ column_name: 'company', data_type: 'text', is_nullable: 'YES' });

            // Add stock_lots virtual columns
            columns.push({ column_name: 'quantity', data_type: 'integer', is_nullable: 'YES' });
            columns.push({ column_name: 'cost_per_unit', data_type: 'numeric', is_nullable: 'YES' });
            columns.push({ column_name: 'expiry_date', data_type: 'date', is_nullable: 'YES' });
        }

        res.json({ success: true, schema: columns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/import', isAdmin, async (req, res) => csvImport.importGenericCsv(req, res, db));
app.post('/api/import/stocks', isAdmin, async (req, res) => csvImport.importStocksCsv(req, res, db));

app.put('/api/users/:id/password', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { adminPassword, newPassword } = req.body;
    const adminId = req.user.id;

    if (!adminPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Admin password and new password are required' });
    }

    try {
        const adminResult = await db.query("SELECT password FROM users WHERE id = $1", [adminId]);
        if (adminResult.rows.length === 0) return res.status(404).json({ success: false, message: "Admin not found" });

        const adminSavedPassword = adminResult.rows[0].password;
        const passwordMatch = await bcrypt.compare(adminPassword, adminSavedPassword);

        if (!passwordMatch) {
            return res.status(403).json({ success: false, message: "Incorrect admin password" });
        }

        const hash = await bcrypt.hash(newPassword, saltRounds);
        const updateResult = await db.query("UPDATE users SET password = $1 WHERE id = $2", [hash, targetUserId]);

        if (updateResult.rowCount > 0) {
            res.json({ success: true, message: 'Password updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Target user not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    if (targetUserId === req.user.id) {
        return res.status(400).json({ success: false, message: "You cannot delete yourself" });
    }
    try {
        const result = await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);
        if (result.rowCount > 0) {
            res.json({ success: true, message: 'User deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        if (err.code === '23503') {
            res.status(400).json({ success: false, message: 'Cannot delete user because they are linked to existing records.' });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

// Auth routes
app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ success: false, message: info.message });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.json({ success: true, message: "Logged in successfully", user });
        });
    })(req, res, next);
});

app.post("/api/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: "Logged out successfully" });
        }
    })
});

// Passport Authentication
passport.use("local", new Strategy(async function verify(username, password, cb) {
    if (username) username = username.toLowerCase();
    try {
        let user = await userAuth.loginUser(username, password, db);
        if (user == "wrong password") {
            return cb(null, false, { message: 'Wrong Password!!' });
        } else if (user == "does not exist") {
            return cb(null, false, { message: 'This user is not registered, Contact your Admin.' });
        } else {
            return cb(null, user);
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user)
});

//Listening at port >> 3000
app.listen(port, HOST, () => {
    console.log(`Server running at ${port}`)
});