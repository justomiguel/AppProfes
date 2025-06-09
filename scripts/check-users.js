const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkUsers() {
  console.log('🔍 Verificando usuarios en la base de datos...');
  
  try {
    const dbPath = path.join(process.cwd(), 'data', 'ai-evaluador.db');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Obtener todos los usuarios
    const users = await db.all('SELECT id, username, email, is_admin, is_active FROM users');
    
    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos');
    } else {
      console.log(`📊 Encontrados ${users.length} usuario(s):`);
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ID: ${user.id}`);
        console.log(`   👤 Username: ${user.username}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👑 Admin: ${user.is_admin ? 'SÍ' : 'NO'}`);
        console.log(`   ✅ Activo: ${user.is_active ? 'SÍ' : 'NO'}`);
      });
    }

    await db.close();
    
  } catch (error) {
    console.error('❌ Error verificando usuarios:', error);
  }
}

checkUsers(); 