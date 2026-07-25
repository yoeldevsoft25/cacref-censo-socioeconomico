import { Activity, AlertCircle, CheckCircle2, Clock, Pill, Stethoscope, Users } from 'lucide-react';
import { formatPercent } from '../lib/format';

interface Props {
  summary: any;
}

export default function ExecutiveSummary({ summary }: Props) {
  if (!summary) return null;

  const total = summary.total || 0;
  const estados = summary.por_estado || {};
  const semaforo = (() => {
    const ratio = total > 0 ? (estados.RESUELTO || 0) / total : 0;
    if (ratio >= 0.4) return { color: 'emerald', label: 'Avance saludable', desc: 'Mas del 40% de los casos atendidos.' };
    if (ratio >= 0.2) return { color: 'amber', label: 'Avance moderado', desc: 'Entre 20% y 40% de los casos atendidos.' };
    return { color: 'red', label: 'Atencion requerida', desc: 'Menos del 20% de los casos atendidos.' };
  })();

  const semaforoCls = {
    emerald: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    amber: 'bg-amber-50 border-amber-300 text-amber-900',
    red: 'bg-red-50 border-red-300 text-red-900',
  }[semaforo.color];

  const kpis = [
    { label: 'Total procesados', value: total, icon: Users, color: 'red' },
    { label: 'Prioridad alta', value: summary.por_recomendacion?.APROBADO_PRIORIDAD_ALTA || 0, icon: AlertCircle, color: 'amber' },
    { label: 'Requieren comite', value: summary.por_recomendacion?.REQUIERE_COMITE || 0, icon: Clock, color: 'blue' },
    { label: 'Resueltos', value: estados.RESUELTO || 0, icon: CheckCircle2, color: 'emerald' },
    { label: 'Medicamento cronico', value: summary.total_con_medicamento_cronico || 0, icon: Pill, color: 'rose' },
    { label: 'Cirugia pendiente', value: summary.total_con_cirugia || 0, icon: Stethoscope, color: 'purple' },
    { label: 'Calidad vida promedio', value: `${summary.calidad_vida_promedio}/10`, icon: Activity, color: 'cyan' },
    { label: 'Score promedio', value: summary.score_promedio, icon: Activity, color: 'indigo' },
  ];

  const colorMap: Record<string, string> = {
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border-2 p-5 ${semaforoCls}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Semaforo institucional</p>
            <p className="text-lg font-bold mt-0.5">{semaforo.label}</p>
            <p className="text-xs mt-1 opacity-80">{semaforo.desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{k.label}</span>
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${colorMap[k.color]}`}>
                <k.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Por recomendacion</p>
          <div className="space-y-2">
            {Object.entries(summary.por_recomendacion || {}).map(([key, val]) => {
              const pct = total > 0 ? Number(val) / total : 0;
              const colors: Record<string, string> = {
                APROBADO_PRIORIDAD_ALTA: 'bg-emerald-500',
                APROBADO_CONDICIONAL: 'bg-blue-500',
                REQUIERE_COMITE: 'bg-amber-500',
                NO_ELEGIBLE: 'bg-red-500',
              };
              const labels: Record<string, string> = {
                APROBADO_PRIORIDAD_ALTA: 'Prioridad Alta',
                APROBADO_CONDICIONAL: 'Aprobado Condicional',
                REQUIERE_COMITE: 'Comite',
                NO_ELEGIBLE: 'No Elegible',
              };
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{labels[key]}</span>
                    <span className="font-semibold text-slate-900">{String(val)} ({formatPercent(pct, 0)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[key]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Por estado workflow</p>
          <div className="space-y-2">
            {Object.entries(summary.por_estado || {}).map(([key, val]) => {
              const pct = total > 0 ? Number(val) / total : 0;
              const colors: Record<string, string> = {
                REGISTRADO: 'bg-slate-400',
                EN_REVISION: 'bg-blue-500',
                COMITE: 'bg-amber-500',
                RESUELTO: 'bg-emerald-500',
                DESCARTADO: 'bg-slate-300',
              };
              const labels: Record<string, string> = {
                REGISTRADO: 'Registrado',
                EN_REVISION: 'En revision',
                COMITE: 'En comite',
                RESUELTO: 'Resuelto',
                DESCARTADO: 'Descartado',
              };
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{labels[key]}</span>
                    <span className="font-semibold text-slate-900">{String(val)} ({formatPercent(pct, 0)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[key]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Top gerencias</p>
          <div className="space-y-2">
            {(summary.top_gerencias || []).slice(0, 5).map((g: any) => (
              <div key={g.gerencia} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate flex-1">{g.gerencia}</span>
                <div className="flex gap-1">
                  {Number(g.ALTO) > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">{g.ALTO}A</span>}
                  {Number(g.MEDIO) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">{g.MEDIO}M</span>}
                  {Number(g.BAJO) > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">{g.BAJO}B</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
