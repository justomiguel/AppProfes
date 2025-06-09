import modelsConfig from '../../config/models.json';

export interface ModelInfo {
  name: string;
  description: string;
  size?: string;
  sizeBytes?: number;
  maxTokens?: number;
  recommended: boolean;
  default: boolean;
  url?: string;
}

export interface ModelConfig {
  openai: {
    models: Record<string, ModelInfo>;
  };
  local: {
    models: Record<string, ModelInfo>;
  };
}

class ModelConfigService {
  private config: ModelConfig;

  constructor() {
    this.config = modelsConfig as ModelConfig;
  }

  // Get all OpenAI models
  getOpenAIModels(): Record<string, ModelInfo> {
    return this.config.openai.models;
  }

  // Get all local models
  getLocalModels(): Record<string, ModelInfo> {
    return this.config.local.models;
  }

  // Get specific model info
  getModelInfo(provider: 'openai' | 'local', modelKey: string): ModelInfo | null {
    const models = provider === 'openai' ? this.getOpenAIModels() : this.getLocalModels();
    return models[modelKey] || null;
  }

  // Get default model for a provider
  getDefaultModel(provider: 'openai' | 'local'): string | null {
    const models = provider === 'openai' ? this.getOpenAIModels() : this.getLocalModels();
    
    for (const [key, model] of Object.entries(models)) {
      if (model.default) {
        return key;
      }
    }
    
    // Fallback to first model if no default is set
    const keys = Object.keys(models);
    return keys.length > 0 ? keys[0] : null;
  }

  // Get recommended models for a provider
  getRecommendedModels(provider: 'openai' | 'local'): Record<string, ModelInfo> {
    const models = provider === 'openai' ? this.getOpenAIModels() : this.getLocalModels();
    
    return Object.entries(models)
      .filter(([_, model]) => model.recommended)
      .reduce((acc, [key, model]) => {
        acc[key] = model;
        return acc;
      }, {} as Record<string, ModelInfo>);
  }

  // Get model URL (for local models)
  getModelUrl(modelKey: string): string | null {
    const localModels = this.getLocalModels();
    const model = localModels[modelKey];
    return model?.url || null;
  }

  // Validate if a model exists
  modelExists(provider: 'openai' | 'local', modelKey: string): boolean {
    const models = provider === 'openai' ? this.getOpenAIModels() : this.getLocalModels();
    return modelKey in models;
  }

  // Get all models with provider information
  getAllModelsWithProvider(): Array<{
    provider: 'openai' | 'local';
    key: string;
    info: ModelInfo;
  }> {
    const result: Array<{
      provider: 'openai' | 'local';
      key: string;
      info: ModelInfo;
    }> = [];

    // Add OpenAI models
    Object.entries(this.getOpenAIModels()).forEach(([key, info]) => {
      result.push({ provider: 'openai', key, info });
    });

    // Add local models
    Object.entries(this.getLocalModels()).forEach(([key, info]) => {
      result.push({ provider: 'local', key, info });
    });

    return result;
  }
}

// Export singleton instance
export const modelConfigService = new ModelConfigService();
export default modelConfigService; 