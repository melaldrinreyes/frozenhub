import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// MySQL connection pool
let pool: mysql.Pool | null = null;

function getDatabaseName() {
  return process.env.DB_NAME || "frozenhub_pos";
}

function getDatabasePort() {
  const rawPort = process.env.DB_PORT;
  const parsed = rawPort ? Number(rawPort) : 3306;
  return Number.isFinite(parsed) ? parsed : 3306;
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: getDatabasePort(),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: getDatabaseName(),
      connectTimeout: 10000,
      acquireTimeout: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

// Get a connection from the pool
export async function getConnection() {
  const pool = getPool();
  return await pool.getConnection();
}

// Initialize database schema
export async function initializeDatabase() {
  const databaseName = getDatabaseName();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: getDatabasePort(),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectTimeout: 10000,
  });
  
  try {
    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    await connection.query(`USE \`${databaseName}\``);

    // Recreate the application pool now that the database exists
    if (pool) {
      await pool.end();
      pool = null;
    }
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: getDatabasePort(),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: databaseName,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'branch_admin', 'pos_operator', 'customer', 'rider') NOT NULL,
        branch_id VARCHAR(255),
        created_at DATETIME NOT NULL,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Branches table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        manager VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        barcode VARCHAR(100) UNIQUE NOT NULL, -- New field for barcodes
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL,
        image VARCHAR(255) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        INDEX idx_sku (sku),
        INDEX idx_category (category),
        INDEX idx_barcode (barcode) -- Index for faster lookups
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // MySQL 5.7 does not support IF NOT EXISTS in ADD COLUMN/INDEX.
    // Use metadata checks to keep this migration compatible.
    const [barcodeColumn] = await connection.query(`SHOW COLUMNS FROM products LIKE 'barcode'`);
    if ((barcodeColumn as any[]).length === 0) {
      await connection.query(`ALTER TABLE products ADD COLUMN barcode VARCHAR(100) UNIQUE`);
    }

    const [barcodeIndex] = await connection.query(`SHOW INDEX FROM products WHERE Key_name = 'idx_barcode'`);
    if ((barcodeIndex as any[]).length === 0) {
      await connection.query(`CREATE INDEX idx_barcode ON products(barcode)`);
    }

    // Inventory table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        reorder_level INT NOT NULL DEFAULT 50,
        last_stock_check DATETIME NOT NULL,
        UNIQUE KEY unique_product_branch (product_id, branch_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        INDEX idx_branch (branch_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Pricing table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pricing (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        base_price DECIMAL(10, 2) NOT NULL,
        wholesale_price DECIMAL(10, 2) NOT NULL,
        retail_price DECIMAL(10, 2) NOT NULL,
        distributor_price DECIMAL(10, 2) NOT NULL,
        markup DECIMAL(10, 2) NOT NULL,
        effective_from DATETIME NOT NULL,
        effective_to DATETIME NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Sales table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(255) PRIMARY KEY,
        date DATETIME NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        items_count INT NOT NULL,
        payment_method ENUM('cash', 'card', 'gcash', 'paymaya', 'bank_transfer', 'online') NOT NULL,
        status ENUM('pending', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        created_by VARCHAR(255) NULL,
        assigned_rider_id VARCHAR(255) NULL,
        customer_info TEXT COMMENT 'JSON data of customer information',
        notes TEXT COMMENT 'Additional notes for the sale',
        payment_status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending',
        picked_up_at DATETIME NULL,
        delivered_at DATETIME NULL,
        subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Subtotal before discounts',
        discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Total discount amount',
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_rider_id) REFERENCES users(id),
        INDEX idx_branch (branch_id),
        INDEX idx_date (date),
        INDEX idx_status (status),
        INDEX idx_created_by (created_by),
        INDEX idx_assigned_rider (assigned_rider_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Sale items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(255) PRIMARY KEY,
        sale_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Item subtotal before discount',
        discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Discount applied to item',
        promo_id VARCHAR(255) COMMENT 'Promo applied to this item',
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        INDEX idx_sale (sale_id),
        INDEX idx_promo (promo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Settings table for banner and other configurations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(255) PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at DATETIME NOT NULL,
        updated_by VARCHAR(255),
        INDEX idx_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Stock transfer logs table for audit trail
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_transfer_logs (
        id VARCHAR(255) PRIMARY KEY,
        transfer_date DATETIME NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        from_branch_id VARCHAR(255) NOT NULL,
        from_branch_name VARCHAR(255) NOT NULL,
        to_branch_id VARCHAR(255) NOT NULL,
        to_branch_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        reason TEXT,
        approved_by VARCHAR(255) NOT NULL,
        approved_by_name VARCHAR(255) NOT NULL,
        status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed',
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id),
        INDEX idx_transfer_date (transfer_date),
        INDEX idx_product (product_id),
        INDEX idx_from_branch (from_branch_id),
        INDEX idx_to_branch (to_branch_id),
        INDEX idx_approved_by (approved_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Promos table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS promos (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(10, 2) NOT NULL,
        min_purchase DECIMAL(10, 2) DEFAULT 0,
        max_discount DECIMAL(10, 2) DEFAULT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        created_by VARCHAR(255),
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_active (active),
        INDEX idx_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Product promos junction table (many-to-many)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_promos (
        id VARCHAR(255) PRIMARY KEY,
        promo_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_promo_product (promo_id, product_id),
        FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_promo (promo_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Cart table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Cart items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id VARCHAR(255) PRIMARY KEY,
        cart_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_cart_product (cart_id, product_id),
        INDEX idx_cart (cart_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Activity logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_role ENUM('admin', 'branch_admin', 'pos_operator', 'customer', 'rider') NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        entity_name VARCHAR(255),
        description TEXT,
        metadata JSON,
        ip_address VARCHAR(45),
        branch_id VARCHAR(255),
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        INDEX idx_user (user_id),
        INDEX idx_action (action),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_branch (branch_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Rider-branch assignment table (admin-controlled mapping)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rider_branch_assignments (
        id VARCHAR(255) PRIMARY KEY,
        rider_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        assigned_by VARCHAR(255) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uniq_rider_assignment (rider_id),
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id),
        INDEX idx_assignment_branch (branch_id),
        INDEX idx_assignment_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Rider delivery history table (persistent delivery logs)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_history (
        id VARCHAR(255) PRIMARY KEY,
        sale_id VARCHAR(255) NOT NULL,
        rider_id VARCHAR(255) NOT NULL,
        branch_id VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NULL,
        customer_phone VARCHAR(100) NULL,
        customer_address TEXT NULL,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payment_status VARCHAR(50) NULL,
        picked_up_at DATETIME NULL,
        delivered_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY uniq_delivery_sale (sale_id),
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        INDEX idx_delivery_rider (rider_id),
        INDEX idx_delivery_branch (branch_id),
        INDEX idx_delivery_delivered_at (delivered_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("✅ Database schema initialized");
    
    // Run migrations for existing databases
    await runMigrations(connection);
  } finally {
    await connection.end();
  }
}

// Run database migrations for existing tables
async function runMigrations(connection: mysql.PoolConnection) {
  try {
    console.log("🔄 Running database migrations...");

    // Migration 1: Add new columns to sales table
    try {
      // Check and add customer_info column
      const [salesColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'customer_info'`);
      if ((salesColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN customer_info TEXT COMMENT 'JSON data of customer information'
        `);
      }
      
      // Check and add notes column
      const [notesColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'notes'`);
      if ((notesColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN notes TEXT COMMENT 'Additional notes for the sale'
        `);
      }
      
      // Check and add subtotal column
      const [subtotalColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'subtotal'`);
      if ((subtotalColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Subtotal before discounts'
        `);
      }
      
      // Check and add discount_amount column
      const [discountColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'discount_amount'`);
      if ((discountColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales 
          ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Total discount amount'
        `);
      }

      const [riderColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'assigned_rider_id'`);
      if ((riderColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN assigned_rider_id VARCHAR(255) NULL AFTER created_by
        `);
      }

      const [paymentStatusColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'payment_status'`);
      if ((paymentStatusColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN payment_status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending' AFTER notes
        `);
      }

      const [pickedUpAtColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'picked_up_at'`);
      if ((pickedUpAtColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN picked_up_at DATETIME NULL AFTER payment_status
        `);
      }

      const [deliveredAtColumns] = await connection.query(`SHOW COLUMNS FROM sales LIKE 'delivered_at'`);
      if ((deliveredAtColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD COLUMN delivered_at DATETIME NULL AFTER picked_up_at
        `);
      }

      const [riderIdxRows] = await connection.query(`SHOW INDEX FROM sales WHERE Key_name = 'idx_assigned_rider'`);
      if ((riderIdxRows as any[]).length === 0) {
        await connection.query(`CREATE INDEX idx_assigned_rider ON sales(assigned_rider_id)`);
      }

      const [riderFkRows] = await connection.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sales'
          AND COLUMN_NAME = 'assigned_rider_id'
          AND REFERENCED_TABLE_NAME = 'users'
      `);
      if ((riderFkRows as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sales
          ADD CONSTRAINT fk_sales_assigned_rider
          FOREIGN KEY (assigned_rider_id) REFERENCES users(id)
        `);
      }

      // Ensure status enum supports online order workflow states.
      await connection.query(`
        ALTER TABLE sales
        MODIFY COLUMN status ENUM('pending', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'completed', 'cancelled')
        NOT NULL DEFAULT 'pending'
      `);

      await connection.query(`
        UPDATE sales
        SET payment_status = 'succeeded'
        WHERE status = 'completed'
          AND customer_info IS NOT NULL
          AND (payment_status IS NULL OR payment_status = 'pending')
      `);
      
      console.log("  ✅ Sales table updated");
    } catch (error: any) {
      console.error("  ⚠️  Sales table migration error:", error.message);
    }

    // Migration 2: Add new columns to sale_items table
    try {
      // Check and add subtotal column
      const [siSubtotalColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'subtotal'`);
      if ((siSubtotalColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0 COMMENT 'Item subtotal before discount'
        `);
      }
      
      // Check and add discount_amount column
      const [siDiscountColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'discount_amount'`);
      if ((siDiscountColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Discount applied to item'
        `);
      }
      
      // Check and add promo_id column
      const [siPromoColumns] = await connection.query(`SHOW COLUMNS FROM sale_items LIKE 'promo_id'`);
      if ((siPromoColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE sale_items 
          ADD COLUMN promo_id VARCHAR(255) COMMENT 'Promo applied to this item'
        `);
        
        // Add index for promo_id
        await connection.query(`
          CREATE INDEX idx_sale_items_promo ON sale_items(promo_id)
        `);
      }
      
      console.log("  ✅ Sale items table updated");
    } catch (error: any) {
      console.error("  ⚠️  Sale items table migration error:", error.message);
    }

    // Migration 3: Add created_at to product_promos
    try {
      const [ppCreatedColumns] = await connection.query(`SHOW COLUMNS FROM product_promos LIKE 'created_at'`);
      if ((ppCreatedColumns as any[]).length === 0) {
        await connection.query(`
          ALTER TABLE product_promos 
          ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `);
      }
      console.log("  ✅ Product promos table updated");
    } catch (error: any) {
      console.error("  ⚠️  Product promos table migration error:", error.message);
    }

    // Migration 4: Ensure rider assignment table exists and backfill
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS rider_branch_assignments (
          id VARCHAR(255) PRIMARY KEY,
          rider_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          assigned_by VARCHAR(255) NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          UNIQUE KEY uniq_rider_assignment (rider_id),
          FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_by) REFERENCES users(id),
          INDEX idx_assignment_branch (branch_id),
          INDEX idx_assignment_active (active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        INSERT INTO rider_branch_assignments (id, rider_id, branch_id, assigned_by, active, created_at, updated_at)
        SELECT CONCAT('rba-', u.id), u.id, u.branch_id, NULL, TRUE, NOW(), NOW()
        FROM users u
        WHERE u.role = 'rider' AND u.branch_id IS NOT NULL
        ON DUPLICATE KEY UPDATE
          branch_id = VALUES(branch_id),
          active = TRUE,
          updated_at = NOW()
      `);

      console.log("  ✅ Rider assignment table updated");
    } catch (error: any) {
      console.error("  ⚠️  Rider assignment migration error:", error.message);
    }

    // Migration 5: Update existing records
    try {
      await connection.query(`
        UPDATE sale_items SET subtotal = total WHERE subtotal = 0 OR subtotal IS NULL
      `);
      await connection.query(`
        UPDATE sales SET subtotal = total_amount WHERE subtotal = 0 OR subtotal IS NULL
      `);
      console.log("  ✅ Existing records updated");
    } catch (error: any) {
      console.error("  ⚠️  Record update warning:", error.message);
    }

    // Migration 6: Ensure delivery history table exists and backfill
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS delivery_history (
          id VARCHAR(255) PRIMARY KEY,
          sale_id VARCHAR(255) NOT NULL,
          rider_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          customer_name VARCHAR(255) NULL,
          customer_phone VARCHAR(100) NULL,
          customer_address TEXT NULL,
          total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
          payment_status VARCHAR(50) NULL,
          picked_up_at DATETIME NULL,
          delivered_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL,
          UNIQUE KEY uniq_delivery_sale (sale_id),
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
          INDEX idx_delivery_rider (rider_id),
          INDEX idx_delivery_branch (branch_id),
          INDEX idx_delivery_delivered_at (delivered_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        INSERT INTO delivery_history (
          id, sale_id, rider_id, branch_id, customer_name, customer_phone, customer_address,
          total_amount, payment_status, picked_up_at, delivered_at, created_at
        )
        SELECT
          CONCAT('dh-', s.id),
          s.id,
          s.assigned_rider_id,
          s.branch_id,
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.name')),
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')),
          JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.address')),
          COALESCE(s.total_amount, 0),
          COALESCE(s.payment_status, 'completed'),
          s.picked_up_at,
          COALESCE(s.delivered_at, s.date),
          NOW()
        FROM sales s
        WHERE s.status = 'completed'
          AND s.assigned_rider_id IS NOT NULL
          AND s.customer_info IS NOT NULL
        ON DUPLICATE KEY UPDATE
          rider_id = VALUES(rider_id),
          branch_id = VALUES(branch_id),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          customer_address = VALUES(customer_address),
          total_amount = VALUES(total_amount),
          payment_status = VALUES(payment_status),
          picked_up_at = VALUES(picked_up_at),
          delivered_at = VALUES(delivered_at)
      `);

      console.log("  ✅ Delivery history table updated");
    } catch (error: any) {
      console.error("  ⚠️  Delivery history migration error:", error.message);
    }

    console.log("✅ Database migrations completed");
  } catch (error) {
    console.error("❌ Migration error:", error);
    // Don't throw - allow app to continue even if migrations fail
  }
}

// Seed initial data
export async function seedDatabase() {
  const connection = await getConnection();
  
  try {
    // Check if data already exists (check categories instead of branches)
    const [categories] = await connection.query("SELECT COUNT(*) as count FROM categories");
    const categoryCount = (categories as any)[0].count;
    
    if (categoryCount > 0) {
      console.log("⏭️  Database already seeded");
      return;
    }

    console.log("🌱 Seeding database...");

    // Insert categories
    const categoryData = [
      ["cat-001", "Meat", "Fresh frozen meat products", true, "2023-01-01 00:00:00"],
      ["cat-002", "Seafood", "Fresh frozen seafood products", true, "2023-01-01 00:00:00"],
      ["cat-003", "Vegetables", "Fresh frozen vegetables", true, "2023-01-01 00:00:00"],
      ["cat-004", "Fruits", "Fresh frozen fruits and berries", true, "2023-01-01 00:00:00"],
    ];

    await connection.query(
      "INSERT INTO categories (id, name, description, active, created_at) VALUES ?",
      [categoryData]
    );

    // Skip branch seeding - let admin add branches manually
    console.log("⏭️  Skipping branch mock data - admin can add branches manually");

    // Insert only the system administrator user
    const adminUser = {
      id: "user-admin-001",
      name: "System Administrator",
      email: "admin@gmail.com",
      phone: "+1-555-0001",
      password: "admin123",
      role: "admin",
      branch_id: null,
      created_at: "2023-01-01 00:00:00"
    };

    const passwordHash = bcrypt.hashSync(adminUser.password, 10);
    await connection.query(
      "INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [adminUser.id, adminUser.name, adminUser.email, adminUser.phone, passwordHash, adminUser.role, adminUser.branch_id, adminUser.created_at]
    );

    console.log("✅ Admin user created - email: admin@gmail.com, password: admin123");

    // Insert default CMS settings
    const defaultSettings = [
      ["cms-001", "hero_banner", "/placeholder.svg", "2023-01-01 00:00:00", null],
      ["cms-002", "hero_title", "Premium Frozen Foods", "2023-01-01 00:00:00", null],
      ["cms-003", "hero_subtitle", "Quality You Can Trust", "2023-01-01 00:00:00", null],
      ["cms-004", "hero_description", "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals.", "2023-01-01 00:00:00", null],
      ["cms-005", "about_title", "About Batangas Premium Bongabong", "2023-01-01 00:00:00", null],
      ["cms-006", "about_description", "At Batangas Premium Bongabong, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry.", "2023-01-01 00:00:00", null],
      ["cms-007", "about_mission", "To provide the highest quality frozen products while maintaining exceptional service and competitive pricing.", "2023-01-01 00:00:00", null],
      ["cms-008", "about_values", "Quality, Trust, Service, Innovation", "2023-01-01 00:00:00", null],
      ["cms-009", "company_name", "Batangas Premium Bongabong", "2023-01-01 00:00:00", null],
      ["cms-010", "company_logo", null, "2023-01-01 00:00:00", null],
      ["cms-011", "featured_bg_type", "color", "2023-01-01 00:00:00", null],
      ["cms-012", "featured_bg_color", "#ffffff", "2023-01-01 00:00:00", null],
      ["cms-013", "featured_bg_image", null, "2023-01-01 00:00:00", null],
    ];

    await connection.query(
      "INSERT INTO settings (id, setting_key, setting_value, updated_at, updated_by) VALUES ?",
      [defaultSettings]
    );

    console.log("✅ Default CMS settings created");

    // Skip product seeding - let admin add products manually with images
    console.log("⏭️  Skipping product mock data - admin can add products manually");

    // Insert sample activity logs for Recent Activity section
    const activityLogs = [
      // Recent product additions
      ["log-1", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-001", "Frozen Chicken Breast - 5kg pack", "New product added to catalog", '{"category": "Frozen Meat", "price": 850.00}', "192.168.1.1", null, new Date(Date.now() - 2 * 60 * 60 * 1000)], // 2 hours ago
      ["log-2", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-002", "Premium Ice Cream - Vanilla 1L", "New product added to catalog", '{"category": "Frozen Desserts", "price": 320.00}', "192.168.1.1", null, new Date(Date.now() - 4 * 60 * 60 * 1000)], // 4 hours ago
      
      // Price updates
      ["log-3", "user-admin-001", "Admin User", "admin", "PRICE_UPDATED", "product_category", "cat-vegetables", "Frozen Vegetables", "Bulk price adjustment for category", '{"old_price_range": "50-200", "new_price_range": "45-180", "discount": "10%"}', "192.168.1.1", null, new Date(Date.now() - 5 * 60 * 60 * 1000)], // 5 hours ago
      ["log-4", "user-admin-001", "Admin User", "admin", "UPDATE", "product", "prod-seafood-001", "Frozen Salmon Fillet 500g", "Price updated due to supplier cost change", '{"old_price": 450.00, "new_price": 420.00}', "192.168.1.1", null, new Date(Date.now() - 8 * 60 * 60 * 1000)], // 8 hours ago
      
      // Sales transactions
      ["log-5", "user-pos-001", "POS Operator", "pos_operator", "SALE_CREATED", "sale", "sale-2847", "Order #2847", "Sale transaction completed", '{"total": 1250.00, "items": 5, "payment_method": "cash", "discount": 125.00}', "192.168.1.100", "branch-003", new Date(Date.now() - 24 * 60 * 60 * 1000)], // 1 day ago
      ["log-6", "user-pos-002", "Branch Manager", "branch_admin", "SALE_CREATED", "sale", "sale-2846", "Order #2846", "Large bulk order processed", '{"total": 3450.00, "items": 12, "payment_method": "card", "customer_type": "wholesale"}', "192.168.1.101", "branch-002", new Date(Date.now() - 25 * 60 * 60 * 1000)], // 1 day ago
      
      // Inventory adjustments
      ["log-7", "user-branch-001", "Branch Admin", "branch_admin", "INVENTORY_ADJUSTED", "inventory", "inv-seafood-001", "Frozen Seafood Collection", "Monthly inventory reconciliation completed", '{"adjusted_items": 15, "total_value_change": -450.00, "reason": "spoilage"}', "192.168.1.102", "branch-001", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)], // 2 days ago
      ["log-8", "user-admin-001", "Admin User", "admin", "INVENTORY_ADJUSTED", "inventory", "inv-chicken-001", "Frozen Chicken Products", "Stock replenishment from supplier", '{"adjusted_items": 50, "total_value_change": 12500.00, "reason": "restock"}', "192.168.1.1", null, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000)], // 2 days ago
      
      // Promotional activities
      ["log-9", "user-admin-001", "Admin User", "admin", "PROMO_ACTIVATED", "promotion", "promo-001", "Weekend Special - 15% Off Frozen Meals", "Weekend promotion activated", '{"discount_type": "percentage", "discount_value": 15, "valid_until": "2025-11-10"}', "192.168.1.1", null, new Date(Date.now() - 3 * 60 * 60 * 1000)], // 3 hours ago
      ["log-10", "user-admin-001", "Admin User", "admin", "PROMO_DEACTIVATED", "promotion", "promo-halloween", "Halloween Bundle Deals", "Seasonal promotion ended", '{"reason": "expired", "total_usage": 45, "total_savings": 2250.00}', "192.168.1.1", null, new Date(Date.now() - 6 * 60 * 60 * 1000)], // 6 hours ago
      
      // User activities
      ["log-11", "user-branch-002", "Jane Smith", "branch_admin", "USER_LOGIN", "auth", "user-branch-002", "Jane Smith", "User logged into system", '{"login_method": "email", "device": "desktop"}', "192.168.1.103", "branch-002", new Date(Date.now() - 30 * 60 * 1000)], // 30 minutes ago
      ["log-12", "user-pos-003", "Mike Johnson", "pos_operator", "USER_LOGIN", "auth", "user-pos-003", "Mike Johnson", "User started shift", '{"login_method": "email", "device": "pos_terminal", "shift": "morning"}', "192.168.1.104", "branch-001", new Date(Date.now() - 60 * 60 * 1000)], // 1 hour ago
    ];

    await connection.query(
      `INSERT INTO activity_logs (
        id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, description, metadata, ip_address, branch_id, created_at
      ) VALUES ?`,
      [activityLogs]
    );

    console.log("✅ Sample activity logs created");
    console.log("✅ Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    connection.release();
  }
}
