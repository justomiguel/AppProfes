import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { getUserById } from './database';

// Validate JWT secret exists
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

interface JWTPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JWTPayload;
    
    // Check if token is expired (additional check)
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }
    
    const user = await getUserById(decoded.userId);
    
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  // Try to get token from cookie first (more secure)
  const tokenFromCookie = request.cookies.get('auth-token')?.value;
  
  // Fallback to Authorization header for API clients
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  const token = tokenFromCookie || tokenFromHeader;
  
  if (!token) return null;
  
  return await verifyToken(token);
}

export function createAuthResponse(error: string, status: number = 401) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store', // Prevent caching of auth errors
    }
  });
}

export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    JWT_SECRET!,
    { 
      expiresIn: process.env.NODE_ENV === 'production' ? '24h' : '7d',
      issuer: 'ai-evaluador',
      audience: 'ai-evaluador-users'
    }
  );
} 