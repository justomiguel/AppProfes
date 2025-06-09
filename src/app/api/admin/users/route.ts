import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAuthResponse } from '../../../../lib/auth';
import { getAllUsers, updateUserAdminStatus, updateUserActiveStatus } from '../../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return createAuthResponse('No autorizado');
    }

    const users = await getAllUsers(user.id);
    
    return NextResponse.json({ users });

  } catch (error) {
    console.error('Get users error:', error);
    
    if (error instanceof Error && error.message.includes('No autorizado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return createAuthResponse('No autorizado');
    }

    const { userId, action, value } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId y action son requeridos' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'toggleAdmin':
        await updateUserAdminStatus(user.id, userId, value);
        break;
      case 'toggleActive':
        await updateUserActiveStatus(user.id, userId, value);
        break;
      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error instanceof Error && error.message.includes('No autorizado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 