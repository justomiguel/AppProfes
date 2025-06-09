# 🔒 Guía de Seguridad - AI Evaluador

## 📋 Resumen de Seguridad

Esta aplicación implementa múltiples capas de seguridad para proteger datos sensibles como API Keys de OpenAI y información de usuarios.

## 🔐 Características de Seguridad Implementadas

### 1. **Autenticación y Autorización**
- ✅ JWT tokens con expiración configurable (24h en producción, 7d en desarrollo)
- ✅ HTTP-only cookies para mayor seguridad
- ✅ Validación de tokens en cada request
- ✅ Rate limiting en login (5 intentos por 15 minutos)
- ✅ Logout seguro con limpieza de cookies

### 2. **Protección de Datos Sensibles**
- ✅ **API Keys cifradas** usando AES-256-CBC
- ✅ Passwords hasheados con bcrypt (12 rounds en producción)
- ✅ Variables de entorno obligatorias para JWT_SECRET y ENCRYPTION_KEY
- ✅ Exclusión de datos sensibles en respuestas API

### 3. **Validación y Sanitización**
- ✅ Validación de entrada con Zod schemas
- ✅ Sanitización de datos de usuario
- ✅ Validación de tipos de archivo
- ✅ Límites de tamaño de archivo

### 4. **Headers de Seguridad**
- ✅ Cache-Control: no-store para errores de auth
- ✅ Cookies con flags secure, httpOnly, sameSite

## 🚀 Configuración para Producción (Vercel)

### Variables de Entorno Requeridas

```bash
# Generar JWT Secret (mínimo 32 caracteres)
openssl rand -hex 32

# Generar Encryption Key (32 bytes = 64 caracteres hex)
openssl rand -hex 32
```

**En Vercel Dashboard:**
```
JWT_SECRET=tu-jwt-secret-de-64-caracteres-generado-con-openssl
ENCRYPTION_KEY=tu-encryption-key-de-64-caracteres-generado-con-openssl
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Base de Datos para Producción

⚠️ **IMPORTANTE**: SQLite NO es adecuado para producción en Vercel.

**Opciones recomendadas:**
1. **Vercel Postgres** (recomendado)
2. **Supabase** (PostgreSQL managed)
3. **PlanetScale** (MySQL serverless)
4. **Railway** (PostgreSQL)

### Implementación PostgreSQL

```typescript
// src/lib/database-postgres.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Migrar esquema SQLite a PostgreSQL
```

## 🛡️ Mejoras de Seguridad Adicionales

### 1. **Rate Limiting Avanzado**
```typescript
// Implementar con Redis en producción
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### 2. **Validación de API Keys**
```typescript
// Validar que las API Keys sean válidas antes de guardar
async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. **Logging y Monitoreo**
```typescript
// Implementar logging de eventos de seguridad
import { logger } from './logger';

logger.warn('Failed login attempt', { ip, username, timestamp });
logger.info('API key updated', { userId, timestamp });
```

### 4. **Headers de Seguridad CSP**
```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];
```

## 🔍 Auditoría de Seguridad

### Checklist Pre-Deployment

- [ ] Variables de entorno configuradas correctamente
- [ ] Base de datos PostgreSQL configurada
- [ ] API Keys cifradas en base de datos
- [ ] Rate limiting implementado
- [ ] Headers de seguridad configurados
- [ ] Logs de seguridad implementados
- [ ] Validación de API Keys activa
- [ ] Backup y recovery plan definido

### Monitoreo Continuo

1. **Alertas de Seguridad**
   - Múltiples intentos de login fallidos
   - Accesos no autorizados
   - Cambios en API Keys

2. **Métricas de Seguridad**
   - Tasa de intentos de login fallidos
   - Tiempo de respuesta de autenticación
   - Uso de API Keys

## 🚨 Incidentes de Seguridad

### Procedimiento de Respuesta

1. **Detección**: Monitoreo automático + reportes manuales
2. **Contención**: Revocar tokens, bloquear IPs
3. **Investigación**: Análisis de logs, identificación de causa
4. **Recuperación**: Restaurar servicios, actualizar credenciales
5. **Lecciones**: Documentar y mejorar medidas

### Contactos de Emergencia

- **Administrador del Sistema**: [email]
- **Equipo de Desarrollo**: [email]
- **Proveedor de Hosting**: Vercel Support

## 📚 Recursos Adicionales

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Vercel Security](https://vercel.com/docs/security)
- [OpenAI API Security](https://platform.openai.com/docs/guides/safety-best-practices)

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0  
**Estado**: ✅ Implementado 