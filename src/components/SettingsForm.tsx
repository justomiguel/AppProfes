'use client';

import { useState, useEffect } from 'react';
import { Save, Key, Globe, Sliders, Zap, FileText, RotateCcw, Settings } from 'lucide-react';
import { useTranslations } from '../hooks/useTranslations';

interface SettingsFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export default function SettingsForm({ onSave, onCancel }: SettingsFormProps) {
  const [settings, setSettings] = useState({
    openai: {
      apiKey: '',
      model: 'gpt-4o' as 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3,
    },
    language: 'es' as 'es' | 'en',
    gradeScale: {
      min: 1,
      max: 7,
    },
    customPrompts: {
      systemPrompt: '',
      evaluationPrefix: '',
      gradingCriteria: '',
    },
  });

  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useCustomPrompts, setUseCustomPrompts] = useState(false);
  const { t, setLanguage } = useTranslations();

  useEffect(() => {
    loadSettings();
    loadGlobalSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const { settings: userSettings } = await response.json();
        console.log('Received settings from API:', userSettings);
        
        if (userSettings) {
          console.log('API Key received:', userSettings.openai?.apiKey ? '***PRESENT***' : 'NOT PRESENT');
          
          setSettings({
            openai: userSettings.openai || settings.openai,
            language: userSettings.language || 'es',
            gradeScale: userSettings.gradeScale || settings.gradeScale,
            customPrompts: userSettings.customPrompts || settings.customPrompts,
          });

          // Check if user has custom prompts configured
          const hasCustomPrompts = userSettings.customPrompts && (
            userSettings.customPrompts.systemPrompt ||
            userSettings.customPrompts.evaluationPrefix ||
            userSettings.customPrompts.gradingCriteria
          );
          setUseCustomPrompts(hasCustomPrompts);
        }
      } else {
        console.error('Failed to load settings:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGlobalSettings = async () => {
    try {
      const response = await fetch('/api/admin/global-settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const { settings } = await response.json();
        setGlobalSettings(settings);
      }
    } catch (error) {
      console.error('Error loading global settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const settingsToSave = {
        ...settings,
        customPrompts: useCustomPrompts ? settings.customPrompts : {
          systemPrompt: '',
          evaluationPrefix: '',
          gradingCriteria: '',
        },
      };

      console.log('Sending settings:', settingsToSave);

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ settings: settingsToSave }),
      });

      const responseData = await response.json();
      console.log('Response:', response.status, responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
      }

      setSuccessMessage('Configuración guardada exitosamente');
      
      setTimeout(() => {
        onSave();
      }, 1000);

    } catch (error) {
      console.error('Save settings error:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  const resetPromptsToGlobal = () => {
    if (!globalSettings) return;

    if (confirm('¿Estás seguro de que quieres restaurar los prompts a la configuración global? Esto sobrescribirá tus prompts personalizados.')) {
      setSettings(prev => ({
        ...prev,
        customPrompts: {
          systemPrompt: '',
          evaluationPrefix: '',
          gradingCriteria: '',
        },
      }));
      setUseCustomPrompts(false);
    }
  };

  const loadGlobalPromptsAsBase = () => {
    if (!globalSettings) return;

    if (confirm('¿Quieres cargar los prompts globales como base para tu configuración personalizada?')) {
      setSettings(prev => ({
        ...prev,
        customPrompts: {
          systemPrompt: globalSettings.system_prompt || '',
          evaluationPrefix: globalSettings.evaluation_prefix || '',
          gradingCriteria: globalSettings.grading_criteria || '',
        },
      }));
      setUseCustomPrompts(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
              <div className="flex items-center">
                <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configuración</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Configura tu API de OpenAI y preferencias
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Loading */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando configuración...</span>
          </div>
        </main>
      </div>
    );
  }

  // Main content when not loading
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configuración</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Configura tu API de OpenAI y preferencias
                </p>
              </div>
            </div>
            <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-4 text-green-500 hover:text-green-700"
              >
                ×
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* OpenAI Configuration */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <Key className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Configuración de OpenAI</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    value={settings.openai.apiKey}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      openai: { ...prev.openai, apiKey: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="sk-..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                      Modelo
                    </label>
                    <select
                      id="model"
                      value={settings.openai.model}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        openai: { ...prev.openai, model: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4o">GPT-4o</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      id="maxTokens"
                      value={settings.openai.maxTokens}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        openai: { ...prev.openai, maxTokens: Number(e.target.value) }
                      }))}
                      min="100"
                      max="4000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
                      Temperature
                    </label>
                    <input
                      type="number"
                      id="temperature"
                      value={settings.openai.temperature}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        openai: { ...prev.openai, temperature: Number(e.target.value) }
                      }))}
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* General Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Configuración General</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                    Idioma
                  </label>
                  <select
                    id="language"
                    value={settings.language}
                    onChange={(e) => {
                      const newLang = e.target.value as 'es' | 'en';
                      setSettings(prev => ({ ...prev, language: newLang }));
                      setLanguage(newLang);
                    }}
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
                    value={settings.gradeScale.min}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      gradeScale: { ...prev.gradeScale, min: Number(e.target.value) }
                    }))}
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
                    value={settings.gradeScale.max}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      gradeScale: { ...prev.gradeScale, max: Number(e.target.value) }
                    }))}
                    min="1"
                    max="10"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Prompts */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Sliders className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Prompts Personalizados</h3>
                </div>
                
                <div className="flex items-center space-x-3">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={useCustomPrompts}
                      onChange={(e) => setUseCustomPrompts(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Usar prompts personalizados</span>
                  </label>
                </div>
              </div>

              {!useCustomPrompts && globalSettings && (
                <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Actualmente estás usando los prompts globales del sistema. 
                    Activa los prompts personalizados para crear tu propia configuración.
                  </p>
                  <button
                    onClick={loadGlobalPromptsAsBase}
                    className="mt-2 inline-flex items-center px-3 py-1 border border-blue-300 rounded text-sm text-blue-700 hover:bg-blue-100"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Cargar prompts globales como base
                  </button>
                </div>
              )}

              {useCustomPrompts && (
                <div className="space-y-6">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={resetPromptsToGlobal}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restaurar a Global
                    </button>
                    
                    <button
                      onClick={loadGlobalPromptsAsBase}
                      className="inline-flex items-center px-3 py-1 border border-blue-300 rounded text-sm text-blue-700 hover:bg-blue-100"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Cargar Base Global
                    </button>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center mb-2">
                      <Zap className="h-4 w-4 text-purple-600 mr-2" />
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt del Sistema
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      Define el comportamiento principal del evaluador de IA
                    </p>
                    <textarea
                      value={settings.customPrompts.systemPrompt}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        customPrompts: { ...prev.customPrompts, systemPrompt: e.target.value }
                      }))}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="Ingresa tu prompt del sistema personalizado..."
                    />
                  </div>

                  {/* Evaluation Prefix */}
                  <div>
                    <div className="flex items-center mb-2">
                      <FileText className="h-4 w-4 text-green-600 mr-2" />
                      <label className="block text-sm font-medium text-gray-700">
                        Prefijo de Evaluación
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      Texto que se añade al inicio de cada evaluación
                    </p>
                    <textarea
                      value={settings.customPrompts.evaluationPrefix}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        customPrompts: { ...prev.customPrompts, evaluationPrefix: e.target.value }
                      }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingresa tu prefijo de evaluación personalizado..."
                    />
                  </div>

                  {/* Grading Criteria */}
                  <div>
                    <div className="flex items-center mb-2">
                      <Sliders className="h-4 w-4 text-orange-600 mr-2" />
                      <label className="block text-sm font-medium text-gray-700">
                        Criterios de Calificación
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      Criterios específicos para la evaluación
                    </p>
                    <textarea
                      value={settings.customPrompts.gradingCriteria}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        customPrompts: { ...prev.customPrompts, gradingCriteria: e.target.value }
                      }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingresa tus criterios de calificación personalizados..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 