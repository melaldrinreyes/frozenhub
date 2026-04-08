import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function addAdmin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const id = 'user-admin-001';
    const createdAt = new Date('2023-01-01 00:00:00');

    // Delete existing admin if any
    await connection.query("DELETE FROM users WHERE email = 'admin@frozenhub.com'");

    // Insert new admin
    await connection.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, 'System Administrator', 'admin@frozenhub.com', '+1-555-0001', passwordHash, 'admin', null, createdAt]
    );

    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@frozenhub.com');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

addAdmin();
