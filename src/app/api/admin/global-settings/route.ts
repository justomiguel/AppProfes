import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAuthResponse } from '../../../../lib/auth';
import { getGlobalSettings, updateGlobalSettings } from '../../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return createAuthResponse('No autorizado');
    }

    const settings = await getGlobalSettings();
    
    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Get global settings error:', error);
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

    const { 
      systemPrompt, 
      evaluationPrefix, 
      gradingCriteria, 
      defaultLanguage, 
      defaultGradeScale 
    } = await request.json();

    if (!systemPrompt || !evaluationPrefix || !gradingCriteria) {
      return NextResponse.json(
        { error: 'Todos los campos de prompt son requeridos' },
        { status: 400 }
      );
    }

    await updateGlobalSettings(
      user.id,
      systemPrompt,
      evaluationPrefix,
      gradingCriteria,
      defaultLanguage || 'es',
      defaultGradeScale || { min: 1, max: 7 }
    );

    return NextResponse.json({
      message: 'Configuración global actualizada exitosamente'
    });

  } catch (error) {
    console.error('Update global settings error:', error);
    
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