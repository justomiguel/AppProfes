import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '../../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    // Validate input
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email y password son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser(username, email, password);

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;

    return NextResponse.json({
      message: 'Usuario creado exitosamente',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error && error.message.includes('ya existe')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 