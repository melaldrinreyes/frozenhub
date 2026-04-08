import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log("🚀 Running database migrations...\n");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "frozenhub_pos",
    multipleStatements: true,
  });

  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));

    console.log(`Found ${migrationFiles.length} migration file(s):\n`);

    for (const file of migrationFiles) {
      console.log(`📄 Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      
      try {
        await connection.query(sql);
        console.log(`✅ ${file} completed successfully\n`);
      } catch (error: any) {
        // Ignore duplicate key errors (index already exists)
        if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_INDEX') {
          console.log(`⚠️  ${file} - Index already exists, skipping\n`);
        } else {
          console.error(`❌ ${file} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log("\n✨ All migrations completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigrations().catch(console.error);
