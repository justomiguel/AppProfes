'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import FileUpload from './FileUpload';
import { useTranslations } from '../hooks/useTranslations';
import { Evaluation, EvaluationFile } from '../types';
import { StorageService } from '../lib/storage';

const evaluationSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  prompt: z.string().optional(),
  rubric: z.string().optional(),
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

interface EvaluationFormProps {
  evaluation?: Evaluation;
  onSave: (evaluation: Evaluation) => void;
  onCancel: () => void;
}

export default function EvaluationForm({ evaluation, onSave, onCancel }: EvaluationFormProps) {
  const { t } = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [promptFiles, setPromptFiles] = useState<EvaluationFile[]>([]);
  const [rubricFiles, setRubricFiles] = useState<EvaluationFile[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      name: evaluation?.name || '',
      description: evaluation?.description || '',
      prompt: evaluation?.prompt || '',
      rubric: evaluation?.rubric || '',
    },
  });

  useEffect(() => {
    if (evaluation) {
      setPromptFiles(evaluation.promptFiles || []);
      setRubricFiles(evaluation.rubricFiles || []);
    }
  }, [evaluation]);

  const onSubmit = async (data: EvaluationFormData) => {
    const promptText = data.prompt?.trim();
    const hasPromptFiles = promptFiles.length > 0;
    const rubricText = data.rubric?.trim();
    const hasRubricFiles = rubricFiles.length > 0;

    if (!promptText && !hasPromptFiles) {
      alert(t('evaluations.validation.promptRequired'));
      return;
    }

    if (!rubricText && !hasRubricFiles) {
      alert(t('evaluations.validation.rubricRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date();
      const evaluationData: Evaluation = {
        id: evaluation?.id || StorageService.generateId(),
        name: data.name,
        description: data.description,
        prompt: promptText || '', // Ensure we always have a string
        promptFiles: promptFiles.length > 0 ? promptFiles : [],
        rubric: rubricText || '', // Ensure we always have a string
        rubricFiles: rubricFiles.length > 0 ? rubricFiles : [],
        createdAt: evaluation?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
        userId: 'current-user', // This should come from auth context
      };

      StorageService.saveEvaluation(evaluationData);
      onSave(evaluationData);
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert(`${t('common.error')}: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {evaluation ? t('evaluations.edit') : t('evaluations.create')}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              {t('evaluations.name')} *
            </label>
            <input
              {...register('name')}
              type="text"
              id="name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('evaluations.namePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              {t('evaluations.description')}
            </label>
            <input
              {...register('description')}
              type="text"
              id="description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('evaluations.descriptionPlaceholder')}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </div>

        {/* Assignment Prompt Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('evaluations.prompt.title')}
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prompt Text */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                {t('evaluations.prompt.text')}
              </label>
              <textarea
                {...register('prompt')}
                id="prompt"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('evaluations.prompt.placeholder')}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('evaluations.prompt.note')}
              </p>
              {errors.prompt && (
                <p className="mt-1 text-sm text-red-600">{errors.prompt.message}</p>
              )}
            </div>

            {/* Prompt Files */}
            <div>
              <FileUpload
                files={promptFiles}
                onFilesChange={setPromptFiles}
                category="prompt"
                label={t('evaluations.prompt.files')}
                description={t('evaluations.prompt.filesDescription')}
                maxFiles={3}
              />
            </div>
          </div>
        </div>

        {/* Rubric Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('evaluations.rubric.title')}
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rubric Text */}
            <div>
              <label htmlFor="rubric" className="block text-sm font-medium text-gray-700 mb-2">
                {t('evaluations.rubric.text')}
              </label>
              <textarea
                {...register('rubric')}
                id="rubric"
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('evaluations.rubric.placeholder')}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('evaluations.rubric.note')}
              </p>
              {errors.rubric && (
                <p className="mt-1 text-sm text-red-600">{errors.rubric.message}</p>
              )}
            </div>

            {/* Rubric Files */}
            <div>
              <FileUpload
                files={rubricFiles}
                onFilesChange={setRubricFiles}
                category="rubric"
                label={t('evaluations.rubric.files')}
                description={t('evaluations.rubric.filesDescription')}
                maxFiles={3}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? t('common.loading') : evaluation ? t('evaluations.update') : t('evaluations.create')}
          </button>
        </div>
      </form>
    </div>
  );
} 