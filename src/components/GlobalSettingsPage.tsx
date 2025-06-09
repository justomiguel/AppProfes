'use client';

import { useState, useEffect } from 'react';
import { Settings, Globe, Save, ArrowLeft, Zap, Shield, FileText } from 'lucide-react';
import { useTranslations } from '../hooks/useTranslations';

interface GlobalSettings {
  id: number;
  system_prompt: string;
  evaluation_prefix: string;
  grading_criteria: string;
  default_language: 'es' | 'en';
  default_grade_scale: string;
  updated_at: string;
  updated_by: number;
}

interface GlobalSettingsPageProps {
  onBack: () => void;
}

export default function GlobalSettingsPage({ onBack }: GlobalSettingsPageProps) {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { t } = useTranslations();

  // Form state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [evaluationPrefix, setEvaluationPrefix] = useState('');
  const [gradingCriteria, setGradingCriteria] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState<'es' | 'en'>('es');
  const [gradeMin, setGradeMin] = useState(1);
  const [gradeMax, setGradeMax] = useState(7);

  useEffect(() => {
    loadGlobalSettings();
  }, []);

  const loadGlobalSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/global-settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar configuración global');
      }

      const { settings } = await response.json();
      if (settings) {
        setSettings(settings);
        setSystemPrompt(settings.system_prompt);
        setEvaluationPrefix(settings.evaluation_prefix);
        setGradingCriteria(settings.grading_criteria);
        setDefaultLanguage(settings.default_language);
        
        const gradeScale = JSON.parse(settings.default_grade_scale);
        setGradeMin(gradeScale.min);
        setGradeMax(gradeScale.max);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      if (!systemPrompt.trim() || !evaluationPrefix.trim() || !gradingCriteria.trim()) {
        throw new Error('Todos los campos de prompt son requeridos');
      }

      if (gradeMin >= gradeMax) {
        throw new Error('La nota mínima debe ser menor que la máxima');
      }

      const response = await fetch('/api/admin/global-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          systemPrompt: systemPrompt.trim(),
          evaluationPrefix: evaluationPrefix.trim(),
          gradingCriteria: gradingCriteria.trim(),
          defaultLanguage,
          defaultGradeScale: { min: gradeMin, max: gradeMax },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar configuración');
      }

      setSuccessMessage('Configuración global actualizada exitosamente');
      await loadGlobalSettings(); // Reload to get updated timestamp
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('¿Estás seguro de que quieres restaurar los valores por defecto? Esto sobrescribirá la configuración actual.')) {
      setSystemPrompt(`Eres un evaluador académico ESTRICTO y PRECISO. Tu tarea es evaluar trabajos de programación web con criterios rigurosos.

IMPORTANTE: Sé CRÍTICO y EXIGENTE. La mayoría de trabajos estudiantiles tienen deficiencias significativas.

Debes responder ÚNICAMENTE en el siguiente formato JSON:
{
  "grade": [número entre 1.0 y 7.0],
  "explanation": "[explicación detallada y crítica de la calificación]",
  "feedback": "[comentarios específicos sobre qué mejorar]"
}`);

      setEvaluationPrefix('IMPORTANTE: Sé CRÍTICO y EXIGENTE. La mayoría de trabajos estudiantiles tienen deficiencias significativas.');
      
      setGradingCriteria('Evalúa considerando: funcionalidad, calidad del código, diseño, buenas prácticas, y cumplimiento de requisitos.');
      
      setDefaultLanguage('es');
      setGradeMin(1);
      setGradeMax(7);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Cargando configuración global...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </button>
          
          <div className="flex items-center">
            <Globe className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Configuración Global</h1>
              <p className="mt-2 text-gray-600">
                Configura prompts y parámetros por defecto para todos los usuarios
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {successMessage}
            <button
              onClick={() => setSuccessMessage(null)}
              className="ml-4 text-green-500 hover:text-green-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Warning */}
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <div className="flex items-start">
            <Shield className="h-5 w-5 text-amber-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">Configuración de Administrador</h3>
              <p className="mt-1 text-sm text-amber-700">
                Estos ajustes se aplicarán como valores por defecto para todos los usuarios. 
                Los usuarios pueden sobrescribir estos prompts en su configuración personal.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* System Prompt */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Prompt del Sistema</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Prompt principal que define el comportamiento del evaluador de IA
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Ingresa el prompt del sistema..."
            />
          </div>

          {/* Evaluation Prefix */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <FileText className="h-5 w-5 text-green-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Prefijo de Evaluación</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Texto que se añade al inicio de cada evaluación para dar contexto
            </p>
            <textarea
              value={evaluationPrefix}
              onChange={(e) => setEvaluationPrefix(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa el prefijo de evaluación..."
            />
          </div>

          {/* Grading Criteria */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Settings className="h-5 w-5 text-orange-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Criterios de Calificación</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Criterios específicos que debe seguir el evaluador
            </p>
            <textarea
              value={gradingCriteria}
              onChange={(e) => setGradingCriteria(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa los criterios de calificación..."
            />
          </div>

          {/* Default Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Configuración por Defecto</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="defaultLanguage" className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma por Defecto
                </label>
                <select
                  id="defaultLanguage"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value as 'es' | 'en')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label htmlFor="gradeMin" className="block text-sm font-medium text-gray-700 mb-2">
                  Nota Mínima
                </label>
                <input
                  type="number"
                  id="gradeMin"
                  value={gradeMin}
                  onChange={(e) => setGradeMin(Number(e.target.value))}
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="gradeMax" className="block text-sm font-medium text-gray-700 mb-2">
                  Nota Máxima
                </label>
                <input
                  type="number"
                  id="gradeMax"
                  value={gradeMax}
                  onChange={(e) => setGradeMax(Number(e.target.value))}
                  min="1"
                  max="10"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Restaurar Valores por Defecto
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </button>
          </div>

          {/* Last Updated Info */}
          {settings && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                Última actualización: {new Date(settings.updated_at).toLocaleString('es-ES')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 