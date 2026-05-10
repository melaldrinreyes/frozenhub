// Check if messages query is working correctly
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkMessages() {
  const client = await pool.connect();
  
  try {
    console.log("=== Checking Messages ===\n");
    
    // Get all messages
    const { rows: allMessages } = await client.query(`
      SELECT id, conversation_id, sender_id, message_text, deleted_for, created_at
      FROM messages
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${allMessages.length} messages:\n`);
    allMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.message_text}`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Sender: ${msg.sender_id}`);
      console.log(`   Deleted for: ${JSON.stringify(msg.deleted_for)}`);
      console.log();
    });
    
    // Test the query with a user ID
    if (allMessages.length > 0) {
      const testUserId = allMessages[0].sender_id;
      console.log(`\n=== Testing query with user ID: ${testUserId} ===\n`);
      
      // Original query (might be failing)
      try {
        const { rows: filtered1 } = await client.query(`
          SELECT id, message_text, deleted_for
          FROM messages
          WHERE conversation_id = $1
            AND NOT (deleted_for ? $2)
          ORDER BY created_at ASC
        `, [allMessages[0].conversation_id, testUserId]);
        
        console.log(`Query 1 (with ? operator): ${filtered1.length} messages`);
      } catch (error) {
        console.error(`Query 1 FAILED:`, error.message);
      }
      
      // Alternative query (safer)
      try {
        const { rows: filtered2 } = await client.query(`
          SELECT id, message_text, deleted_for
          FROM messages
          WHERE conversation_id = $1
            AND NOT (deleted_for @> $2::jsonb)
          ORDER BY created_at ASC
        `, [allMessages[0].conversation_id, JSON.stringify([testUserId])]);
        
        console.log(`Query 2 (with @> operator): ${filtered2.length} messages`);
      } catch (error) {
        console.error(`Query 2 FAILED:`, error.message);
      }
      
      // Simplest query (no filter)
      const { rows: filtered3 } = await client.query(`
        SELECT id, message_text, deleted_for
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
      `, [allMessages[0].conversation_id]);
      
      console.log(`Query 3 (no filter): ${filtered3.length} messages`);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMessages();
