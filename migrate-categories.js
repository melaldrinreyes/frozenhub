import mysql from 'mysql2/promise';

async function migrateCategories() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    console.log('🔄 Migrating categories table...');

    // Create categories table
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

    // Check if categories already exist
    const [existing] = await connection.query("SELECT COUNT(*) as count FROM categories");
    const count = existing[0].count;

    if (count === 0) {
      console.log('📦 Seeding categories...');
      
      // Insert default categories
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

      console.log('✅ Categories seeded successfully!');
    } else {
      console.log('⏭️  Categories already exist');
    }

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await connection.end();
  }
}

migrateCategories();
