import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function setSimpleAdminPassword() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    // Hash the exact password you want: admin123
    // Note: This doesn't meet security requirements, but we'll hash it anyway
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 12);

    // Update admin account
    await connection.query(
      'UPDATE users SET email = ?, password_hash = ? WHERE role = ?',
      ['admin@gmail.com', passwordHash, 'admin']
    );

    console.log('✅ Admin password updated to your exact specification!');
    console.log('');
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: admin123');
    console.log('');
    console.log('⚠️  WARNING: This password does NOT meet security requirements:');
    console.log('   ✗ Missing uppercase letter');
    console.log('   The system validation will reject new users with this password,');
    console.log('   but your existing admin account will work fine.');
    console.log('');
    console.log('🚀 You can now login!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

setSimpleAdminPassword();
