import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '../../../../lib/database';
import { generateToken } from '../../../../lib/auth';

// Simple rate limiting (in production, use Redis or similar)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Simple rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const attempts = loginAttempts.get(clientIP);
    
    if (attempts && attempts.count >= 5 && now - attempts.lastAttempt < 15 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    try {
      const user = await authenticateUser(username, password);
      
      if (!user) {
        // Update rate limiting
        const currentAttempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
        loginAttempts.set(clientIP, {
          count: currentAttempts.count + 1,
          lastAttempt: now
        });
        
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // Reset rate limiting on successful login
      loginAttempts.delete(clientIP);

      // Generate JWT token
      const token = generateToken(user.id, user.username);

      // Return user without sensitive data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, openai_api_key_encrypted, ...userWithoutSensitiveData } = user;

      // Set HTTP-only cookie
      const response = NextResponse.json({ 
        message: 'Login successful',
        user: userWithoutSensitiveData
      });
      
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 // 24 hours
      });

      return response;

    } catch (authError) {
      console.error('Authentication error:', authError);
      
      // Update rate limiting
      const currentAttempts = loginAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(clientIP, {
        count: currentAttempts.count + 1,
        lastAttempt: now
      });
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 