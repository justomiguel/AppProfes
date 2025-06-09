import { StudentFile } from '../types';

export const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'text/javascript': '.js',
  'text/typescript': '.ts',
  'text/jsx': '.jsx',
  'text/tsx': '.tsx',
  'application/json': '.json',
  'text/html': '.html',
  'text/css': '.css',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file: File): { isValid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `El archivo ${file.name} es muy grande. Máximo permitido: 10MB`,
    };
  }

  // Check file type
  const isSupported = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type) ||
    Object.values(SUPPORTED_FILE_TYPES).some(ext => file.name.toLowerCase().endsWith(ext));

  if (!isSupported) {
    return {
      isValid: false,
      error: `Tipo de archivo no soportado: ${file.name}. Tipos permitidos: PDF, DOCX, TXT, MD, JS, TS, JSON, HTML, CSS, ZIP`,
    };
  }

  return { isValid: true };
}

export async function processFile(file: File): Promise<StudentFile> {
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  let content: string;

  try {
    if (file.type === 'application/pdf') {
      // For PDF files, we'll store as base64 and handle extraction later
      content = await fileToBase64(file);
    } else if (file.type.startsWith('text/') || 
               file.name.endsWith('.js') || 
               file.name.endsWith('.ts') || 
               file.name.endsWith('.jsx') || 
               file.name.endsWith('.tsx') ||
               file.name.endsWith('.json') ||
               file.name.endsWith('.html') ||
               file.name.endsWith('.css') ||
               file.name.endsWith('.md')) {
      // Text-based files including Markdown
      content = await fileToText(file);
    } else if (file.type.includes('zip')) {
      // ZIP files - store as base64 for now
      content = await fileToBase64(file);
    } else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      // Word documents - store as base64 for now
      content = await fileToBase64(file);
    } else {
      // Default to base64 for other file types
      content = await fileToBase64(file);
    }

    return {
      id: generateFileId(),
      name: file.name,
      type: file.type,
      size: file.size,
      content,
    };
  } catch (error) {
    throw new Error(`Error procesando archivo ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

export async function processMultipleFiles(files: FileList | File[]): Promise<StudentFile[]> {
  const fileArray = Array.from(files);
  const results: StudentFile[] = [];
  const errors: string[] = [];

  for (const file of fileArray) {
    try {
      const processedFile = await processFile(file);
      results.push(processedFile);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Error procesando ${file.name}`);
    }
  }

  if (errors.length > 0 && results.length === 0) {
    throw new Error(errors.join('\n'));
  }

  if (errors.length > 0) {
    console.warn('Algunos archivos no pudieron procesarse:', errors);
  }

  return results;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix to get just the base64 content
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Error reading file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Error reading file as text'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file, 'UTF-8');
  });
}

function generateFileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return '📄';
    case 'doc':
    case 'docx':
      return '📝';
    case 'txt':
      return '📄';
    case 'md':
      return '📖';
    case 'js':
    case 'jsx':
      return '📜';
    case 'ts':
    case 'tsx':
      return '📘';
    case 'json':
      return '📋';
    case 'html':
      return '🌐';
    case 'css':
      return '🎨';
    case 'zip':
      return '📦';
    default:
      return '📄';
  }
} 