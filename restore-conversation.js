import "dotenv/config";
import { getConnection } from "./server/db.ts";

async function restoreConversation() {
  console.log("Restoring deleted conversation...");
  
  let connection;
  try {
    connection = await getConnection();
    
    // Clear deleted_for for the customer conversation
    await connection.query(`
      UPDATE conversations
      SET deleted_for = '[]'::jsonb
      WHERE id = 'conv-1778428537266-uqaplu'
    `);
    
    console.log("✅ Conversation restored!");
    
    // Verify
    const [conv] = await connection.query(`
      SELECT id, deleted_for FROM conversations WHERE id = 'conv-1778428537266-uqaplu'
    `);
    
    console.log("\nVerification:");
    console.log(conv[0]);
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

restoreConversation()
  .then(() => {
    console.log("\n✅ Restore completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Restore failed:", error);
    process.exit(1);
  });
