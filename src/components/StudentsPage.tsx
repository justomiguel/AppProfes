'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Users, User, FileText, Play, Edit, Trash2, ArrowLeft, RotateCcw, Download, BarChart3 } from 'lucide-react';
import { Evaluation, Student, EvaluationResult } from '../types';
import { StorageService } from '../lib/storage';
import { OpenAIService } from '../lib/openai/client';
import { ReportService } from '../lib/reportService';
import { formatFileSize, getFileIcon } from '../lib/fileUtils';
import { useAuth } from '../contexts/AuthContext';

interface StudentsPageProps {
  evaluation: Evaluation;
  onBack: () => void;
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
}

export default function StudentsPage({ evaluation, onBack, onAddStudent, onEditStudent }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [evaluatingStudents, setEvaluatingStudents] = useState<Set<string>>(new Set());
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
    loadSettings();
  }, [evaluation.id]);

  const loadData = () => {
    const studentsData = StorageService.getStudentsByEvaluation(evaluation.id);
    const resultsData = StorageService.getResults();
    setStudents(studentsData);
    setResults(resultsData);
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', {
        credentials: 'include',
      });

      if (response.ok) {
        const { settings } = await response.json();
        setSettings(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este estudiante? Se eliminará también su resultado si existe.')) {
      StorageService.deleteStudent(studentId);
      loadData();
    }
  };

  const evaluateStudent = async (student: Student, isReEval: boolean = false) => {
    if (!user) {
      alert('Usuario no autenticado');
      return;
    }

    setEvaluatingStudents(prev => new Set(prev).add(student.id));

    try {
      const openaiService = new OpenAIService();
      
      // Convert student files to string array
      const studentFiles = student.files.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`);
      
      // Convert evaluation files to string arrays
      const promptFiles = evaluation.promptFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
      const rubricFiles = evaluation.rubricFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
      
      const result = await openaiService.evaluateStudent(
        evaluation.prompt,
        promptFiles,
        evaluation.rubric,
        rubricFiles,
        studentFiles,
        student.id,
        evaluation.id,
        user.id,
        isReEval
      );

      // Get current AI model from settings or use default
      const currentModel = settings?.openai?.model || 'gpt-4o';

      const evaluationResult: EvaluationResult = {
        id: StorageService.generateId(),
        studentId: student.id,
        grade: result.grade,
        explanation: result.explanation,
        feedback: result.feedback,
        evaluatedAt: new Date().toISOString(),
        evaluationVersion: 1,
        isLatest: true,
        aiModel: currentModel,
        userId: user.id.toString(),
      };

      StorageService.saveResult(evaluationResult);
      loadData();
      
      if (isReEval) {
        alert(`Re-evaluación completada para ${student.name}`);
      } else {
        alert(`Evaluación completada para ${student.name}`);
      }
    } catch (error) {
      console.error('Error evaluating student:', error);
      alert(`Error al evaluar a ${student.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setEvaluatingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(student.id);
        return newSet;
      });
    }
  };

  const evaluateAllStudents = async () => {
    if (!user) {
      alert('Usuario no autenticado');
      return;
    }

    const studentsToEvaluate = students.filter(student => !results.some(result => result.studentId === student.id));

    if (studentsToEvaluate.length === 0) {
      alert('Todos los estudiantes ya han sido evaluados.');
      return;
    }

    if (!confirm(`¿Evaluar automáticamente a ${studentsToEvaluate.length} estudiante(s)?`)) {
      return;
    }

    setIsEvaluatingAll(true);

    try {
      const openaiService = new OpenAIService();
      const currentModel = settings?.openai?.model || 'gpt-4o';
      
      for (const student of studentsToEvaluate) {
        try {
          // Convert student files to string array
          const studentFiles = student.files.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`);
          
          // Convert evaluation files to string arrays
          const promptFiles = evaluation.promptFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
          const rubricFiles = evaluation.rubricFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
          
          const result = await openaiService.evaluateStudent(
            evaluation.prompt,
            promptFiles,
            evaluation.rubric,
            rubricFiles,
            studentFiles,
            student.id,
            evaluation.id,
            user.id,
            false
          );

          const evaluationResult: EvaluationResult = {
            id: StorageService.generateId(),
            studentId: student.id,
            grade: result.grade,
            explanation: result.explanation,
            feedback: result.feedback,
            evaluatedAt: new Date().toISOString(),
            evaluationVersion: 1,
            isLatest: true,
            aiModel: currentModel,
            userId: user.id.toString(),
          };

          StorageService.saveResult(evaluationResult);
        } catch (error) {
          console.error(`Error evaluating student ${student.name}:`, error);
        }
      }

      loadData();
      alert('Evaluación masiva completada. Revisa los resultados.');
    } catch (error) {
      console.error('Error in batch evaluation:', error);
      alert('Error en la evaluación masiva');
    } finally {
      setIsEvaluatingAll(false);
    }
  };

  const getStudentResult = (studentId: string): EvaluationResult | undefined => {
    return results.find(result => result.studentId === studentId);
  };

  // Report generation functions using PDF service
  const generateStudentReport = (student: Student) => {
    const result = getStudentResult(student.id);
    if (!result) {
      alert('Este estudiante no ha sido evaluado aún.');
      return;
    }

    ReportService.generateStudentReport(student, evaluation, result);
  };

  const generateCourseReport = () => {
    const evaluatedResults = results.filter(r => students.some(s => s.id === r.studentId));
    
    if (evaluatedResults.length === 0) {
      alert('No hay estudiantes evaluados para generar el reporte.');
      return;
    }

    ReportService.generateCourseReport(evaluation, students, evaluatedResults);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
              <button
                onClick={onBack}
                className="flex items-center px-2 sm:px-3 py-1 sm:py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Volver</span>
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 line-clamp-1">
                  {evaluation.name}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                  {evaluation.description || 'Gestiona los estudiantes de esta evaluación'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {students.length} estudiantes
                </span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  {results.filter(r => students.some(s => s.id === r.studentId)).length} evaluados
                </span>
                {settings && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    {settings.openai?.model || 'gpt-4o'}
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2 order-1 sm:order-2">
                <button
                  onClick={() => setShowReports(!showReports)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Reportes</span>
                  <span className="sm:hidden">Report</span>
                </button>
                <button
                  onClick={evaluateAllStudents}
                  disabled={isEvaluatingAll || students.length === 0}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 focus:ring-green-500`}
                >
                  <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{isEvaluatingAll ? 'Evaluando...' : 'Evaluar Todos'}</span>
                  <span className="sm:hidden">{isEvaluatingAll ? 'Eval...' : 'Eval Todo'}</span>
                </button>
                <button
                  onClick={onAddStudent}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Agregar Estudiante</span>
                  <span className="sm:hidden">Agregar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Reports Section */}
      {showReports && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <div>
                <h3 className="text-lg font-medium text-blue-900">Generación de Reportes PDF</h3>
                <p className="text-sm text-blue-700">Descarga reportes profesionales con tablas y estilos</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={generateCourseReport}
                  disabled={results.filter(r => students.some(s => s.id === r.studentId)).length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Reporte del Curso (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {students.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay estudiantes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza agregando estudiantes a esta evaluación.
            </p>
            {!isEvaluatingAll && (
              <div className="mt-6">
                <button
                  onClick={onAddStudent}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Estudiante
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Estudiantes
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {students.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FileText className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Evaluados
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {results.filter(r => students.some(s => s.id === r.studentId)).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Play className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Pendientes
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {students.length - results.filter(r => students.some(s => s.id === r.studentId)).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Students List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {students.map((student) => {
                  const result = getStudentResult(student.id);
                  const isEvaluating = evaluatingStudents.has(student.id);

                  return (
                    <li key={student.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {student.group ? (
                              <Users className="h-8 w-8 text-blue-600" />
                            ) : (
                              <User className="h-8 w-8 text-gray-600" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">
                                {student.name}
                              </p>
                              {student.group && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Grupo
                                </span>
                              )}
                              {result && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Evaluado: {result.grade}
                                </span>
                              )}
                            </div>
                            {student.groupMembers && student.groupMembers.length > 0 && (
                              <p className="text-sm text-gray-500">
                                Integrantes: {student.groupMembers.filter(m => m.trim()).join(', ')}
                              </p>
                            )}
                            <p className="text-sm text-gray-500">
                              {student.files.length} archivo(s) • {formatFileSize(student.files.reduce((acc, file) => acc + file.size, 0))}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {!result && (
                            <button
                              onClick={() => evaluateStudent(student)}
                              disabled={isEvaluating}
                              className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 focus:ring-green-500`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {isEvaluating ? 'Evaluando...' : 'Evaluar'}
                            </button>
                          )}
                          
                          {result && (
                            <>
                              <button
                                onClick={() => generateStudentReport(student)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                title="Generar reporte PDF"
                              >
                                <Download className="h-3 w-3 mr-1" />
                                PDF
                              </button>
                              <button
                                onClick={() => evaluateStudent(student, true)}
                                disabled={isEvaluating}
                                className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-700 focus:ring-orange-500`}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                {isEvaluating ? 'Re-evaluando...' : 'Re-evaluar'}
                              </button>
                            </>
                          )}
                          
                          {!isEvaluating && (
                            <>
                              <button
                                onClick={() => onEditStudent(student)}
                                className="p-2 text-gray-400 hover:text-blue-600"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="p-2 text-gray-400 hover:text-red-600"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Files */}
                      <div className="mt-3 ml-12">
                        <div className="flex flex-wrap gap-2">
                          {student.files.map((file) => (
                            <div
                              key={file.id}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700"
                            >
                              <span className="mr-1">{getFileIcon(file.name)}</span>
                              {file.name}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Result */}
                      {result && (
                        <div className="mt-3 ml-12 p-3 bg-green-50 rounded-md">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">
                                Calificación: {result.grade}
                              </p>
                              <p className="text-sm text-green-700 mt-1">
                                {result.explanation}
                              </p>
                              {result.feedback && (
                                <p className="text-sm text-green-600 mt-2 italic">
                                  Feedback: {result.feedback}
                                </p>
                              )}
                              <p className="text-xs text-green-600 mt-2">
                                Evaluado: {new Date(result.evaluatedAt).toLocaleString()} • 
                                Modelo: {result.aiModel}
                                {result.evaluationVersion > 1 && (
                                  <span> • Versión: {result.evaluationVersion}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 