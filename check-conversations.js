import "dotenv/config";
import { getConnection } from "./server/db.ts";

async function checkConversations() {
  console.log("Checking conversations in database...");
  
  let connection;
  try {
    connection = await getConnection();
    
    // Get all conversations
    const [allConvs] = await connection.query(`
      SELECT 
        c.id,
        c.customer_id,
        c.branch_id,
        c.last_message_at,
        b.name as branch_name,
        CASE 
          WHEN c.customer_id IS NULL THEN 'Admin'
          ELSE u.name
        END as customer_name
      FROM conversations c
      INNER JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = c.customer_id
      ORDER BY c.last_message_at DESC
    `);
    
    console.log("\n=== ALL CONVERSATIONS ===");
    console.log(`Total: ${allConvs.length}`);
    allConvs.forEach((conv, i) => {
      console.log(`\n${i + 1}. Conversation ID: ${conv.id}`);
      console.log(`   Customer: ${conv.customer_name} (ID: ${conv.customer_id || 'NULL'})`);
      console.log(`   Branch: ${conv.branch_name} (ID: ${conv.branch_id})`);
      console.log(`   Last message: ${conv.last_message_at}`);
    });
    
    // Get customer conversations
    const [customerConvs] = await connection.query(`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE customer_id IS NOT NULL
    `);
    console.log(`\n=== CUSTOMER-BRANCH CONVERSATIONS ===`);
    console.log(`Count: ${customerConvs[0].count}`);
    
    // Get admin conversations
    const [adminConvs] = await connection.query(`
      SELECT COUNT(*) as count
      FROM conversations
      WHERE customer_id IS NULL
    `);
    console.log(`\n=== ADMIN-BRANCH CONVERSATIONS ===`);
    console.log(`Count: ${adminConvs[0].count}`);
    
    // Get all branches
    const [branches] = await connection.query(`
      SELECT id, name FROM branches ORDER BY name
    `);
    console.log(`\n=== BRANCHES ===`);
    branches.forEach(b => {
      console.log(`- ${b.name} (ID: ${b.id})`);
    });
    
    // Get branch admins
    const [branchAdmins] = await connection.query(`
      SELECT id, name, email, branch_id FROM users WHERE role = 'branch_admin'
    `);
    console.log(`\n=== BRANCH ADMINS ===`);
    branchAdmins.forEach(ba => {
      console.log(`- ${ba.name} (${ba.email}) - Branch ID: ${ba.branch_id}`);
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

checkConversations()
  .then(() => {
    console.log("\n✅ Check completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Check failed:", error);
    process.exit(1);
  });
