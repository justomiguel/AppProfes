export type Language = 'es' | 'en';

export interface Translations {
  // Navigation
  evaluations: string;
  settings: string;
  configuration: string;
  
  // Main page
  appTitle: string;
  evaluationsTitle: string;
  evaluationsSubtitle: string;
  newEvaluation: string;
  noEvaluations: string;
  noEvaluationsDescription: string;
  students: string;
  evaluated: string;
  created: string;
  updated: string;
  manageStudents: string;
  generateReport: string;
  edit: string;
  delete: string;
  
  // Evaluation form
  evaluationName: string;
  evaluationDescription: string;
  assignmentPrompt: string;
  promptFiles: string;
  uploadPromptFiles: string;
  rubric: string;
  rubricFiles: string;
  uploadRubricFiles: string;
  save: string;
  cancel: string;
  saving: string;
  createEvaluation: string;
  editEvaluation: string;
  
  // Student form
  studentName: string;
  group: string;
  groupMembers: string;
  files: string;
  addStudent: string;
  editStudent: string;
  individual: string;
  groupWork: string;
  uploadFiles: string;
  
  // Students page
  studentsManagement: string;
  addNewStudent: string;
  evaluateWithAI: string;
  evaluateAll: string;
  totalStudents: string;
  pendingEvaluations: string;
  completedEvaluations: string;
  backToEvaluations: string;
  
  // Settings
  openaiConfiguration: string;
  openaiConfig: string;
  languageConfig: string;
  gradeScaleConfig: string;
  apiKey: string;
  apiKeyHelp: string;
  model: string;
  maxTokens: string;
  temperature: string;
  applicationSettings: string;
  language: string;
  gradeScale: string;
  minGrade: string;
  maxGrade: string;
  saveConfiguration: string;
  
  // Evaluation results
  grade: string;
  explanation: string;
  feedback: string;
  evaluating: string;
  evaluationComplete: string;
  evaluationError: string;
  
  // Common
  loading: string;
  error: string;
  success: string;
  confirm: string;
  yes: string;
  no: string;
  uploadedFiles: string;
  removeFile: string;
  
  // Messages
  deleteEvaluationConfirm: string;
  configurationSaved: string;
  configurationSavedNoApiKey: string;
  evaluationSaved: string;
  studentSaved: string;
  
  // Validation messages
  nameRequired: string;
  nameTooLong: string;
  promptMinLength: string;
  rubricMinLength: string;
  filesRequired: string;
  explanationMinLength: string;
  feedbackMinLength: string;
}

const translations: Record<Language, Translations> = {
  es: {
    // Navigation
    evaluations: 'Evaluaciones',
    settings: 'Configuración',
    configuration: 'Configuración',
    
    // Main page
    appTitle: 'AI Evaluador',
    evaluationsTitle: 'Evaluaciones',
    evaluationsSubtitle: 'Gestiona tus evaluaciones y corrige automáticamente con IA',
    newEvaluation: 'Nueva Evaluación',
    noEvaluations: 'No hay evaluaciones',
    noEvaluationsDescription: 'Comienza creando tu primera evaluación.',
    students: 'Estudiantes',
    evaluated: 'Evaluados',
    created: 'Creada',
    updated: 'Actualizada',
    manageStudents: 'Gestionar Estudiantes',
    generateReport: 'Generar Reporte',
    edit: 'Editar',
    delete: 'Eliminar',
    
    // Evaluation form
    evaluationName: 'Nombre de la Evaluación',
    evaluationDescription: 'Descripción (opcional)',
    assignmentPrompt: 'Consigna del Trabajo',
    promptFiles: 'Archivos de la Consigna',
    uploadPromptFiles: 'Subir Archivos de la Consigna',
    rubric: 'Rúbrica de Evaluación',
    rubricFiles: 'Archivos de la Rúbrica',
    uploadRubricFiles: 'Subir Archivos de la Rúbrica',
    save: 'Guardar',
    cancel: 'Cancelar',
    saving: 'Guardando...',
    createEvaluation: 'Crear Evaluación',
    editEvaluation: 'Editar Evaluación',
    
    // Student form
    studentName: 'Nombre del Estudiante',
    group: 'Grupo (opcional)',
    groupMembers: 'Integrantes del Grupo',
    files: 'Archivos',
    addStudent: 'Agregar Estudiante',
    editStudent: 'Editar Estudiante',
    individual: 'Individual',
    groupWork: 'Trabajo Grupal',
    uploadFiles: 'Subir Archivos',
    
    // Students page
    studentsManagement: 'Gestión de Estudiantes',
    addNewStudent: 'Agregar Estudiante',
    evaluateWithAI: 'Evaluar con IA',
    evaluateAll: 'Evaluar Todos',
    totalStudents: 'Total de Estudiantes',
    pendingEvaluations: 'Evaluaciones Pendientes',
    completedEvaluations: 'Evaluaciones Completadas',
    backToEvaluations: 'Volver a Evaluaciones',
    
    // Settings
    openaiConfiguration: 'Configuración de OpenAI',
    openaiConfig: 'Configuración de OpenAI',
    languageConfig: 'Configuración de Idioma',
    gradeScaleConfig: 'Escala de Calificaciones',
    apiKey: 'API Key',
    apiKeyHelp: 'Obtén tu API Key en platform.openai.com',
    model: 'Modelo',
    maxTokens: 'Máximo de Tokens',
    temperature: 'Temperatura',
    applicationSettings: 'Configuración de la Aplicación',
    language: 'Idioma',
    gradeScale: 'Escala de Calificación',
    minGrade: 'Nota Mínima',
    maxGrade: 'Nota Máxima',
    saveConfiguration: 'Guardar Configuración',
    
    // Evaluation results
    grade: 'Calificación',
    explanation: 'Explicación',
    feedback: 'Retroalimentación',
    evaluating: 'Evaluando...',
    evaluationComplete: 'Evaluación completada',
    evaluationError: 'Error en la evaluación',
    
    // Common
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No',
    uploadedFiles: 'Archivos Subidos',
    removeFile: 'Eliminar Archivo',
    
    // Messages
    deleteEvaluationConfirm: '¿Estás seguro de que quieres eliminar esta evaluación? Se eliminarán también todos los estudiantes y resultados asociados.',
    configurationSaved: 'Configuración guardada exitosamente',
    configurationSavedNoApiKey: 'Configuración guardada. Nota: Necesitarás agregar una API Key de OpenAI para usar las funciones de evaluación automática.',
    evaluationSaved: 'Evaluación guardada exitosamente',
    studentSaved: 'Estudiante guardado exitosamente',
    
    // Validation messages
    nameRequired: 'El nombre es requerido',
    nameTooLong: 'El nombre es muy largo',
    promptMinLength: 'La consigna debe tener al menos 10 caracteres',
    rubricMinLength: 'La rúbrica debe tener al menos 10 caracteres',
    filesRequired: 'Debe subir al menos un archivo',
    explanationMinLength: 'La explicación debe tener al menos 10 caracteres',
    feedbackMinLength: 'El feedback debe tener al menos 10 caracteres',
  },
  
  en: {
    // Navigation
    evaluations: 'Evaluations',
    settings: 'Settings',
    configuration: 'Configuration',
    
    // Main page
    appTitle: 'AI Evaluator',
    evaluationsTitle: 'Evaluations',
    evaluationsSubtitle: 'Manage your evaluations and automatically grade with AI',
    newEvaluation: 'New Evaluation',
    noEvaluations: 'No evaluations',
    noEvaluationsDescription: 'Start by creating your first evaluation.',
    students: 'Students',
    evaluated: 'Evaluated',
    created: 'Created',
    updated: 'Updated',
    manageStudents: 'Manage Students',
    generateReport: 'Generate Report',
    edit: 'Edit',
    delete: 'Delete',
    
    // Evaluation form
    evaluationName: 'Evaluation Name',
    evaluationDescription: 'Description (optional)',
    assignmentPrompt: 'Assignment Prompt',
    promptFiles: 'Assignment Files',
    uploadPromptFiles: 'Upload Assignment Files',
    rubric: 'Evaluation Rubric',
    rubricFiles: 'Rubric Files',
    uploadRubricFiles: 'Upload Rubric Files',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving...',
    createEvaluation: 'Create Evaluation',
    editEvaluation: 'Edit Evaluation',
    
    // Student form
    studentName: 'Student Name',
    group: 'Group (optional)',
    groupMembers: 'Group Members',
    files: 'Files',
    addStudent: 'Add Student',
    editStudent: 'Edit Student',
    individual: 'Individual',
    groupWork: 'Group Work',
    uploadFiles: 'Upload Files',
    
    // Students page
    studentsManagement: 'Student Management',
    addNewStudent: 'Add Student',
    evaluateWithAI: 'Evaluate with AI',
    evaluateAll: 'Evaluate All',
    totalStudents: 'Total Students',
    pendingEvaluations: 'Pending Evaluations',
    completedEvaluations: 'Completed Evaluations',
    backToEvaluations: 'Back to Evaluations',
    
    // Settings
    openaiConfiguration: 'OpenAI Configuration',
    openaiConfig: 'OpenAI Configuration',
    languageConfig: 'Language Configuration',
    gradeScaleConfig: 'Grade Scale Configuration',
    apiKey: 'API Key',
    apiKeyHelp: 'Get your API Key at platform.openai.com',
    model: 'Model',
    maxTokens: 'Max Tokens',
    temperature: 'Temperature',
    applicationSettings: 'Application Settings',
    language: 'Language',
    gradeScale: 'Grade Scale',
    minGrade: 'Minimum Grade',
    maxGrade: 'Maximum Grade',
    saveConfiguration: 'Save Configuration',
    
    // Evaluation results
    grade: 'Grade',
    explanation: 'Explanation',
    feedback: 'Feedback',
    evaluating: 'Evaluating...',
    evaluationComplete: 'Evaluation completed',
    evaluationError: 'Evaluation error',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    uploadedFiles: 'Uploaded Files',
    removeFile: 'Remove File',
    
    // Messages
    deleteEvaluationConfirm: 'Are you sure you want to delete this evaluation? All associated students and results will also be deleted.',
    configurationSaved: 'Configuration saved successfully',
    configurationSavedNoApiKey: 'Configuration saved. Note: You will need to add an OpenAI API Key to use automatic evaluation features.',
    evaluationSaved: 'Evaluation saved successfully',
    studentSaved: 'Student saved successfully',
    
    // Validation messages
    nameRequired: 'Name is required',
    nameTooLong: 'Name is too long',
    promptMinLength: 'Prompt must be at least 10 characters',
    rubricMinLength: 'Rubric must be at least 10 characters',
    filesRequired: 'At least one file must be uploaded',
    explanationMinLength: 'Explanation must be at least 10 characters',
    feedbackMinLength: 'Feedback must be at least 10 characters',
  },
};

export function getTranslations(language: Language): Translations {
  return translations[language];
}

export function getCurrentLanguage(): Language {
  if (typeof window !== 'undefined') {
    const settings = localStorage.getItem('ai-evaluador-settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        return parsed.language || 'es';
      } catch {
        return 'es';
      }
    }
  }
  return 'es';
} 