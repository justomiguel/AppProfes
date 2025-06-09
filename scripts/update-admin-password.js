const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

async function updateAdminPassword() {
  console.log('🔄 Actualizando password del usuario admin...');
  
  try {
    // Abrir la base de datos
    const dbPath = path.join(process.cwd(), 'data', 'ai-evaluador.db');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Buscar el usuario existente (case insensitive)
    const existingUser = await db.get(
      'SELECT id, username, email FROM users WHERE LOWER(email) = LOWER(?)',
      ['justomiguelvargas@gmail.com']
    );

    if (existingUser) {
      console.log('👤 Usuario encontrado:', existingUser.username);
      console.log('📧 Email:', existingUser.email);
      
      // Nuevo password
      const newPassword = 'vn6nFB!2cndD!ut';
      
      // Hash del nuevo password
      const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Actualizar el password y permisos del usuario admin
      const result = await db.run(
        'UPDATE users SET password_hash = ?, is_admin = 1, is_active = 1 WHERE id = ?',
        [passwordHash, existingUser.id]
      );

      if (result.changes > 0) {
        console.log('✅ Password del usuario admin actualizado exitosamente');
        console.log('👤 Username:', existingUser.username);
        console.log('📧 Email:', existingUser.email);
        console.log('🔐 Password: vn6nFB!2cndD!ut');
        console.log('👑 Admin: SÍ');
        console.log('✅ Activo: SÍ');
      }
    } else {
      console.log('⚠️  Usuario admin no encontrado. Creando nuevo usuario...');
      
      // Nuevo password
      const newPassword = 'vn6nFB!2cndD!ut';
      const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Crear el usuario admin si no existe
      const insertResult = await db.run(`
        INSERT INTO users (username, email, password_hash, is_admin, is_active, settings)
        VALUES (?, ?, ?, 1, 1, '{}')
      `, [
        'justomiguel',
        'justomiguelvargas@gmail.com',
        passwordHash
      ]);
      
      if (insertResult.lastID) {
        console.log('✅ Usuario admin creado exitosamente');
        console.log('👤 Username: justomiguel');
        console.log('📧 Email: justomiguelvargas@gmail.com');
        console.log('🔐 Password: vn6nFB!2cndD!ut');
        console.log('👑 Admin: SÍ');
      }
    }

    await db.close();
    console.log('🎉 ¡Listo! Ahora puedes hacer login con las credenciales actualizadas.');
    
  } catch (error) {
    console.error('❌ Error actualizando password:', error);
    process.exit(1);
  }
}

updateAdminPassword(); 