import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@futpvcacref.com';
const SENDER_NAME = process.env.SENDER_NAME || 'CACREF - Censo de Salud';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://futpvcacref.com').replace(/\/+$/, '');
const RESEND_AUDIENCE_COERCION = process.env.RESEND_AUDIENCE_ID || null;

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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskCedula(value: string): string {
  const clean = String(value || '').replace(/\D/g, '');
  if (clean.length <= 4) return clean || 'N/D';
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

function formatMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isReservedRecipient(to: string): boolean {
  const domain = String(to || '').split('@').pop()?.toLowerCase();
  return Boolean(domain && (
    domain === 'example.com' ||
    domain === 'example.org' ||
    domain === 'example.net' ||
    domain === 'localhost' ||
    domain.endsWith('.test') ||
    domain.endsWith('.invalid')
  ));
}

function baseEmailLayout(opts: {
  preheader: string;
  title: string;
  badge: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}) {
  const cta = opts.ctaLabel && opts.ctaHref
    ? `<tr>
        <td align="center" style="padding:24px 0 8px 0">
          <a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:20px;padding:13px 22px;border-radius:8px">
            ${escapeHtml(opts.ctaLabel)}
          </a>
        </td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(opts.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;margin:0;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
            <tr>
              <td style="background:#0f2340;padding:20px 24px;border-bottom:4px solid #b91c1c">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <p style="margin:0;color:#ffffff;font-size:18px;line-height:24px;font-weight:800;letter-spacing:.2px">CACREF Salud</p>
                      <p style="margin:4px 0 0 0;color:#cbd5e1;font-size:12px;line-height:18px">Censo socioeconómico, salud y bienestar</p>
                    </td>
                    <td align="right" style="vertical-align:middle">
                      <span style="display:inline-block;background:#ffffff;color:#0f2340;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px">${escapeHtml(opts.badge)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${opts.body}
            ${cta}
            <tr>
              <td style="padding:20px 24px 24px 24px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb">
                  <tr>
                    <td style="padding-top:16px">
                      <p style="margin:0;color:#64748b;font-size:11px;line-height:17px">
                        ${escapeHtml(opts.footerNote || 'Mensaje automático de CACREF. No responda a este correo.')}
                      </p>
                      <p style="margin:8px 0 0 0;color:#94a3b8;font-size:11px;line-height:17px">
                        La información del censo es tratada con fines institucionales internos y conforme a la política de privacidad aplicable.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function confirmationTemplate(opts: {
  nombre: string;
  cedula: string;
  submissionId: number | string;
  gerencia: string;
  aporteBase: number;
  filesAttached: number;
}): { subject: string; html: string; text: string } {
  const nombre = escapeHtml(opts.nombre);
  const consultaUrl = `${APP_BASE_URL}/consulta`;
  const html = baseEmailLayout({
    preheader: 'CACREF recibió correctamente tu censo de salud y bienestar.',
    title: 'Confirmación de censo recibido',
    badge: 'Registro recibido',
    ctaLabel: 'Consultar estado',
    ctaHref: consultaUrl,
    footerNote: 'Este correo confirma la recepción del formulario. No implica aprobación automática de beneficios, préstamos o ayudas.',
    body: `
      <tr>
        <td style="padding:28px 24px 8px 24px">
          <h1 style="margin:0;color:#0f2340;font-size:24px;line-height:31px;font-weight:800">Formulario recibido correctamente</h1>
          <p style="margin:14px 0 0 0;color:#334155;font-size:15px;line-height:23px">Hola <strong>${nombre}</strong>,</p>
          <p style="margin:8px 0 0 0;color:#334155;font-size:15px;line-height:23px">
            CACREF recibió tu información para el censo socioeconómico, de salud y bienestar. El caso queda registrado para revisión administrativa, priorización interna y seguimiento por los responsables autorizados.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 0 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden">
            <tr>
              <td style="background:#f8fafc;padding:12px 14px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase">Código de registro</td>
              <td style="background:#f8fafc;padding:12px 14px;color:#0f2340;font-size:14px;font-weight:800;text-align:right">CACREF-${escapeHtml(opts.submissionId)}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;color:#64748b;font-size:13px;border-top:1px solid #e5e7eb">Cédula</td>
              <td style="padding:12px 14px;color:#111827;font-size:13px;border-top:1px solid #e5e7eb;text-align:right">${escapeHtml(maskCedula(opts.cedula))}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;color:#64748b;font-size:13px;border-top:1px solid #e5e7eb">Gerencia</td>
              <td style="padding:12px 14px;color:#111827;font-size:13px;border-top:1px solid #e5e7eb;text-align:right">${escapeHtml(opts.gerencia || 'No especificada')}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;color:#64748b;font-size:13px;border-top:1px solid #e5e7eb">Aporte base estimado</td>
              <td style="padding:12px 14px;color:#111827;font-size:13px;border-top:1px solid #e5e7eb;text-align:right">${formatMoney(opts.aporteBase)} <span style="color:#64748b">(2%)</span></td>
            </tr>
            <tr>
              <td style="padding:12px 14px;color:#64748b;font-size:13px;border-top:1px solid #e5e7eb">Soportes adjuntos</td>
              <td style="padding:12px 14px;color:#111827;font-size:13px;border-top:1px solid #e5e7eb;text-align:right">${opts.filesAttached}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 0 24px">
          <div style="background:#fef2f2;border-left:4px solid #b91c1c;border-radius:8px;padding:14px 16px">
            <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:20px">
              <strong>Importante:</strong> esta confirmación no representa aprobación automática. Medicamentos, cirugías, préstamos o apoyos especiales requieren revisión, validación y decisión conforme a las políticas de CACREF.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 0 24px">
          <p style="margin:0 0 8px 0;color:#0f2340;font-size:14px;font-weight:800">Próximos pasos</p>
          <ol style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:21px">
            <li>El equipo autorizado revisará que los datos estén completos.</li>
            <li>El caso será priorizado administrativamente según necesidad y criterios institucionales.</li>
            <li>Podrás consultar el estado con tu número de cédula en el portal.</li>
          </ol>
        </td>
      </tr>`,
  });

  const text = `Hola ${opts.nombre},

CACREF recibió correctamente tu censo socioeconómico, de salud y bienestar.

Código de registro: CACREF-${opts.submissionId}
Cédula: ${maskCedula(opts.cedula)}
Gerencia: ${opts.gerencia || 'No especificada'}
Aporte base estimado: ${formatMoney(opts.aporteBase)} (2%)
Soportes adjuntos: ${opts.filesAttached}

Esta confirmación no representa aprobación automática. Medicamentos, cirugías, préstamos o apoyos especiales requieren revisión, validación y decisión conforme a las políticas de CACREF.

Consulta el estado en: ${consultaUrl}

CACREF Salud`;

  return {
    subject: 'CACREF Salud: confirmación de formulario recibido',
    html,
    text,
  };
}

function statusTemplate(opts: {
  nombre: string;
  status: string;
  note: string | null;
  decision: { tipo: string; monto_aprobado: number; observaciones: string } | null;
}): { subject: string; html: string; text: string } {
  const label = escapeHtml(STATUS_LABELS[opts.status] || opts.status);
  const decisionBlock = opts.decision
    ? `<tr><td style="padding:12px;background:#f0fdf4;border-radius:8px;margin-top:12px">
        <p style="margin:0;font-size:14px;color:#166534"><strong>Decision del comite</strong></p>
        <p style="margin:6px 0 0 0;font-size:14px;color:#15803d">${escapeHtml(DECISION_LABELS[opts.decision.tipo] || opts.decision.tipo)}</p>
        <p style="margin:6px 0 0 0;font-size:20px;color:#15803d"><strong>${formatMoney(opts.decision.monto_aprobado)}</strong></p>
        ${opts.decision.observaciones ? `<p style="margin:6px 0 0 0;font-size:13px;color:#475569">${escapeHtml(opts.decision.observaciones)}</p>` : ''}
      </td></tr>`
    : '';

  const noteBlock = opts.note
    ? `<tr><td style="padding:12px;background:#f8fafc;border-radius:8px;margin-top:12px">
        <p style="margin:0;font-size:13px;color:#475569"><strong>Nota:</strong> ${escapeHtml(opts.note)}</p>
      </td></tr>`
    : '';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
      <div style="border-bottom:2px solid #dc2626;padding-bottom:12px;margin-bottom:16px">
        <h1 style="margin:0;font-size:18px;color:#dc2626">CACREF - Censo Socioeconomico y de Salud</h1>
      </div>
      <p style="font-size:15px;color:#0f172a">Hola <strong>${escapeHtml(opts.nombre)}</strong>,</p>
      <p style="font-size:15px;color:#0f172a">Tu censo ha sido actualizado al estado:</p>
      <div style="padding:14px 18px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;margin:16px 0">
        <p style="margin:0;font-size:18px;font-weight:bold;color:#7f1d1d">${label}</p>
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:0 8px">${decisionBlock}${noteBlock}</table>
      <p style="font-size:13px;color:#64748b;margin-top:24px">Puedes consultar el estado de tu caso en cualquier momento en <a href="${APP_BASE_URL}/consulta" style="color:#dc2626">nuestro portal de consulta</a> con tu numero de cedula.</p>
      <p style="font-size:13px;color:#64748b">Si tienes preguntas, contactanos a traves de tu gerencia.</p>
      <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:12px">
        <p style="font-size:11px;color:#94a3b8;margin:0">Documento generado automaticamente. Confidencial - uso interno CACREF.</p>
      </div>
    </div>`;

  const decisionText = opts.decision
    ? `\nDecision del comite: ${DECISION_LABELS[opts.decision.tipo] || opts.decision.tipo}\nMonto aprobado: ${formatMoney(opts.decision.monto_aprobado)}\n${opts.decision.observaciones ? `Observaciones: ${opts.decision.observaciones}\n` : ''}`
    : '';
  const noteText = opts.note ? `\nNota: ${opts.note}\n` : '';

  const text = `Hola ${opts.nombre},

Tu censo ha sido actualizado al estado: ${label}
${noteText}${decisionText}

Consulta el estado en: ${APP_BASE_URL}/consulta

CACREF - Censo Socioeconomico y de Salud`;

  return {
    subject: `[CACREF] Tu censo: ${label}`,
    html,
    text,
  };
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; mocked: boolean; reason?: string; messageId?: string }> {
  if (isReservedRecipient(opts.to)) {
    console.log(`[EMAIL SKIP] To: ${opts.to} | Subject: ${opts.subject} | Reserved recipient domain`);
    return { sent: false, mocked: true, reason: 'Dominio de correo reservado para pruebas. Use un correo real.' };
  }

  if (!resend) {
    console.log(`[EMAIL MOCK] To: ${opts.to} | Subject: ${opts.subject}`);
    return { sent: false, mocked: true, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { sent: true, mocked: false, messageId: (result as any).data?.id || 'unknown' };
  } catch (err: any) {
    console.error('Resend error:', err);
    return { sent: false, mocked: false, reason: err.message || 'Send failed' };
  }
}

export async function sendCensusConfirmationEmail(opts: {
  to: string;
  nombre: string;
  cedula: string;
  submissionId: number | string;
  gerencia: string;
  aporteBase: number;
  filesAttached: number;
}): Promise<{ sent: boolean; mocked: boolean; reason?: string; messageId?: string }> {
  const tpl = confirmationTemplate(opts);
  return sendEmail({ to: opts.to, ...tpl });
}

export async function sendStatusEmail(opts: {
  to: string;
  nombre: string;
  status: string;
  note: string | null;
  decision: { tipo: string; monto_aprobado: number; observaciones: string } | null;
}): Promise<{ sent: boolean; mocked: boolean; reason?: string; messageId?: string }> {
  const tpl = statusTemplate(opts);
  return sendEmail({ to: opts.to, ...tpl });
}
