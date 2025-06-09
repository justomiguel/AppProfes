const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function fixDatabase() {
  console.log('🔧 Arreglando base de datos...');
  
  try {
    const dbPath = path.join(process.cwd(), 'data', 'ai-evaluador.db');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Verificar columnas existentes
    const tableInfo = await db.all("PRAGMA table_info(users)");
    console.log('📋 Columnas actuales en users:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.name} (${col.type})`);
    });

    const hasLastLoginAt = tableInfo.some(col => col.name === 'last_login_at');

    if (!hasLastLoginAt) {
      console.log('➕ Agregando columna last_login_at...');
      await db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME');
      console.log('✅ Columna last_login_at agregada');
    } else {
      console.log('✅ Columna last_login_at ya existe');
    }

    // Limpiar cualquier tabla de rate limiting si existe
    try {
      await db.exec('DROP TABLE IF EXISTS rate_limits');
      console.log('🧹 Rate limiting limpiado');
    } catch (e) {
      // Ignorar si no existe
    }

    // Verificar que el usuario admin tenga todos los campos
    const adminUser = await db.get(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      ['justomiguelvargas@gmail.com']
    );

    if (adminUser) {
      console.log('\n👤 Usuario admin encontrado:');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Username: ${adminUser.username}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Admin: ${adminUser.is_admin ? 'SÍ' : 'NO'}`);
      console.log(`   Activo: ${adminUser.is_active ? 'SÍ' : 'NO'}`);
      console.log(`   Último login: ${adminUser.last_login_at || 'Nunca'}`);
    }

    await db.close();
    console.log('\n🎉 Base de datos arreglada correctamente!');
    console.log('💡 Ahora reinicia el servidor con Ctrl+C y npm run dev');
    
  } catch (error) {
    console.error('❌ Error arreglando base de datos:', error);
    process.exit(1);
  }
}

fixDatabase(); 