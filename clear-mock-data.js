import mysql from 'mysql2/promise';

async function clearMockData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    console.log('🧹 Clearing mock data...');

    // Delete in order to respect foreign key constraints
    await connection.query("DELETE FROM sale_items");
    console.log('✅ Cleared sale_items');

    await connection.query("DELETE FROM sales");
    console.log('✅ Cleared sales');

    await connection.query("DELETE FROM pricing");
    console.log('✅ Cleared pricing');

    await connection.query("DELETE FROM inventory");
    console.log('✅ Cleared inventory');

    await connection.query("DELETE FROM products");
    console.log('✅ Cleared products');

    console.log('');
    console.log('✨ All mock data cleared successfully!');
    console.log('You can now add products manually through the admin panel.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

clearMockData();
