import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Shield, TrendingUp, Users, FileText } from 'lucide-react';

const SCORING = [
  { name: 'Antiguedad', weight: 22, desc: 'Premia anos de servicio en la industria. Maximo 22 puntos a los 15 anos.' },
  { name: 'Capacidad de pago', weight: 28, desc: 'Ingreso individual declarado como referencia para programas posteriores. Maximo 28 puntos.' },
  { name: 'Aporte base', weight: 24, desc: 'Aporte institucional de 2% sobre ingreso individual. No representa aprobacion de prestamos.' },
  { name: 'Necesidad de salud', weight: 45, desc: 'Cirugia (25), medicamento (15), familiar (10), calidad de vida (ajuste).' },
  { name: 'Plus cooperativo', weight: 10, desc: 'Afiliado CACREF (6) + ratio de soporte familiar (4).' },
];

const RECOMMENDATIONS = [
  { key: 'Prioridad Alta', desc: 'Score >= 80 y riesgo bajo. Recomendado para aprobacion inmediata.' },
  { key: 'Aprobado Condicional', desc: 'Score 65-79 sin riesgo alto. Aprobado con seguimiento.' },
  { key: 'Comite', desc: 'Score 50-64 o score 65+ con riesgo alto. Requiere revision del comite.' },
  { key: 'No Elegible', desc: 'Score < 50. No cumple criterios administrativos minimos.' },
];

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver al censo
      </Link>

      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-4">
          <Brain className="w-3.5 h-3.5 text-red-600" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-red-700">Metodologia</span>
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Como evaluamos</h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          El sistema asigna a cada registro un puntaje administrativo entre 0 y 100 que ordena automaticamente la cola de atencion.
          No es un diagnostico medico ni una decision de aprobacion: es una herramienta de priorizacion institucional.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-red-600" />
          El scoring
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Componente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Peso max.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Descripcion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {SCORING.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-sm font-display font-bold text-red-600">+{s.weight}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-red-600" />
          Recomendaciones
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RECOMMENDATIONS.map((r) => (
            <div key={r.key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-1">{r.key}</h3>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-600" />
          Manejo de datos sensibles
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que recogemos:</strong> datos personales basicos, ingresos estimados, necesidades declaradas de salud y percepcion de calidad de vida.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que NO recogemos:</strong> historia clinica, diagnosticos confirmados, documentos medicos, numero de cuenta bancaria, datos de familiares menores.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Quien tiene acceso:</strong> solo personal autorizado de CACREF, autenticado, con bitacora de cambios.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que no hacemos:</strong> no compartimos con terceros, no usamos para scoring medico, no almacenamos fuera de la infraestructura controlada.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-red-600" />
          Decisiones que habilita
        </h2>
        <ul className="space-y-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <li className="flex gap-3"><span className="text-red-600 font-bold">-</span><span className="text-sm text-slate-700">Identificar quien requiere atencion prioritaria en medicamentos cronicos de alto costo.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">-</span><span className="text-sm text-slate-700">Detectar patrones de necesidad por gerencia o unidad operativa para asignar recursos.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">-</span><span className="text-sm text-slate-700">Construir un orden de atencion objetivo y trazable para el comite de evaluacion.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">-</span><span className="text-sm text-slate-700">Reportar a la junta directiva con datos agregados, no con casos individuales.</span></li>
        </ul>
      </section>

      <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
        Metodologia abierta y trazable. CACREF, 2026.
      </div>
    </div>
  );
}
