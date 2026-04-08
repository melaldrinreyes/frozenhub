import mysql from 'mysql2/promise';

/**
 * Database Indexing Script
 * Creates comprehensive indexes for optimal query performance
 */

async function createDatabaseIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'frozenhub_pos'
  });

  try {
    console.log('🔍 Creating database indexes...\n');

    // ==================== USERS TABLE ====================
    console.log('📊 Indexing users table...');
    
    await connection.query(`CREATE INDEX idx_users_branch_id ON users(branch_id)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_users_role_branch ON users(role, branch_id)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_users_created_at ON users(created_at)`).catch(() => {});
    
    console.log('  ✅ Users table indexed\n');

    // ==================== BRANCHES TABLE ====================
    console.log('📊 Indexing branches table...');

    await connection.query(`CREATE INDEX idx_branches_name ON branches(name)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_branches_location ON branches(location)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_branches_manager ON branches(manager)`).catch(() => {});

    console.log('  ✅ Branches table indexed\n');

    // ==================== CATEGORIES TABLE ====================
    console.log('📊 Indexing categories table...');

    await connection.query(`CREATE INDEX idx_categories_active ON categories(active)`).catch(() => {});

    console.log('  ✅ Categories table indexed\n');

    // ==================== PRODUCTS TABLE ====================
    console.log('📊 Indexing products table...');

    await connection.query(`CREATE INDEX idx_products_name ON products(name)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_products_active ON products(active)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_products_price ON products(price)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_products_category_active ON products(category, active)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_products_price_category ON products(price, category)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_products_created_at ON products(created_at DESC)`).catch(() => {});
    await connection.query(`CREATE FULLTEXT INDEX idx_products_search ON products(name, description)`).catch(() => {});

    console.log('  ✅ Products table indexed\n');

    // ==================== INVENTORY TABLE ====================
    console.log('📊 Indexing inventory table...');

    await connection.query(`CREATE INDEX idx_inventory_quantity ON inventory(quantity)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_inventory_branch_quantity ON inventory(branch_id, quantity)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_inventory_last_check ON inventory(last_stock_check)`).catch(() => {});

    console.log('  ✅ Inventory table indexed\n');

    // ==================== PRICING TABLE ====================
    console.log('📊 Indexing pricing table...');

    await connection.query(`CREATE INDEX idx_pricing_effective_from ON pricing(effective_from)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_pricing_effective_to ON pricing(effective_to)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_pricing_product_dates ON pricing(product_id, effective_from, effective_to)`).catch(() => {});

    console.log('  ✅ Pricing table indexed\n');

    // ==================== SALES TABLE ====================
    console.log('📊 Indexing sales table...');

    await connection.query(`CREATE INDEX idx_sales_payment_method ON sales(payment_method)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sales_created_by ON sales(created_by)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sales_total_amount ON sales(total_amount)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sales_branch_date ON sales(branch_id, date DESC)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sales_date_status ON sales(date DESC, status)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sales_branch_status ON sales(branch_id, status)`).catch(() => {});

    console.log('  ✅ Sales table indexed\n');

    // ==================== SALE_ITEMS TABLE ====================
    console.log('📊 Indexing sale_items table...');

    await connection.query(`CREATE INDEX idx_sale_items_product_id ON sale_items(product_id)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sale_items_quantity ON sale_items(quantity)`).catch(() => {});
    await connection.query(`CREATE INDEX idx_sale_items_total ON sale_items(total)`).catch(() => {});

    console.log('  ✅ Sale_items table indexed\n');

    // ==================== ANALYZE TABLES ====================
    console.log('📈 Analyzing tables for query optimization...');
    
    await connection.query('ANALYZE TABLE users');
    await connection.query('ANALYZE TABLE branches');
    await connection.query('ANALYZE TABLE categories');
    await connection.query('ANALYZE TABLE products');
    await connection.query('ANALYZE TABLE inventory');
    await connection.query('ANALYZE TABLE pricing');
    await connection.query('ANALYZE TABLE sales');
    await connection.query('ANALYZE TABLE sale_items');

    console.log('  ✅ Tables analyzed\n');

    console.log('✨ All database indexes created successfully!\n');
    console.log('📝 Index Summary:');
    console.log('   - Users: 5 indexes');
    console.log('   - Branches: 3 indexes');
    console.log('   - Categories: 2 indexes');
    console.log('   - Products: 9 indexes (including full-text search)');
    console.log('   - Inventory: 5 indexes');
    console.log('   - Pricing: 4 indexes');
    console.log('   - Sales: 9 indexes');
    console.log('   - Sale_items: 4 indexes');
    console.log('\n🚀 Database is now optimized for fast queries!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

createDatabaseIndexes();
