'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Users, User, FileText, Play, Edit, Trash2, ArrowLeft, RotateCcw, Download, BarChart3, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Evaluation, Student, EvaluationResult, StudentFile } from '../types';
import { StorageService } from '../lib/storage';
import { OpenAIService } from '../lib/openai/client';
import { localLLMService } from '../lib/localLLM/client';
import { ReportService } from '../lib/reportService';
import { formatFileSize, getFileIcon } from '../lib/fileUtils';
import { useAuth } from '../contexts/AuthContext';
import { LocalLLMService } from '../lib/localLLM/client';
import { modelConfigService } from '../lib/models/config';
import { useTranslations } from '../hooks/useTranslations';

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
  const [selectedFile, setSelectedFile] = useState<StudentFile | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [collapsedResults, setCollapsedResults] = useState<Set<string>>(new Set());
  const [localModelProgress, setLocalModelProgress] = useState<{ progress: number; status: string; modelName?: string; file?: string; loaded?: number; total?: number } | null>(null);
  const [isInitializingLocalModel, setIsInitializingLocalModel] = useState(false);
  const [showFolderSelectionModal, setShowFolderSelectionModal] = useState(false);
  const [pendingModelDownload, setPendingModelDownload] = useState<string | null>(null);
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const { user } = useAuth();
  const { t, setLanguage } = useTranslations();

  // Format bytes to human readable string
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Add modal CSS
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
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    loadData();
    loadSettings();
  }, [evaluation.id]);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showFileModal) {
        closeFileModal();
      }
    };

    if (showFileModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showFileModal]);

  const loadData = () => {
    const studentsData = StorageService.getStudentsByEvaluation(evaluation.id);
    const resultsData = StorageService.getResults();
    setStudents(studentsData);
    setResults(resultsData);
    
    // Initialize all results as collapsed to save space
    const studentIds = studentsData.map(s => s.id);
    setCollapsedResults(new Set(studentIds));
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

  const openFileModal = (file: StudentFile, student: Student) => {
    try {
      if (!file || !student) {
        alert('Error: Datos de archivo o estudiante faltantes');
        return;
      }

      setSelectedFile(file);
      setSelectedStudent(student);
      setShowFileModal(true);
    } catch (error) {
      console.error('Error opening file modal:', error);
      alert('Error al abrir el archivo: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const closeFileModal = () => {
    try {
      setSelectedFile(null);
      setSelectedStudent(null);
      setShowFileModal(false);
    } catch (error) {
      console.error('Error closing modal:', error);
      setShowFileModal(false);
    }
  };

  const toggleResultCollapse = (studentId: string) => {
    setCollapsedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
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

    if (!settings) {
      alert('Configuración no disponible');
      return;
    }

    // Check if local model is downloaded when using local provider
    if (settings.llmProvider === 'local') {
      const modelName = settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0';
      const modelStatus = await localLLMService.getModelStatus(modelName);
      
      if (modelStatus.status !== 'downloaded') {
        const modelInfo = modelConfigService.getModelInfo('local', modelName);
        const modelDisplayName = modelInfo ? t(modelInfo.name) : modelName;
        const shouldDownload = confirm(
          `El modelo ${modelDisplayName} no está descargado.\n\n` +
          `¿Quieres descargarlo ahora? (Tamaño: ${modelInfo?.size || 'desconocido'})\n\n` +
          `Nota: La descarga puede tomar varios minutos dependiendo de tu conexión.`
        );
        
        if (!shouldDownload) {
          return;
        }

        // Check and select download folder if needed, then start download
        try {
          await new Promise<void>((resolve, reject) => {
            if (!downloadFolder) {
              setPendingModelDownload(modelName);
              setShowFolderSelectionModal(true);
              // Wait for folder selection...
              const checkFolderSelection = setInterval(() => {
                if (!showFolderSelectionModal && !pendingModelDownload) {
                  clearInterval(checkFolderSelection);
                  if (downloadFolder) {
                    resolve();
                  } else {
                    reject(new Error('Descarga cancelada'));
                  }
                }
              }, 100);
            } else {
              resolve();
            }
          });

          await proceedWithDownload(modelName);
        } catch (error) {
          alert(`Error descargando modelo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          return;
        }
      }
    }

    setEvaluatingStudents(prev => new Set(prev).add(student.id));

    try {
      // Convert student files to string array
      const studentFiles = student.files.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`);
      
      // Convert evaluation files to string arrays
      const promptFiles = evaluation.promptFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
      const rubricFiles = evaluation.rubricFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];

      let result;

      // Check which provider to use
      if (settings.llmProvider === 'local') {
        // Use local LLM - simplified approach
        const modelName = settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0';
        
        try {
          // Initialize pipeline if needed
          await localLLMService.initializePipeline(modelName);
          
          // Build evaluation prompt
          const fullPrompt = localLLMService.buildEvaluationPrompt(
            evaluation.prompt + '\n' + promptFiles.join('\n'),
            evaluation.rubric + '\n' + rubricFiles.join('\n'),
            studentFiles.join('\n'),
            settings.customPrompts?.systemPrompt || '',
            settings.customPrompts?.evaluationPrefix || '',
            settings.customPrompts?.gradingCriteria || ''
          );

          // Generate response
          const response = await localLLMService.generateText(fullPrompt, {
            maxTokens: settings.localLLM?.maxTokens || 1500,
            temperature: settings.localLLM?.temperature || 0.3
          });

          // Parse response
          result = localLLMService.parseEvaluationResponse(response);
        } catch (error) {
          throw new Error(`Error en evaluación local: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      } else {
        // Use OpenAI
        if (!settings.openai?.apiKey) {
          throw new Error('API Key de OpenAI no configurada');
        }

        const openaiService = new OpenAIService();
        result = await openaiService.evaluateStudent(
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
      }

      // Get current AI model from settings
      const currentModel = settings.llmProvider === 'local' 
        ? (() => {
            const modelInfo = modelConfigService.getModelInfo('local', settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0');
            return `Local: ${modelInfo ? t(modelInfo.name) : 'TinyLlama'}`;
          })()
        : settings.openai?.model || 'gpt-4o';

      const evaluationResult: EvaluationResult = {
        id: StorageService.generateId(),
        studentId: student.id,
        grade: result.grade !== null ? (typeof result.grade === 'string' ? parseFloat(result.grade) : result.grade) : 0,
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
      setIsInitializingLocalModel(false);
      setLocalModelProgress(null);
    }
  };

  const evaluateAllStudents = async () => {
    if (!user) {
      alert('Usuario no autenticado');
      return;
    }

    if (!settings) {
      alert('Configuración no disponible');
      return;
    }

    const studentsToEvaluate = students.filter(student => !results.some(result => result.studentId === student.id));

    if (studentsToEvaluate.length === 0) {
      alert('Todos los estudiantes ya han sido evaluados.');
      return;
    }

    // Check if local model is downloaded when using local provider
    if (settings.llmProvider === 'local') {
      const modelName = settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0';
      const modelStatus = await localLLMService.getModelStatus(modelName);
      
      if (modelStatus.status !== 'downloaded') {
        const modelInfo = modelConfigService.getModelInfo('local', modelName);
        const modelDisplayName = modelInfo ? t(modelInfo.name) : modelName;
        const shouldDownload = confirm(
          `El modelo ${modelDisplayName} no está descargado.\n\n` +
          `¿Quieres descargarlo ahora? (Tamaño: ${modelInfo?.size || 'desconocido'})\n\n` +
          `Nota: La descarga puede tomar varios minutos dependiendo de tu conexión.`
        );
        
        if (!shouldDownload) {
          return;
        }

        // Check and select download folder if needed, then start download
        try {
          await new Promise<void>((resolve, reject) => {
            if (!downloadFolder) {
              setPendingModelDownload(modelName);
              setShowFolderSelectionModal(true);
              // Wait for folder selection...
              const checkFolderSelection = setInterval(() => {
                if (!showFolderSelectionModal && !pendingModelDownload) {
                  clearInterval(checkFolderSelection);
                  if (downloadFolder) {
                    resolve();
                  } else {
                    reject(new Error('Descarga cancelada'));
                  }
                }
              }, 100);
            } else {
              resolve();
            }
          });

          await proceedWithDownload(modelName);
        } catch (error) {
          alert(`Error descargando modelo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          return;
        }
      }
    }

    if (!confirm(`¿Evaluar automáticamente a ${studentsToEvaluate.length} estudiante(s)?`)) {
      return;
    }

    setIsEvaluatingAll(true);

    try {
      // Convert evaluation files to string arrays once
      const promptFiles = evaluation.promptFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];
      const rubricFiles = evaluation.rubricFiles?.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`) || [];

      let currentModel = '';

      if (settings.llmProvider === 'local') {
        const modelName = settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0';
        
        try {
          // Initialize pipeline once for all evaluations
          await localLLMService.initializePipeline(modelName);
          const modelInfo = modelConfigService.getModelInfo('local', modelName);
          currentModel = `Local: ${modelInfo ? t(modelInfo.name) : 'TinyLlama'}`;
        } catch (error) {
          setIsEvaluatingAll(false);
          alert(`Error inicializando modelo local: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          return;
        }
      } else {
        if (!settings.openai?.apiKey) {
          setIsEvaluatingAll(false);
          alert('API Key de OpenAI no configurada');
          return;
        }
        currentModel = settings.openai?.model || 'gpt-4o';
      }

      // Process each student
      for (const student of studentsToEvaluate) {
        try {
          setEvaluatingStudents(prev => new Set(prev).add(student.id));

          // Convert student files to string array
          const studentFiles = student.files.map(file => `Archivo: ${file.name}\nContenido:\n${file.content}`);

          let result;

          if (settings.llmProvider === 'local') {
            const modelName = settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0';
            
            // Build evaluation prompt
            const fullPrompt = localLLMService.buildEvaluationPrompt(
              evaluation.prompt + '\n' + promptFiles.join('\n'),
              evaluation.rubric + '\n' + rubricFiles.join('\n'),
              studentFiles.join('\n'),
              settings.customPrompts?.systemPrompt || '',
              settings.customPrompts?.evaluationPrefix || '',
              settings.customPrompts?.gradingCriteria || ''
            );

            // Generate response
            const response = await localLLMService.generateText(fullPrompt, {
              maxTokens: settings.localLLM?.maxTokens || 1500,
              temperature: settings.localLLM?.temperature || 0.3
            });

            // Parse response
            result = localLLMService.parseEvaluationResponse(response);
          } else {
            // Use OpenAI
            const openaiService = new OpenAIService();
            result = await openaiService.evaluateStudent(
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
          }

          const evaluationResult: EvaluationResult = {
            id: StorageService.generateId(),
            studentId: student.id,
            grade: result.grade !== null ? (typeof result.grade === 'string' ? parseFloat(result.grade) : result.grade) : 0,
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
          alert(`Error al evaluar a ${student.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
          setEvaluatingStudents(prev => {
            const newSet = new Set(prev);
            newSet.delete(student.id);
            return newSet;
          });
        }
      }

      loadData();
      alert(`Evaluación completada para ${studentsToEvaluate.length} estudiante(s)`);
    } catch (error) {
      console.error('Error in batch evaluation:', error);
      alert(`Error en evaluación masiva: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsEvaluatingAll(false);
      setIsInitializingLocalModel(false);
      setLocalModelProgress(null);
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

  const getGradeColorClasses = (grade: string | number) => {
    const numericGrade = typeof grade === 'string' ? parseFloat(grade) : grade;
    
    if (isNaN(numericGrade)) {
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-900',
        subtext: 'text-gray-600',
        hover: 'hover:bg-gray-100',
        badge: 'bg-gray-100 text-gray-800'
      };
    }
    
    if (numericGrade < 4) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-900',
        subtext: 'text-red-600',
        hover: 'hover:bg-red-100',
        badge: 'bg-red-100 text-red-800'
      };
    } else if (numericGrade >= 5) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-900',
        subtext: 'text-green-600',
        hover: 'hover:bg-green-100',
        badge: 'bg-green-100 text-green-800'
      };
    } else {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-900',
        subtext: 'text-yellow-600',
        hover: 'hover:bg-yellow-100',
        badge: 'bg-yellow-100 text-yellow-800'
      };
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
        setShowFolderSelectionModal(false);
        
        // Continue with pending download if any
        if (pendingModelDownload) {
          proceedWithDownload(pendingModelDownload);
          setPendingModelDownload(null);
        }
      } else {
        // Fallback for browsers that don't support the API
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
          setShowFolderSelectionModal(false);
          
          // Continue with pending download if any
          if (pendingModelDownload) {
            proceedWithDownload(pendingModelDownload);
            setPendingModelDownload(null);
          }
        } else {
          // User cancelled
          setShowFolderSelectionModal(false);
          setPendingModelDownload(null);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert('Error al seleccionar carpeta: ' + error.message);
      }
      setShowFolderSelectionModal(false);
      setPendingModelDownload(null);
    }
  };

  const checkDownloadFolderAndProceed = (modelName: string) => {
    if (!downloadFolder) {
      // Show folder selection modal first
      setPendingModelDownload(modelName);
      setShowFolderSelectionModal(true);
    } else {
      proceedWithDownload(modelName);
    }
  };

  const proceedWithDownload = async (modelName: string) => {
    setIsInitializingLocalModel(true);
    setLocalModelProgress({ progress: 0, status: 'Iniciando descarga...' });

    try {
      await localLLMService.downloadModel(modelName, (progress) => {
        setLocalModelProgress(progress);
      });
      setLocalModelProgress({ progress: 100, status: 'Modelo descargado exitosamente' });
    } catch (error) {
      setIsInitializingLocalModel(false);
      setLocalModelProgress(null);
      throw error; // Re-throw to be handled by caller
    }
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
                    {settings.llmProvider === 'local' 
                      ? (() => {
                          const modelInfo = modelConfigService.getModelInfo('local', settings.localLLM?.model || 'Xenova/TinyLlama-1.1B-Chat-v1.0');
                          return `Local: ${modelInfo ? t(modelInfo.name) : 'TinyLlama'}`;
                        })()
                      : settings.openai?.model || 'gpt-4o'
                    }
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
                                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeColorClasses(result.grade).badge}`}>
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
                          {student.files && student.files.length > 0 ? (
                            student.files.map((file) => {
                              return (
                                <button
                                  key={file.id}
                                  onClick={() => {
                                    openFileModal(file, student);
                                  }}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 transition-colors cursor-pointer border border-gray-200 hover:border-blue-300"
                                  title={`Ver contenido de ${file.name}`}
                                >
                                  <span className="mr-1">{getFileIcon(file.name)}</span>
                                  {file.name}
                                  <Eye className="h-3 w-3 ml-1 opacity-60" />
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-xs text-gray-500">No hay archivos</span>
                          )}
                        </div>
                      </div>

                      {/* Result */}
                      {result && (
                        <div className="mt-3 ml-12">
                          <div className={`${getGradeColorClasses(result.grade).bg} rounded-md overflow-hidden border ${getGradeColorClasses(result.grade).border}`}>
                            {/* Header - Always visible */}
                            <div 
                              className={`p-3 cursor-pointer ${getGradeColorClasses(result.grade).hover} transition-colors`}
                              onClick={() => toggleResultCollapse(student.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <p className={`text-sm font-medium ${getGradeColorClasses(result.grade).text}`}>
                                    Calificación: {result.grade}
                                  </p>
                                  <p className={`text-xs ${getGradeColorClasses(result.grade).subtext}`}>
                                    {new Date(result.evaluatedAt).toLocaleString()}
                                  </p>
                                  {result.evaluationVersion > 1 && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${getGradeColorClasses(result.grade).badge}`}>
                                      v{result.evaluationVersion}
                                    </span>
                                  )}
                                </div>
                                <div className={getGradeColorClasses(result.grade).subtext}>
                                  {collapsedResults.has(student.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronUp className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expandable content */}
                            {!collapsedResults.has(student.id) && (
                              <div className={`px-3 pb-3 pt-0 border-t ${getGradeColorClasses(result.grade).border}`}>
                                <div className="space-y-2">
                                  <div>
                                    <p className={`text-xs font-medium mb-1 ${getGradeColorClasses(result.grade).text}`}>Explicación:</p>
                                    <p className={`text-sm ${getGradeColorClasses(result.grade).subtext}`}>
                                      {result.explanation}
                                    </p>
                                  </div>
                                  
                                  {result.feedback && (
                                    <div>
                                      <p className={`text-xs font-medium mb-1 ${getGradeColorClasses(result.grade).text}`}>Feedback:</p>
                                      <p className={`text-sm italic ${getGradeColorClasses(result.grade).subtext}`}>
                                        {result.feedback}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="pt-1">
                                    <p className={`text-xs ${getGradeColorClasses(result.grade).subtext}`}>
                                      Modelo: {result.aiModel}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
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

      {/* File Content Modal */}
      {showFileModal && selectedFile && selectedStudent && (
        (() => {
          return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedFile?.name || 'Archivo sin nombre'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedStudent?.name || 'Estudiante'} • {selectedFile?.type || 'Tipo desconocido'} • {formatFileSize(selectedFile?.size || 0)}
                    </p>
                  </div>
                  <button
                    onClick={closeFileModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cerrar"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {(() => {
                    if (!selectedFile?.content || selectedFile.content.length === 0) {
                      return (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <div className="text-gray-400 mb-4">
                            <FileText className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-sm text-gray-600">
                            No hay contenido disponible para este archivo.
                          </p>
                        </div>
                      );
                    }

                    // Check if content is base64 (binary file)
                    const isBase64 = selectedFile.content.match(/^[A-Za-z0-9+/]*={0,2}$/) && selectedFile.content.length > 100;
                    
                    if (isBase64) {
                      return (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <div className="text-gray-400 mb-4">
                            <FileText className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Este archivo es binario y no se puede mostrar como texto.
                          </p>
                          <p className="text-xs text-gray-500">
                            Tipo: {selectedFile?.type || 'Desconocido'} • Tamaño: {formatFileSize(selectedFile?.size || 0)}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                          {selectedFile.content}
                        </pre>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={closeFileModal}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Folder Selection Modal */}
      {showFolderSelectionModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mb-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Seleccionar Carpeta de Descarga
              </h3>
              
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Antes de descargar el modelo, elige dónde quieres organizarlo:
                </p>
                
                <div className="bg-gray-50 border rounded-lg p-3 text-left">
                  <p className="font-medium text-gray-900 mb-2">Carpeta actual:</p>
                  <p className="font-mono text-xs break-all">
                    {downloadFolder || 'No configurada'}
                  </p>
                </div>
                
                <p className="text-xs">
                  Los modelos se almacenan en el navegador. La carpeta es solo una referencia organizacional.
                </p>
              </div>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleSelectDownloadFolder}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                  </svg>
                  Seleccionar Carpeta
                </button>
                
                {downloadFolder && (
                  <button
                    onClick={() => {
                      setShowFolderSelectionModal(false);
                      if (pendingModelDownload) {
                        proceedWithDownload(pendingModelDownload);
                        setPendingModelDownload(null);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Usar Carpeta Actual
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowFolderSelectionModal(false);
                    setPendingModelDownload(null);
                  }}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local Model Initialization Modal */}
      {(isInitializingLocalModel || localModelProgress) && (
        <div className="download-modal-overlay fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="download-modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {localModelProgress?.status === 'downloading' ? 'Descargando Modelo' : 'Inicializando Modelo Local'}
              </h3>
              
              {localModelProgress && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    {localModelProgress.status}
                  </p>
                  
                  {/* Model name and current file */}
                  {localModelProgress.modelName && (
                    <div className="bg-gray-50 rounded-lg p-3 text-left">
                      <p className="text-xs font-medium text-gray-900 mb-1">Modelo:</p>
                      <p className="text-xs text-gray-700 font-mono break-all">
                        {localModelProgress.modelName}
                      </p>
                      {localModelProgress.file && (
                        <>
                          <p className="text-xs font-medium text-gray-900 mt-2 mb-1">Archivo actual:</p>
                          <p className="text-xs text-gray-700 font-mono break-all">
                            {localModelProgress.file}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, localModelProgress.progress || 0))}%` 
                      }}
                    ></div>
                  </div>
                  
                  {/* Progress details */}
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{Math.round(localModelProgress.progress || 0)}% completado</span>
                    {localModelProgress.loaded && localModelProgress.total && (
                      <span>
                        {formatBytes(localModelProgress.loaded)} / {formatBytes(localModelProgress.total)}
                      </span>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  {localModelProgress.status === 'downloading' && localModelProgress.modelName && (
                    <div className="flex space-x-3 mt-4">
                      <button
                        onClick={() => {
                          if (localModelProgress.modelName) {
                            localLLMService.pauseDownload(localModelProgress.modelName);
                            setLocalModelProgress(null);
                            setIsInitializingLocalModel(false);
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pausar
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-4">
                {localModelProgress?.status === 'downloading' 
                  ? 'La descarga puede tomar varios minutos dependiendo de tu conexión...'
                  : 'Esta operación puede tomar varios minutos la primera vez...'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
