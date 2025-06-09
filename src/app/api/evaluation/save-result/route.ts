import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createAuthResponse } from '../../../../lib/auth';
import { saveEvaluationResult } from '../../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return createAuthResponse('No autorizado');
    }

    const { 
      studentId, 
      evaluationId, 
      grade, 
      explanation, 
      feedback, 
      aiModel,
      // Check if this is a re-evaluation (for future use)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      isReEvaluation
    } = await request.json();

    if (!studentId || !evaluationId || grade === undefined || !explanation || !feedback) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    await saveEvaluationResult(
      studentId,
      evaluationId,
      grade,
      explanation,
      feedback,
      aiModel || 'gpt-4o',
      user.id
    );

    return NextResponse.json({
      message: 'Resultado guardado exitosamente'
    });

  } catch (error) {
    console.error('Save evaluation result error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 