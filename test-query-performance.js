import mysql from 'mysql2/promise';

/**
 * Test Query Performance
 * Runs common queries and shows execution time and whether indexes are used
 */

async function testQueryPerformance() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'frozenhub_pos'
  });

  try {
    console.log('🧪 Testing Query Performance\n');
    console.log('═'.repeat(100));

    // Test queries
    const queries = [
      {
        name: 'Login query (email lookup)',
        sql: "SELECT * FROM users WHERE email = 'admin@frozenhub.com'"
      },
      {
        name: 'Get active products by category',
        sql: "SELECT * FROM products WHERE category = 'Meat' AND active = TRUE"
      },
      {
        name: 'Branch inventory lookup',
        sql: "SELECT * FROM inventory WHERE branch_id = 'branch-001'"
      },
      {
        name: 'Low stock items',
        sql: "SELECT * FROM inventory WHERE quantity <= reorder_level"
      },
      {
        name: 'Sales report by branch',
        sql: "SELECT * FROM sales WHERE branch_id = 'branch-001' ORDER BY date DESC LIMIT 10"
      },
      {
        name: 'Product search (name)',
        sql: "SELECT * FROM products WHERE name LIKE '%Chicken%'"
      },
      {
        name: 'Recent users',
        sql: "SELECT * FROM users ORDER BY created_at DESC LIMIT 10"
      },
      {
        name: 'Branch + role query',
        sql: "SELECT * FROM users WHERE role = 'branch_admin' AND branch_id = 'branch-001'"
      }
    ];

    for (const query of queries) {
      console.log(`\n📊 ${query.name}`);
      console.log('─'.repeat(100));
      console.log(`Query: ${query.sql}`);
      
      // Get execution plan
      const [explain] = await connection.query(`EXPLAIN ${query.sql}`);
      
      // Execute query with timing
      const startTime = Date.now();
      await connection.query(query.sql);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Display results
      const explainData = explain[0];
      const usingIndex = explainData.type !== 'ALL';
      const indexUsed = explainData.key || 'NONE';
      const rowsScanned = explainData.rows;

      console.log(`⏱️  Execution Time: ${duration}ms`);
      console.log(`🔍 Index Used: ${indexUsed}`);
      console.log(`📄 Rows Scanned: ${rowsScanned}`);
      console.log(`${usingIndex ? '✅' : '❌'} ${usingIndex ? 'Using Index' : 'Full Table Scan'}`);
      
      if (!usingIndex) {
        console.log('⚠️  WARNING: This query is not using an index! Consider adding one.');
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log('\n📈 Performance Summary:\n');

    // Get table sizes
    console.log('Table Sizes:');
    console.log('─'.repeat(50));
    const [tables] = await connection.query(`
      SELECT 
        table_name as 'Table',
        table_rows as 'Rows',
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
        ROUND((index_length / 1024 / 1024), 2) AS 'Index Size (MB)'
      FROM information_schema.TABLES 
      WHERE table_schema = 'frozenhub_pos'
      ORDER BY (data_length + index_length) DESC
    `);
    
    console.table(tables);

    console.log('\n✅ Performance test complete!');
    console.log('\nTips:');
    console.log('  • Queries showing "Full Table Scan" need indexes');
    console.log('  • Execution time < 10ms is excellent');
    console.log('  • Execution time > 100ms needs optimization');
    console.log('  • Add more test data to see realistic performance');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

testQueryPerformance();
