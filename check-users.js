import mysql from 'mysql2/promise';

async function checkUsers() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    const [users] = await connection.query("SELECT id, name, email, role FROM users ORDER BY role");
    
    console.log('📋 Users in database:');
    console.log('=====================');
    
    for (const user of users) {
      console.log(`${user.role.toUpperCase()}: ${user.email} (${user.name})`);
    }
    
    console.log('\n🔑 Admin credentials:');
    const [admin] = await connection.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
    if (admin.length > 0) {
      console.log(`Email: ${admin[0].email}`);
      console.log('Password: admin123');
    } else {
      console.log('❌ No admin user found!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkUsers();
