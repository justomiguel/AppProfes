import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Pool, PoolClient } from 'pg';
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
  llmProvider: 'openai' | 'local';
  openai: {
    apiKey?: string;
    model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o';
    maxTokens?: number;
    temperature?: number;
  };
  localLLM: {
    model: string;
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
let pgPool: Pool | null = null;

// Database type detection
const isProduction = process.env.NODE_ENV === 'production';
const usePostgreSQL = isProduction && process.env.DATABASE_URL;

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

// PostgreSQL initialization
async function initPostgreSQL(): Promise<Pool> {
  if (pgPool) return pgPool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Test connection
  const client = await pgPool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        openai_api_key_encrypted TEXT,
        settings TEXT DEFAULT '{}',
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create global settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_settings (
        id SERIAL PRIMARY KEY,
        system_prompt TEXT NOT NULL,
        evaluation_prefix TEXT NOT NULL,
        grading_criteria TEXT NOT NULL,
        default_language VARCHAR(2) DEFAULT 'es',
        default_grade_scale TEXT DEFAULT '{"min":1,"max":7}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);

    // Create evaluation history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_history (
        id SERIAL PRIMARY KEY,
        student_id TEXT NOT NULL,
        evaluation_id TEXT NOT NULL,
        grade REAL NOT NULL,
        explanation TEXT NOT NULL,
        feedback TEXT NOT NULL,
        evaluation_version INTEGER DEFAULT 1,
        is_latest BOOLEAN DEFAULT TRUE,
        ai_model TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create function to update updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for users table
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Ensure admin user exists
    const adminEmail = 'justomiguelvargas@gmail.com';
    const adminResult = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (adminResult.rows.length > 0) {
      await client.query('UPDATE users SET is_admin = TRUE WHERE email = $1', [adminEmail]);
      console.log(`Admin privileges granted to ${adminEmail}`);
    }

    console.log('PostgreSQL database initialized successfully');
  } finally {
    client.release();
  }

  return pgPool;
}

// SQLite initialization (existing code)
async function initSQLite(): Promise<Database> {
  if (db) return db;

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
  const adminEmail = 'justomiguelvargas@gmail.com';
  const adminUser = await db.get('SELECT id FROM users WHERE email = ?', [adminEmail]);
  
  if (adminUser) {
    await db.run('UPDATE users SET is_admin = 1 WHERE email = ?', [adminEmail]);
    console.log(`Admin privileges granted to ${adminEmail}`);
  }

  console.log('SQLite database initialized successfully');
  return db;
}

export async function initDatabase(): Promise<Database | Pool> {
  if (usePostgreSQL) {
    return await initPostgreSQL();
  } else {
    return await initSQLite();
  }
}

// Helper functions for database operations
async function executeQuery(query: string, params: any[] = []): Promise<any> {
  if (usePostgreSQL) {
    const pool = await initDatabase() as Pool;
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } else {
    const database = await initDatabase() as Database;
    return await database.all(query, params);
  }
}

async function executeQuerySingle(query: string, params: any[] = []): Promise<any> {
  if (usePostgreSQL) {
    const pool = await initDatabase() as Pool;
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  } else {
    const database = await initDatabase() as Database;
    return await database.get(query, params);
  }
}

async function executeUpdate(query: string, params: any[] = []): Promise<any> {
  if (usePostgreSQL) {
    const pool = await initDatabase() as Pool;
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return { lastID: result.rows[0]?.id, changes: result.rowCount };
    } finally {
      client.release();
    }
  } else {
    const database = await initDatabase() as Database;
    return await database.run(query, params);
  }
}

export async function createUser(username: string, email: string, password: string): Promise<User> {
  await initDatabase();

  // Check if user already exists
  const existingUser = await executeQuerySingle(
    usePostgreSQL 
      ? 'SELECT id FROM users WHERE username = $1 OR email = $2'
      : 'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (existingUser) {
    throw new Error('El usuario o email ya existe');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const defaultSettings: UserSettings = {
    llmProvider: 'openai',
    openai: {
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3
    },
    localLLM: {
      model: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
      maxTokens: 1500,
      temperature: 0.3
    },
    language: 'es',
    gradeScale: {
      min: 1,
      max: 7
    },
    customPrompts: {}
  };

  if (usePostgreSQL) {
    const result = await executeUpdate(
      `INSERT INTO users (username, email, password_hash, settings, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [username, email, hashedPassword, JSON.stringify(defaultSettings), now, now]
    );
    
    return {
      id: result.lastID,
      username,
      email,
      password_hash: hashedPassword,
      settings: JSON.stringify(defaultSettings),
      is_admin: false,
      is_active: true,
      created_at: now,
      updated_at: now
    };
  } else {
    const result = await executeUpdate(
      `INSERT INTO users (username, email, password_hash, settings, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, JSON.stringify(defaultSettings), now, now]
    );

    return {
      id: result.lastID,
      username,
      email,
      password_hash: hashedPassword,
      settings: JSON.stringify(defaultSettings),
      is_admin: false,
      is_active: true,
      created_at: now,
      updated_at: now
    };
  }
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  await initDatabase();

  const user = await executeQuerySingle(
    usePostgreSQL
      ? 'SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = $2'
      : 'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
    usePostgreSQL ? [username, true] : [username, username]
  );

  if (!user) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return null;
  }

  // Update last login
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE users SET last_login_at = $1 WHERE id = $2'
      : 'UPDATE users SET last_login_at = ? WHERE id = ?',
    [new Date().toISOString(), user.id]
  );

  return user;
}

export async function getUserById(id: number): Promise<User | null> {
  await initDatabase();
  
  return await executeQuerySingle(
    usePostgreSQL ? 'SELECT * FROM users WHERE id = $1' : 'SELECT * FROM users WHERE id = ?',
    [id]
  );
}

export async function updateUserSettings(userId: number, settings: UserSettings): Promise<void> {
  await initDatabase();
  
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE users SET settings = $1 WHERE id = $2'
      : 'UPDATE users SET settings = ? WHERE id = ?',
    [JSON.stringify(settings), userId]
  );
}

export async function updateUserApiKey(userId: number, apiKey: string): Promise<void> {
  await initDatabase();
  
  const encryptedApiKey = encrypt(apiKey);
  
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE users SET openai_api_key_encrypted = $1 WHERE id = $2'
      : 'UPDATE users SET openai_api_key_encrypted = ? WHERE id = ?',
    [encryptedApiKey, userId]
  );
}

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  await initDatabase();
  
  const user = await executeQuerySingle(
    usePostgreSQL ? 'SELECT * FROM users WHERE id = $1' : 'SELECT * FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    return null;
  }

  let settings: UserSettings;
  try {
    settings = user.settings ? JSON.parse(user.settings) : {};
  } catch (error) {
    console.error('Error parsing user settings:', error);
    settings = {} as UserSettings;
  }

  // Ensure all required fields exist with defaults
  const defaultSettings: UserSettings = {
    llmProvider: 'openai',
    openai: {
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3
    },
    localLLM: {
      model: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
      maxTokens: 1500,
      temperature: 0.3
    },
    language: 'es',
    gradeScale: {
      min: 1,
      max: 7
    },
    customPrompts: {
      systemPrompt: '',
      evaluationPrefix: '',
      gradingCriteria: ''
    }
  };

  // Merge with defaults
  const mergedSettings = {
    ...defaultSettings,
    ...settings,
    openai: {
      ...defaultSettings.openai,
      ...settings.openai
    },
    localLLM: {
      ...defaultSettings.localLLM,
      ...settings.localLLM
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

  // Add decrypted API key if available
  if (user.openai_api_key_encrypted) {
    try {
      const decryptedApiKey = decrypt(user.openai_api_key_encrypted);
      if (decryptedApiKey) {
        mergedSettings.openai.apiKey = decryptedApiKey;
      }
    } catch (error) {
      console.error('Error decrypting API key:', error);
    }
  }

  return mergedSettings;
}

// Admin functions
export async function getAllUsers(adminUserId: number): Promise<User[]> {
  await initDatabase();
  
  // Verify admin privileges
  const admin = await executeQuerySingle(
    usePostgreSQL ? 'SELECT is_admin FROM users WHERE id = $1' : 'SELECT is_admin FROM users WHERE id = ?',
    [adminUserId]
  );
  
  if (!admin?.is_admin) {
    throw new Error('Acceso denegado: se requieren privilegios de administrador');
  }
  
  return await executeQuery(
    'SELECT id, username, email, is_admin, is_active, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
}

export async function updateUserAdminStatus(adminUserId: number, targetUserId: number, isAdmin: boolean): Promise<void> {
  await initDatabase();
  
  // Verify admin privileges
  const admin = await executeQuerySingle(
    usePostgreSQL ? 'SELECT is_admin FROM users WHERE id = $1' : 'SELECT is_admin FROM users WHERE id = ?',
    [adminUserId]
  );
  
  if (!admin?.is_admin) {
    throw new Error('Acceso denegado: se requieren privilegios de administrador');
  }
  
  // Prevent removing admin from self
  if (adminUserId === targetUserId && !isAdmin) {
    throw new Error('No puedes remover tus propios privilegios de administrador');
  }
  
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE users SET is_admin = $1 WHERE id = $2'
      : 'UPDATE users SET is_admin = ? WHERE id = ?',
    [isAdmin, targetUserId]
  );
}

export async function updateUserActiveStatus(adminUserId: number, targetUserId: number, isActive: boolean): Promise<void> {
  await initDatabase();
  
  // Verify admin privileges
  const admin = await executeQuerySingle(
    usePostgreSQL ? 'SELECT is_admin FROM users WHERE id = $1' : 'SELECT is_admin FROM users WHERE id = ?',
    [adminUserId]
  );
  
  if (!admin?.is_admin) {
    throw new Error('Acceso denegado: se requieren privilegios de administrador');
  }
  
  // Prevent deactivating self
  if (adminUserId === targetUserId && !isActive) {
    throw new Error('No puedes desactivar tu propia cuenta');
  }
  
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE users SET is_active = $1 WHERE id = $2'
      : 'UPDATE users SET is_active = ? WHERE id = ?',
    [isActive, targetUserId]
  );
}

// Global settings functions
export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  await initDatabase();
  
  return await executeQuerySingle(
    'SELECT * FROM global_settings ORDER BY id DESC LIMIT 1'
  );
}

export async function updateGlobalSettings(
  adminUserId: number, 
  systemPrompt: string, 
  evaluationPrefix: string, 
  gradingCriteria: string,
  defaultLanguage: 'es' | 'en',
  defaultGradeScale: { min: number; max: number }
): Promise<void> {
  await initDatabase();
  
  // Verify admin privileges
  const admin = await executeQuerySingle(
    usePostgreSQL ? 'SELECT is_admin FROM users WHERE id = $1' : 'SELECT is_admin FROM users WHERE id = ?',
    [adminUserId]
  );
  
  if (!admin?.is_admin) {
    throw new Error('Acceso denegado: se requieren privilegios de administrador');
  }
  
  const now = new Date().toISOString();
  
  // Check if settings exist
  const existingSettings = await executeQuerySingle(
    'SELECT id FROM global_settings LIMIT 1'
  );
  
  if (existingSettings) {
    await executeUpdate(
      usePostgreSQL
        ? 'UPDATE global_settings SET system_prompt = $1, evaluation_prefix = $2, grading_criteria = $3, default_language = $4, default_grade_scale = $5, updated_at = $6, updated_by = $7'
        : 'UPDATE global_settings SET system_prompt = ?, evaluation_prefix = ?, grading_criteria = ?, default_language = ?, default_grade_scale = ?, updated_at = ?, updated_by = ?',
      [systemPrompt, evaluationPrefix, gradingCriteria, defaultLanguage, JSON.stringify(defaultGradeScale), now, adminUserId]
    );
  } else {
    await executeUpdate(
      usePostgreSQL
        ? 'INSERT INTO global_settings (system_prompt, evaluation_prefix, grading_criteria, default_language, default_grade_scale, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)'
        : 'INSERT INTO global_settings (system_prompt, evaluation_prefix, grading_criteria, default_language, default_grade_scale, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [systemPrompt, evaluationPrefix, gradingCriteria, defaultLanguage, JSON.stringify(defaultGradeScale), now, adminUserId]
    );
  }
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
  await initDatabase();
  
  // Mark previous results as not latest
  await executeUpdate(
    usePostgreSQL
      ? 'UPDATE evaluation_history SET is_latest = $1 WHERE student_id = $2 AND evaluation_id = $3'
      : 'UPDATE evaluation_history SET is_latest = 0 WHERE student_id = ? AND evaluation_id = ?',
    usePostgreSQL ? [false, studentId, evaluationId] : [studentId, evaluationId]
  );
  
  // Get next version number
  const lastResult = await executeQuerySingle(
    usePostgreSQL
      ? 'SELECT MAX(evaluation_version) as max_version FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2'
      : 'SELECT MAX(evaluation_version) as max_version FROM evaluation_history WHERE student_id = ? AND evaluation_id = ?',
    [studentId, evaluationId]
  );
  
  const nextVersion = (lastResult?.max_version || 0) + 1;
  
  // Insert new result
  await executeUpdate(
    usePostgreSQL
      ? 'INSERT INTO evaluation_history (student_id, evaluation_id, grade, explanation, feedback, evaluation_version, is_latest, ai_model, user_id, evaluated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
      : 'INSERT INTO evaluation_history (student_id, evaluation_id, grade, explanation, feedback, evaluation_version, is_latest, ai_model, user_id, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [studentId, evaluationId, grade, explanation, feedback, nextVersion, usePostgreSQL ? true : 1, aiModel, userId, new Date().toISOString()]
  );
}

export async function getEvaluationHistory(studentId: string, evaluationId: string): Promise<any[]> {
  await initDatabase();
  
  return await executeQuery(
    usePostgreSQL
      ? 'SELECT * FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2 ORDER BY evaluation_version DESC'
      : 'SELECT * FROM evaluation_history WHERE student_id = ? AND evaluation_id = ? ORDER BY evaluation_version DESC',
    [studentId, evaluationId]
  );
}

export async function getLatestEvaluationResult(studentId: string, evaluationId: string): Promise<any | null> {
  await initDatabase();
  
  return await executeQuerySingle(
    usePostgreSQL
      ? 'SELECT * FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2 AND is_latest = $3'
      : 'SELECT * FROM evaluation_history WHERE student_id = ? AND evaluation_id = ? AND is_latest = 1',
    usePostgreSQL ? [studentId, evaluationId, true] : [studentId, evaluationId]
  );
} 