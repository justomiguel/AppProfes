import { z } from 'zod';
import { getTranslations, getCurrentLanguage } from '../lib/i18n';

// Get current translations
const getT = () => getTranslations(getCurrentLanguage());

export const createEvaluationSchema = () => {
  const t = getT();
  return z.object({
    name: z.string().min(1, t.nameRequired).max(100, t.nameTooLong),
    description: z.string().optional(),
    prompt: z.string().optional(),
    rubric: z.string().optional(),
  });
};

export const createStudentSchema = () => {
  const t = getT();
  return z.object({
    name: z.string().min(1, t.nameRequired).max(100, t.nameTooLong),
    group: z.string().optional(),
    groupMembers: z.array(z.string()).optional(),
    files: z.array(z.any()).min(1, t.filesRequired),
  });
};

export const createSettingsSchema = () => {
  return z.object({
    openai: z.object({
      apiKey: z.string().optional(),
      model: z.enum(['gpt-3.5-turbo', 'gpt-4', 'gpt-4o']),
      maxTokens: z.number().min(100).max(4000).optional(),
      temperature: z.number().min(0).max(2).optional(),
    }),
    language: z.enum(['es', 'en']),
    gradeScale: z.object({
      min: z.number().min(0),
      max: z.number().max(10),
    }),
  });
};

export const createEvaluationResultSchema = () => {
  const t = getT();
  return z.object({
    grade: z.number().min(1).max(7),
    explanation: z.string().min(10, t.explanationMinLength),
    feedback: z.string().min(10, t.feedbackMinLength),
  });
};

// Legacy exports for backward compatibility
export const evaluationSchema = createEvaluationSchema();
export const studentSchema = createStudentSchema();
export const settingsSchema = createSettingsSchema();
export const evaluationResultSchema = createEvaluationResultSchema();

export type EvaluationFormData = z.infer<ReturnType<typeof createEvaluationSchema>>;
export type StudentFormData = z.infer<ReturnType<typeof createStudentSchema>>;
export type SettingsFormData = z.infer<ReturnType<typeof createSettingsSchema>>;
export type EvaluationResultFormData = z.infer<ReturnType<typeof createEvaluationResultSchema>>; 