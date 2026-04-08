// Script to update product image paths in MySQL database
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'frozenhub_pos',
  });

  // Update image paths that do not start with /uploads/products/
  const [result] = await connection.execute(
    `UPDATE products SET image = CONCAT('/uploads/products/', image)
     WHERE image IS NOT NULL AND image != '' AND image NOT LIKE '/uploads/products/%'`
  );

  console.log(`Updated ${result.affectedRows} product image paths.`);
  await connection.end();
}

main().catch(err => {
  console.error('Error updating product image paths:', err);
  process.exit(1);
});
