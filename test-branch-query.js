import "dotenv/config";
import { getConnection } from "./server/db.ts";

async function testBranchQuery() {
  console.log("Testing branch admin query...");
  
  let connection;
  try {
    connection = await getConnection();
    
    // Simulate branch admin query
    const branchId = "branch-1775955649069-0w7z7k"; // Bongabong Branch
    const userId = "user-branch-admin-1775955760563"; // Branch admin user ID (need to find this)
    
    // First, find the branch admin user ID
    const [branchAdmins] = await connection.query(`
      SELECT id, name, email FROM users 
      WHERE role = 'branch_admin' AND branch_id = $1
    `, [branchId]);
    
    console.log("\n=== BRANCH ADMIN ===");
    console.log(branchAdmins[0]);
    
    const actualUserId = branchAdmins[0]?.id;
    
    // Now run the actual query
    const query = `
      SELECT 
        c.id,
        c.customer_id,
        c.branch_id,
        c.last_message_at,
        c.customer_unread_count,
        c.branch_unread_count,
        c.created_at,
        b.name as branch_name,
        b.location as branch_location,
        CASE 
          WHEN c.customer_id IS NULL THEN 'Admin'
          ELSE u.name
        END as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        (
          SELECT message_text 
          FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message
      FROM conversations c
      INNER JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = c.customer_id
      WHERE c.branch_id = $1
        AND (c.deleted_for IS NULL OR NOT (c.deleted_for @> $2::jsonb))
      ORDER BY c.last_message_at DESC
    `;
    
    const [rows] = await connection.query(query, [branchId, JSON.stringify([actualUserId])]);
    
    console.log("\n=== QUERY RESULTS ===");
    console.log(`Found ${rows.length} conversations`);
    rows.forEach((conv, i) => {
      console.log(`\n${i + 1}. ${conv.customer_name}`);
      console.log(`   Customer ID: ${conv.customer_id || 'NULL'}`);
      console.log(`   Branch: ${conv.branch_name}`);
      console.log(`   Last message: ${conv.last_message}`);
      console.log(`   Unread (branch): ${conv.branch_unread_count}`);
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

testBranchQuery()
  .then(() => {
    console.log("\n✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
