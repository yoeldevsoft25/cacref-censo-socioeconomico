import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@cacref-salud.example.com';
const SENDER_NAME = process.env.SENDER_NAME || 'CACREF - Censo de Salud';

const resend: Resend | null = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const STATUS_LABELS: Record<string, string> = {
  REGISTRADO: 'Recibido',
  EN_REVISION: 'En revision',
  COMITE: 'En evaluacion por el comite',
  RESUELTO: 'Resuelto',
  DESCARTADO: 'Descartado',
};

const DECISION_LABELS: Record<string, string> = {
  MEDICAMENTO: 'Apoyo en medicamento',
  CIRUGIA: 'Apoyo en cirugia o procedimiento',
  APOYO_FAMILIAR: 'Apoyo familiar',
  OTRO: 'Otro tipo de apoyo',
};

function statusTemplate(opts: {
  nombre: string;
  status: string;
  note: string | null;
  decision: { tipo: string; monto_aprobado: number; observaciones: string } | null;
}): { subject: string; html: string; text: string } {
  const label = STATUS_LABELS[opts.status] || opts.status;
  const decisionBlock = opts.decision
    ? `<tr><td style="padding:12px;background:#f0fdf4;border-radius:8px;margin-top:12px">
        <p style="margin:0;font-size:14px;color:#166534"><strong>Decision del comite</strong></p>
        <p style="margin:6px 0 0 0;font-size:14px;color:#15803d">${DECISION_LABELS[opts.decision.tipo] || opts.decision.tipo}</p>
        <p style="margin:6px 0 0 0;font-size:20px;color:#15803d"><strong>$${opts.decision.monto_aprobado.toFixed(2)}</strong></p>
        ${opts.decision.observaciones ? `<p style="margin:6px 0 0 0;font-size:13px;color:#475569">${opts.decision.observaciones}</p>` : ''}
      </td></tr>`
    : '';

  const noteBlock = opts.note
    ? `<tr><td style="padding:12px;background:#f8fafc;border-radius:8px;margin-top:12px">
        <p style="margin:0;font-size:13px;color:#475569"><strong>Nota:</strong> ${opts.note}</p>
      </td></tr>`
    : '';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
      <div style="border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:16px">
        <h1 style="margin:0;font-size:18px;color:#dc2626">CACREF - Censo Socioeconomico y de Salud</h1>
      </div>
      <p style="font-size:15px;color:#0f172a">Hola <strong>${opts.nombre}</strong>,</p>
      <p style="font-size:15px;color:#0f172a">Tu censo ha sido actualizado al estado:</p>
      <div style="padding:14px 18px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:bold;color:#7f1d1d">${label}</p>
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:0 8px">${decisionBlock}${noteBlock}</table>
      <p style="font-size:13px;color:#64748b;margin-top:24px">Puedes consultar el estado de tu caso en cualquier momento en <a href="http://localhost:7842/consulta" style="color:#dc2626">nuestro portal de consulta</a> con tu numero de cedula.</p>
      <p style="font-size:13px;color:#64748b">Si tienes preguntas, contactanos a traves de tu gerencia.</p>
      <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:12px">
        <p style="font-size:11px;color:#94a3b8;margin:0">Documento generado automaticamente. Confidencial - uso interno CACREF.</p>
      </div>
    </div>`;

  const decisionText = opts.decision
    ? `\nDecision del comite: ${DECISION_LABELS[opts.decision.tipo] || opts.decision.tipo}\nMonto aprobado: $${opts.decision.monto_aprobado.toFixed(2)}\n${opts.decision.observaciones ? `Observaciones: ${opts.decision.observaciones}\n` : ''}`
    : '';
  const noteText = opts.note ? `\nNota: ${opts.note}\n` : '';

  const text = `Hola ${opts.nombre},

Tu censo ha sido actualizado al estado: ${label}
${noteText}${decisionText}

Consulta el estado en: http://localhost:7842/consulta

CACREF - Censo Socioeconomico y de Salud`;

  return {
    subject: `[CACREF] Tu censo: ${label}`,
    html,
    text,
  };
}

export async function sendStatusEmail(opts: {
  to: string;
  nombre: string;
  status: string;
  note: string | null;
  decision: { tipo: string; monto_aprobado: number; observaciones: string } | null;
}): Promise<{ sent: boolean; mocked: boolean; reason?: string; messageId?: string }> {
  const tpl = statusTemplate(opts);

  if (!resend) {
    console.log(`[EMAIL MOCK] To: ${opts.to} | Subject: ${tpl.subject}`);
    return { sent: false, mocked: true, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: opts.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    return { sent: true, mocked: false, messageId: (result as any).data?.id || 'unknown' };
  } catch (err: any) {
    console.error('Resend error:', err);
    return { sent: false, mocked: false, reason: err.message || 'Send failed' };
  }
}
