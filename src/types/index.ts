export interface Evaluation {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  promptFiles: EvaluationFile[];
  rubric: string;
  rubricFiles: EvaluationFile[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Student {
  id: string;
  name: string;
  group?: string;
  groupMembers?: string[];
  files: StudentFile[];
  evaluationId: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface StudentFile {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
}

export interface EvaluationResult {
  id: string;
  studentId: string;
  grade: number;
  explanation: string;
  feedback: string;
  evaluatedAt: string;
  evaluationVersion: number;
  isLatest: boolean;
  aiModel: string;
  userId: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o';
  maxTokens?: number;
  temperature?: number;
}

export interface AppSettings {
  openai: OpenAIConfig;
  language: 'es' | 'en';
  gradeScale: {
    min: number;
    max: number;
  };
  customPrompts: {
    systemPrompt?: string;
    evaluationPrefix?: string;
    gradingCriteria?: string;
  };
}

export interface ReportData {
  evaluation: Evaluation;
  students: (Student & { result: EvaluationResult })[];
  generatedAt: Date;
}

export interface EvaluationFile {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  uploadedAt?: string;
  category?: 'prompt' | 'rubric';
}

export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface GlobalSettings {
  id: string;
  systemPrompt: string;
  evaluationPrefix: string;
  gradingCriteria: string;
  defaultLanguage: 'es' | 'en';
  defaultGradeScale: {
    min: number;
    max: number;
  };
  updatedAt: string;
  updatedBy: string;
}

export interface EvaluationHistory {
  id: string;
  studentId: string;
  evaluationId: string;
  results: EvaluationResult[];
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalEvaluations: number;
  totalStudents: number;
  totalAIEvaluations: number;
  apiUsage: {
    thisMonth: number;
    lastMonth: number;
  };
} 