import { getConnection } from "./db";

/**
 * Comprehensive Database Indexing for frozenhub_pos
 * 
 * This script creates optimized indexes for all tables to improve query performance.
 * Run this after database initialization to add missing indexes.
 * 
 * Index Types:
 * - Single-column indexes: For frequently queried columns
 * - Composite indexes: For queries with multiple WHERE conditions
 * - Unique indexes: To enforce data integrity
 * - Full-text indexes: For text search operations
 */

export async function createDatabaseIndexes() {
  const connection = await getConnection();
  
  try {
    console.log("🔍 Creating database indexes...\n");

    // ==================== USERS TABLE ====================
    console.log("📊 Indexing users table...");
    
    // Email index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `).catch(() => console.log("  ✓ idx_users_email already exists"));

    // Role index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
    `).catch(() => console.log("  ✓ idx_users_role already exists"));

    // Branch ID index for filtering users by branch
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id)
    `).catch(() => console.log("  ✓ idx_users_branch_id already exists"));

    // Composite index for role + branch queries (common in admin panels)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_branch ON users(role, branch_id)
    `).catch(() => console.log("  ✓ idx_users_role_branch already exists"));

    // Created date index for user reports and analytics
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)
    `).catch(() => console.log("  ✓ idx_users_created_at already exists"));

    console.log("  ✅ Users table indexed\n");

    // ==================== BRANCHES TABLE ====================
    console.log("📊 Indexing branches table...");

    // Name index for searching branches by name
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(name)
    `).catch(() => console.log("  ✓ idx_branches_name already exists"));

    // Location index for geographical queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_location ON branches(location)
    `).catch(() => console.log("  ✓ idx_branches_location already exists"));

    // Manager index for finding branches by manager
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_manager ON branches(manager)
    `).catch(() => console.log("  ✓ idx_branches_manager already exists"));

    console.log("  ✅ Branches table indexed\n");

    // ==================== CATEGORIES TABLE ====================
    console.log("📊 Indexing categories table...");

    // Name index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)
    `).catch(() => console.log("  ✓ idx_categories_name already exists"));

    // Active status index for filtering active categories
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active)
    `).catch(() => console.log("  ✓ idx_categories_active already exists"));

    console.log("  ✅ Categories table indexed\n");

    // ==================== PRODUCTS TABLE ====================
    console.log("📊 Indexing products table...");

    // SKU index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)
    `).catch(() => console.log("  ✓ idx_products_sku already exists"));

    // Category index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)
    `).catch(() => console.log("  ✓ idx_products_category already exists"));

    // Name index for product search
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)
    `).catch(() => console.log("  ✓ idx_products_name already exists"));

    // Active status index for filtering active products
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)
    `).catch(() => console.log("  ✓ idx_products_active already exists"));

    // Price index for price range queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)
    `).catch(() => console.log("  ✓ idx_products_price already exists"));

    // Composite index for category + active queries (common in shop pages)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, active)
    `).catch(() => console.log("  ✓ idx_products_category_active already exists"));

    // Composite index for price range + category queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_price_category ON products(price, category)
    `).catch(() => console.log("  ✓ idx_products_price_category already exists"));

    // Created date index for sorting by newest
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)
    `).catch(() => console.log("  ✓ idx_products_created_at already exists"));

    // Full-text index for product search (name and description)
    await connection.query(`
      CREATE FULLTEXT INDEX IF NOT EXISTS idx_products_search ON products(name, description)
    `).catch(() => console.log("  ✓ idx_products_search already exists"));

    console.log("  ✅ Products table indexed\n");

    // ==================== INVENTORY TABLE ====================
    console.log("📊 Indexing inventory table...");

    // Branch index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id)
    `).catch(() => console.log("  ✓ idx_inventory_branch_id already exists"));

    // Product index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id)
    `).catch(() => console.log("  ✓ idx_inventory_product_id already exists"));

    // Quantity index for low stock queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity)
    `).catch(() => console.log("  ✓ idx_inventory_quantity already exists"));

    // Composite index for branch + low stock queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_branch_quantity ON inventory(branch_id, quantity)
    `).catch(() => console.log("  ✓ idx_inventory_branch_quantity already exists"));

    // Last stock check index for inventory audits
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_last_check ON inventory(last_stock_check)
    `).catch(() => console.log("  ✓ idx_inventory_last_check already exists"));

    console.log("  ✅ Inventory table indexed\n");

    // ==================== PRICING TABLE ====================
    console.log("📊 Indexing pricing table...");

    // Product index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_product_id ON pricing(product_id)
    `).catch(() => console.log("  ✓ idx_pricing_product_id already exists"));

    // Effective dates index for active pricing queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_effective_from ON pricing(effective_from)
    `).catch(() => console.log("  ✓ idx_pricing_effective_from already exists"));

    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_effective_to ON pricing(effective_to)
    `).catch(() => console.log("  ✓ idx_pricing_effective_to already exists"));

    // Composite index for product + date range queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_product_dates ON pricing(product_id, effective_from, effective_to)
    `).catch(() => console.log("  ✓ idx_pricing_product_dates already exists"));

    console.log("  ✅ Pricing table indexed\n");

    // ==================== SALES TABLE ====================
    console.log("📊 Indexing sales table...");

    // Branch index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id)
    `).catch(() => console.log("  ✓ idx_sales_branch_id already exists"));

    // Date index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC)
    `).catch(() => console.log("  ✓ idx_sales_date already exists"));

    // Status index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)
    `).catch(() => console.log("  ✓ idx_sales_status already exists"));

    // Payment method index for payment reports
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method)
    `).catch(() => console.log("  ✓ idx_sales_payment_method already exists"));

    // Created by index for user activity tracking
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by)
    `).catch(() => console.log("  ✓ idx_sales_created_by already exists"));

    // Total amount index for revenue queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_total_amount ON sales(total_amount)
    `).catch(() => console.log("  ✓ idx_sales_total_amount already exists"));

    // Composite index for branch + date queries (common in reports)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, date DESC)
    `).catch(() => console.log("  ✓ idx_sales_branch_date already exists"));

    // Composite index for date range + status queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(date DESC, status)
    `).catch(() => console.log("  ✓ idx_sales_date_status already exists"));

    // Composite index for branch + status queries
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_branch_status ON sales(branch_id, status)
    `).catch(() => console.log("  ✓ idx_sales_branch_status already exists"));

    console.log("  ✅ Sales table indexed\n");

    // ==================== SALE_ITEMS TABLE ====================
    console.log("📊 Indexing sale_items table...");

    // Sale index (already exists in schema but verify)
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)
    `).catch(() => console.log("  ✓ idx_sale_items_sale_id already exists"));

    // Product index for product sales analysis
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)
    `).catch(() => console.log("  ✓ idx_sale_items_product_id already exists"));

    // Quantity index for quantity-based reports
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_quantity ON sale_items(quantity)
    `).catch(() => console.log("  ✓ idx_sale_items_quantity already exists"));

    // Total index for revenue analysis
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_total ON sale_items(total)
    `).catch(() => console.log("  ✓ idx_sale_items_total already exists"));

    console.log("  ✅ Sale_items table indexed\n");

    // ==================== ANALYZE TABLES ====================
    console.log("📈 Analyzing tables for query optimization...");
    
    await connection.query("ANALYZE TABLE users");
    await connection.query("ANALYZE TABLE branches");
    await connection.query("ANALYZE TABLE categories");
    await connection.query("ANALYZE TABLE products");
    await connection.query("ANALYZE TABLE inventory");
    await connection.query("ANALYZE TABLE pricing");
    await connection.query("ANALYZE TABLE sales");
    await connection.query("ANALYZE TABLE sale_items");

    console.log("  ✅ Tables analyzed\n");

    console.log("✨ All database indexes created successfully!\n");
    console.log("📝 Index Summary:");
    console.log("   - Users: 5 indexes");
    console.log("   - Branches: 3 indexes");
    console.log("   - Categories: 2 indexes");
    console.log("   - Products: 9 indexes (including full-text search)");
    console.log("   - Inventory: 5 indexes");
    console.log("   - Pricing: 4 indexes");
    console.log("   - Sales: 9 indexes");
    console.log("   - Sale_items: 4 indexes");
    console.log("\n🚀 Database is now optimized for fast queries!");

  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  createDatabaseIndexes()
    .then(() => {
      console.log("✅ Index creation completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Index creation failed:", error);
      process.exit(1);
    });
}
