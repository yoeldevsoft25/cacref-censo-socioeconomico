import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from './format';

export function generateExecutivePdf(summary: any): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(18);
  doc.setTextColor(220, 38, 38);
  doc.text('CACREF', margin, 50);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Censo Socioeconomico y de Salud', margin, 68);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const date = new Date(summary.fecha_generacion || Date.now()).toLocaleString('es-VE');
  doc.text(`Generado: ${date}`, pageWidth - margin, 50, { align: 'right' });
  doc.text('Resumen Ejecutivo', pageWidth - margin, 68, { align: 'right' });

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  doc.line(margin, 80, pageWidth - margin, 80);

  let y = 110;

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Indicadores clave', margin, y);
  y += 18;

  const total = summary.total || 0;
  const semaforo = (() => {
    const r = total > 0 ? (summary.por_estado?.RESUELTO || 0) / total : 0;
    if (r >= 0.4) return 'AVANCE SALUDABLE';
    if (r >= 0.2) return 'AVANCE MODERADO';
    return 'ATENCION REQUERIDA';
  })();

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const kpis = [
    `Total procesados: ${total}`,
    `Prioridad alta: ${summary.por_recomendacion?.APROBADO_PRIORIDAD_ALTA || 0}`,
    `Aprobado condicional: ${summary.por_recomendacion?.APROBADO_CONDICIONAL || 0}`,
    `En comite: ${summary.por_recomendacion?.REQUIERE_COMITE || 0}`,
    `No elegible: ${summary.por_recomendacion?.NO_ELEGIBLE || 0}`,
    `Resueltos: ${summary.por_estado?.RESUELTO || 0}`,
    `Semaforo: ${semaforo}`,
    `Calidad de vida promedio: ${summary.calidad_vida_promedio}/10`,
    `Score promedio: ${summary.score_promedio}`,
    `Requieren medicamento: ${summary.total_con_medicamento_cronico}`,
    `Requieren cirugia: ${summary.total_con_cirugia}`,
    `Con familiar en asistencia: ${summary.total_con_familiar_asistencia}`,
  ];
  kpis.forEach((k) => {
    doc.text(`• ${k}`, margin, y);
    y += 14;
  });

  y += 12;
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Top gerencias con casos', margin, y);
  y += 8;

  const top = (summary.top_gerencias || []).slice(0, 10).map((g: any, i: number) => [
    String(i + 1),
    String(g.gerencia),
    String(g.total),
    String(g.ALTO),
    String(g.MEDIO),
    String(g.BAJO),
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [['#', 'Gerencia', 'Total', 'Alto', 'Medio', 'Bajo']],
    body: top.length ? top : [['-', 'Sin datos', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });

  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento confidencial. Uso interno CACREF. No sustituye evaluacion medica.', margin, footerY);
  doc.text('Generado con metodologia abierta - Y.D.', pageWidth - margin, footerY, { align: 'right' });

  const filename = `censo-ejecutivo-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function generateCasePdf(submission: any, history: any[], comments: any[], files: any[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const right = pageWidth - margin;

  doc.setFontSize(18);
  doc.setTextColor(220, 38, 38);
  doc.text('CACREF', margin, 50);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Ficha individual del censo', margin, 66);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, right, 50, { align: 'right' });
  doc.text(`Caso #${submission.id}`, right, 66, { align: 'right' });
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  doc.line(margin, 78, right, 78);

  let y = 100;
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(submission.nombre_apellido || 'Sin nombre', margin, y);
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`CI ${submission.cedula}  |  ${submission.gerencia || ''}  |  ${submission.cargo || ''}  |  ${submission.anos_servicio || 0} anos de servicio`, margin, y);
  y += 18;

  const statusLabel = (() => {
    const map: Record<string, string> = {
      REGISTRADO: 'Recibido',
      EN_REVISION: 'En revision',
      COMITE: 'En comite',
      RESUELTO: 'Resuelto',
      DESCARTADO: 'Descartado',
    };
    return map[submission.workflow_status] || submission.workflow_status || 'Sin estado';
  })();

  const decisionLabels: Record<string, string> = {
    MEDICAMENTO: 'Apoyo en medicamento',
    CIRUGIA: 'Apoyo en cirugia o procedimiento',
    APOYO_FAMILIAR: 'Apoyo familiar',
    OTRO: 'Otro tipo de apoyo',
  };

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Estado', statusLabel],
      ['Riesgo', submission.risk_level || 'N/D'],
      ['Recomendacion', submission.recommendation || 'N/D'],
      ['Score', `${Number(submission.score || 0).toFixed(1)} / 100`],
      ['Asignado a', submission.assigned_to || 'Sin asignar'],
      ['Afiliado CACREF', submission.afiliado_cacref ? 'Si' : 'No'],
      ['Ingreso individual', `$${Number(submission.ingreso_individual || 0).toFixed(2)}`],
      ['Ingreso familiar', `$${Number(submission.ingreso_familiar || 0).toFixed(2)}`],
      ['Aporte base 2%', `$${Number(submission.capacidad_cuota || 0).toFixed(2)}`],
      ['Requiere medicamento', submission.requiere_medicamento_cronico ? `Si: ${submission.medicamento_detalle || ''}` : 'No'],
      ['Requiere cirugia', submission.requiere_cirugia ? `Si: ${submission.cirugia_detalle || ''}` : 'No'],
      ['Familiar con asistencia', submission.familiar_requiere_asistencia ? 'Si' : 'No'],
      ['Calidad de vida', `${submission.calidad_vida_escala || 0} / 10`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  if (submission.decision_tipo) {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Decision del comite', margin, y);
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`${decisionLabels[submission.decision_tipo] || submission.decision_tipo}  -  $${Number(submission.decision_monto || 0).toFixed(2)}`, margin, y);
    y += 12;
    if (submission.decision_observaciones) {
      doc.setTextColor(71, 85, 105);
      const splitObs = doc.splitTextToSize(submission.decision_observaciones, pageWidth - 2 * margin);
      doc.text(splitObs, margin, y);
      y += splitObs.length * 12;
    }
    y += 8;
  }

  if (history && history.length > 0) {
    if (y > 680) { doc.addPage(); y = 50; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Historial del workflow', margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [['Fecha', 'De', 'A', 'Nota']],
      body: history.map(h => [
        formatDateTime(h.changed_at),
        h.from_status || '-',
        h.to_status,
        h.note || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (comments && comments.length > 0) {
    if (y > 680) { doc.addPage(); y = 50; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Discusion del comite', margin, y);
    y += 8;
    comments.forEach((c: any) => {
      if (y > 740) { doc.addPage(); y = 50; }
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${c.author} (${c.author_role}) - ${formatDateTime(c.created_at)}`, margin, y);
      y += 11;
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const splitBody = doc.splitTextToSize(c.body, pageWidth - 2 * margin);
      doc.text(splitBody, margin, y);
      y += splitBody.length * 11 + 8;
    });
  }

  if (files && files.length > 0) {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Archivos adjuntos', margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [['Tipo', 'Archivo', 'Tamano']],
      body: files.map((f: any) => [
        f.file_type,
        f.original_name,
        `${(Number(f.size_bytes) / 1024).toFixed(1)} KB`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento confidencial. Uso interno CACREF. No sustituye evaluacion medica.', margin, footerY);
    doc.text(`Pagina ${i} de ${pageCount}  -  Generado por Y.D.`, right, footerY, { align: 'right' });
  }

  const filename = `caso-${submission.id}-${(submission.nombre_apellido || 'censado').toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
