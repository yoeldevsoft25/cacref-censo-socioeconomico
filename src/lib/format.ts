export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatMoney(value: unknown): string {
  return `$${toNumber(value).toFixed(2)}`;
}

export function formatPercent(value: unknown, decimals = 1): string {
  const num = toNumber(value);
  return `${(num * 100).toFixed(decimals)}%`;
}

export function formatDate(value: unknown): string {
  if (!value) return 'N/D';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(value: unknown): string {
  if (!value) return 'N/D';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleString('es-VE', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function boolLabel(value: number | boolean | undefined | null): string {
  return Boolean(value) ? 'Si' : 'No';
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

export const WORKFLOW_STATUSES = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'] as const;
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];

export function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'EN_REVISION': return 'En revision';
    case 'COMITE': return 'En comite';
    case 'RESUELTO': return 'Resuelto';
    case 'DESCARTADO': return 'Descartado';
    default: return 'Registrado';
  }
}

export function workflowStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'EN_REVISION': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'COMITE': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'RESUELTO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'DESCARTADO': return 'bg-slate-200 text-slate-700 border-slate-300';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
