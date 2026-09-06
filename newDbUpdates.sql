CREATE TABLE customer_debts (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(25) NOT NULL DEFAULT 'pending',
    CONSTRAINT chk_customer_debts_status CHECK (status IN ('pending', 'cleared')),
    CONSTRAINT fk_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
-- Function to create debt after sale
CREATE OR REPLACE FUNCTION create_debt_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO customer_debts (sale_id, customer_id, amount, status)
    VALUES (NEW.id, NEW.customer_id, NEW.total_amount, 'pending');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create debt after sale
CREATE TRIGGER trg_after_sale_insert
AFTER INSERT ON sales
FOR EACH ROW
WHEN (NEW.payroute = 'Credit')
EXECUTE FUNCTION create_debt_after_sale();