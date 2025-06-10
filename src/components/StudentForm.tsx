'use client';

import React, { useState } from 'react';
import { Upload, X, Plus, Users, User } from 'lucide-react';
import { Student, StudentFile } from '../types';
import { StorageService } from '../lib/storage';
import { processMultipleFiles, formatFileSize, getFileIcon } from '../lib/fileUtils';
import { useTranslations } from '../hooks/useTranslations';

interface StudentFormProps {
  evaluationId: string;
  student?: Student;
  onSave: (student: Student) => void;
  onCancel: () => void;
}

export default function StudentForm({ evaluationId, student, onSave, onCancel }: StudentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(student?.name || '');
  const [isGroup, setIsGroup] = useState(!!student?.group);
  const [groupMembers, setGroupMembers] = useState<string[]>(
    student?.groupMembers || ['', '']
  );
  const [uploadedFiles, setUploadedFiles] = useState<StudentFile[]>(student?.files || []);
  const { t } = useTranslations();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const processedFiles = await processMultipleFiles(files);
      setUploadedFiles(prev => [...prev, ...processedFiles]);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Error: ${error}`);
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addGroupMember = () => {
    setGroupMembers(prev => [...prev, '']);
  };

  const removeGroupMember = (index: number) => {
    setGroupMembers(prev => prev.filter((_, i) => i !== index));
  };

  const updateGroupMember = (index: number, value: string) => {
    setGroupMembers(prev => prev.map((member, i) => i === index ? value : member));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert(t('students.nameRequired'));
      return;
    }

    if (uploadedFiles.length === 0) {
      alert(t('students.filesRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      
      // Debug logging to see what we're about to save
      console.log('=== SAVING STUDENT DATA ===');
      console.log('Name:', name.trim());
      console.log('Is Group:', isGroup);
      console.log('Group Members (raw):', groupMembers);
      console.log('Group Members (filtered):', groupMembers.filter(member => member.trim() !== ''));
      
      const studentData: Student = {
        id: student?.id || StorageService.generateId(),
        name: name.trim(),
        group: isGroup ? name.trim() : undefined,
        groupMembers: isGroup ? groupMembers.filter(member => member.trim() !== '') : undefined,
        evaluationId,
        userId: '1', // Default user ID for now
        files: uploadedFiles,
        createdAt: student?.createdAt || now,
        updatedAt: now,
      };

      console.log('Final student data to save:', studentData);
      console.log('========================');

      StorageService.saveStudent(studentData);
      onSave(studentData);
    } catch (error) {
      console.error('Error saving student:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {student ? t('students.editStudent') : t('students.addStudent')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo: Individual o Grupo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('students.submissionType')}
          </label>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setIsGroup(false)}
              className={`flex items-center px-4 py-2 rounded-md border ${
                !isGroup
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <User className="h-4 w-4 mr-2" />
              {t('students.individual')}
            </button>
            <button
              type="button"
              onClick={() => setIsGroup(true)}
              className={`flex items-center px-4 py-2 rounded-md border ${
                isGroup
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              {t('students.groupWork')}
            </button>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            {isGroup 
              ? t('students.groupName')
              : t('students.studentName')
            } *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={isGroup 
              ? t('students.groupNamePlaceholder')
              : t('students.studentNamePlaceholder')
            }
            required
          />
        </div>

        {/* Integrantes del grupo */}
        {isGroup && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('students.groupMembers')}
            </label>
            <div className="space-y-2">
              {groupMembers.map((member, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={member}
                    onChange={(e) => updateGroupMember(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('students.memberPlaceholder', { number: index + 1 })}
                  />
                  {groupMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroupMember(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addGroupMember}
                className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('students.addMember')}
              </button>
            </div>
          </div>
        )}

        {/* Carga de archivos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('students.assignmentFiles')} *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept="*"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                {t('students.uploadInstructions')}
              </p>
              <p className="text-xs text-gray-500">
                {t('students.supportedFormats')}
              </p>
            </label>
          </div>

          {/* Lista de archivos subidos */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">
                {t('students.uploadedFiles')}
              </h4>
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {isLoading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
} 