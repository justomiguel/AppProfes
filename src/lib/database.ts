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

let pgPool: Pool | null = null;

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

  // Try different environment variable names for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL || 
                     process.env.POSTGRES_PRISMA_URL ||
                     process.env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required. Please set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL');
  }

  console.log('Connecting to PostgreSQL database...');

  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    },
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  const client = await pgPool.connect();
  
  try {
    console.log('Testing database connection...');
    await client.query('SELECT NOW()');
    console.log('Database connection successful!');

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
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }

  return pgPool;
}

export async function initDatabase(): Promise<Pool> {
  return await initPostgreSQL();
}

// Helper functions for database operations
async function executeQuery(query: string, params: any[] = []): Promise<any> {
  const pool = await initDatabase();
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function executeQuerySingle(query: string, params: any[] = []): Promise<any> {
  const pool = await initDatabase();
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function executeUpdate(query: string, params: any[] = []): Promise<any> {
  const pool = await initDatabase();
  const client = await pool.connect();
  try {
    // Only add RETURNING id for INSERT statements that don't already have it
    let finalQuery = query;
    if (query.toUpperCase().includes('INSERT') && !query.toUpperCase().includes('RETURNING')) {
      finalQuery = query + ' RETURNING id';
    }
    
    const result = await client.query(finalQuery, params);
    return { lastID: result.rows[0]?.id, changes: result.rowCount };
  } finally {
    client.release();
  }
}

export async function createUser(username: string, email: string, password: string): Promise<User> {
  await initDatabase();

  // Check if user already exists
  const existingUser = await executeQuerySingle(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
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

  const result = await executeUpdate(
    'INSERT INTO users (username, email, password_hash, settings, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
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

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  await initDatabase();

  const user = await executeQuerySingle(
    'SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = $2',
    [username, true]
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
    'UPDATE users SET last_login_at = $1 WHERE id = $2',
    [new Date().toISOString(), user.id]
  );

  return user;
}

export async function getUserById(id: number): Promise<User | null> {
  await initDatabase();
  
  return await executeQuerySingle(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
}

export async function updateUserSettings(userId: number, settings: UserSettings): Promise<void> {
  await initDatabase();
  
  await executeUpdate(
    'UPDATE users SET settings = $1 WHERE id = $2',
    [JSON.stringify(settings), userId]
  );
}

export async function updateUserApiKey(userId: number, apiKey: string): Promise<void> {
  await initDatabase();
  
  const encryptedApiKey = encrypt(apiKey);
  
  await executeUpdate(
    'UPDATE users SET openai_api_key_encrypted = $1 WHERE id = $2',
    [encryptedApiKey, userId]
  );
}

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  await initDatabase();
  
  const user = await executeQuerySingle(
    'SELECT * FROM users WHERE id = $1',
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
    'SELECT is_admin FROM users WHERE id = $1',
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
    'SELECT is_admin FROM users WHERE id = $1',
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
    'UPDATE users SET is_admin = $1 WHERE id = $2',
    [isAdmin, targetUserId]
  );
}

export async function updateUserActiveStatus(adminUserId: number, targetUserId: number, isActive: boolean): Promise<void> {
  await initDatabase();
  
  // Verify admin privileges
  const admin = await executeQuerySingle(
    'SELECT is_admin FROM users WHERE id = $1',
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
    'UPDATE users SET is_active = $1 WHERE id = $2',
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
    'SELECT is_admin FROM users WHERE id = $1',
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
      'UPDATE global_settings SET system_prompt = $1, evaluation_prefix = $2, grading_criteria = $3, default_language = $4, default_grade_scale = $5, updated_at = $6, updated_by = $7',
      [systemPrompt, evaluationPrefix, gradingCriteria, defaultLanguage, JSON.stringify(defaultGradeScale), now, adminUserId]
    );
  } else {
    await executeUpdate(
      'INSERT INTO global_settings (system_prompt, evaluation_prefix, grading_criteria, default_language, default_grade_scale, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
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
    'UPDATE evaluation_history SET is_latest = $1 WHERE student_id = $2 AND evaluation_id = $3',
    [false, studentId, evaluationId]
  );
  
  // Get next version number
  const lastResult = await executeQuerySingle(
    'SELECT MAX(evaluation_version) as max_version FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2',
    [studentId, evaluationId]
  );
  
  const nextVersion = (lastResult?.max_version || 0) + 1;
  
  // Insert new result
  await executeUpdate(
    'INSERT INTO evaluation_history (student_id, evaluation_id, grade, explanation, feedback, evaluation_version, is_latest, ai_model, user_id, evaluated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [studentId, evaluationId, grade, explanation, feedback, nextVersion, true, aiModel, userId, new Date().toISOString()]
  );
}

export async function getEvaluationHistory(studentId: string, evaluationId: string): Promise<any[]> {
  await initDatabase();
  
  return await executeQuery(
    'SELECT * FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2 ORDER BY evaluation_version DESC',
    [studentId, evaluationId]
  );
}

export async function getLatestEvaluationResult(studentId: string, evaluationId: string): Promise<any | null> {
  await initDatabase();
  
  return await executeQuerySingle(
    'SELECT * FROM evaluation_history WHERE student_id = $1 AND evaluation_id = $2 AND is_latest = $3',
    [studentId, evaluationId, true]
  );
} 