import { Evaluation, Student, EvaluationResult, AppSettings } from '../types';

const STORAGE_KEYS = {
  EVALUATIONS: 'ai-evaluador-evaluations',
  STUDENTS: 'ai-evaluador-students',
  RESULTS: 'ai-evaluador-results',
  SETTINGS: 'ai-evaluador-settings',
} as const;

export class StorageService {
  // Evaluations
  static getEvaluations(): Evaluation[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
    return data ? JSON.parse(data) : [];
  }

  static saveEvaluation(evaluation: Evaluation): void {
    if (typeof window === 'undefined') return;
    const evaluations = this.getEvaluations();
    const existingIndex = evaluations.findIndex(e => e.id === evaluation.id);
    
    if (existingIndex >= 0) {
      evaluations[existingIndex] = evaluation;
    } else {
      evaluations.push(evaluation);
    }
    
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
  }

  static deleteEvaluation(id: string): void {
    if (typeof window === 'undefined') return;
    const evaluations = this.getEvaluations().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
    
    // Also delete related students and results
    const students = this.getStudents().filter(s => s.evaluationId !== id);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    
    const results = this.getResults().filter(r => {
      const student = this.getStudents().find(s => s.id === r.studentId);
      return student?.evaluationId !== id;
    });
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  }

  // Students
  static getStudents(): Student[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    return data ? JSON.parse(data) : [];
  }

  static getStudentsByEvaluation(evaluationId: string): Student[] {
    return this.getStudents().filter(s => s.evaluationId === evaluationId);
  }

  static saveStudent(student: Student): void {
    if (typeof window === 'undefined') return;
    const students = this.getStudents();
    const existingIndex = students.findIndex(s => s.id === student.id);
    
    if (existingIndex >= 0) {
      students[existingIndex] = student;
    } else {
      students.push(student);
    }
    
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }

  static deleteStudent(id: string): void {
    if (typeof window === 'undefined') return;
    const students = this.getStudents().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    
    // Also delete related results
    const results = this.getResults().filter(r => r.studentId !== id);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  }

  // Results
  static getResults(): EvaluationResult[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
    return data ? JSON.parse(data) : [];
  }

  static getResultByStudent(studentId: string): EvaluationResult | undefined {
    return this.getResults().find(r => r.studentId === studentId);
  }

  static saveResult(result: EvaluationResult): void {
    if (typeof window === 'undefined') return;
    const results = this.getResults();
    const existingIndex = results.findIndex(r => r.studentId === result.studentId);
    
    if (existingIndex >= 0) {
      results[existingIndex] = result;
    } else {
      results.push(result);
    }
    
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  }

  // Settings
  static getSettings(): AppSettings | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  }

  static saveSettings(settings: AppSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Utility methods
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static exportData(): string {
    if (typeof window === 'undefined') return '{}';
    
    return JSON.stringify({
      evaluations: this.getEvaluations(),
      students: this.getStudents(),
      results: this.getResults(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  static importData(jsonData: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data = JSON.parse(jsonData);
      
      if (data.evaluations) {
        localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(data.evaluations));
      }
      if (data.students) {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
      }
      if (data.results) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(data.results));
      }
      if (data.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
    } catch (error) {
      throw new Error('Formato de datos inválido');
    }
  }

  static clearAllData(): void {
    if (typeof window === 'undefined') return;
    
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
} 