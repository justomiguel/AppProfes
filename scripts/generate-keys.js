#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 Generador de Claves Seguras - AI Evaluador\n');

// Generate JWT Secret (32 bytes = 64 hex characters)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('🔑 JWT_SECRET (para autenticación):');
console.log(`JWT_SECRET=${jwtSecret}\n`);

// Generate Encryption Key (32 bytes = 64 hex characters)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('🛡️  ENCRYPTION_KEY (para cifrar API Keys):');
console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);

console.log('📋 Configuración completa para .env.local:');
console.log('================================================');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('NODE_ENV=development');
console.log('');

console.log('🚀 Para producción en Vercel:');
console.log('================================');
console.log('1. Copia las claves generadas arriba');
console.log('2. Ve a tu dashboard de Vercel');
console.log('3. Settings → Environment Variables');
console.log('4. Agrega JWT_SECRET y ENCRYPTION_KEY');
console.log('5. Configura NODE_ENV=production');
console.log('6. Agrega DATABASE_URL de tu proveedor PostgreSQL');
console.log('');

console.log('⚠️  IMPORTANTE:');
console.log('- Nunca compartas estas claves');
console.log('- Úsalas solo en variables de entorno');
console.log('- Regenera si hay comprometimiento');
console.log('- SQLite solo para desarrollo');
console.log('- PostgreSQL requerido para producción'); 