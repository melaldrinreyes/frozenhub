import "dotenv/config";
import { getConnection } from "./server/db.ts";

async function checkDeletedFor() {
  console.log("Checking deleted_for column...");
  
  let connection;
  try {
    connection = await getConnection();
    
    const [convs] = await connection.query(`
      SELECT 
        c.id,
        c.customer_id,
        c.branch_id,
        c.deleted_for,
        CASE 
          WHEN c.customer_id IS NULL THEN 'Admin'
          ELSE u.name
        END as customer_name,
        b.name as branch_name
      FROM conversations c
      INNER JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = c.customer_id
      ORDER BY c.last_message_at DESC
    `);
    
    console.log("\n=== CONVERSATIONS WITH deleted_for ===");
    convs.forEach((conv, i) => {
      console.log(`\n${i + 1}. ${conv.customer_name} → ${conv.branch_name}`);
      console.log(`   ID: ${conv.id}`);
      console.log(`   Customer ID: ${conv.customer_id || 'NULL'}`);
      console.log(`   deleted_for: ${JSON.stringify(conv.deleted_for)}`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

checkDeletedFor()
  .then(() => {
    console.log("\n✅ Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Check failed:", error);
    process.exit(1);
  });
