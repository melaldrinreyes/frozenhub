// Script to check and assign branch_id to branch admins
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkBranchAdmins() {
  const client = await pool.connect();
  
  try {
    console.log("=== Checking Branch Admins ===\n");
    
    // Get all branch admins
    const { rows: branchAdmins } = await client.query(
      `SELECT id, name, email, role, branch_id 
       FROM users 
       WHERE role = 'branch_admin'
       ORDER BY name`
    );
    
    console.log(`Found ${branchAdmins.length} branch admin(s):\n`);
    
    branchAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name} (${admin.email})`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Branch ID: ${admin.branch_id || '❌ NOT ASSIGNED'}`);
      console.log();
    });
    
    // Get all branches
    const { rows: branches } = await client.query(
      `SELECT id, name, location, manager 
       FROM branches 
       ORDER BY name`
    );
    
    console.log(`\n=== Available Branches ===\n`);
    
    branches.forEach((branch, index) => {
      console.log(`${index + 1}. ${branch.name} - ${branch.location}`);
      console.log(`   ID: ${branch.id}`);
      console.log(`   Manager: ${branch.manager}`);
      console.log();
    });
    
    // Check conversations
    const { rows: conversations } = await client.query(
      `SELECT c.*, b.name as branch_name, u.name as customer_name
       FROM conversations c
       LEFT JOIN branches b ON b.id = c.branch_id
       LEFT JOIN users u ON u.id = c.customer_id
       ORDER BY c.created_at DESC`
    );
    
    console.log(`\n=== Conversations ===\n`);
    console.log(`Found ${conversations.length} conversation(s):\n`);
    
    conversations.forEach((conv, index) => {
      console.log(`${index + 1}. Customer: ${conv.customer_name} → Branch: ${conv.branch_name}`);
      console.log(`   Conversation ID: ${conv.id}`);
      console.log(`   Branch ID: ${conv.branch_id}`);
      console.log(`   Branch Unread: ${conv.branch_unread_count}`);
      console.log(`   Customer Unread: ${conv.customer_unread_count}`);
      console.log();
    });
    
    // Check messages
    const { rows: messages } = await client.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       ORDER BY m.created_at DESC
       LIMIT 10`
    );
    
    console.log(`\n=== Recent Messages (last 10) ===\n`);
    
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. From: ${msg.sender_name} (${msg.sender_role})`);
      console.log(`   Message: ${msg.message_text.substring(0, 50)}...`);
      console.log(`   Conversation ID: ${msg.conversation_id}`);
      console.log(`   Created: ${msg.created_at}`);
      console.log();
    });
    
    // Suggest fixes
    console.log("\n=== DIAGNOSIS ===\n");
    
    const adminsWithoutBranch = branchAdmins.filter(admin => !admin.branch_id);
    
    if (adminsWithoutBranch.length > 0) {
      console.log("❌ PROBLEM FOUND: Branch admins without branch_id assigned!");
      console.log("\nTo fix this, you need to assign a branch_id to each branch admin.");
      console.log("You can do this by running SQL commands like:\n");
      
      adminsWithoutBranch.forEach(admin => {
        console.log(`UPDATE users SET branch_id = '<branch-id>' WHERE id = '${admin.id}'; -- ${admin.name}`);
      });
      
      console.log("\nReplace <branch-id> with the actual branch ID from the list above.");
    } else {
      console.log("✅ All branch admins have branch_id assigned!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkBranchAdmins();
