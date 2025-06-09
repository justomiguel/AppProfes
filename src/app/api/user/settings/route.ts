import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAuthResponse } from '../../../../lib/auth';
import { getUserSettings, updateUserSettings, updateUserApiKey } from '../../../../lib/database';
import type { UserSettings } from '../../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return createAuthResponse('No autorizado');
    }

    const settings = await getUserSettings(user.id);
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Error obteniendo configuración del usuario' },
        { status: 500 }
      );
    }

    console.log('Returning settings for user', user.id, ':', {
      ...settings,
      openai: {
        ...settings.openai,
        apiKey: settings.openai.apiKey ? '***REDACTED***' : undefined
      }
    });

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Get settings error:', error);
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

    const body = await request.json();
    const settings: UserSettings = body.settings || body;

    // Validate settings structure
    if (!settings.openai || !settings.language || !settings.gradeScale) {
      console.error('Invalid settings structure:', settings);
      return NextResponse.json(
        { error: 'Estructura de settings inválida. Se requieren openai, language y gradeScale.' },
        { status: 400 }
      );
    }

    // Update API key separately if provided
    if (settings.openai.apiKey) {
      await updateUserApiKey(user.id, settings.openai.apiKey);
      // Remove API key from settings object before storing
      const { apiKey, ...openaiWithoutKey } = settings.openai;
      settings.openai = openaiWithoutKey;
    }

    // Update settings
    await updateUserSettings(user.id, settings);

    return NextResponse.json({
      message: 'Settings actualizados exitosamente'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 