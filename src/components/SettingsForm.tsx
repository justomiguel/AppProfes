'use client';

import React, { useState, useEffect } from 'react';
import { Key, Globe, Sliders, Zap, FileText, RotateCcw, Settings, Download, Cpu, Cloud, Trash2, Pause, Play, HardDrive, CheckCircle, AlertCircle, Clock, FolderOpen, Info } from 'lucide-react';
import { useTranslations } from '../hooks/useTranslations';
import { modelConfigService } from '../lib/models/config';
import { localLLMService, LocalLLMService, ModelStatus, ModelProgressInfo, ModelDownloadProgress } from '../lib/localLLM/client';

// Define the ModelDownloadStatus interface for compatibility
interface ModelDownloadStatus {
  modelName: string;
  status: ModelStatus;
  progress: number;
  downloadedSize?: number;
  totalSize?: number;
  error?: string;
  lastUpdated: number;
}

interface SettingsFormProps {
  onSave: (settings: UserSettings) => void;
  onCancel: () => void;
}

interface UserSettings {
  llmProvider: 'openai' | 'local';
  openai: {
    apiKey: string;
    model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o';
    maxTokens: number;
    temperature: number;
  };
  localLLM: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  language: 'es' | 'en';
  gradeScale: {
    min: number;
    max: number;
  };
  customPrompts: {
    systemPrompt: string;
    evaluationPrefix: string;
    gradingCriteria: string;
  };
}

interface GlobalSettings {
  [key: string]: unknown;
}

export default function SettingsForm({ onSave, onCancel }: SettingsFormProps) {
  const [settings, setSettings] = useState<UserSettings>({
    llmProvider: 'openai' as 'openai' | 'local',
    openai: {
      apiKey: '',
      model: 'gpt-3.5-turbo' as 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.3,
    },
    localLLM: {
      model: modelConfigService.getDefaultModel('local') || 'Xenova/Phi-3-mini-4k-instruct',
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

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useCustomPrompts, setUseCustomPrompts] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelDownloadStatus[]>([]);
  const [localLLMServiceInstance, setLocalLLMServiceInstance] = useState<LocalLLMService | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [storageUsage, setStorageUsage] = useState<string>('0 Bytes');
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const { t, setLanguage } = useTranslations();

  // Add CSS styles to ensure modal stays fixed
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .download-modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 9999 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: auto !important;
      }
      
      .download-modal-content {
        position: relative !important;
        background: white !important;
        border-radius: 0.5rem !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        max-width: 28rem !important;
        width: 90% !important;
        max-height: 90vh !important;
        overflow: auto !important;
        margin: 1rem !important;
      }
      
      body.modal-open {
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (downloadProgress) {
      document.body.classList.add('modal-open');
      
      // Disable scrolling on the document
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      // Add escape key handler
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && downloadingModel) {
          handlePauseDownload(downloadingModel);
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [downloadProgress, downloadingModel]);

  // Load download folder on mount
  useEffect(() => {
    const savedFolder = localStorage.getItem('ai_evaluator_download_folder');
    if (savedFolder) {
      setDownloadFolder(savedFolder);
    } else {
      // Set default folder
      const defaultFolder = 'Downloads/AI-Evaluator-Models';
      setDownloadFolder(defaultFolder);
      localStorage.setItem('ai_evaluator_download_folder', defaultFolder);
    }
  }, []);

  useEffect(() => {
    const initializeSettings = async () => {
      await loadSettings();
      await loadGlobalSettings();
      
      // Initialize LocalLLM service only in browser
      if (typeof window !== 'undefined') {
        setLocalLLMServiceInstance(localLLMService);
        await loadModelStatuses();
        updateStorageUsage();
      }
    };

    initializeSettings();
  }, []);

  // Refresh model statuses periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      if (downloadingModel && localLLMServiceInstance) {
        await loadModelStatuses();
        updateStorageUsage();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [downloadingModel, localLLMServiceInstance]);

  const loadModelStatuses = async () => {
    if (localLLMServiceInstance) {
      const statusMap = await localLLMServiceInstance.getAllModelStatuses();
      const availableModels = modelConfigService.getLocalModels();
      
      // Convert Map to array and merge with available models
      const statusArray: ModelDownloadStatus[] = Object.keys(availableModels).map(modelKey => {
        const modelProgress = statusMap.get(modelKey);
        const modelInfo = availableModels[modelKey];
        
        return {
          modelName: modelKey,
          status: modelProgress?.status || 'not_downloaded',
          progress: modelProgress?.progress || 0,
          downloadedSize: modelProgress?.loaded || 0,
          totalSize: modelProgress?.total || modelInfo.sizeBytes || 0,
          error: modelProgress?.error,
          lastUpdated: Date.now()
        };
      });
      
      setModelStatuses(statusArray);
    }
  };

  const updateStorageUsage = async () => {
    if (localLLMServiceInstance) {
      try {
        const usage = await localLLMServiceInstance.getStorageUsage();
        setStorageUsage(usage);
      } catch (error) {
        console.error('Error getting storage usage:', error);
      }
    }
  };

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
            llmProvider: userSettings.llmProvider || 'openai',
            openai: {
              ...settings.openai,
              ...userSettings.openai
            },
            localLLM: userSettings.localLLM || settings.localLLM,
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

  const handleDownloadModel = async (modelName: string) => {
    if (!localLLMServiceInstance) {
      setError(t('settings.modelManagement.serviceUnavailable'));
      return;
    }

    try {
      setDownloadingModel(modelName);
      setDownloadProgress({
        progress: 0,
        loaded: 0,
        total: 0,
        status: 'downloading',
        modelName
      });
      setError(null);

      await localLLMServiceInstance.downloadModel(modelName, (progress) => {
        setDownloadProgress(progress);
        
        // Update the specific model status with progress
        setModelStatuses(prev => 
          prev.map(s => s.modelName === modelName ? {
            ...s,
            status: progress.status === 'downloading' ? 'downloading' : s.status,
            progress: progress.progress,
            downloadedSize: progress.loaded,
            totalSize: progress.total,
            lastUpdated: Date.now()
          } : s)
        );
      });

      const modelInfo = modelConfigService.getModelInfo('local', modelName);
      const modelDisplayName = modelInfo ? t(modelInfo.name) : modelName;
      setSuccessMessage(t('settings.modelManagement.downloadSuccess', { modelName: modelDisplayName }));
    } catch (error) {
      setError(t('settings.modelManagement.downloadError', { error: error instanceof Error ? error.message : t('errors.unknown') }));
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(null);
      await loadModelStatuses();
      updateStorageUsage();
    }
  };

  const handlePauseDownload = async (modelName: string) => {
    if (!localLLMServiceInstance) {
      setError(t('settings.modelManagement.serviceUnavailable'));
      return;
    }

    localLLMServiceInstance.pauseDownload(modelName);
    setDownloadingModel(null);
    await loadModelStatuses();
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!localLLMServiceInstance) {
      setError(t('settings.modelManagement.serviceUnavailable'));
      return;
    }

    const modelInfo = modelConfigService.getModelInfo('local', modelName);
    const modelDisplayName = modelInfo ? t(modelInfo.name) : modelName;
    
    if (!confirm(t('settings.modelManagement.confirmDelete', { modelName: modelDisplayName }))) {
      return;
    }

    try {
      await localLLMServiceInstance.deleteModel(modelName);
      setSuccessMessage(t('settings.modelManagement.deleteSuccess', { modelName: modelDisplayName }));
      await loadModelStatuses();
      updateStorageUsage();
    } catch (error) {
      setError(t('settings.modelManagement.deleteError', { error: error instanceof Error ? error.message : t('errors.unknown') }));
    }
  };

  const handleResetModel = async (modelName: string) => {
    if (!localLLMServiceInstance) {
      setError(t('settings.modelManagement.serviceUnavailable'));
      return;
    }

    const modelInfo = modelConfigService.getModelInfo('local', modelName);
    const modelDisplayName = modelInfo ? t(modelInfo.name) : modelName;

    if (confirm(t('settings.modelManagement.confirmReset', { modelName: modelDisplayName }))) {
      localLLMServiceInstance.resetModelStatus(modelName);
      await loadModelStatuses();
      updateStorageUsage();
      setSuccessMessage(t('settings.modelManagement.resetSuccess'));
    }
  };

  const handleClearAllData = async () => {
    if (!localLLMServiceInstance) {
      setError(t('settings.modelManagement.serviceUnavailable'));
      return;
    }

    if (confirm(t('settings.modelManagement.clearAllConfirm'))) {
      localLLMServiceInstance.clearAllData();
      await loadModelStatuses();
      updateStorageUsage();
      setSuccessMessage(t('settings.modelManagement.allDataCleared'));
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: ModelDownloadStatus['status']) => {
    switch (status) {
      case 'downloaded':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ModelDownloadStatus['status']) => {
    switch (status) {
      case 'downloaded':
        return 'bg-green-50 border-green-200';
      case 'downloading':
        return 'bg-blue-50 border-blue-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'paused':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Prepare settings to save
      const settingsToSave = {
        ...settings,
        openai: {
          ...settings.openai,
          apiKey: settings.openai.apiKey === '***REDACTED***' ? undefined : settings.openai.apiKey,
          model: settings.openai.model || modelConfigService.getDefaultModel('openai') || 'gpt-3.5-turbo'
        },
        localLLM: {
          ...settings.localLLM,
          model: settings.localLLM.model || modelConfigService.getDefaultModel('local') || 'Xenova/Phi-3-mini-4k-instruct'
        },
        customPrompts: useCustomPrompts ? settings.customPrompts : {
          systemPrompt: '',
          evaluationPrefix: '',
          gradingCriteria: '',
        },
      };

      console.log('Sending settings with API key:', settingsToSave.openai.apiKey ? '***PRESENT***' : 'NOT SENT');

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

      setSuccessMessage(t('settings.saved'));
      
      setTimeout(() => {
        onSave(settingsToSave);
      }, 1000);

    } catch (error) {
      console.error('Save settings error:', error);
      setError(error instanceof Error ? error.message : t('errors.unknown'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetPromptsToGlobal = () => {
    if (!globalSettings) return;

    if (confirm(t('settings.customPrompts.resetConfirm'))) {
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

    if (confirm(t('settings.customPrompts.loadGlobalConfirm'))) {
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

  const handleSelectDownloadFolder = async () => {
    try {
      // Check if browser supports File System Access API
      if ('showDirectoryPicker' in window) {
        const directoryHandle = await (window as any).showDirectoryPicker();
        const folderPath = directoryHandle.name;
        setDownloadFolder(folderPath);
        localStorage.setItem('ai_evaluator_download_folder', folderPath);
        setSuccessMessage(t('settings.modelManagement.folderSelected', { folder: folderPath }));
      } else {
        // Fallback for browsers that don't support the API
        const folderInput = document.createElement('input');
        folderInput.type = 'text';
        folderInput.placeholder = 'Ingresa la ruta de la carpeta (ej: /Users/tu-usuario/Downloads/AI-Models)';
        folderInput.value = downloadFolder;
        
        const result = prompt(
          'Ingresa la ruta donde quieres guardar los modelos:\n\n' +
          'Ejemplo: Downloads/AI-Evaluator-Models\n' +
          'Los modelos se guardarán en el navegador usando esta referencia.',
          downloadFolder
        );
        
        if (result && result.trim()) {
          const newFolder = result.trim();
          setDownloadFolder(newFolder);
          localStorage.setItem('ai_evaluator_download_folder', newFolder);
          setSuccessMessage(t('settings.modelManagement.folderSelected', { folder: newFolder }));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError('Error al seleccionar carpeta: ' + error.message);
      }
    }
  };

  const getModelFolderPath = (modelName: string) => {
    const cleanModelName = modelName.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return `${downloadFolder}/${cleanModelName}`;
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
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {t('settings.subtitle')}
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
            <span className="ml-3 text-gray-600">{t('common.loading')}</span>
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {t('settings.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSaving ? t('settings.saving') : t('common.save')}
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
            {/* LLM Provider Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center mb-4">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mr-2" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900">{t('settings.provider.title')}</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('settings.provider.subtitle')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        settings.llmProvider === 'openai' 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSettings(prev => ({ ...prev, llmProvider: 'openai' }))}
                    >
                      <div className="flex items-center">
                        <Cloud className="h-6 w-6 text-blue-600 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{t('settings.provider.openai.title')}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('settings.provider.openai.description')}
                          </p>
                        </div>
                      </div>
                      {settings.llmProvider === 'openai' && (
                        <div className="absolute top-3 right-3">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>

                    <div 
                      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        settings.llmProvider === 'local' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSettings(prev => ({ ...prev, llmProvider: 'local' }))}
                    >
                      <div className="flex items-center">
                        <Cpu className="h-6 w-6 text-green-600 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{t('settings.provider.local.title')}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('settings.provider.local.description')}
                          </p>
                        </div>
                      </div>
                      {settings.llmProvider === 'local' && (
                        <div className="absolute top-3 right-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OpenAI Configuration */}
            {settings.llmProvider === 'openai' && (
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
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          openai: { ...prev.openai, apiKey: e.target.value }
                        }));
                      }}
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
            )}

            {/* Local LLM Configuration */}
            {settings.llmProvider === 'local' && (
              <div className="space-y-6">
                {/* Basic Configuration */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center mb-4">
                    <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900">Configuración de Modelo Local</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                      <div className="flex items-start">
                        <Download className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-green-800 font-medium">Modelo ejecutado localmente</p>
                          <p className="text-green-700 mt-1">
                            El modelo se descarga y ejecuta directamente en tu navegador. 
                            No se envían datos a servidores externos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="localModel" className="block text-sm font-medium text-gray-700 mb-2">
                        Modelo
                      </label>
                      <select
                        id="localModel"
                        value={settings.localLLM.model}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          localLLM: { ...prev.localLLM, model: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        {Object.entries(modelConfigService.getLocalModels()).map(([key, model]) => (
                          <option key={key} value={key}>
                            {t(model.name)} - {model.size} {model.recommended ? '(Recomendado)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {(() => {
                          const modelInfo = modelConfigService.getModelInfo('local', settings.localLLM.model);
                          return modelInfo ? t(modelInfo.description) : '';
                        })()}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="localMaxTokens" className="block text-sm font-medium text-gray-700 mb-2">
                          Max Tokens
                        </label>
                        <input
                          type="number"
                          id="localMaxTokens"
                          value={settings.localLLM.maxTokens}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            localLLM: { ...prev.localLLM, maxTokens: Number(e.target.value) }
                          }))}
                          min="100"
                          max="2000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="localTemperature" className="block text-sm font-medium text-gray-700 mb-2">
                          Temperature
                        </label>
                        <input
                          type="number"
                          id="localTemperature"
                          value={settings.localLLM.temperature}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            localLLM: { ...prev.localLLM, temperature: Number(e.target.value) }
                          }))}
                          min="0"
                          max="2"
                          step="0.1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Folder Management */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Ubicación de Modelos</h3>
                    </div>
                    <button
                      onClick={handleSelectDownloadFolder}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Cambiar Ubicación
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <div className="flex items-start">
                        <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="text-blue-800 font-medium">Carpeta de descarga actual:</p>
                          <p className="text-blue-700 mt-1 font-mono text-xs break-all">
                            {downloadFolder || 'Downloads/AI-Evaluator-Models'}
                          </p>
                          <p className="text-blue-600 mt-2 text-xs">
                            Los modelos se organizan en subcarpetas por nombre de modelo dentro de esta ubicación.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Show model folders */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Estructura de carpetas:</h4>
                      <div className="bg-gray-50 border rounded-lg p-3 text-xs font-mono">
                        <div className="text-gray-600">📁 {downloadFolder}/</div>
                        {Object.keys(modelConfigService.getLocalModels()).map((modelName) => {
                          const status = modelStatuses.find(s => s.modelName === modelName);
                          const isDownloaded = status?.status === 'downloaded';
                          return (
                            <div key={modelName} className="ml-4 text-gray-500">
                              {isDownloaded ? '📁' : '📂'} {modelName.replace(/[^a-zA-Z0-9-_.]/g, '_')}/
                              {isDownloaded && (
                                <span className="text-green-600 ml-2">(descargado)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <strong>Nota:</strong> Los modelos se almacenan en el navegador usando IndexedDB. 
                        La "carpeta" es una referencia organizacional y no afecta el almacenamiento real.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Model Management */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mr-2" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Gestión de Modelos Descargados</h3>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        Almacenamiento usado: {storageUsage}
                      </div>
                      <button
                        onClick={handleClearAllData}
                        className="text-xs px-2 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50"
                        title="Limpiar todos los datos"
                      >
                        Limpiar Todo
                      </button>
                    </div>
                  </div>

                  {!localLLMServiceInstance ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-sm text-gray-600">Inicializando gestión de modelos...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {modelStatuses.map((status) => {
                        const modelInfo = modelConfigService.getModelInfo('local', status.modelName);
                        if (!modelInfo) return null;

                        return (
                          <div 
                            key={status.modelName}
                            className={`border rounded-lg p-4 ${getStatusColor(status.status)}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                {getStatusIcon(status.status)}
                                <div className="ml-3">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    {modelInfo.name}
                                    {modelInfo.recommended && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Recomendado
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-gray-500">{modelInfo.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">{modelInfo.size}</span>
                                
                                {status.status === 'not_downloaded' && (
                                  <button
                                    onClick={() => handleDownloadModel(status.modelName)}
                                    disabled={downloadingModel !== null}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Descargar
                                  </button>
                                )}
                                
                                {status.status === 'downloading' && (
                                  <button
                                    onClick={() => handlePauseDownload(status.modelName)}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700"
                                  >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pausar
                                  </button>
                                )}
                                
                                {status.status === 'paused' && (
                                  <button
                                    onClick={() => handleDownloadModel(status.modelName)}
                                    disabled={downloadingModel !== null}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Reanudar
                                  </button>
                                )}
                                
                                {status.status === 'error' && (
                                  <>
                                    <button
                                      onClick={() => handleResetModel(status.modelName)}
                                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-gray-600 hover:bg-gray-700"
                                      title="Reiniciar estado"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadModel(status.modelName)}
                                      disabled={downloadingModel !== null}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    >
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Reintentar
                                    </button>
                                  </>
                                )}
                                
                                {status.status === 'downloaded' && (
                                  <button
                                    onClick={() => handleDeleteModel(status.modelName)}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Progress bar for downloading models */}
                            {(status.status === 'downloading' || status.status === 'paused') && (
                              <div className="mt-3">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                  <span>
                                    {status.status === 'downloading' ? 'Descargando...' : 'Pausado'}
                                  </span>
                                  <span>{status.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      status.status === 'downloading' ? 'bg-blue-600' : 'bg-yellow-600'
                                    }`}
                                    style={{ width: `${status.progress}%` }}
                                  ></div>
                                </div>
                                {status.downloadedSize && status.totalSize && (
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>{formatBytes(status.downloadedSize)} / {formatBytes(status.totalSize)}</span>
                                    <span>
                                      {new Date(status.lastUpdated).toLocaleTimeString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Error message */}
                            {status.status === 'error' && status.error && (
                              <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                                Error: {status.error}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

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

      {/* Download Progress Modal */}
      {downloadProgress && (
        <div 
          className="download-modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div 
            className="download-modal-content bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('students.modelDownload.downloadStarting')}
              </h3>
              <button
                onClick={() => {
                  if (downloadingModel) {
                    handlePauseDownload(downloadingModel);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                title="Pausar descarga"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="font-medium">{(() => {
                    const modelInfo = modelConfigService.getModelInfo('local', downloadProgress.modelName);
                    return modelInfo ? t(modelInfo.name) : downloadProgress.modelName;
                  })()}</span>
                  <span className="text-blue-600 font-semibold">{downloadProgress.progress}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress.progress}%` }}
                  ></div>
                </div>
                
                {downloadProgress.loaded > 0 && downloadProgress.total > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)}</span>
                    <span>
                      {downloadProgress.file && `${downloadProgress.file}`}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-gray-600 mb-3">
                  {t('students.modelDownload.downloadNote')}
                </p>
                
                <button
                  onClick={() => {
                    if (downloadingModel) {
                      handlePauseDownload(downloadingModel);
                    }
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                >
                  {t('common.pause')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 