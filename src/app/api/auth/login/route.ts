import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '../../../../lib/database';
import { generateToken } from '../../../../lib/auth';

// Simple rate limiting (in production, use Redis or similar)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Reset counter after 15 minutes
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Allow max 5 attempts per 15 minutes
  if (attempts.count >= 5) {
    return true;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
        { status: 429 }
      );
    }

    const { username, password } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username y password son requeridos' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authenticateUser(username, password);

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username);

    // Return user without password and token
    const { password_hash, openai_api_key_encrypted, ...userWithoutSensitiveData } = user;

    const response = NextResponse.json({
      message: 'Login exitoso',
      user: userWithoutSensitiveData,
      token
    });

    // Set HTTP-only cookie with security flags
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 7 * 24 * 60 * 60, // 1 day in prod, 7 days in dev
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 