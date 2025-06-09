import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  openai_api_key_encrypted?: string;
  settings?: string; // JSON string
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  openai: {
    apiKey?: string;
    model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o';
    maxTokens?: number;
    temperature?: number;
  };
  language: 'es' | 'en';
  gradeScale: {
    min: number;
    max: number;
  };
  customPrompts: {
    systemPrompt?: string;
    evaluationPrefix?: string;
    gradingCriteria?: string;
  };
}

export interface GlobalSettings {
  id: number;
  system_prompt: string;
  evaluation_prefix: string;
  grading_criteria: string;
  default_language: 'es' | 'en';
  default_grade_scale: string; // JSON string
  updated_at: string;
  updated_by: number; // admin user ID
}

let db: Database | null = null;

// Encryption key for API keys (should be in environment variable)
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  // Ensure key is exactly 32 bytes for AES-256
  if (key.length >= 64) {
    return Buffer.from(key.slice(0, 64), 'hex');
  } else {
    // If key is shorter, hash it to get consistent 32 bytes
    return crypto.createHash('sha256').update(key).digest();
  }
};

const ENCRYPTION_KEY = getEncryptionKey();

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

async function ensureDataDirectory(dbPath: string) {
  // Only run on server side
  if (typeof window !== 'undefined') return;
  
  const fs = await import('fs');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  // Use PostgreSQL in production (Vercel), SQLite in development
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    // For production, you would use a PostgreSQL adapter
    // This is a placeholder - you'd need to implement PostgreSQL connection
    throw new Error('PostgreSQL implementation needed for production');
  }

  const dbPath = path.join(process.cwd(), 'data', 'ai-evaluador.db');
  
  // Ensure data directory exists (server-side only)
  await ensureDataDirectory(dbPath);

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create users table with admin support
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      openai_api_key_encrypted TEXT,
      settings TEXT DEFAULT '{}',
      is_admin BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if we need to migrate existing users table
  const tableInfo = await db.all("PRAGMA table_info(users)");
  const hasIsAdmin = tableInfo.some(col => col.name === 'is_admin');
  const hasIsActive = tableInfo.some(col => col.name === 'is_active');
  const hasLastLoginAt = tableInfo.some(col => col.name === 'last_login_at');

  if (!hasIsAdmin) {
    await db.exec('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0');
  }

  if (!hasIsActive) {
    await db.exec('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1');
  }

  if (!hasLastLoginAt) {
    await db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME');
  }

  // Create global settings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_prompt TEXT NOT NULL,
      evaluation_prefix TEXT NOT NULL,
      grading_criteria TEXT NOT NULL,
      default_language TEXT DEFAULT 'es',
      default_grade_scale TEXT DEFAULT '{"min":1,"max":7}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY (updated_by) REFERENCES users (id)
    )
  `);

  // Create evaluation history table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      evaluation_id TEXT NOT NULL,
      grade REAL NOT NULL,
      explanation TEXT NOT NULL,
      feedback TEXT NOT NULL,
      evaluation_version INTEGER DEFAULT 1,
      is_latest BOOLEAN DEFAULT 1,
      ai_model TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create trigger to update updated_at
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  // Make sure justomiguelvargas@gmail.com is admin if exists
  await db.run(`
    UPDATE users SET is_admin = 1 WHERE email = 'justomiguelvargas@gmail.com'
  `);

  // Initialize default global settings if not exists
  const existingSettings = await db.get('SELECT id FROM global_settings LIMIT 1');
  if (!existingSettings) {
    await db.run(`
      INSERT INTO global_settings (system_prompt, evaluation_prefix, grading_criteria, default_language)
      VALUES (?, ?, ?, ?)
    `, [
      'Eres un evaluador académico ESTRICTO y PRECISO. Tu tarea es evaluar trabajos de programación web con criterios rigurosos.',
      'IMPORTANTE: Sé CRÍTICO y EXIGENTE. La mayoría de trabajos estudiantiles tienen deficiencias significativas.',
      'Evalúa considerando: funcionalidad, calidad del código, diseño, buenas prácticas, y cumplimiento de requisitos.',
      'es'
    ]);
  }

  return db;
}

export async function createUser(username: string, email: string, password: string): Promise<User> {
  const database = await initDatabase();
  
  // Validate input
  if (!username || username.length < 3) {
    throw new Error('Username debe tener al menos 3 caracteres');
  }
  
  if (!email || !email.includes('@')) {
    throw new Error('Email inválido');
  }
  
  if (!password || password.length < 6) {
    throw new Error('Password debe tener al menos 6 caracteres');
  }
  
  // Check if user already exists
  const existingUser = await database.get(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );
  
  if (existingUser) {
    throw new Error('Usuario o email ya existe');
  }

  // Hash password with higher cost for production
  const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Check if this should be an admin user
  const isAdmin = email === 'justomiguelvargas@gmail.com';

  // Default settings
  const defaultSettings: UserSettings = {
    openai: {
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3,
    },
    language: 'es',
    gradeScale: {
      min: 1,
      max: 7,
    },
    customPrompts: {},
  };

  // Insert user
  const result = await database.run(
    'INSERT INTO users (username, email, password_hash, settings, is_admin) VALUES (?, ?, ?, ?, ?)',
    [username, email, passwordHash, JSON.stringify(defaultSettings), isAdmin ? 1 : 0]
  );

  // Return created user
  const user = await database.get(
    'SELECT * FROM users WHERE id = ?',
    [result.lastID]
  );

  return user as User;
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const database = await initDatabase();
  
  if (!username || !password) {
    return null;
  }
  
  const user = await database.get(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
    [username, username]
  );

  if (!user) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return null;
  }

  // Update last login
  await database.run(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [user.id]
  );

  return user as User;
}

export async function getUserById(id: number): Promise<User | null> {
  const database = await initDatabase();
  
  const user = await database.get(
    'SELECT * FROM users WHERE id = ? AND is_active = 1',
    [id]
  );

  return user as User | null;
}

export async function updateUserSettings(userId: number, settings: UserSettings): Promise<void> {
  const database = await initDatabase();
  
  await database.run(
    'UPDATE users SET settings = ? WHERE id = ?',
    [JSON.stringify(settings), userId]
  );
}

export async function updateUserApiKey(userId: number, apiKey: string): Promise<void> {
  const database = await initDatabase();
  
  // Encrypt the API key before storing
  const encryptedApiKey = encrypt(apiKey);
  
  await database.run(
    'UPDATE users SET openai_api_key_encrypted = ? WHERE id = ?',
    [encryptedApiKey, userId]
  );
}

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const database = await initDatabase();
  
  const user = await database.get(
    'SELECT settings, openai_api_key_encrypted FROM users WHERE id = ?',
    [userId]
  );

  if (!user) return null;

  // Default settings structure
  const defaultSettings: UserSettings = {
    openai: {
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3,
    },
    language: 'es',
    gradeScale: {
      min: 1,
      max: 7,
    },
    customPrompts: {
      systemPrompt: '',
      evaluationPrefix: '',
      gradingCriteria: '',
    }
  };

  // Parse user settings or use defaults
  let settings: UserSettings;
  try {
    settings = user.settings ? JSON.parse(user.settings) : defaultSettings;
    
    // Merge with defaults to ensure all required fields exist
    settings = {
      ...defaultSettings,
      ...settings,
      openai: {
        ...defaultSettings.openai,
        ...settings.openai
      },
      gradeScale: {
        ...defaultSettings.gradeScale,
        ...settings.gradeScale
      },
      customPrompts: {
        ...defaultSettings.customPrompts,
        ...settings.customPrompts
      }
    };
  } catch (error) {
    console.error('Error parsing user settings, using defaults:', error);
    settings = defaultSettings;
  }
  
  // Decrypt and include API key in settings if available
  if (user.openai_api_key_encrypted) {
    try {
      const decryptedApiKey = decrypt(user.openai_api_key_encrypted);
      if (decryptedApiKey) {
        settings.openai.apiKey = decryptedApiKey;
      }
    } catch (error) {
      console.error('Error decrypting API key:', error);
      // Don't include API key if decryption fails
    }
  }

  return settings;
}

// Admin functions
export async function getAllUsers(adminUserId: number): Promise<User[]> {
  const database = await initDatabase();
  
  // Verify admin permissions
  const admin = await database.get(
    'SELECT is_admin FROM users WHERE id = ? AND is_admin = 1',
    [adminUserId]
  );
  
  if (!admin) {
    throw new Error('No autorizado - se requieren permisos de administrador');
  }

  const users = await database.all(
    'SELECT id, username, email, is_admin, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
  );

  return users as User[];
}

export async function updateUserAdminStatus(adminUserId: number, targetUserId: number, isAdmin: boolean): Promise<void> {
  const database = await initDatabase();
  
  // Verify admin permissions
  const admin = await database.get(
    'SELECT is_admin FROM users WHERE id = ? AND is_admin = 1',
    [adminUserId]
  );
  
  if (!admin) {
    throw new Error('No autorizado - se requieren permisos de administrador');
  }

  await database.run(
    'UPDATE users SET is_admin = ? WHERE id = ?',
    [isAdmin ? 1 : 0, targetUserId]
  );
}

export async function updateUserActiveStatus(adminUserId: number, targetUserId: number, isActive: boolean): Promise<void> {
  const database = await initDatabase();
  
  // Verify admin permissions
  const admin = await database.get(
    'SELECT is_admin FROM users WHERE id = ? AND is_admin = 1',
    [adminUserId]
  );
  
  if (!admin) {
    throw new Error('No autorizado - se requieren permisos de administrador');
  }

  await database.run(
    'UPDATE users SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, targetUserId]
  );
}

// Global settings functions
export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  const database = await initDatabase();
  
  const settings = await database.get(
    'SELECT * FROM global_settings ORDER BY updated_at DESC LIMIT 1'
  );

  return settings as GlobalSettings | null;
}

export async function updateGlobalSettings(
  adminUserId: number, 
  systemPrompt: string, 
  evaluationPrefix: string, 
  gradingCriteria: string,
  defaultLanguage: 'es' | 'en',
  defaultGradeScale: { min: number; max: number }
): Promise<void> {
  const database = await initDatabase();
  
  // Verify admin permissions
  const admin = await database.get(
    'SELECT is_admin FROM users WHERE id = ? AND is_admin = 1',
    [adminUserId]
  );
  
  if (!admin) {
    throw new Error('No autorizado - se requieren permisos de administrador');
  }

  await database.run(`
    INSERT OR REPLACE INTO global_settings 
    (id, system_prompt, evaluation_prefix, grading_criteria, default_language, default_grade_scale, updated_by)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `, [
    systemPrompt,
    evaluationPrefix,
    gradingCriteria,
    defaultLanguage,
    JSON.stringify(defaultGradeScale),
    adminUserId
  ]);
}

// Evaluation history functions
export async function saveEvaluationResult(
  studentId: string,
  evaluationId: string,
  grade: number,
  explanation: string,
  feedback: string,
  aiModel: string,
  userId: number
): Promise<void> {
  const database = await initDatabase();
  
  // Mark previous evaluations as not latest
  await database.run(`
    UPDATE evaluation_history 
    SET is_latest = 0 
    WHERE student_id = ? AND evaluation_id = ?
  `, [studentId, evaluationId]);

  // Get next version number
  const lastVersion = await database.get(`
    SELECT MAX(evaluation_version) as max_version
    FROM evaluation_history 
    WHERE student_id = ? AND evaluation_id = ?
  `, [studentId, evaluationId]);

  const nextVersion = (lastVersion?.max_version || 0) + 1;

  // Insert new evaluation result
  await database.run(`
    INSERT INTO evaluation_history 
    (student_id, evaluation_id, grade, explanation, feedback, evaluation_version, is_latest, ai_model, user_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [studentId, evaluationId, grade, explanation, feedback, nextVersion, aiModel, userId]);
}

export async function getEvaluationHistory(studentId: string, evaluationId: string): Promise<any[]> {
  const database = await initDatabase();
  
  const history = await database.all(`
    SELECT eh.*, u.username
    FROM evaluation_history eh
    JOIN users u ON eh.user_id = u.id
    WHERE eh.student_id = ? AND eh.evaluation_id = ?
    ORDER BY eh.evaluation_version DESC
  `, [studentId, evaluationId]);

  return history;
}

export async function getLatestEvaluationResult(studentId: string, evaluationId: string): Promise<any | null> {
  const database = await initDatabase();
  
  const result = await database.get(`
    SELECT * FROM evaluation_history
    WHERE student_id = ? AND evaluation_id = ? AND is_latest = 1
  `, [studentId, evaluationId]);

  return result;
} 