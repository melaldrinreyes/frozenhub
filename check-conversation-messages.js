// Check specific conversation and its messages
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkConversation() {
  const client = await pool.connect();
  
  try {
    console.log("=== Checking Conversations and Messages ===\n");
    
    // Get all conversations
    const { rows: conversations } = await client.query(`
      SELECT c.*, b.name as branch_name, u.name as customer_name
      FROM conversations c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = c.customer_id
      ORDER BY c.created_at DESC
    `);
    
    console.log(`Found ${conversations.length} conversation(s):\n`);
    
    for (const conv of conversations) {
      console.log(`Conversation: ${conv.customer_name} → ${conv.branch_name}`);
      console.log(`  ID: ${conv.id}`);
      console.log(`  Customer ID: ${conv.customer_id}`);
      console.log(`  Branch ID: ${conv.branch_id}`);
      console.log(`  Branch Unread: ${conv.branch_unread_count}`);
      console.log(`  Customer Unread: ${conv.customer_unread_count}`);
      
      // Get messages for this conversation
      const { rows: messages } = await client.query(`
        SELECT m.*, u.name as sender_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `, [conv.id]);
      
      console.log(`  Messages: ${messages.length}`);
      messages.forEach((msg, i) => {
        console.log(`    ${i + 1}. [${msg.sender_name}] ${msg.message_text}`);
        console.log(`       Deleted for: ${JSON.stringify(msg.deleted_for)}`);
      });
      console.log();
    }
    
    // Get branch admin user
    const { rows: branchAdmins } = await client.query(`
      SELECT id, name, email, branch_id
      FROM users
      WHERE role = 'branch_admin'
      ORDER BY name
    `);
    
    console.log(`\n=== Branch Admins ===\n`);
    branchAdmins.forEach((admin, i) => {
      console.log(`${i + 1}. ${admin.name} (${admin.email})`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Branch ID: ${admin.branch_id}`);
      console.log();
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkConversation();
