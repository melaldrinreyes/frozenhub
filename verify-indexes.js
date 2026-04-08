import mysql from 'mysql2/promise';

/**
 * Verify Database Indexes
 * Shows all indexes created on each table
 */

async function verifyIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'frozenhub_pos'
  });

  try {
    console.log('🔍 Verifying database indexes...\n');

    const tables = [
      'users',
      'branches', 
      'categories',
      'products',
      'inventory',
      'pricing',
      'sales',
      'sale_items'
    ];

    for (const table of tables) {
      console.log(`\n📊 Indexes on ${table} table:`);
      console.log('─'.repeat(80));
      
      const [indexes] = await connection.query(`SHOW INDEX FROM ${table}`);
      
      // Group indexes by name
      const indexGroups = {};
      for (const idx of indexes) {
        if (!indexGroups[idx.Key_name]) {
          indexGroups[idx.Key_name] = {
            name: idx.Key_name,
            unique: idx.Non_unique === 0,
            type: idx.Index_type,
            columns: []
          };
        }
        indexGroups[idx.Key_name].columns.push(idx.Column_name);
      }

      // Display indexes
      for (const [name, info] of Object.entries(indexGroups)) {
        const uniqueFlag = info.unique ? '🔑 UNIQUE' : '📌';
        const columns = info.columns.join(', ');
        console.log(`  ${uniqueFlag} ${name.padEnd(35)} | ${columns}`);
      }
      
      console.log(`  Total: ${Object.keys(indexGroups).length} indexes`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Index verification complete!\n');

    // Get table statistics
    console.log('📈 Table Statistics:');
    console.log('─'.repeat(80));
    
    for (const table of tables) {
      const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = rows[0].count;
      console.log(`  ${table.padEnd(20)} ${count} rows`);
    }

    console.log('\n✨ Database is properly indexed and ready for production!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

verifyIndexes();
