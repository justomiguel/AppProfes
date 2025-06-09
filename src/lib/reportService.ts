import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Evaluation, Student, EvaluationResult } from '../types';

export class ReportService {
  private static addHeader(doc: jsPDF, title: string) {
    // Header background
    doc.setFillColor(41, 98, 169); // Blue background
    doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
    
    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, 20);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
  }

  private static addFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    const pageSize = doc.internal.pageSize;
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      
      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, pageSize.height - 20, pageSize.width - 20, pageSize.height - 20);
      
      // Footer text
      const footerText = `AI Evaluador - Generado el ${new Date().toLocaleDateString('es-ES')} - Página ${i} de ${pageCount}`;
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageSize.width - textWidth) / 2, pageSize.height - 10);
    }
  }

  static generateStudentReport(
    student: Student,
    evaluation: Evaluation,
    result: EvaluationResult
  ): void {
    const doc = new jsPDF();
    
    // Header
    this.addHeader(doc, 'Reporte Individual de Evaluación');
    
    let yPosition = 50;
    
    // Student/Group Information
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(student.group ? 'Información del Grupo' : 'Información del Estudiante', 20, yPosition);
    yPosition += 10;
    
    // Determine display name for the student/group
    const displayName = student.group && student.groupMembers && student.groupMembers.length > 0
      ? student.groupMembers.filter(m => m.trim()).join(', ')
      : student.name;
    
    const studentInfo = [
      ['Evaluación', evaluation.name],
      [student.group ? 'Integrantes' : 'Estudiante', displayName],
      ...(student.group && student.groupMembers && student.groupMembers.length > 0 ? 
        [['Nombre del Grupo', student.name]] : []),
      ['Fecha de evaluación', result.evaluatedAt ? new Date(result.evaluatedAt).toLocaleString('es-ES') : 'No disponible'],
      ['Calificación', (result.grade || 0).toString()],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Campo', 'Valor']],
      body: studentInfo,
      theme: 'grid',
      headStyles: { fillColor: [70, 130, 180], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 12, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 230, 230] } }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Grade Box
    doc.setFillColor(76, 175, 80); // Green background
    doc.roundedRect(20, yPosition, doc.internal.pageSize.width - 40, 25, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const gradeText = `CALIFICACIÓN: ${result.grade || 0}`;
    const gradeTextWidth = doc.getTextWidth(gradeText);
    doc.text(gradeText, (doc.internal.pageSize.width - gradeTextWidth) / 2, yPosition + 16);
    
    yPosition += 40;
    doc.setTextColor(0, 0, 0);

    // Explanation Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Explicación de la Calificación', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const explanationLines = doc.splitTextToSize(result.explanation || 'No hay explicación disponible', doc.internal.pageSize.width - 40);
    doc.text(explanationLines, 20, yPosition);
    yPosition += explanationLines.length * 6 + 15;

    // Feedback Section (if exists)
    if (result.feedback) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Retroalimentación', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const feedbackLines = doc.splitTextToSize(result.feedback, doc.internal.pageSize.width - 40);
      doc.text(feedbackLines, 20, yPosition);
      yPosition += feedbackLines.length * 6 + 15;
    }

    // Files Section
    if (yPosition > doc.internal.pageSize.height - 80) {
      doc.addPage();
      yPosition = 30;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Archivos Evaluados', 20, yPosition);
    yPosition += 10;

    const filesData = student.files.map(file => [
      file.name || 'Archivo sin nombre',
      file.type || 'Tipo desconocido',
      `${((file.size || 0) / 1024).toFixed(2)} KB`
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Nombre del Archivo', 'Tipo', 'Tamaño']],
      body: filesData,
      theme: 'striped',
      headStyles: { fillColor: [255, 152, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 }
    });

    // Add footer
    this.addFooter(doc);

    // Download - use display name for filename
    const filenameName = student.group && student.groupMembers && student.groupMembers.length > 0
      ? student.groupMembers.filter(m => m.trim()).join('_').replace(/\s+/g, '_')
      : student.name.replace(/\s+/g, '_');
    
    const filename = `reporte_${filenameName}_${evaluation.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  }

  static generateCourseReport(
    evaluation: Evaluation,
    students: Student[],
    results: EvaluationResult[]
  ): void {
    const doc = new jsPDF();
    
    // Header
    this.addHeader(doc, 'Reporte General del Curso');
    
    let yPosition = 50;

    // Course Information
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text('Información del Curso', 20, yPosition);
    yPosition += 15;

    const courseInfo = [
      ['Evaluación', evaluation.name],
      ['Descripción', evaluation.description || 'Sin descripción'],
      ['Fecha de generación', new Date().toLocaleString('es-ES')],
      ['Total de estudiantes', students.length.toString()],
      ['Estudiantes evaluados', results.length.toString()],
      ['Estudiantes pendientes', (students.length - results.length).toString()]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Campo', 'Valor']],
      body: courseInfo,
      theme: 'grid',
      headStyles: { fillColor: [70, 130, 180], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 12, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [230, 230, 230] } }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Statistics (only if there are evaluated students)
    if (results.length > 0) {
      const grades = results.map(r => r.grade || 0).filter(grade => grade !== null && grade !== undefined);
      const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
      const maxGrade = Math.max(...grades);
      const minGrade = Math.min(...grades);

      // Statistics Box
      doc.setFillColor(33, 150, 243); // Blue background
      doc.roundedRect(20, yPosition, doc.internal.pageSize.width - 40, 30, 5, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Estadísticas de Calificaciones', 25, yPosition + 12);
      doc.setFontSize(12);
      doc.text(`Promedio: ${average.toFixed(2)} | Máxima: ${maxGrade} | Mínima: ${minGrade}`, 25, yPosition + 24);
      
      yPosition += 45;
      doc.setTextColor(0, 0, 0);

      // Grade Distribution
      const gradeDistribution = grades.reduce((acc, grade) => {
        const roundedGrade = Math.round(grade);
        acc[roundedGrade] = (acc[roundedGrade] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const distributionData = Object.entries(gradeDistribution)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([grade, count]) => [
          `Nota ${grade}`,
          count.toString(),
          `${((count / results.length) * 100).toFixed(1)}%`
        ]);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Distribución de Notas', 20, yPosition);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Calificación', 'Cantidad', 'Porcentaje']],
        body: distributionData,
        theme: 'striped',
        headStyles: { fillColor: [76, 175, 80], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 11, cellPadding: 4, halign: 'center' }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Student Details
    if (yPosition > doc.internal.pageSize.height - 100) {
      doc.addPage();
      yPosition = 30;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle por Estudiante', 20, yPosition);
    yPosition += 10;

    const studentData = students.map(student => {
      const result = results.find(r => r.studentId === student.id);
      
      // Debug: Let's see what we actually have
      console.log('Student data:', {
        name: student.name,
        group: student.group,
        groupMembers: student.groupMembers,
        isGroup: !!student.group
      });
      
      let firstColumn, secondColumn;
      
      if (student.group) {
        // It's a group
        firstColumn = student.name; // Group name
        secondColumn = student.groupMembers && student.groupMembers.length > 0 
          ? student.groupMembers.filter(m => m.trim()).join(', ')
          : 'Sin integrantes especificados';
      } else {
        // It's an individual student
        firstColumn = student.name; // Student name
        secondColumn = 'N/A';
      }
      
      return [
        firstColumn,
        secondColumn,
        result ? (result.grade || 0).toString() : 'Pendiente',
        result && result.evaluatedAt ? new Date(result.evaluatedAt).toLocaleDateString('es-ES') : 'N/A'
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Estudiante/Grupo', 'Integrantes', 'Calificación', 'Fecha']],
      body: studentData,
      theme: 'grid',
      headStyles: { fillColor: [255, 152, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' }
      },
      didDrawCell: function(data: any) {
        // Color pending evaluations
        if (data.column.index === 2 && data.cell.text[0] === 'Pendiente') {
          data.cell.styles.fillColor = [255, 235, 238];
          data.cell.styles.textColor = [198, 40, 40];
        }
        // Color evaluated students
        else if (data.column.index === 2 && data.cell.text[0] !== 'Pendiente' && data.cell.text[0] !== 'Calificación') {
          data.cell.styles.fillColor = [232, 245, 233];
          data.cell.styles.textColor = [46, 125, 50];
        }
      }
    });

    // Add footer
    this.addFooter(doc);

    // Download
    const filename = `reporte_curso_${evaluation.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  }
} 