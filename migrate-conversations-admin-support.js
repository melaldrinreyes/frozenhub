import "dotenv/config";
import { getConnection } from "./server/db.ts";

async function migrateConversations() {
  console.log("Starting conversations table migration for admin support...");
  
  let connection;
  try {
    connection = await getConnection();
    
    // Drop the unique constraint if it exists
    console.log("Dropping unique constraint on customer_id and branch_id...");
    await connection.query(`
      ALTER TABLE conversations 
      DROP CONSTRAINT IF EXISTS unique_customer_branch
    `);
    
    // Make customer_id nullable
    console.log("Making customer_id nullable...");
    await connection.query(`
      ALTER TABLE conversations 
      ALTER COLUMN customer_id DROP NOT NULL
    `);
    
    console.log("✅ Migration completed successfully!");
    console.log("Conversations table now supports admin-branch messaging (customer_id can be NULL)");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

migrateConversations()
  .then(() => {
    console.log("Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
