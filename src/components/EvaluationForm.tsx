'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEvaluationSchema, EvaluationFormData } from '../models/validation';
import { Evaluation, EvaluationFile } from '../types';
import { StorageService } from '../lib/storage';
import { useTranslations } from '../hooks/useTranslations';
import FileUpload from './FileUpload';

interface EvaluationFormProps {
  evaluation?: Evaluation;
  onSave: (evaluation: Evaluation) => void;
  onCancel: () => void;
}

export default function EvaluationForm({ evaluation, onSave, onCancel }: EvaluationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [promptFiles, setPromptFiles] = useState<EvaluationFile[]>(evaluation?.promptFiles || []);
  const [rubricFiles, setRubricFiles] = useState<EvaluationFile[]>(evaluation?.rubricFiles || []);
  const { t } = useTranslations();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EvaluationFormData>({
    resolver: zodResolver(createEvaluationSchema()),
    defaultValues: evaluation ? {
      name: evaluation.name,
      description: evaluation.description || '',
      prompt: evaluation.prompt,
      rubric: evaluation.rubric,
    } : undefined,
  });

  const onSubmit = async (data: EvaluationFormData) => {
    // Custom validation: require either text OR files for prompt and rubric
    const promptText = data.prompt?.trim();
    const hasPromptFiles = promptFiles.length > 0;
    const rubricText = data.rubric?.trim();
    const hasRubricFiles = rubricFiles.length > 0;

    if (!promptText && !hasPromptFiles) {
      alert(t.language === 'es' 
        ? 'Debes proporcionar una consigna en texto o subir archivos de consigna'
        : 'You must provide assignment text or upload assignment files');
      return;
    }

    if (!rubricText && !hasRubricFiles) {
      alert(t.language === 'es' 
        ? 'Debes proporcionar una rúbrica en texto o subir archivos de rúbrica'
        : 'You must provide rubric text or upload rubric files');
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
        promptFiles: promptFiles.length > 0 ? promptFiles : undefined,
        rubric: rubricText || '', // Ensure we always have a string
        rubricFiles: rubricFiles.length > 0 ? rubricFiles : undefined,
        createdAt: evaluation?.createdAt || now,
        updatedAt: now,
      };

      StorageService.saveEvaluation(evaluationData);
      onSave(evaluationData);
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert(`${t.error}: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {evaluation ? t.editEvaluation : t.createEvaluation}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              {t.evaluationName} *
            </label>
            <input
              {...register('name')}
              type="text"
              id="name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t.language === 'es' ? 'Ej: Aplicación 1 - React' : 'E.g.: Application 1 - React'}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              {t.evaluationDescription}
            </label>
            <input
              {...register('description')}
              type="text"
              id="description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t.language === 'es' ? 'Breve descripción de la evaluación' : 'Brief evaluation description'}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </div>

        {/* Assignment Prompt Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t.assignmentPrompt}
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prompt Text */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                {t.assignmentPrompt} (Texto)
              </label>
              <textarea
                {...register('prompt')}
                id="prompt"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t.language === 'es' 
                  ? 'Describe aquí la consigna completa del trabajo que deben realizar los estudiantes...' 
                  : 'Describe here the complete assignment that students must complete...'}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t.language === 'es' 
                  ? '* Requerido si no subes archivos de consigna' 
                  : '* Required if no assignment files are uploaded'}
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
                label={`${t.promptFiles}`}
                description={t.language === 'es' 
                  ? 'Como alternativa o complemento al texto de la consigna' 
                  : 'As an alternative or complement to the assignment text'}
                maxFiles={3}
              />
            </div>
          </div>
        </div>

        {/* Rubric Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t.rubric}
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rubric Text */}
            <div>
              <label htmlFor="rubric" className="block text-sm font-medium text-gray-700 mb-2">
                {t.rubric} (Texto)
              </label>
              <textarea
                {...register('rubric')}
                id="rubric"
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t.language === 'es' 
                  ? 'Define aquí los criterios de evaluación, escalas de calificación, y qué aspectos considerar para cada nota...' 
                  : 'Define here the evaluation criteria, grading scales, and what aspects to consider for each grade...'}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t.language === 'es' 
                  ? '* Requerido si no subes archivos de rúbrica' 
                  : '* Required if no rubric files are uploaded'}
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
                label={`${t.rubricFiles}`}
                description={t.language === 'es' 
                  ? 'Como alternativa o complemento al texto de la rúbrica' 
                  : 'As an alternative or complement to the rubric text'}
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
            {t.cancel}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? t.saving : evaluation ? (t.language === 'es' ? 'Actualizar' : 'Update') : t.createEvaluation}
          </button>
        </div>
      </form>
    </div>
  );
} 