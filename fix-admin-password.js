import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function fixAdminPassword() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    // Check current admin users
    const [admins] = await connection.query(
      "SELECT id, email, role FROM users WHERE role = 'admin'"
    );

    console.log('Current admin users:', admins);

    if (admins.length === 0) {
      console.log('❌ No admin users found!');
      return;
    }

    // New password that meets requirements:
    // - At least 8 characters
    // - At least one uppercase letter
    // - At least one lowercase letter
    // - At least one number
    const newPassword = 'Admin123'; // Meets all requirements
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Get the actual admin email from database
    const adminEmail = admins[0].email;
    const correctEmail = 'admin@frozenhub.com';
    
    // Update both email and password
    await connection.query(
      'UPDATE users SET email = ?, password_hash = ? WHERE role = ?',
      [correctEmail, passwordHash, 'admin']
    );

    console.log('✅ Admin account updated successfully!');
    console.log('');
    console.log('📧 Email (fixed):', correctEmail);
    console.log('   (was:', adminEmail + ')');
    console.log('🔑 New Password:', newPassword);
    console.log('');
    console.log('Password meets requirements:');
    console.log('  ✓ At least 8 characters');
    console.log('  ✓ Contains uppercase letter (A)');
    console.log('  ✓ Contains lowercase letters (dmin)');
    console.log('  ✓ Contains numbers (123)');
    console.log('');
    console.log('You can now login with these credentials!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

fixAdminPassword();
