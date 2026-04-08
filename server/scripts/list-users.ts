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

async function listUsers() {
  const connection = await pool.getConnection();
  
  try {
    console.log("\n👥 Users in Database:\n");
    
    const [users] = await connection.query(
      "SELECT id, name, email, phone, role, branch_id, created_at FROM users ORDER BY created_at DESC"
    );

    if ((users as any[]).length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    // Group by role
    const groupedUsers: Record<string, any[]> = {};
    (users as any[]).forEach(user => {
      if (!groupedUsers[user.role]) {
        groupedUsers[user.role] = [];
      }
      groupedUsers[user.role].push(user);
    });

    // Display users by role
    const roleOrder = ["admin", "branch_admin", "pos_operator", "customer"];
    
    roleOrder.forEach(role => {
      if (groupedUsers[role]) {
        const roleEmoji = {
          admin: "👑",
          branch_admin: "🏢",
          pos_operator: "💼",
          customer: "👤"
        }[role] || "👤";
        
        const roleLabel = role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        console.log(`${roleEmoji} ${roleLabel}s (${groupedUsers[role].length}):`);
        groupedUsers[role].forEach(user => {
          console.log(`   📧 ${user.email}`);
          console.log(`      Name: ${user.name}`);
          console.log(`      Phone: ${user.phone || "N/A"}`);
          console.log(`      Created: ${new Date(user.created_at).toLocaleDateString()}`);
          if (user.branch_id) {
            console.log(`      Branch ID: ${user.branch_id}`);
          }
          console.log("");
        });
      }
    });

    console.log(`\n📊 Total Users: ${(users as any[]).length}\n`);
    
  } catch (error) {
    console.error("❌ Error listing users:", error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

listUsers();
