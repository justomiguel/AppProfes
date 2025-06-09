# AI Evaluador

Una aplicación web fullstack para profesores que permite realizar correcciones automáticas utilizando OpenAI. La app está construida con una arquitectura limpia siguiendo principios SOLID y buenas prácticas de diseño.

## 🚀 Características

### Evaluaciones
- ✅ Crear evaluaciones con nombre, consigna y rúbrica
- ✅ Editar y eliminar evaluaciones existentes
- ✅ Gestión completa del ciclo de vida de evaluaciones

### Alumnos (En desarrollo)
- 🔄 Cargar uno o varios alumnos/grupos
- 🔄 Subir múltiples archivos por alumno (PDF, DOCX, ZIP, TXT, JS, TS, etc.)
- 🔄 Evaluar trabajos automáticamente con IA

### Corrección con OpenAI (En desarrollo)
- 🔄 Integración con API de OpenAI
- 🔄 Soporte para múltiples modelos (GPT-3.5, GPT-4, GPT-4o)
- 🔄 Evaluación automática con notas y feedback
- 🔄 Posibilidad de editar evaluaciones antes de guardar

### Reportes (En desarrollo)
- 🔄 Generación de reportes en PDF
- 🔄 Tabla con notas y explicaciones por alumno

### Configuración (En desarrollo)
- 🔄 Selección de modelo OpenAI
- 🔄 Configuración de API Key
- 🔄 Límites de tokens y configuración de idioma

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Formularios**: React Hook Form + Zod
- **Iconos**: Lucide React
- **IA**: OpenAI API
- **Almacenamiento**: LocalStorage (persistencia local)
- **Validación**: Zod schemas
- **Deployment**: Vercel Ready

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ai-evaluador
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edita `.env.local` y agrega tu API Key de OpenAI:
   ```env
   OPENAI_API_KEY=tu_api_key_aqui
   OPENAI_MODEL=gpt-4o
   NEXT_PUBLIC_APP_NAME=AI Evaluador
   NEXT_PUBLIC_DEFAULT_LANGUAGE=es
   NEXT_PUBLIC_MAX_FILE_SIZE=10485760
   ```

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 🚀 Deployment en Vercel

1. **Conectar repositorio a Vercel**
   - Importa tu repositorio en [vercel.com](https://vercel.com)
   - Vercel detectará automáticamente que es un proyecto Next.js

2. **Configurar variables de entorno**
   - En el dashboard de Vercel, ve a Settings > Environment Variables
   - Agrega las mismas variables que tienes en `.env.local`

3. **Deploy**
   - Vercel desplegará automáticamente en cada push a main
   - También puedes hacer deploy manual desde el dashboard

## 📁 Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── page.tsx           # Página principal
│   └── layout.tsx         # Layout principal
├── components/            # Componentes React
│   └── EvaluationForm.tsx # Formulario de evaluaciones
├── lib/                   # Librerías y utilidades
│   ├── openai/           # Cliente de OpenAI
│   │   └── client.ts     # Servicio de OpenAI
│   ├── storage.ts        # Servicio de almacenamiento
│   └── fileUtils.ts      # Utilidades para archivos
├── models/               # Validaciones y esquemas
│   └── validation.ts     # Esquemas Zod
└── types/               # Tipos TypeScript
    └── index.ts         # Definiciones de tipos
```

## 🎯 Uso

### 1. Crear una Evaluación
1. Haz clic en "Nueva Evaluación"
2. Completa el formulario:
   - **Nombre**: Ej. "Aplicación 1 - React"
   - **Descripción**: (Opcional) Breve descripción
   - **Consigna**: Instrucciones completas del trabajo
   - **Rúbrica**: Criterios de evaluación detallados
3. Guarda la evaluación

### 2. Gestionar Evaluaciones
- **Editar**: Haz clic en el ícono de configuración
- **Eliminar**: Haz clic en la "×" (eliminará también estudiantes y resultados)
- **Ver detalles**: Cada tarjeta muestra fecha de creación y actualización

### 3. Próximos pasos (En desarrollo)
- Agregar estudiantes a una evaluación
- Subir archivos de trabajos
- Ejecutar evaluación automática con IA
- Revisar y editar resultados
- Generar reportes en PDF

## 🔧 Configuración de OpenAI

Para usar las funciones de evaluación automática:

1. **Obtener API Key**
   - Regístrate en [OpenAI](https://platform.openai.com)
   - Genera una API Key en tu dashboard
   - Agrega créditos a tu cuenta

2. **Configurar en la app**
   - Agrega tu API Key en `.env.local`
   - Selecciona el modelo deseado (gpt-3.5-turbo, gpt-4, gpt-4o)

## 📝 Tipos de Archivo Soportados

- **Documentos**: PDF, DOCX, DOC, TXT
- **Código**: JS, TS, JSX, TSX, JSON, HTML, CSS
- **Comprimidos**: ZIP
- **Límite de tamaño**: 10MB por archivo

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles del problema

## 🔮 Roadmap

- [ ] **Gestión de Estudiantes**: Formulario para agregar estudiantes y archivos
- [ ] **Evaluación con IA**: Integración completa con OpenAI
- [ ] **Editor de Resultados**: Interfaz para editar evaluaciones de IA
- [ ] **Generación de Reportes**: Exportar resultados a PDF
- [ ] **Configuración Avanzada**: Panel de settings completo
- [ ] **Autenticación**: Login de profesores
- [ ] **Dashboard Analytics**: Gráficos y estadísticas
- [ ] **Internacionalización**: Soporte completo para inglés/español
- [ ] **Base de Datos**: Migración de localStorage a BD real
- [ ] **API REST**: Endpoints para integración externa
