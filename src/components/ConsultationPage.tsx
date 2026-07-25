import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, Search, ShieldCheck, UserCheck, Clock, AlertTriangle, CheckCircle2, XCircle, FileText, DollarSign, Download, ClipboardCheck, Trash2 } from 'lucide-react';

type WorkflowStatus = 'REGISTRADO' | 'EN_REVISION' | 'COMITE' | 'RESUELTO' | 'DESCARTADO';
type Sla = 'ON_TRACK' | 'WARNING' | 'OVERDUE';

interface Decision {
  tipo: string;
  monto_aprobado: number;
  observaciones?: string | null;
}

interface CensusStatus {
  found: boolean;
  nombre_apellido?: string;
  cedula?: string;
  gerencia?: string;
  status?: WorkflowStatus;
  status_label?: string;
  assigned_to?: string | null;
  days_in_state?: number;
  sla?: Sla;
  decision?: Decision | null;
  submitted_at?: string;
}

interface TimelineStep {
  key: WorkflowStatus;
  label: string;
  short: string;
}

const TIMELINE: TimelineStep[] = [
  { key: 'REGISTRADO', label: 'Registrado', short: 'Recibimos tu censo y validamos los datos basicos.' },
  { key: 'EN_REVISION', label: 'En revision', short: 'El equipo administrativo verifica la documentacion.' },
  { key: 'COMITE', label: 'Comite', short: 'El comite evalua tu caso.' },
  { key: 'RESUELTO', label: 'Resuelto', short: 'Caso cerrado con decision del comite.' },
  { key: 'DESCARTADO', label: 'Descartado', short: 'Caso descartado por el comite.' },
];

const SLA_STYLES: Record<Sla, { label: string; bg: string; text: string; border: string }> = {
  ON_TRACK: { label: 'En tiempo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  WARNING: { label: 'Por vencer', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  OVERDUE: { label: 'Vencido', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

function formatMoney(value: number) {
  const parsed = Number(value);
  return `$${Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: WorkflowStatus | undefined) {
  switch (status) {
    case 'EN_REVISION':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'COMITE':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'RESUELTO':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'DESCARTADO':
      return 'bg-slate-200 text-slate-700 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function stepVisuals(step: WorkflowStatus, current: WorkflowStatus | undefined) {
  const order = TIMELINE.findIndex((s) => s.key === step);
  const currentOrder = current ? TIMELINE.findIndex((s) => s.key === current) : -1;
  const isCurrent = step === current;
  const isPast = currentOrder >= 0 && order < currentOrder;
  const isFuture = currentOrder >= 0 && order > currentOrder;

  if (isCurrent) {
    return {
      dotClass: 'bg-red-600 ring-4 ring-red-100 scale-110',
      iconClass: 'text-white',
      Icon: ClipboardCheck,
      labelClass: 'text-red-700 font-semibold',
    };
  }
  if (isPast) {
    return {
      dotClass: 'bg-red-500',
      iconClass: 'text-white',
      Icon: CheckCircle2,
      labelClass: 'text-slate-700',
    };
  }
  if (isFuture) {
    return {
      dotClass: 'bg-white border-2 border-slate-300',
      iconClass: 'text-slate-400',
      Icon: Clock,
      labelClass: 'text-slate-400',
    };
  }
  return {
    dotClass: 'bg-white border-2 border-slate-300',
    iconClass: 'text-slate-400',
    Icon: Clock,
    labelClass: 'text-slate-400',
  };
}

export default function ConsultationPage() {
  const [cedula, setCedula] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<CensusStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = cedula.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/census/status/${encodeURIComponent(trimmed)}`);
      const json = (await res.json().catch(() => ({}))) as CensusStatus;
      if (!res.ok) {
        throw new Error('No se pudo obtener el estado. Intenta de nuevo.');
      }
      setData(json);
    } catch (err) {
      console.error(err);
      setError('No pudimos conectar con el servidor. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setCedula('');
    setData(null);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-red-50/40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al censo
        </a>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-4">
            <Search className="w-3.5 h-3.5 text-red-600" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-700">
              Consulta de estado
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-black text-slate-950 tracking-tight">
            Consulta el estado de tu censo
          </h1>
          <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-xl">
            Ingresa tu numero de cedula para ver en que etapa se encuentra tu solicitud y si ya
            tienes una decision del comite.
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="cedula" className="block">
              <span className="text-sm font-semibold text-slate-700 mb-2 block">
                Numero de cedula
              </span>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej. 12345678"
                disabled={submitting}
                className="w-full text-center text-2xl sm:text-3xl font-display font-bold tracking-wider px-5 py-5 sm:py-6 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/10 transition-all placeholder:font-normal placeholder:text-slate-300 disabled:opacity-60"
              />
            </label>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !cedula.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-red-600/25 hover:shadow-red-600/35 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Consultar estado
                  </>
                )}
              </button>
              {(data || error) && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>
        </section>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-6 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-5"
            >
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-800">{error}</p>
            </motion.div>
          )}

          {data && !data.found && (
            <motion.div
              key="not-found"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center"
            >
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Search className="w-6 h-6 text-slate-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No encontramos tu censo</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                No encontramos un censo con esa cedula. Verifica e intenta de nuevo.
              </p>
            </motion.div>
          )}

          {data && data.found && (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="mt-6 space-y-6"
            >
              <section className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl shadow-lg shadow-red-600/20 p-6 sm:p-8 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-red-100 mb-2">
                      Trabajador identificado
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold leading-tight break-words">
                      {data.nombre_apellido}
                    </h2>
                    <p className="mt-2 text-sm text-red-100">
                      CI {data.cedula} · {data.gerencia}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${statusBadgeClass(data.status)}`}
                  >
                    {data.status_label ?? 'Sin estado'}
                  </span>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-6">
                  Progreso del caso
                </h3>
                <ol className="space-y-5">
                  {TIMELINE.map((step, idx) => {
                    const visuals = stepVisuals(step.key, data.status);
                    const isLast = idx === TIMELINE.length - 1;
                    return (
                      <li key={step.key} className="relative flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${visuals.dotClass}`}
                          >
                            <visuals.Icon className={`w-5 h-5 ${visuals.iconClass}`} />
                          </div>
                          {!isLast && (
                            <div
                              className={`w-0.5 flex-1 min-h-6 mt-2 ${idx < (data.status ? TIMELINE.findIndex((s) => s.key === data.status) : -1) ? 'bg-red-300' : 'bg-slate-200'}`}
                            />
                          )}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className={`text-sm ${visuals.labelClass}`}>{step.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{step.short}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Asignado a</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {data.assigned_to ?? 'Pendiente de asignar'}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Dias en este estado</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {typeof data.days_in_state === 'number' ? `${data.days_in_state} dia${data.days_in_state === 1 ? '' : 's'}` : 'N/D'}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {data.sla === 'OVERDUE' ? (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    ) : data.sla === 'WARNING' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">SLA</p>
                  </div>
                  {data.sla ? (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${SLA_STYLES[data.sla].bg} ${SLA_STYLES[data.sla].text} ${SLA_STYLES[data.sla].border}`}
                    >
                      {SLA_STYLES[data.sla].label}
                    </span>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">N/D</p>
                  )}
                </div>
              </section>

              {data.decision && (
                <section className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">
                        Decision del comite
                      </p>
                      <h3 className="text-lg font-display font-bold text-slate-900">
                        {data.decision.tipo}
                      </h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">
                          Monto aprobado
                        </p>
                      </div>
                      <p className="text-xl font-display font-bold text-slate-900">
                        {formatMoney(data.decision.monto_aprobado)}
                      </p>
                    </div>
                    {data.decision.observaciones && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                          Observaciones
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {data.decision.observaciones}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {data.submitted_at && (
                <p className="text-xs text-slate-400 text-center">
                  Censo recibido el {formatDateTime(data.submitted_at)}
                </p>
              )}

              <section className="bg-blue-50/50 border border-blue-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-900">Tus derechos ARCO (LOPDP)</h3>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Conforme a la Ley Organica de Proteccion de Datos Personales, tienes derecho a acceder, rectificar, cancelar u oponerte al tratamiento de tus datos.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/census/export/${data.cedula}`, { method: 'POST' });
                        if (!res.ok) throw new Error('Error');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `mis-datos-${data.cedula}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert('Error al exportar');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar mis datos (JSON)
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Esta accion anonimizara permanentemente sus datos personales. Es IRREVERSIBLE. Desea continuar?')) return;
                      const token = window.prompt('Para confirmar, escriba ELIMINAR en mayusculas:');
                      if (token !== 'ELIMINAR') {
                        alert('Confirmacion cancelada o incorrecta.');
                        return;
                      }
                      try {
                        const res = await fetch(`/api/census/delete/${data.cedula}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ confirm: 'ELIMINAR' }),
                        });
                        if (!res.ok) throw new Error('Error');
                        alert('Sus datos han sido anonimizados. Esta consulta ya no mostrara detalles.');
                        window.location.reload();
                      } catch (err) {
                        alert('Error al eliminar');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Solicitar eliminacion de mis datos
                  </button>
                </div>
              </section>

              <section className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Esta consulta solo muestra el estado administrativo de tu censo. No expone
                  detalles clinicos ni informacion de terceros. Si necesitas una actualizacion,
                  contacta directamente al equipo de CACREF.
                </p>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
