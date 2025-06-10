import { StudentFile } from '../types';

// Increased file size limit to 50MB to accommodate larger files
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Common file types for better icon display
export const COMMON_FILE_TYPES = {
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
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'video/mp4': '.mp4',
  'video/avi': '.avi',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'application/x-python-code': '.py',
  'text/x-python': '.py',
  'application/x-java-source': '.java',
  'text/x-c': '.c',
  'text/x-c++': '.cpp',
  'text/x-csharp': '.cs',
  'application/xml': '.xml',
  'text/xml': '.xml',
  'application/yaml': '.yml',
  'text/yaml': '.yaml',
} as const;

export function validateFile(file: File): { isValid: boolean; error?: string } {
  // Only check file size - accept any file type
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `El archivo ${file.name} es muy grande. Máximo permitido: 50MB`,
    };
  }

  // Accept all file types
  return { isValid: true };
}

export async function processFile(file: File): Promise<StudentFile> {
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  let content: string;

  try {
    // Determine how to process the file based on type
    if (isTextFile(file)) {
      // Text-based files - read as text
      content = await fileToText(file);
    } else {
      // Binary files - store as base64
      content = await fileToBase64(file);
    }

    return {
      id: generateFileId(),
      name: file.name,
      type: file.type || 'application/octet-stream', // Default MIME type for unknown files
      size: file.size,
      content,
    };
  } catch (error) {
    throw new Error(`Error procesando archivo ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// Helper function to determine if a file should be read as text
function isTextFile(file: File): boolean {
  // Check MIME type first
  if (file.type.startsWith('text/')) {
    return true;
  }

  // Check file extension for common text files
  const textExtensions = [
    '.txt', '.md', '.markdown', '.js', '.ts', '.jsx', '.tsx', '.json', 
    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.xml', '.svg',
    '.csv', '.yaml', '.yml', '.ini', '.cfg', '.conf', '.log', '.sql',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb',
    '.go', '.rs', '.swift', '.kt', '.scala', '.sh', '.bash', '.zsh',
    '.ps1', '.bat', '.cmd', '.r', '.m', '.pl', '.lua', '.vim', '.gitignore',
    '.gitattributes', '.editorconfig', '.env', '.dockerfile', '.makefile'
  ];

  const fileName = file.name.toLowerCase();
  return textExtensions.some(ext => fileName.endsWith(ext)) || 
         fileName === 'readme' || fileName === 'license' || fileName === 'changelog';
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

export function getFileIcon(fileNameOrType: string): string {
  // Handle both filename and MIME type
  const fileName = fileNameOrType.toLowerCase();
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  
  // Check by file extension first
  switch (extension) {
    // Documents
    case 'pdf':
      return '📄';
    case 'doc':
    case 'docx':
      return '📝';
    case 'txt':
      return '📄';
    case 'md':
    case 'markdown':
      return '📖';
    case 'rtf':
      return '📄';
    
    // Spreadsheets
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '📊';
    
    // Presentations
    case 'ppt':
    case 'pptx':
      return '📽️';
    
    // Code files
    case 'js':
    case 'jsx':
      return '📜';
    case 'ts':
    case 'tsx':
      return '📘';
    case 'py':
      return '🐍';
    case 'java':
      return '☕';
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
      return '⚙️';
    case 'cs':
      return '🔷';
    case 'php':
      return '🐘';
    case 'rb':
      return '💎';
    case 'go':
      return '🐹';
    case 'rs':
      return '🦀';
    case 'swift':
      return '🦉';
    case 'kt':
      return '🅺';
    case 'scala':
      return '🎯';
    case 'r':
      return '📈';
    case 'm':
      return '🧮';
    case 'pl':
      return '🐪';
    case 'lua':
      return '🌙';
    
    // Web files
    case 'html':
    case 'htm':
      return '🌐';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return '🎨';
    case 'json':
      return '📋';
    case 'xml':
      return '📰';
    case 'yaml':
    case 'yml':
      return '⚙️';
    
    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
      return '🖼️';
    case 'svg':
      return '🎨';
    case 'ico':
      return '🔷';
    
    // Videos
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'webm':
    case 'mkv':
      return '🎬';
    
    // Audio
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'ogg':
    case 'm4a':
      return '🎵';
    
    // Archives
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'bz2':
      return '📦';
    
    // Executables
    case 'exe':
    case 'msi':
    case 'dmg':
    case 'pkg':
    case 'deb':
    case 'rpm':
      return '⚙️';
    
    // Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return '🐚';
    case 'ps1':
    case 'bat':
    case 'cmd':
      return '💻';
    
    // Data files
    case 'sql':
      return '🗃️';
    case 'db':
    case 'sqlite':
    case 'sqlite3':
      return '🗄️';
    
    // Configuration files
    case 'ini':
    case 'cfg':
    case 'conf':
    case 'config':
      return '⚙️';
    case 'env':
      return '🔐';
    
    // Special files
    case 'log':
      return '📜';
    case 'dockerfile':
      return '🐳';
    case 'makefile':
      return '🔨';
    
    default:
      // Check by MIME type if extension doesn't match
      if (fileName.includes('image/')) return '🖼️';
      if (fileName.includes('video/')) return '🎬';
      if (fileName.includes('audio/')) return '🎵';
      if (fileName.includes('text/')) return '📄';
      if (fileName.includes('application/pdf')) return '📄';
      if (fileName.includes('application/zip')) return '📦';
      if (fileName.includes('application/json')) return '📋';
      
      // Default icon for unknown files
      return '📄';
  }
} 