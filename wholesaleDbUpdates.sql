-- ==============================================================================
-- Wholesale Schema Updates & Table Definitions
-- ==============================================================================

-- 1. Create wholesale_units Table
CREATE TABLE IF NOT EXISTS wholesale_units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Seed default wholesale packaging units
INSERT INTO wholesale_units (name) VALUES 
('Pack'), 
('Carton'), 
('Box'), 
('Roll'), 
('Dozen'), 
('Bundle'), 
('Sachet')
ON CONFLICT (name) DO NOTHING;

-- 2. Add Wholesale Columns to all_stocks Table
ALTER TABLE all_stocks 
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS wholesale_unit_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wholesale_multiplier INT DEFAULT 1;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_all_stocks_wholesale_unit'
    ) THEN
        ALTER TABLE all_stocks 
        ADD CONSTRAINT fk_all_stocks_wholesale_unit FOREIGN KEY (wholesale_unit_id) REFERENCES wholesale_units(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create wholesales Table
CREATE TABLE IF NOT EXISTS wholesales (
    id SERIAL PRIMARY KEY,
    wholesale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    customer_id INT,
    user_id INT NOT NULL,
    discount_applied NUMERIC(10, 2) DEFAULT 0.00,
    pay_route VARCHAR(50) NOT NULL DEFAULT 'Cash',
    bank_id INT,
    CONSTRAINT fk_wholesales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_wholesales_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_wholesales_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE SET NULL
);

-- 4. Create wholesale_line_items Table
CREATE TABLE IF NOT EXISTS wholesale_line_items (
    id SERIAL PRIMARY KEY,
    wholesale_id INT NOT NULL,
    product_id INT NOT NULL,
    lot_id INT,
    quantity_sold NUMERIC(10, 3) NOT NULL,
    wholesale_unit_id INT,
    unit_multiplier INT NOT NULL DEFAULT 1,
    total_base_units NUMERIC(10, 2) NOT NULL,
    selling_price_per_unit NUMERIC(10, 2) NOT NULL,
    cost_at_sale NUMERIC(10, 2),
    CONSTRAINT fk_wholesale_line_items_wholesale FOREIGN KEY (wholesale_id) REFERENCES wholesales(id) ON DELETE CASCADE,
    CONSTRAINT fk_wholesale_line_items_product FOREIGN KEY (product_id) REFERENCES all_stocks(id),
    CONSTRAINT fk_wholesale_line_items_lot FOREIGN KEY (lot_id) REFERENCES stock_lots(lot_id) ON DELETE SET NULL,
    CONSTRAINT fk_wholesale_line_items_wholesale_unit FOREIGN KEY (wholesale_unit_id) REFERENCES wholesale_units(id) ON DELETE SET NULL
);

-- Ensure existing wholesale_line_items columns accept fractional packaging allocations across multiple stock lots
ALTER TABLE wholesale_line_items 
ALTER COLUMN quantity_sold TYPE NUMERIC(10, 3),
ALTER COLUMN total_base_units TYPE NUMERIC(10, 2);

-- 5. Alter customer_debts to Support Wholesale Sales
-- Ensure sale_id is nullable if customer_debts exists
ALTER TABLE customer_debts ALTER COLUMN sale_id DROP NOT NULL;

-- Add wholesale_id column to customer_debts
ALTER TABLE customer_debts 
ADD COLUMN IF NOT EXISTS wholesale_id INT;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_customer_debts_wholesale'
    ) THEN
        ALTER TABLE customer_debts 
        ADD CONSTRAINT fk_customer_debts_wholesale FOREIGN KEY (wholesale_id) REFERENCES wholesales(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Alter stock_changes to Track Wholesale Transactions
ALTER TABLE stock_changes 
ADD COLUMN IF NOT EXISTS wholesale_id INT;

-- 7. Trigger Function to Record Customer Debt on Wholesale Credit
CREATE OR REPLACE FUNCTION create_debt_after_wholesale()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO customer_debts (wholesale_id, customer_id, amount, status)
    VALUES (NEW.id, NEW.customer_id, NEW.total_amount, 'pending');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on wholesales table for Credit payments
DROP TRIGGER IF EXISTS trg_after_wholesale_insert ON wholesales;
CREATE TRIGGER trg_after_wholesale_insert
AFTER INSERT ON wholesales
FOR EACH ROW
WHEN (NEW.pay_route = 'Credit' AND NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION create_debt_after_wholesale();

-- 8. Add theme preference column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light';

