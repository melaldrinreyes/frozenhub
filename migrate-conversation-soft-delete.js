// Migration script to add deleted_for column to conversations table
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log("=== Adding deleted_for column to conversations table ===\n");
    
    // Check if column already exists
    const { rows: columns } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
        AND column_name = 'deleted_for'
    `);
    
    if (columns.length > 0) {
      console.log("✅ Column 'deleted_for' already exists. Skipping migration.");
      return;
    }
    
    console.log("Adding 'deleted_for' column...");
    
    // Add the column
    await client.query(`
      ALTER TABLE conversations 
      ADD COLUMN deleted_for JSONB DEFAULT '[]'::jsonb
    `);
    
    console.log("✅ Column added successfully!");
    
    // Add index
    console.log("\nAdding index for better query performance...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_deleted_for 
      ON conversations USING gin(deleted_for)
    `);
    
    console.log("✅ Index created successfully!");
    
    // Verify
    const { rows: conversations } = await client.query(`
      SELECT id, customer_id, branch_id, deleted_for 
      FROM conversations 
      LIMIT 5
    `);
    
    console.log("\n=== Verification ===");
    console.log(`Found ${conversations.length} conversations (showing first 5):`);
    conversations.forEach((conv, i) => {
      console.log(`${i + 1}. Conversation ID: ${conv.id}`);
      console.log(`   Customer: ${conv.customer_id}`);
      console.log(`   Branch: ${conv.branch_id}`);
      console.log(`   deleted_for: ${JSON.stringify(conv.deleted_for)}`);
      console.log();
    });
    
    console.log("✅ Migration completed successfully!");
    console.log("\nHow it works:");
    console.log("- When a user deletes a conversation, their user ID is added to the deleted_for array");
    console.log("- The conversation is hidden only for that user");
    console.log("- Other users can still see the conversation");
    console.log("- This is a 'soft delete' or 'delete for me' feature");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
