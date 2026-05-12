import { getConnection } from "../db";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

type SeedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";
  branch_id?: string | null;
};

const seedUsers: SeedUser[] = [
  {
    id: "user-admin-001",
    name: "System Administrator",
    email: "admin@gmail.com",
    phone: "+1-555-0001",
    password: "admin123",
    role: "admin",
    branch_id: null,
  },
  {
    id: "user-branch-001",
    name: "Branch Manager",
    email: "branchadmin@example.com",
    phone: "+1-555-0101",
    password: "branch123",
    role: "branch_admin",
    branch_id: "branch-001",
  },
  {
    id: "user-pos-001",
    name: "POS Operator",
    email: "pos@example.com",
    phone: "+1-555-0202",
    password: "pos123",
    role: "pos_operator",
    branch_id: "branch-001",
  },
  {
    id: "user-customer-001",
    name: "Customer One",
    email: "customer1@example.com",
    phone: "+1-555-0303",
    password: "cust123",
    role: "customer",
    branch_id: null,
  },
];

async function runSeeder() {
  const connection = await getConnection();
  try {
    console.log("🌱 Seeding users...");

    for (const u of seedUsers) {
      const passwordHash = await bcrypt.hash(u.password || "changeme", 10);

      try {
        await connection.query(
          `INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
           ON CONFLICT (email) DO NOTHING`,
          [u.id, u.name, u.email, u.phone, passwordHash, u.role, u.branch_id]
        );
        console.log(`  ✅ Upserted user: ${u.email} (${u.role})`);
      } catch (err) {
        console.error(`  ⚠️  Failed to insert user ${u.email}:`, err);
      }
    }

    console.log("✅ Users seeded successfully");
  } catch (error) {
    console.error("Error seeding users:", error);
    throw error;
  } finally {
    connection.release();
  }
}

runSeeder().catch((err) => {
  console.error(err);
  process.exit(1);
});
