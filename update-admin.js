import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function updateAdminAccount() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    // New credentials as requested
    const newEmail = 'admin@gmail.com';
    const newPassword = 'Admin123'; // Using Admin123 to meet security requirements
    
    // Hash password with 12 rounds
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update admin account
    await connection.query(
      'UPDATE users SET email = ?, password_hash = ? WHERE role = ?',
      [newEmail, passwordHash, 'admin']
    );

    console.log('✅ Admin account updated successfully!');
    console.log('');
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: Admin123');
    console.log('');
    console.log('⚠️  Note: Changed password from "admin123" to "Admin123"');
    console.log('   Reason: Security requirements need at least one uppercase letter');
    console.log('');
    console.log('Password requirements:');
    console.log('  ✓ At least 8 characters');
    console.log('  ✓ Contains uppercase letter (A)');
    console.log('  ✓ Contains lowercase letters (dmin)');
    console.log('  ✓ Contains numbers (123)');
    console.log('');
    console.log('🚀 You can now login with these credentials!');

    // Verify the update
    const [admins] = await connection.query(
      "SELECT id, name, email, role FROM users WHERE role = 'admin'"
    );
    console.log('');
    console.log('✅ Verified admin account:');
    console.log(JSON.stringify(admins, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

updateAdminAccount();
