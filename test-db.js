const { Pool } = require('pg');

async function grantAdminPrivileges() {
  console.log('Checking and granting admin privileges...');
  
  // Try different environment variable names for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL || 
                     process.env.POSTGRES_PRISMA_URL ||
                     process.env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    console.error('❌ No database URL found in environment variables');
    return;
  }

  console.log('✅ Database URL found');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    },
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Check if user exists and current admin status
    const userResult = await client.query(
      'SELECT id, username, email, is_admin FROM users WHERE email = $1',
      ['justomiguelvargas@gmail.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User justomiguelvargas@gmail.com not found');
      client.release();
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:', {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin
    });
    
    if (user.is_admin) {
      console.log('✅ User already has admin privileges');
    } else {
      console.log('🔄 Granting admin privileges...');
      await client.query(
        'UPDATE users SET is_admin = TRUE WHERE email = $1',
        ['justomiguelvargas@gmail.com']
      );
      console.log('✅ Admin privileges granted successfully');
    }
    
    // Verify the change
    const verifyResult = await client.query(
      'SELECT id, username, email, is_admin FROM users WHERE email = $1',
      ['justomiguelvargas@gmail.com']
    );
    
    const updatedUser = verifyResult.rows[0];
    console.log('✅ Final user status:', {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      is_admin: updatedUser.is_admin
    });
    
    client.release();
    console.log('✅ Admin privileges operation completed successfully');
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

grantAdminPrivileges().catch(console.error); 