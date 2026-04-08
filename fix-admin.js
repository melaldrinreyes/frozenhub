import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function fixAdmin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    console.log('🔧 Fixing admin email...');

    const passwordHash = bcrypt.hashSync('admin123', 10);

    // Update the admin user's email and password
    await connection.query(
      "UPDATE users SET email = ?, password_hash = ? WHERE role = 'admin'",
      ['admin@frozenhub.com', passwordHash]
    );

    console.log('✅ Admin user updated successfully!');
    console.log('');
    console.log('🔑 Login credentials:');
    console.log('Email: admin@frozenhub.com');
    console.log('Password: admin123');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixAdmin();
