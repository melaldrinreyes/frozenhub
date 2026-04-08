-- Add missing columns to sales and sale_items tables

-- Enhance sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS customer_info TEXT COMMENT 'JSON data of customer information',
ADD COLUMN IF NOT EXISTS notes TEXT COMMENT 'Additional notes for the sale',
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Subtotal before discounts',
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Total discount amount';

-- Enhance sale_items table  
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Item subtotal before discount',
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Discount applied to item',
ADD COLUMN IF NOT EXISTS promo_id VARCHAR(255) COMMENT 'Promo applied to this item';

-- Add foreign key for promo_id
ALTER TABLE sale_items
ADD CONSTRAINT fk_sale_item_promo 
FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE SET NULL;

-- Add created_at to product_promos if not exists
ALTER TABLE product_promos
ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_items_promo ON sale_items(promo_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_promos_dates ON promos(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(active);

-- Update existing sale_items to have subtotal = total where subtotal is 0
UPDATE sale_items SET subtotal = total WHERE subtotal = 0 OR subtotal IS NULL;

-- Update existing sales to have subtotal = total_amount where subtotal is 0
UPDATE sales SET subtotal = total_amount WHERE subtotal = 0 OR subtotal IS NULL;

SELECT 'Sales schema enhanced successfully!' as message;
