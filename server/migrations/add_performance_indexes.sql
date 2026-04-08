-- Add performance indexes for promotional system queries
-- These indexes optimize the product listing with active promos

-- Index for products by creation date (already used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Index for products by category (for filtering)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Index for products by active status
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Composite index for product_promos JOIN operations
CREATE INDEX IF NOT EXISTS idx_product_promos_product ON product_promos(product_id);
CREATE INDEX IF NOT EXISTS idx_product_promos_promo ON product_promos(promo_id);

-- Composite index for active promos within date range
CREATE INDEX IF NOT EXISTS idx_promos_active_dates ON promos(active, start_date, end_date);

-- Index for promo lookups by status
CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(active);
CREATE INDEX IF NOT EXISTS idx_promos_dates ON promos(start_date, end_date);

-- Index for sale_items promo tracking
CREATE INDEX IF NOT EXISTS idx_sale_items_promo ON sale_items(promo_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- Index for sales by date (for analytics)
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);

-- Index for inventory lookups
CREATE INDEX IF NOT EXISTS idx_inventory_product_branch ON inventory(product_id, branch_id);

-- Index for categories
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);

SELECT 'Performance indexes created successfully!' as message;
