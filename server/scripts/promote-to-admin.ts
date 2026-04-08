import { createPool } from "mysql2/promise";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const pool = createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "frozenhub_pos",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function promoteUserToAdmin(email: string) {
  const connection = await pool.getConnection();
  
  try {
    console.log(`\n🔍 Looking for user: ${email}`);
    
    // Check if user exists
    const [users] = await connection.query(
      "SELECT id, name, email, role FROM users WHERE email = ?",
      [email]
    );

    if ((users as any[]).length === 0) {
      console.error(`❌ User not found: ${email}`);
      console.log("\n💡 Available users:");
      
      const [allUsers] = await connection.query(
        "SELECT email, name, role FROM users ORDER BY created_at DESC"
      );
      
      (allUsers as any[]).forEach(user => {
        console.log(`   - ${user.email} (${user.name}) - Role: ${user.role}`);
      });
      
      return;
    }

    const user = (users as any[])[0];
    
    if (user.role === "admin") {
      console.log(`ℹ️  User ${email} is already an admin`);
      return;
    }

    console.log(`📝 Current role: ${user.role}`);
    console.log(`🔄 Promoting to admin...`);

    // Update user role to admin
    await connection.query(
      "UPDATE users SET role = ? WHERE email = ?",
      ["admin", email]
    );

    console.log(`✅ Successfully promoted ${user.name} (${email}) to admin!`);
    console.log(`\n🔐 User can now:`);
    console.log(`   - Access all admin panels`);
    console.log(`   - Manage CMS content`);
    console.log(`   - Manage branches and users`);
    console.log(`   - View all analytics and reports`);
    
  } catch (error) {
    console.error("❌ Error promoting user:", error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error("❌ Please provide an email address");
  console.log("\nUsage:");
  console.log("  pnpm promote-admin <email>");
  console.log("\nExample:");
  console.log("  pnpm promote-admin user@example.com");
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error("❌ Invalid email format");
  process.exit(1);
}

promoteUserToAdmin(email);
