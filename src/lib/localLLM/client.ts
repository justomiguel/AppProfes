// Remove the static import and make it dynamic
// import { pipeline } from '@xenova/transformers';

import { modelConfigService, ModelInfo } from '../models/config';

// Global initialization flag to prevent multiple setups
let environmentInitialized = false;

// Initialize environment specifically for Transformers.js
function initializeTransformersEnvironment(): void {
  if (typeof window === 'undefined' || environmentInitialized) {
    return;
  }

  try {
    console.log('Setting up environment for Transformers.js...');

    // Ensure global objects exist
    (window as any).global = (window as any).global || window;
    
    // Set up process object with all needed properties
    if (!(window as any).process) {
      (window as any).process = {
        env: {},
        version: 'v18.0.0',
        versions: { node: '18.0.0' },
        platform: 'browser',
        arch: 'x64',
        argv: [],
        pid: 1,
        title: 'browser',
        cwd: () => '/',
        chdir: () => {},
        nextTick: (callback: Function) => setTimeout(callback, 0),
        hrtime: () => [Date.now() / 1000, 0],
        exit: () => {},
        kill: () => {},
        stderr: { write: console.error },
        stdout: { write: console.log },
        stdin: { on: () => {}, removeListener: () => {} },
        on: () => {},
        removeListener: () => {},
        browser: true
      };
    }

    // Set environment variables that Transformers.js needs
    const envVars = {
      NODE_ENV: 'production',
      USE_REMOTE_MODELS: 'true',
      USE_FS: 'false',
      HF_HUB_DISABLE_TELEMETRY: 'true',
      TRANSFORMERS_OFFLINE: 'false',
      RUNNING_IN_BROWSER: 'true',
      // Hugging Face specific - force use of remote models
      HF_HUB_URL: 'https://huggingface.co',
      HUGGINGFACE_HUB_URL: 'https://huggingface.co',
      // Browser specific
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      // Cache settings
      TRANSFORMERS_CACHE: './.cache',
      HF_HOME: './.cache',
      HUGGINGFACE_HUB_CACHE: './.cache'
    };

    // Apply environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      (window as any).process.env[key] = value;
    });

    console.log('Process env configured:', (window as any).process.env);

    // Provide global polyfills
    if (!(window as any).Buffer) {
      const BufferPolyfill = {
        from: (data: any, encoding?: string) => {
          if (typeof data === 'string') {
            return new TextEncoder().encode(data);
          }
          return new Uint8Array(data);
        },
        isBuffer: (obj: any) => obj instanceof Uint8Array,
        alloc: (size: number) => new Uint8Array(size),
        concat: (arrays: Uint8Array[]) => {
          const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
          }
          return result;
        }
      };
      (window as any).Buffer = BufferPolyfill;
    }

    // Mock Node.js modules that might be used
    const mockModules = {
      fs: {
        readFileSync: () => { throw new Error('fs not available in browser'); },
        writeFileSync: () => { throw new Error('fs not available in browser'); },
        existsSync: () => false,
        mkdirSync: () => { throw new Error('fs not available in browser'); }
      },
      path: {
        join: (...parts: string[]) => parts.join('/'),
        resolve: (...parts: string[]) => parts.join('/'),
        basename: (path: string) => path.split('/').pop() || '',
        dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '/',
        extname: (path: string) => {
          const match = path.match(/\.[^.]*$/);
          return match ? match[0] : '';
        }
      },
      os: {
        homedir: () => '/',
        tmpdir: () => '/tmp',
        platform: () => 'browser',
        arch: () => 'x64'
      }
    };

    Object.entries(mockModules).forEach(([moduleName, moduleExports]) => {
      Object.defineProperty(window, moduleName, {
        value: moduleExports,
        writable: true,
        configurable: true
      });
    });

    // Create a custom isEmpty function to handle the specific error
    (window as any).isEmpty = (obj: any) => {
      if (obj === null || obj === undefined) {
        return true;
      }
      try {
        return Object.keys(obj).length === 0;
      } catch (e) {
        return true;
      }
    };

    environmentInitialized = true;
    console.log('Transformers.js environment initialized successfully');
  } catch (error) {
    console.error('Error initializing Transformers.js environment:', error);
  }
}

// Separate function to dynamically import transformers with proper error handling
async function importTransformers(): Promise<any> {
  try {
    console.log('Attempting to dynamically import @xenova/transformers...');
    
    // Ensure environment is set up first
    initializeTransformersEnvironment();
    
    // Add a small delay to let environment settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now import the transformers library
    const transformersModule = await import('@xenova/transformers');
    console.log('Successfully imported @xenova/transformers');
    
    return transformersModule;
  } catch (error) {
    console.error('Failed to import @xenova/transformers:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('WebAssembly')) {
        throw new Error('WebAssembly not supported in this browser. Please use a modern browser.');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network error while loading model. Please check your internet connection.');
      } else if (error.message.includes('Cannot convert undefined or null to object')) {
        throw new Error('Browser environment setup failed. Please try refreshing the page.');
      }
    }
    
    throw new Error(`Model loading failed: ${error}`);
  }
}

export interface ModelDownloadProgress {
  progress: number;
  loaded: number;
  total: number;
  status: 'downloading' | 'loading' | 'ready' | 'error';
  modelName: string;
  file?: string;
}

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'error' | 'paused';

export interface ModelProgressInfo {
  status: ModelStatus;
  progress: number;
  loaded: number;
  total: number;
  error?: string;
}

export class LocalLLMService {
  private pipeline: any = null;
  private modelStatuses: Map<string, ModelProgressInfo> = new Map();
  private activeDownloads: Map<string, AbortController> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Defer initialization to avoid blocking constructor
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.loadModelStatuses();
      await this.verifyDownloadedModels();
      this.isInitialized = true;
      console.log('LocalLLMService initialized successfully');
    } catch (error) {
      console.error('Error initializing LocalLLMService:', error);
    }
  }

  // Ensure service is initialized before operations
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeAsync();
    }
  }

  // Model status management with IndexedDB verification
  private async loadModelStatuses(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      
      const stored = localStorage.getItem('transformers_model_statuses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          // Manually convert to Map to avoid Object.fromEntries issues
          for (const [key, value] of Object.entries(parsed)) {
            if (value && typeof value === 'object') {
              this.modelStatuses.set(key, value as ModelProgressInfo);
            }
          }
          console.log('Loaded model statuses from localStorage:', this.modelStatuses.size, 'models');
        }
      }
    } catch (error) {
      console.warn('Error loading model statuses, clearing corrupted data:', error);
      localStorage.removeItem('transformers_model_statuses');
      this.modelStatuses.clear();
    }
  }

  // Verify which models are actually downloaded in browser storage
  private async verifyDownloadedModels(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      console.log('Starting model verification...');
      let updatedAny = false;
      
      // Check each model's actual existence in storage
      for (const [modelName, status] of this.modelStatuses.entries()) {
        if (status.status === 'downloaded') {
          const actuallyExists = await this.checkModelExistsInStorage(modelName);
          
          if (!actuallyExists) {
            console.log(`🔍 Model ${modelName} marked as downloaded but not found in storage, resetting status`);
            this.modelStatuses.set(modelName, {
              status: 'not_downloaded',
              progress: 0,
              loaded: 0,
              total: 0
            });
            updatedAny = true;
          } else {
            console.log(`✅ Model ${modelName} verified as downloaded and available`);
          }
        }
      }

      // Also check for models that exist in storage but aren't in our status map
      const existingModels = await this.findModelsInStorage();
      console.log('Found models in storage:', existingModels);
      
      for (const modelName of existingModels) {
        if (!this.modelStatuses.has(modelName)) {
          console.log(`🔍 Found existing model ${modelName} in storage, adding to status`);
          this.modelStatuses.set(modelName, {
            status: 'downloaded',
            progress: 100,
            loaded: 100,
            total: 100
          });
          updatedAny = true;
        }
      }

      // Save updated statuses if any changes were made
      if (updatedAny) {
        this.saveModelStatuses();
      }
      
      console.log('Model verification completed');
    } catch (error) {
      console.error('Error verifying downloaded models:', error);
    }
  }

  // Simplified check using multiple approaches
  private async checkModelExistsInStorage(modelName: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking storage for model: ${modelName}`);
      
      // Method 1: Check for model-specific marker in localStorage
      const modelMarker = `model_downloaded_${modelName.replace('/', '_')}`;
      const hasMarker = localStorage.getItem(modelMarker) === 'true';
      
      if (hasMarker) {
        console.log(`✅ Found localStorage marker for ${modelName}`);
        return true;
      }
      
      // Method 2: Try to check IndexedDB cache storage usage
      if ('navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const usage = estimate.usage || 0;
          
          // If there's significant storage usage (> 50MB), assume models exist
          if (usage > 50 * 1024 * 1024) {
            console.log(`💾 Found significant storage usage (${this.formatBytes(usage)}), model likely exists`);
            // Set marker for future checks
            localStorage.setItem(modelMarker, 'true');
            return true;
          }
        } catch (error) {
          console.log('Storage estimate error:', error);
        }
      }
      
      // Method 3: Try IndexedDB direct check (simplified)
      if ('indexedDB' in window) {
        try {
          const hasTransformersData = await this.checkIndexedDBForTransformers();
          if (hasTransformersData) {
            console.log(`🗃️ Found Transformers data in IndexedDB`);
            // Set marker for future checks
            localStorage.setItem(modelMarker, 'true');
            return true;
          }
        } catch (error) {
          console.log('IndexedDB check error:', error);
        }
      }
      
      console.log(`❌ No evidence of ${modelName} in storage`);
      return false;
    } catch (error) {
      console.error(`Error checking model existence for ${modelName}:`, error);
      return false;
    }
  }

  // Simple check for any Transformers.js data in IndexedDB
  private async checkIndexedDBForTransformers(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('transformers-cache');
        
        request.onerror = () => resolve(false);
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          try {
            // Just check if the database exists and has object stores
            const hasStores = db.objectStoreNames.length > 0;
            db.close();
            resolve(hasStores);
          } catch (error) {
            db.close();
            resolve(false);
          }
        };
        
        // Give it a timeout
        setTimeout(() => resolve(false), 1000);
      } catch (error) {
        resolve(false);
      }
    });
  }

  // Find all models that exist in storage (simplified)
  private async findModelsInStorage(): Promise<string[]> {
    try {
      const modelNames: string[] = [];
      
      // Check localStorage for model markers
      for (const key in localStorage) {
        if (key.startsWith('model_downloaded_') && localStorage.getItem(key) === 'true') {
          const modelName = key.replace('model_downloaded_', '').replace('_', '/');
          modelNames.push(modelName);
        }
      }
      
      return modelNames;
    } catch (error) {
      console.error('Error finding models in storage:', error);
      return [];
    }
  }

  private saveModelStatuses(): void {
    try {
      if (typeof window === 'undefined') return;
      
      // Manually convert Map to object to avoid issues
      const statusObject: Record<string, ModelProgressInfo> = {};
      for (const [key, value] of this.modelStatuses.entries()) {
        statusObject[key] = value;
      }
      
      localStorage.setItem('transformers_model_statuses', JSON.stringify(statusObject));
      console.log('Saved model statuses to localStorage:', Object.keys(statusObject).length, 'models');
    } catch (error) {
      console.error('Error saving model statuses:', error);
    }
  }

  // Get model status
  async getModelStatus(modelName: string): Promise<ModelProgressInfo> {
    await this.ensureInitialized();
    
    const status = this.modelStatuses.get(modelName);
    if (status) {
      return status;
    }
    
    // If no status found, check if model actually exists in storage
    const existsInStorage = await this.checkModelExistsInStorage(modelName);
    if (existsInStorage) {
      const newStatus: ModelProgressInfo = {
        status: 'downloaded',
        progress: 100,
        loaded: 100,
        total: 100
      };
      this.modelStatuses.set(modelName, newStatus);
      this.saveModelStatuses();
      return newStatus;
    }
    
    return {
      status: 'not_downloaded',
      progress: 0,
      loaded: 0,
      total: 0
    };
  }

  // Synchronous version for backward compatibility
  getModelStatusSync(modelName: string): ModelProgressInfo {
    return this.modelStatuses.get(modelName) || {
      status: 'not_downloaded',
      progress: 0,
      loaded: 0,
      total: 0
    };
  }

  // Update model status
  private updateModelStatus(modelName: string, update: Partial<ModelProgressInfo>): void {
    const current = this.getModelStatusSync(modelName);
    const updated = { ...current, ...update };
    this.modelStatuses.set(modelName, updated);
    this.saveModelStatuses();
  }

  // Get all model statuses
  async getAllModelStatuses(): Promise<Map<string, ModelProgressInfo>> {
    await this.ensureInitialized();
    return new Map(this.modelStatuses);
  }

  // Delete model
  async deleteModel(modelName: string): Promise<void> {
    try {
      this.modelStatuses.delete(modelName);
      this.saveModelStatuses();
      
      // Remove model marker from localStorage
      const modelMarker = `model_downloaded_${modelName.replace('/', '_')}`;
      localStorage.removeItem(modelMarker);
      console.log(`🗑️ Removed model marker for ${modelName}`);
      
      // Clear any cached data (this is browser storage, so we clear what we can)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes(modelName) || cacheName.includes('transformers')) {
            await caches.delete(cacheName);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete model: ${error}`);
    }
  }

  // Reset model status
  resetModelStatus(modelName: string): void {
    this.modelStatuses.delete(modelName);
    
    // Remove model marker from localStorage
    const modelMarker = `model_downloaded_${modelName.replace('/', '_')}`;
    localStorage.removeItem(modelMarker);
    console.log(`🔄 Reset status and marker for ${modelName}`);
    
    this.saveModelStatuses();
  }

  // Clear all data
  clearAllData(): void {
    this.modelStatuses.clear();
    
    // Remove all model markers from localStorage
    for (const key in localStorage) {
      if (key.startsWith('model_downloaded_')) {
        localStorage.removeItem(key);
      }
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('transformers_model_statuses');
    }
    
    console.log('🧹 Cleared all model data and markers');
  }

  // Get storage usage (approximate)
  getStorageUsage(): Promise<string> {
    return new Promise((resolve) => {
      if ('navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then((estimate) => {
          const used = estimate.usage || 0;
          resolve(this.formatBytes(used));
        }).catch(() => {
          resolve('Desconocido');
        });
      } else {
        resolve('No disponible');
      }
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Download model with progress tracking
  async downloadModel(
    modelName: string,
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Esta operación solo se puede realizar en el navegador');
    }

    // Check if already downloading
    if (this.activeDownloads.has(modelName)) {
      throw new Error('El modelo ya se está descargando');
    }

    const abortController = new AbortController();
    this.activeDownloads.set(modelName, abortController);

    try {
      this.updateModelStatus(modelName, {
        status: 'downloading',
        progress: 0,
        loaded: 0,
        total: 0
      });

      onProgress?.({
        progress: 0,
        loaded: 0,
        total: 0,
        status: 'downloading',
        modelName
      });

      // Get the transformers module
      const transformers = await importTransformers();
      
      // Create progress callback for transformers
      const progressCallback = (progress: any) => {
        if (progress.progress !== undefined) {
          const progressPercent = Math.round(progress.progress * 100);
          const loaded = progress.loaded || 0;
          const total = progress.total || 0;
          
          this.updateModelStatus(modelName, {
            status: 'downloading',
            progress: progressPercent,
            loaded,
            total
          });

          onProgress?.({
            progress: progressPercent,
            loaded,
            total,
            status: 'downloading',
            modelName,
            file: progress.file
          });
        }
      };

      // Configure environment for this specific download
      if (transformers.env) {
        transformers.env.allowRemoteModels = true;
        transformers.env.allowLocalModels = false;
        transformers.env.useBrowserCache = true;
        transformers.env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
      }

      console.log(`Starting download for model: ${modelName}`);
      
      // Create the pipeline which will trigger download
      this.pipeline = await transformers.pipeline(
        'text-generation',
        modelName,
        {
          progress_callback: progressCallback,
          revision: 'main'
        }
      );

      this.updateModelStatus(modelName, {
        status: 'downloaded',
        progress: 100,
        loaded: 100,
        total: 100
      });

      // Mark model as downloaded in localStorage for persistence
      const modelMarker = `model_downloaded_${modelName.replace('/', '_')}`;
      localStorage.setItem(modelMarker, 'true');
      console.log(`✅ Model ${modelName} marked as downloaded in storage`);

      onProgress?.({
        progress: 100,
        loaded: 100,
        total: 100,
        status: 'ready',
        modelName
      });

      console.log(`Successfully downloaded and loaded model: ${modelName}`);

    } catch (error) {
      console.error(`Download error:`, error);
      
      this.updateModelStatus(modelName, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });

      onProgress?.({
        progress: 0,
        loaded: 0,
        total: 0,
        status: 'error',
        modelName
      });

      throw error;
    } finally {
      this.activeDownloads.delete(modelName);
    }
  }

  // Pause download
  pauseDownload(modelName: string): void {
    const controller = this.activeDownloads.get(modelName);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(modelName);
      this.updateModelStatus(modelName, { status: 'paused' });
    }
  }

  // Resume download
  async resumeDownload(
    modelName: string,
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<void> {
    await this.downloadModel(modelName, onProgress);
  }

  // Check if model is available for use
  isModelReady(modelName: string): boolean {
    const status = this.getModelStatusSync(modelName);
    return status.status === 'downloaded' && this.pipeline !== null;
  }

  // Get model info
  getModelInfo(modelName: string): ModelInfo | null {
    return modelConfigService.getModelInfo('local', modelName);
  }

  // Get available models
  getAvailableModels(): ModelInfo[] {
    const localModels = modelConfigService.getLocalModels();
    return Object.values(localModels);
  }

  // Initialize pipeline for a specific model
  async initializePipeline(modelName: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Esta operación solo se puede realizar en el navegador');
    }

    try {
      const transformers = await importTransformers();
      
      if (transformers.env) {
        transformers.env.allowRemoteModels = true;
        transformers.env.allowLocalModels = false;
        transformers.env.useBrowserCache = true;
      }

      this.pipeline = await transformers.pipeline('text-generation', modelName);
      console.log(`Pipeline initialized for model: ${modelName}`);
    } catch (error) {
      console.error('Error initializing pipeline:', error);
      throw new Error(`Error al inicializar modelo local: ${error}`);
    }
  }

  // Generate text using the loaded model
  async generateText(prompt: string, options: {
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    if (!this.pipeline) {
      throw new Error('Modelo no inicializado. Descarga e inicializa un modelo primero.');
    }

    try {
      const result = await this.pipeline(prompt, {
        max_new_tokens: options.maxTokens,
        temperature: options.temperature,
        do_sample: true,
        return_full_text: false
      });

      if (result && result.length > 0) {
        return result[0].generated_text || result[0].text || '';
      }

      return '';
    } catch (error) {
      console.error('Error generating text:', error);
      throw new Error(`Error durante la evaluación local: ${error}`);
    }
  }

  // Create evaluation prompt
  buildEvaluationPrompt(
    assignmentText: string,
    rubricText: string,
    studentWork: string,
    systemPrompt: string,
    evaluationPrefix: string,
    gradingCriteria: string
  ): string {
    const basePrompt = systemPrompt || "Eres un profesor universitario experto en evaluación académica.";
    const prefix = evaluationPrefix || "Evalúa el siguiente trabajo de estudiante de manera objetiva y constructiva.";
    const criteria = gradingCriteria || "Usa una escala de 1 a 7 donde 7 es excelente y 1 es deficiente.";

    return `${basePrompt}

${prefix}

## CONSIGNA DEL TRABAJO
${assignmentText}

## RÚBRICA DE EVALUACIÓN
${rubricText}

## CRITERIOS DE CALIFICACIÓN
${criteria}

## TRABAJO DEL ESTUDIANTE
${studentWork}

## INSTRUCCIONES DE RESPUESTA
Debes responder EXACTAMENTE en este formato:

CALIFICACIÓN: [número del 1 al 7]
EXPLICACIÓN: [explicación detallada de por qué otorgas esta calificación]
FEEDBACK: [comentarios constructivos para ayudar al estudiante a mejorar]

Ejemplo de respuesta correcta:
CALIFICACIÓN: 5
EXPLICACIÓN: El trabajo demuestra comprensión básica del tema pero carece de profundidad en el análisis...
FEEDBACK: Para mejorar, te sugiero ampliar el análisis con más ejemplos específicos...

Tu respuesta:`;
  }

  // Parse evaluation response
  parseEvaluationResponse(response: string): {
    grade: number | null;
    explanation: string;
    feedback: string;
  } {
    console.log('Parsing evaluation response:', response);
    
    let grade: number | null = null;
    let explanation = '';
    let feedback = '';
    
    // First, try to parse structured format
    const calificacionMatch = response.match(/CALIFICACIÓN:\s*(\d+(?:\.\d+)?)/i);
    const explicacionMatch = response.match(/EXPLICACIÓN:\s*([\s\S]*?)(?=FEEDBACK:|$)/i);
    const feedbackMatch = response.match(/FEEDBACK:\s*([\s\S]*?)$/i);
    
    if (calificacionMatch) {
      grade = parseFloat(calificacionMatch[1]);
      // Ensure grade is within valid range (1-7)
      if (grade < 1) grade = 1;
      if (grade > 7) grade = 7;
    }
    
    if (explicacionMatch) {
      explanation = explicacionMatch[1].trim();
    }
    
    if (feedbackMatch) {
      feedback = feedbackMatch[1].trim();
    }
    
    // Fallback: if structured format fails, try to extract from text
    if (!grade) {
      // Look for patterns like "nota: 5", "calificación: 4", "score: 6", etc.
      const gradePattern = /(?:nota|calificación|calificacion|grade|score|puntuación|puntuacion)[:=]\s*(\d+(?:\.\d+)?)/i;
      const gradeMatch = response.match(gradePattern);
      
      if (gradeMatch) {
        grade = parseFloat(gradeMatch[1]);
        if (grade < 1) grade = 1;
        if (grade > 7) grade = 7;
      } else {
        // Last resort: look for any number between 1-7
        const numberMatch = response.match(/\b([1-7](?:\.\d+)?)\b/);
        if (numberMatch) {
          grade = parseFloat(numberMatch[1]);
        }
      }
    }
    
    // If still no grade found, assign a default based on content analysis
    if (!grade) {
      const responseText = response.toLowerCase();
      if (responseText.includes('excelente') || responseText.includes('muy bueno') || responseText.includes('sobresaliente')) {
        grade = 6;
      } else if (responseText.includes('bueno') || responseText.includes('bien') || responseText.includes('correcto')) {
        grade = 5;
      } else if (responseText.includes('regular') || responseText.includes('aceptable') || responseText.includes('suficiente')) {
        grade = 4;
      } else if (responseText.includes('malo') || responseText.includes('deficiente') || responseText.includes('insuficiente')) {
        grade = 2;
      } else {
        grade = 3; // Default middle grade
      }
    }
    
    // If no structured explanation/feedback, use the whole response
    if (!explanation) {
      explanation = response;
    }
    
    if (!feedback) {
      feedback = response;
    }
    
    console.log('Parsed result:', { grade, explanation: explanation.substring(0, 100), feedback: feedback.substring(0, 100) });
    
    return { grade, explanation, feedback };
  }
}

// Singleton instance
export const localLLMService = new LocalLLMService(); 