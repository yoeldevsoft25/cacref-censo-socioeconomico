import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, CheckCircle2, Clock, Users, Pill, Stethoscope, Heart, TrendingUp, FileText, Shield } from 'lucide-react';

const GERENCIA_COLORS = ['#dc2626', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

interface TransparencyData {
  total: number;
  generados: string | null;
  actualizados: string | null;
  resueltos: number;
  en_proceso: number;
  tasa_resolucion: number;
  por_estado: Record<string, number>;
  por_gerencia: Array<{ gerencia: string; total: number; resueltos: number }>;
  tiempos_promedio_dias: Record<string, number>;
  necesidades: { medicamento_cronico: number; cirugia: number; familiar_asistencia: number };
  generado_en: string;
}

export default function TransparencyPage() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/transparencia')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center text-slate-500">Cargando datos publicos...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center text-slate-500">Error al cargar datos.</div>
    );
  }

  const estadoLabels: Record<string, string> = {
    REGISTRADO: 'Recibidos',
    EN_REVISION: 'En revision',
    COMITE: 'En comite',
    RESUELTO: 'Resueltos',
    DESCARTADO: 'Descartados',
  };

  const maxGerencia = Math.max(1, ...data.por_gerencia.map(g => g.total));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver al censo
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-4">
            <Activity className="w-3.5 h-3.5 text-red-600" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-700">Transparencia</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Censo en cifras
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Datos agregados del proceso de censo socioeconomico y de salud. Sin informacion personal.
            Actualizado periodicamente.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-red-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Censos recibidos</span>
            </div>
            <p className="text-3xl font-display font-bold text-slate-900">{data.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resueltos</span>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-700">{data.resueltos}</p>
            <p className="text-xs text-slate-500 mt-1">{data.tasa_resolucion}% del total</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">En proceso</span>
            </div>
            <p className="text-3xl font-display font-bold text-blue-700">{data.en_proceso}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tiempo medio</span>
            </div>
            <p className="text-3xl font-display font-bold text-purple-700">
              {data.tiempos_promedio_dias.RESUELTO || data.tiempos_promedio_dias.EN_REVISION || 0}
              <span className="text-base text-slate-400 ml-1">d</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Promedio en estado</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Distribucion por estado</h2>
            <div className="space-y-3">
              {Object.entries(data.por_estado).map(([key, value]) => {
                const pct = data.total > 0 ? (Number(value) / data.total) * 100 : 0;
                const colors: Record<string, string> = {
                  REGISTRADO: 'bg-slate-400',
                  EN_REVISION: 'bg-blue-500',
                  COMITE: 'bg-amber-500',
                  RESUELTO: 'bg-emerald-500',
                  DESCARTADO: 'bg-slate-300',
                };
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-700 font-medium">{estadoLabels[key]}</span>
                      <span className="font-semibold text-slate-900">{String(value)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[key]} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Necesidades declaradas</h2>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 p-3 bg-red-50/50 border border-red-100 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Medicamento cronico</p>
                  <p className="text-xl font-bold text-slate-900">{data.necesidades.medicamento_cronico}</p>
                </div>
                <span className="text-xs text-slate-500">{data.total > 0 ? ((data.necesidades.medicamento_cronico / data.total) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Cirugia o procedimiento</p>
                  <p className="text-xl font-bold text-slate-900">{data.necesidades.cirugia}</p>
                </div>
                <span className="text-xs text-slate-500">{data.total > 0 ? ((data.necesidades.cirugia / data.total) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Familiar con asistencia</p>
                  <p className="text-xl font-bold text-slate-900">{data.necesidades.familiar_asistencia}</p>
                </div>
                <span className="text-xs text-slate-500">{data.total > 0 ? ((data.necesidades.familiar_asistencia / data.total) * 100).toFixed(0) : 0}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Censos por gerencia</h2>
          <div className="space-y-2.5">
            {data.por_gerencia.map((g, i) => {
              const pct = (g.total / maxGerencia) * 100;
              const resPct = g.total > 0 ? (g.resueltos / g.total) * 100 : 0;
              return (
                <div key={g.gerencia}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{g.gerencia}</span>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-900">{g.total}</span> censos &middot; <span className="text-emerald-700">{g.resueltos}</span> resueltos
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: GERENCIA_COLORS[i % GERENCIA_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Periodo</span>
            </div>
            <p className="text-sm text-slate-700">
              Primer censo: <span className="font-semibold">{data.generados ? new Date(data.generados).toLocaleDateString('es-VE') : 'N/D'}</span>
            </p>
            <p className="text-sm text-slate-700">
              Ultimo censo: <span className="font-semibold">{data.actualizados ? new Date(data.actualizados).toLocaleDateString('es-VE') : 'N/D'}</span>
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Privacidad</span>
            </div>
            <p className="text-sm text-slate-700">Esta pagina NO muestra datos personales. Solo agregadosanonimos.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actualizado</span>
            </div>
            <p className="text-sm text-slate-700">{new Date(data.generado_en).toLocaleString('es-VE')}</p>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-200">
          Datos publicados por CACREF. Hecho por Y.D. · Metodologia abierta.
        </div>
      </div>
    </div>
  );
}
