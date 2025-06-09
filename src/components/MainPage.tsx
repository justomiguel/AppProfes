'use client';

import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Users, Settings, FileText, LogOut, Shield, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EvaluationForm from './EvaluationForm';
import StudentsPage from './StudentsPage';
import SettingsForm from './SettingsForm';
import StudentForm from './StudentForm';
import AdminUsersPage from './AdminUsersPage';
import GlobalSettingsPage from './GlobalSettingsPage';
import { Evaluation, Student } from '../types';
import { StorageService } from '../lib/storage';
import { useTranslations } from '../hooks/useTranslations';

type CurrentView = 
  | 'evaluations' 
  | 'students' 
  | 'settings' 
  | 'evaluation-form' 
  | 'student-form' 
  | 'admin-users' 
  | 'global-settings';

export default function MainPage() {
  const { user, logout, isLoading, isAdmin } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [currentView, setCurrentView] = useState<CurrentView>('evaluations');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | undefined>();
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | undefined>();
  const [editingStudent, setEditingStudent] = useState<Student | undefined>();
  const { t } = useTranslations();

  useEffect(() => {
    setEvaluations(StorageService.getEvaluations());
  }, []);

  const handleSaveEvaluation = (evaluation: Evaluation) => {
    setEvaluations(StorageService.getEvaluations());
    setCurrentView('evaluations');
    setEditingEvaluation(undefined);
  };

  const handleEditEvaluation = (evaluation: Evaluation) => {
    setEditingEvaluation(evaluation);
    setCurrentView('evaluation-form');
  };

  const handleDeleteEvaluation = (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta evaluación? Se eliminarán también todos los estudiantes y resultados asociados.')) {
      StorageService.deleteEvaluation(id);
      setEvaluations(StorageService.getEvaluations());
    }
  };

  const handleViewStudents = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setCurrentView('students');
  };

  const handleSaveStudent = (student: Student) => {
    setCurrentView('students');
    setEditingStudent(undefined);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setCurrentView('student-form');
  };

  const handleCancelForm = () => {
    setCurrentView('evaluations');
    setEditingEvaluation(undefined);
    setEditingStudent(undefined);
  };

  const handleBackToEvaluations = () => {
    setCurrentView('evaluations');
    setSelectedEvaluation(undefined);
  };

  const handleSettingsSaved = () => {
    setCurrentView('evaluations');
    // Trigger settings change event for other components
    window.dispatchEvent(new Event('settingsChanged'));
  };

  const handleAdminBack = () => {
    setCurrentView('evaluations');
  };

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  // Render current view
  if (currentView === 'evaluation-form') {
    return (
      <EvaluationForm
        evaluation={editingEvaluation}
        onSave={handleSaveEvaluation}
        onCancel={handleCancelForm}
      />
    );
  }

  if (currentView === 'students' && selectedEvaluation) {
    return (
      <StudentsPage
        evaluation={selectedEvaluation}
        onBack={handleBackToEvaluations}
        onAddStudent={() => setCurrentView('student-form')}
        onEditStudent={handleEditStudent}
      />
    );
  }

  if (currentView === 'student-form' && selectedEvaluation) {
    return (
      <StudentForm
        evaluationId={selectedEvaluation.id}
        student={editingStudent}
        onSave={handleSaveStudent}
        onCancel={() => setCurrentView('students')}
      />
    );
  }

  if (currentView === 'settings') {
    return (
      <SettingsForm
        onSave={handleSettingsSaved}
        onCancel={() => setCurrentView('evaluations')}
      />
    );
  }

  if (currentView === 'admin-users' && isAdmin) {
    return (
      <AdminUsersPage
        onBack={handleAdminBack}
      />
    );
  }

  if (currentView === 'global-settings' && isAdmin) {
    return (
      <GlobalSettingsPage
        onBack={handleAdminBack}
      />
    );
  }

  // Main evaluations view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Evaluador</h1>
              {isAdmin && (
                <span className="ml-2 sm:ml-3 inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <span className="text-sm text-gray-600 order-2 sm:order-1">
                Bienvenido, <span className="font-medium">{user?.username}</span>
              </span>
              
              {/* Navigation */}
              <nav className="flex flex-wrap gap-2 sm:gap-0 sm:space-x-2 order-1 sm:order-2">
                <button 
                  onClick={() => setCurrentView('evaluations')}
                  className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${
                    currentView === 'evaluations' 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{t('navigation.evaluations')}</span>
                  <span className="sm:hidden">Eval</span>
                </button>
                
                <button 
                  onClick={() => setCurrentView('settings')}
                  className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${
                    (currentView as string) === 'settings' 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{t('navigation.settings')}</span>
                  <span className="sm:hidden">Config</span>
                </button>

                {/* Admin Navigation */}
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => setCurrentView('admin-users')}
                      className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${
                        currentView === 'admin-users' 
                          ? 'text-purple-600 bg-purple-50' 
                          : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                      }`}
                    >
                      <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Usuarios</span>
                      <span className="sm:hidden">Users</span>
                    </button>
                    <button 
                      onClick={() => setCurrentView('global-settings')}
                      className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${
                        currentView === 'global-settings' 
                          ? 'text-purple-600 bg-purple-50' 
                          : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                      }`}
                    >
                      <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Config Global</span>
                      <span className="sm:hidden">Global</span>
                    </button>
                  </>
                )}

                <button 
                  onClick={handleLogout}
                  className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md text-gray-700 hover:text-red-600 hover:bg-gray-50"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Salir</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('evaluations.title')}</h2>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Gestiona tus evaluaciones y corrige automáticamente con IA
            </p>
          </div>
          <button
            onClick={() => setCurrentView('evaluation-form')}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('evaluations.create')}
          </button>
        </div>

        {/* Evaluations Grid */}
        {evaluations.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay evaluaciones</h3>
            <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera evaluación</p>
            <div className="mt-6">
              <button
                onClick={() => setCurrentView('evaluation-form')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('evaluations.create')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {evaluations.map((evaluation) => {
              const students = StorageService.getStudentsByEvaluation(evaluation.id);
              const results = StorageService.getResults().filter(r => 
                students.some(s => s.id === r.studentId)
              );
              const evaluatedCount = results.length;

              return (
                <div
                  key={evaluation.id}
                  className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                          {evaluation.name}
                        </h3>
                        {evaluation.description && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                            {evaluation.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 sm:mt-4">
                      <div className="flex items-center text-xs sm:text-sm text-gray-500">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span>{students.length} estudiantes</span>
                        {evaluatedCount > 0 && (
                          <span className="ml-2 text-green-600">
                            ({evaluatedCount} evaluados)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Creado: {new Date(evaluation.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-4 sm:px-6 py-3">
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => handleViewStudents(evaluation)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-1.5 sm:py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Ver Estudiantes
                      </button>
                      
                      <button
                        onClick={() => handleEditEvaluation(evaluation)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-1.5 sm:py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      
                      <button
                        onClick={() => handleDeleteEvaluation(evaluation.id)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-1.5 sm:py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
} 