import "dotenv/config";
import { initializeDatabase, seedDatabase } from "./db";

async function runMigrations() {
  try {
    console.log("🚀 Ensuring Supabase/Postgres schema is initialized...\n");
    await initializeDatabase();
    await seedDatabase();
    console.log("\n✨ Supabase/Postgres migrations completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

runMigrations().catch(console.error);
