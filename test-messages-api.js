// Test the messages API to see what branch admins receive
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testMessagesAPI() {
  const client = await pool.connect();
  
  try {
    console.log("=== Testing Messages API ===\n");
    
    // Get the branch admin for Bansud Branch
    const { rows: branchAdmins } = await client.query(
      `SELECT id, name, email, role, branch_id 
       FROM users 
       WHERE role = 'branch_admin' AND branch_id = 'branch-1776013644513-fcs2ks'`
    );
    
    if (branchAdmins.length === 0) {
      console.log("❌ No branch admin found for Bansud Branch!");
      return;
    }
    
    const branchAdmin = branchAdmins[0];
    console.log("Branch Admin:");
    console.log(`  Name: ${branchAdmin.name}`);
    console.log(`  Email: ${branchAdmin.email}`);
    console.log(`  Branch ID: ${branchAdmin.branch_id}\n`);
    
    // Simulate the API query that would run for this branch admin
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
        u.name as customer_name,
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
      INNER JOIN users u ON u.id = c.customer_id
      WHERE c.branch_id = $1
      ORDER BY c.last_message_at DESC
    `;
    
    console.log("Running query with branch_id:", branchAdmin.branch_id);
    console.log();
    
    const { rows: conversations } = await client.query(query, [branchAdmin.branch_id]);
    
    console.log(`Found ${conversations.length} conversation(s) for this branch admin:\n`);
    
    if (conversations.length === 0) {
      console.log("❌ No conversations found! This is the problem.");
      console.log("\nLet's check what's in the conversations table:");
      
      const { rows: allConvs } = await client.query(
        `SELECT * FROM conversations ORDER BY created_at DESC`
      );
      
      console.log(`\nAll conversations in database (${allConvs.length}):`);
      allConvs.forEach((conv, i) => {
        console.log(`\n${i + 1}.`);
        console.log(`   ID: ${conv.id}`);
        console.log(`   Customer ID: ${conv.customer_id}`);
        console.log(`   Branch ID: ${conv.branch_id}`);
        console.log(`   Branch ID matches? ${conv.branch_id === branchAdmin.branch_id ? '✅ YES' : '❌ NO'}`);
      });
    } else {
      conversations.forEach((conv, index) => {
        console.log(`${index + 1}. Conversation:`);
        console.log(`   ID: ${conv.id}`);
        console.log(`   Customer: ${conv.customer_name} (${conv.customer_email})`);
        console.log(`   Branch: ${conv.branch_name}`);
        console.log(`   Last Message: ${conv.last_message}`);
        console.log(`   Branch Unread: ${conv.branch_unread_count}`);
        console.log(`   Last Message At: ${conv.last_message_at}`);
        console.log();
      });
      
      console.log("✅ Conversations found! The API should work correctly.");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

testMessagesAPI();
