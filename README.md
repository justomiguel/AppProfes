# 🤖 AI Evaluador

Sistema de evaluación automática con IA para profesores. Permite crear evaluaciones, subir trabajos de estudiantes y obtener calificaciones automáticas utilizando OpenAI.

## ✨ Características

- 🔐 **Sistema de autenticación seguro** con JWT y rate limiting
- 📝 **Gestión de evaluaciones** con prompts y rúbricas personalizables
- 👥 **Gestión de estudiantes** individual y grupal
- 🤖 **Evaluación automática** con OpenAI (GPT-3.5, GPT-4, GPT-4o)
- 📄 **Soporte múltiples formatos** de archivo (PDF, DOCX, ZIP, TXT, JS, TS, MD)
- 🔒 **API Keys cifradas** con AES-256-CBC
- 🌍 **Multiidioma** (Español/Inglés)
- 📊 **Reportes en PDF** con calificaciones y retroalimentación
- 🎨 **Interfaz moderna** con Tailwind CSS

## 🔒 Seguridad

- **API Keys cifradas** en base de datos
- **Autenticación JWT** con cookies HTTP-only
- **Rate limiting** en endpoints críticos
- **Validación estricta** de entrada con Zod
- **Headers de seguridad** implementados
- **Variables de entorno** obligatorias para producción

Ver [SECURITY.md](./SECURITY.md) para detalles completos.

## 🚀 Inicio Rápido

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd ai-evaluador
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Generar claves de seguridad

```bash
npm run generate-keys
```

### 4. Configurar variables de entorno

Copia las claves generadas al archivo `.env.local`:

```env
# Variables de seguridad (generadas con npm run generate-keys)
JWT_SECRET=tu-jwt-secret-generado
ENCRYPTION_KEY=tu-encryption-key-generado
NODE_ENV=development

# Configuración opcional
OPENAI_API_KEY=tu-api-key-de-openai
NEXT_PUBLIC_APP_NAME=AI Evaluador
NEXT_PUBLIC_DEFAULT_LANGUAGE=es
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── api/               # API Routes
│   │   ├── auth/          # Autenticación
│   │   └── user/          # Gestión de usuarios
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página principal
├── components/            # Componentes React
│   ├── EvaluationForm.tsx # Formulario de evaluaciones
│   ├── StudentForm.tsx    # Formulario de estudiantes
│   ├── StudentsPage.tsx   # Página de gestión de estudiantes
│   ├── SettingsForm.tsx   # Configuración de usuario
│   └── MainPage.tsx       # Página principal de la app
├── contexts/              # Contextos React
│   └── AuthContext.tsx    # Contexto de autenticación
├── hooks/                 # Custom hooks
│   └── useTranslations.ts # Hook de internacionalización
├── lib/                   # Librerías y utilidades
│   ├── auth.ts            # Utilidades de autenticación
│   ├── database.ts        # Gestión de base de datos
│   ├── storage.ts         # Almacenamiento local
│   ├── fileUtils.ts       # Utilidades de archivos
│   ├── i18n.ts            # Internacionalización
│   └── openai/            # Integración con OpenAI
├── models/                # Modelos y validaciones
│   └── validation.ts      # Schemas de Zod
└── types/                 # Definiciones de TypeScript
    └── index.ts
```

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, SQLite (dev) / PostgreSQL (prod)
- **Autenticación**: JWT, bcrypt, HTTP-only cookies
- **Validación**: Zod
- **AI**: OpenAI API
- **Base de datos**: sqlite3 (desarrollo), PostgreSQL (producción)
- **UI**: Lucide React Icons, React Hook Form

## 🌍 Deployment en Vercel

### 1. Preparar variables de entorno

```bash
# Generar claves de producción
npm run generate-keys
```

### 2. Configurar Vercel

En tu dashboard de Vercel, añade las siguientes variables de entorno:

```env
JWT_SECRET=tu-jwt-secret-de-64-caracteres
ENCRYPTION_KEY=tu-encryption-key-de-64-caracteres
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/database
```

### 3. Configurar PostgreSQL

Opciones recomendadas:
- **Vercel Postgres** (recomendado)
- **Supabase** (PostgreSQL managed)
- **PlanetScale** (MySQL serverless)
- **Railway** (PostgreSQL)

### 4. Deploy

```bash
# Via Vercel CLI
vercel --prod

# O conecta tu repositorio en vercel.com
```

⚠️ **Importante**: SQLite no funciona en Vercel. Debes usar PostgreSQL para producción.

## 📝 Uso

### 1. Crear cuenta

- Regístrate con usuario, email y contraseña
- El sistema creará configuraciones por defecto

### 2. Configurar OpenAI

- Ve a Configuración
- Añade tu API Key de OpenAI
- Selecciona el modelo deseado (GPT-3.5, GPT-4, GPT-4o)

### 3. Crear evaluación

- Crea una nueva evaluación
- Define el prompt del trabajo
- Establece la rúbrica de evaluación
- Opcionalmente sube archivos de apoyo

### 4. Añadir estudiantes

- Añade estudiantes individual o grupalmente
- Sube sus archivos de trabajo
- Soporta múltiples formatos

### 5. Evaluar con IA

- Selecciona estudiantes a evaluar
- Ejecuta evaluación automática
- Revisa resultados y retroalimentación
- Genera reportes en PDF

## 📄 Archivos de Ejemplo

En la carpeta `ejemplo-evaluacion/` encontrarás:

- **consigna.md**: Ejemplo de prompt de evaluación
- **rubrica.md**: Ejemplo de rúbrica detallada
- **solucion-estudiante/**: Solución de calidad alta (nota 6.5-7.0)
- **solucion-estudiante-nota4/**: Solución media (nota 3.5-4.5)
- **solucion-estudiante-nota1/**: Solución baja (nota 1.0-2.0)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📜 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- 📖 **Documentación**: Ver archivos de ejemplo y SECURITY.md
- 🐛 **Bugs**: Abrir un issue en GitHub
- 💡 **Features**: Abrir un issue con la etiqueta "enhancement"
- 🔒 **Seguridad**: Ver SECURITY.md para reportar vulnerabilidades

## 🎯 Roadmap

- [ ] Integración con más modelos de IA (Anthropic Claude, Google Gemini)
- [ ] Sistema de plantillas de evaluación
- [ ] Analytics y métricas de rendimiento
- [ ] Integración con LMS (Moodle, Canvas)
- [ ] API pública para integraciones
- [ ] Modo offline para evaluaciones básicas
