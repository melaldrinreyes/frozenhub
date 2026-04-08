import mysql from 'mysql2/promise';

async function verifyAdmin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'frozenhub_pos'
  });

  try {
    const [admins] = await connection.query(
      "SELECT id, name, email, role FROM users WHERE role = 'admin'"
    );

    console.log('✅ Admin account verified:');
    console.log(JSON.stringify(admins, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

verifyAdmin();
