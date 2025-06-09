import OpenAI from 'openai';
import { OpenAIConfig, StudentFile, EvaluationResult, EvaluationFile } from '../../types';

export class OpenAIService {
  private client: OpenAI | null = null;
  private settings: any = null;
  private globalSettings: any = null;

  private async getSettings() {
    if (this.settings) return this.settings;

    try {
      const response = await fetch('/api/user/settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const { settings } = await response.json();
        this.settings = settings;
        return settings;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    // Fallback to default settings
    return {
      openai: {
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: 0.3,
      },
      language: 'es',
      customPrompts: {},
    };
  }

  private async getGlobalSettings() {
    if (this.globalSettings) return this.globalSettings;

    try {
      const response = await fetch('/api/admin/global-settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const { settings } = await response.json();
        this.globalSettings = settings;
        return settings;
      }
    } catch (error) {
      console.error('Error loading global settings:', error);
      return null;
    }
  }

  private async initializeClient() {
    const settings = await this.getSettings();
    
    console.log('Initializing OpenAI client...');
    console.log('API key present:', !!settings.openai.apiKey);
    console.log('API key length:', settings.openai.apiKey?.length || 0);
    console.log('API key starts with sk-:', settings.openai.apiKey?.startsWith('sk-') || false);
    
    if (!settings.openai.apiKey) {
      throw new Error('API Key de OpenAI no configurada');
    }

    // Validate API key format
    if (!settings.openai.apiKey.startsWith('sk-') || settings.openai.apiKey.length < 40) {
      console.error('Invalid API key format detected:', {
        length: settings.openai.apiKey.length,
        starts_with_sk: settings.openai.apiKey.startsWith('sk-'),
        preview: settings.openai.apiKey.substring(0, 20) + '...'
      });
      throw new Error('API Key de OpenAI tiene formato inválido. Debe empezar con "sk-" y tener al menos 40 caracteres.');
    }

    this.client = new OpenAI({
      apiKey: settings.openai.apiKey,
      dangerouslyAllowBrowser: true,
    });

    return this.client;
  }

  async evaluateStudent(
    prompt: string,
    promptFiles: string[],
    rubric: string,
    rubricFiles: string[],
    studentFiles: string[],
    studentId: string,
    evaluationId: string,
    userId: number,
    isReEvaluation: boolean = false
  ): Promise<Pick<EvaluationResult, 'grade' | 'explanation' | 'feedback'>> {
    try {
      const settings = await this.getSettings();
      const globalSettings = await this.getGlobalSettings();
      const client = await this.initializeClient();

      const systemPrompt = this.buildSystemPrompt(settings, globalSettings);
      console.log('System prompt being used:', systemPrompt.substring(0, 300) + '...');

      // Build the user message with stronger JSON enforcement
      let userMessage = this.buildEvaluationPrefix(settings, globalSettings);
      
      userMessage += `\n\nIMPORTANTE: RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO. NO AGREGUES TEXTO ADICIONAL, EXPLICACIONES O MARKDOWN.
      
FORMATO REQUERIDO (copia exactamente esta estructura):
{
  "grade": [número decimal entre 1.0 y 7.0],
  "explanation": "[explicación de la calificación]",
  "feedback": "[comentarios para mejorar]"
}`;
      
      userMessage += `\n\nCONSIGNA/PROMPT:\n${prompt}\n\n`;
      
      if (promptFiles.length > 0) {
        userMessage += `ARCHIVOS DE LA CONSIGNA:\n${promptFiles.join('\n\n')}\n\n`;
      }
      
      userMessage += `RÚBRICA DE EVALUACIÓN:\n${rubric}\n\n`;
      
      if (rubricFiles.length > 0) {
        userMessage += `ARCHIVOS DE LA RÚBRICA:\n${rubricFiles.join('\n\n')}\n\n`;
      }

      userMessage += this.buildGradingCriteria(settings, globalSettings);
      
      if (isReEvaluation) {
        userMessage += `\n\n🔄 NOTA: Esta es una RE-EVALUACIÓN. Revisa el trabajo con criterios frescos y actualizados.`;
      }
      
      userMessage += `\n\nTRABAJO DEL ESTUDIANTE:\n${studentFiles.join('\n\n')}`;
      
      // Add final JSON reminder
      userMessage += `\n\n⚠️ RECORDATORIO FINAL: Responde ÚNICAMENTE con el objeto JSON. No agregues texto antes, después o explicaciones adicionales.`;

      console.log('User message length:', userMessage.length);
      console.log('User message preview:', userMessage.substring(0, 500) + '...');

      const completion = await client.chat.completions.create({
        model: settings.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: settings.openai.maxTokens,
        temperature: settings.openai.temperature,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      console.log('OpenAI response received:', response.substring(0, 200) + '...');

      // Try multiple JSON parsing strategies
      let result;
      
      // Strategy 1: Look for JSON block with improved regex
      const jsonMatch = response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed JSON with strategy 1');
        } catch (parseError) {
          console.log('Strategy 1 failed, trying strategy 2');
        }
      }
      
      // Strategy 2: Look for JSON between code blocks
      if (!result) {
        const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          try {
            result = JSON.parse(codeBlockMatch[1]);
            console.log('Successfully parsed JSON with strategy 2 (code blocks)');
          } catch (parseError) {
            console.log('Strategy 2 failed, trying strategy 3');
          }
        }
      }
      
      // Strategy 3: Try to extract the largest JSON-like object
      if (!result) {
        const jsonObjects = response.match(/\{[\s\S]*?\}/g);
        if (jsonObjects && jsonObjects.length > 0) {
          // Try the largest JSON object first
          const sortedByLength = jsonObjects.sort((a, b) => b.length - a.length);
          for (const jsonStr of sortedByLength) {
            try {
              result = JSON.parse(jsonStr);
              console.log('Successfully parsed JSON with strategy 3');
              break;
            } catch (parseError) {
              continue;
            }
          }
        }
      }
      
      // Strategy 4: Manual extraction if JSON parsing fails
      if (!result) {
        console.log('All JSON parsing strategies failed, attempting manual extraction');
        console.log('Full OpenAI response:', response);
        
        // Try to extract fields manually using regex
        const gradeMatch = response.match(/["']?grade["']?\s*:\s*([0-9]+\.?[0-9]*)/i);
        const explanationMatch = response.match(/["']?explanation["']?\s*:\s*["']([\s\S]*?)["']/i);
        const feedbackMatch = response.match(/["']?feedback["']?\s*:\s*["']([\s\S]*?)["']/i);
        
        if (gradeMatch && explanationMatch && feedbackMatch) {
          result = {
            grade: parseFloat(gradeMatch[1]),
            explanation: explanationMatch[1],
            feedback: feedbackMatch[1]
          };
          console.log('Successfully extracted data manually');
        }
      }
      
      if (!result) {
        throw new Error(`Respuesta de OpenAI no está en formato JSON válido. Respuesta completa: ${response}`);
      }

      // Validate the result structure
      if (typeof result.grade !== 'number' || !result.explanation || !result.feedback) {
        throw new Error(`Estructura de respuesta inválida. Esperado: {grade: number, explanation: string, feedback: string}. Recibido: ${JSON.stringify(result)}`);
      }
      
      console.log('Final parsed result:', {
        grade: result.grade,
        explanation: result.explanation.substring(0, 100) + '...',
        feedback: result.feedback.substring(0, 100) + '...'
      });
      
      const evaluationResult = {
        grade: result.grade,
        explanation: result.explanation,
        feedback: result.feedback,
      };

      // Save evaluation result via API
      try {
        await fetch('/api/evaluation/save-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            studentId,
            evaluationId,
            grade: result.grade,
            explanation: result.explanation,
            feedback: result.feedback,
            aiModel: settings.openai.model,
            isReEvaluation,
          }),
        });
      } catch (saveError) {
        console.error('Error saving evaluation result:', saveError);
        // Don't throw here - we still want to return the result
      }

      return evaluationResult;

    } catch (error) {
      console.error('Error evaluating student:', error);
      throw error;
    }
  }

  private buildSystemPrompt(userSettings: any, globalSettings: any): string {
    // Priority: User custom > Global > Default
    if (userSettings.customPrompts?.systemPrompt) {
      return userSettings.customPrompts.systemPrompt;
    }
    
    if (globalSettings?.system_prompt) {
      return globalSettings.system_prompt;
    }

    // Default system prompt
    return userSettings.language === 'es' 
      ? this.getDefaultSpanishSystemPrompt() 
      : this.getDefaultEnglishSystemPrompt();
  }

  private buildEvaluationPrefix(userSettings: any, globalSettings: any): string {
    if (userSettings.customPrompts?.evaluationPrefix) {
      return userSettings.customPrompts.evaluationPrefix;
    }
    
    if (globalSettings?.evaluation_prefix) {
      return globalSettings.evaluation_prefix;
    }

    return userSettings.language === 'es'
      ? 'IMPORTANTE: Sé CRÍTICO y EXIGENTE. La mayoría de trabajos estudiantiles tienen deficiencias significativas.'
      : 'IMPORTANT: Be CRITICAL and DEMANDING. Most student work has significant deficiencies.';
  }

  private buildGradingCriteria(userSettings: any, globalSettings: any): string {
    if (userSettings.customPrompts?.gradingCriteria) {
      return `\n\nCRITERIOS DE EVALUACIÓN:\n${userSettings.customPrompts.gradingCriteria}`;
    }
    
    if (globalSettings?.grading_criteria) {
      return `\n\nCRITERIOS DE EVALUACIÓN:\n${globalSettings.grading_criteria}`;
    }

    return userSettings.language === 'es'
      ? '\n\nCRITERIOS DE EVALUACIÓN:\nEvalúa considerando: funcionalidad, calidad del código, diseño, buenas prácticas, y cumplimiento de requisitos.'
      : '\n\nEVALUATION CRITERIA:\nEvaluate considering: functionality, code quality, design, best practices, and requirement compliance.';
  }

  private getDefaultSpanishSystemPrompt(): string {
    return `Eres un evaluador académico ESTRICTO y PRECISO. Tu tarea es evaluar trabajos de programación web con criterios rigurosos.

⚠️⚠️⚠️ INSTRUCCIÓN CRÍTICA ⚠️⚠️⚠️
DEBES responder ÚNICAMENTE con un objeto JSON válido. NO escribas NADA más.
Si agregas texto adicional, markdown, explicaciones o cualquier cosa fuera del JSON, FALLARÁS automáticamente.

FORMATO OBLIGATORIO (copia exactamente):
{
  "grade": 4.2,
  "explanation": "Tu explicación aquí",
  "feedback": "Tus comentarios aquí"
}

REGLAS ESTRICTAS:
- Solo JSON, nada más
- "grade" debe ser número decimal entre 1.0 y 7.0
- "explanation" y "feedback" deben ser strings
- NO uses markdown, NO uses bloques de código
- NO agregues introducción ni conclusión
- NO uses triple backticks
- NO uses formato con tres comillas y json

CRITERIOS DE EVALUACIÓN ESTRICTOS:

**NOTA 7.0 (Excelente)**: SOLO para trabajos excepcionales que:
- Cumplen TODOS los requisitos perfectamente
- Código impecable, bien estructurado, comentado
- Diseño profesional y completamente responsive
- Múltiples funcionalidades extra bien implementadas
- Manejo de errores robusto
- Buenas prácticas de seguridad

**NOTA 6.0-6.9 (Muy Bueno)**: Para trabajos que:
- Cumplen todos los requisitos básicos correctamente
- Código bien organizado con algunas buenas prácticas
- Diseño atractivo y responsive
- Al menos 2-3 funcionalidades extra
- Manejo básico de errores

**NOTA 5.0-5.9 (Bueno)**: Para trabajos que:
- Cumplen la mayoría de requisitos básicos
- Código funcional pero con problemas menores
- Diseño aceptable, parcialmente responsive
- 1-2 funcionalidades extra

**NOTA 4.0-4.9 (Suficiente)**: Para trabajos que:
- Cumplen requisitos mínimos básicos
- Código funciona pero mal estructurado
- Diseño básico, problemas de responsive
- Pocas o ninguna funcionalidad extra
- Problemas evidentes de organización

**NOTA 3.0-3.9 (Insuficiente)**: Para trabajos que:
- Faltan algunas funcionalidades básicas
- Código desorganizado con errores
- Diseño deficiente
- No cumple estructura requerida

**NOTA 1.0-2.9 (Deficiente)**: Para trabajos que:
- Faltan funcionalidades críticas (persistencia, etc.)
- Código muy básico o no funciona
- Sin diseño apropiado
- No cumple requisitos fundamentales

PENALIZACIONES OBLIGATORIAS:
- Estructura incorrecta (todo en un archivo): -1.5 puntos
- Sin persistencia localStorage: -2.0 puntos
- No responsive: -1.0 punto
- Código sin comentarios: -0.5 puntos
- Funcionalidades básicas faltantes: -1.0 punto cada una
- JavaScript antiguo (var, innerHTML): -0.5 puntos
- Sin validaciones: -0.5 puntos

⚠️ RECORDATORIO FINAL: Responde SOLO con el JSON. Sin texto adicional.`;
  }

  private getDefaultEnglishSystemPrompt(): string {
    return `You are a STRICT and PRECISE academic evaluator. Your task is to evaluate web programming assignments with rigorous criteria.

IMPORTANT: Be CRITICAL and DEMANDING. Most student work has significant deficiencies.

MANDATORY RESPONSE FORMAT:
You must respond ONLY with a valid JSON object with this EXACT structure (no additional text before or after):

{
  "grade": 4.5,
  "explanation": "Detailed explanation here...",
  "feedback": "Specific comments here..."
}

JSON RULES:
- The "grade" field must be a decimal number between 1.0 and 7.0
- The "explanation" and "feedback" fields must be strings with double quotes
- DO NOT add text before or after the JSON
- DO NOT use markdown or code blocks
- Ensure the JSON is valid

STRICT EVALUATION CRITERIA:

**GRADE 7.0 (Excellent)**: ONLY for exceptional work that:
- Meets ALL requirements perfectly
- Impeccable, well-structured, commented code
- Professional and fully responsive design
- Multiple extra features well implemented
- Robust error handling
- Good security practices

**GRADE 6.0-6.9 (Very Good)**: For work that:
- Meets all basic requirements correctly
- Well-organized code with some good practices
- Attractive and responsive design
- At least 2-3 extra features
- Basic error handling

**GRADE 5.0-5.9 (Good)**: For work that:
- Meets most basic requirements
- Functional code but with minor issues
- Acceptable design, partially responsive
- 1-2 extra features

**GRADE 4.0-4.9 (Sufficient)**: For work that:
- Meets minimum basic requirements
- Code works but poorly structured
- Basic design, responsive issues
- Few or no extra features
- Evident organization problems

**GRADE 3.0-3.9 (Insufficient)**: For work that:
- Missing some basic functionalities
- Disorganized code with errors
- Poor design
- Doesn't meet required structure

**GRADE 1.0-2.9 (Deficient)**: For work that:
- Missing critical functionalities (persistence, etc.)
- Very basic code or doesn't work
- No appropriate design
- Doesn't meet fundamental requirements

MANDATORY PENALTIES:
- Incorrect structure (all in one file): -1.5 points
- No localStorage persistence: -2.0 points
- Not responsive: -1.0 point
- Code without comments: -0.5 points
- Missing basic functionalities: -1.0 point each
- Old JavaScript (var, innerHTML): -0.5 points
- No validations: -0.5 points

Be SPECIFIC about what's wrong and why the grade is low.

REMEMBER: Respond ONLY with the JSON, no additional text.`;
  }

  // Reset settings cache when settings change
  resetSettings() {
    this.settings = null;
    this.globalSettings = null;
    this.client = null;
  }
} 