'use client';

import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { EvaluationFile } from '../types';
import { processMultipleFiles, formatFileSize, getFileIcon } from '../lib/fileUtils';
import { useTranslations } from '../hooks/useTranslations';

interface FileUploadProps {
  files: EvaluationFile[];
  onFilesChange: (files: EvaluationFile[]) => void;
  category: 'prompt' | 'rubric';
  label: string;
  description?: string;
  accept?: string;
  maxFiles?: number;
}

export default function FileUpload({ 
  files, 
  onFilesChange, 
  category, 
  label, 
  description,
  accept = "*",
  maxFiles = 10
}: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslations();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (files.length + selectedFiles.length > maxFiles) {
      alert(t('fileUpload.maxFilesError', { maxFiles: maxFiles.toString() }));
      return;
    }

    setIsLoading(true);
    try {
      const processedFiles = await processMultipleFiles(selectedFiles);
      const evaluationFiles: EvaluationFile[] = processedFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        content: file.content,
        uploadedAt: new Date().toISOString(),
        category: category
      }));
      
      onFilesChange([...files, ...evaluationFiles]);
    } catch (error) {
      alert(error instanceof Error ? error.message : `${t('common.error')}: ${error}`);
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    onFilesChange(files.filter(f => f.id !== fileId));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      {description && (
        <p className="text-sm text-gray-600 mb-3">{description}</p>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          id={`file-upload-${category}`}
          accept={accept}
          disabled={isLoading || files.length >= maxFiles}
        />
        <label htmlFor={`file-upload-${category}`} className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {isLoading 
              ? t('common.loading')
              : t('fileUpload.instruction')
            }
          </p>
          <p className="text-xs text-gray-500">
            {t('fileUpload.acceptedTypes')}
          </p>
          {maxFiles > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              {t('fileUpload.fileCount', { current: files.length.toString(), max: maxFiles.toString() })}
            </p>
          )}
        </label>
      </div>

      {/* Lista de archivos subidos */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('fileUpload.uploadedFiles')}:
          </h4>
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-red-600 hover:text-red-800"
                title={t('fileUpload.removeFile')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 