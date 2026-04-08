import mysql from 'mysql2/promise';

(async () => {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  console.log('=== Checking sales table ===\n');
  
  const [sales] = await db.query(`
    SELECT 
      id, 
      date,
      DATE(date) as date_only,
      branch_id, 
      total_amount, 
      items_count, 
      created_by, 
      customer_info,
      payment_method,
      status
    FROM sales 
    ORDER BY date DESC 
    LIMIT 15
  `);
  
  console.log('Recent sales:');
  console.table(sales);
  
  console.log('\n=== Sales by date ===\n');
  const [byDate] = await db.query(`
    SELECT 
      DATE(date) as sale_date,
      COUNT(*) as count,
      SUM(total_amount) as total,
      SUM(items_count) as items
    FROM sales
    GROUP BY DATE(date)
    ORDER BY DATE(date) DESC
    LIMIT 10
  `);
  console.table(byDate);
  
  console.log('\n=== Customer vs POS sales ===\n');
  const [byType] = await db.query(`
    SELECT 
      DATE(date) as sale_date,
      CASE WHEN created_by IS NULL THEN 'Customer' ELSE 'POS' END as sale_type,
      COUNT(*) as count,
      SUM(total_amount) as total
    FROM sales
    WHERE DATE(date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(date), CASE WHEN created_by IS NULL THEN 'Customer' ELSE 'POS' END
    ORDER BY DATE(date) DESC, sale_type
  `);
  console.table(byType);

  console.log('\n=== Testing NOW() vs CURDATE() ===\n');
  const [nowTest] = await db.query(`
    SELECT 
      NOW() as now_time,
      CURDATE() as current_date,
      DATE_SUB(NOW(), INTERVAL 7 DAY) as now_minus_7,
      DATE_SUB(CURDATE(), INTERVAL 7 DAY) as curdate_minus_7,
      COUNT(*) as sales_with_now,
      (SELECT COUNT(*) FROM sales WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) as sales_with_curdate
    FROM sales
    WHERE date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  `);
  console.table(nowTest);

  await db.end();
})();
