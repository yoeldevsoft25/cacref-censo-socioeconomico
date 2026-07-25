import { useEffect, useState } from 'react';
import { Activity, Filter, Shield, User, LogIn, LogOut, FileEdit, FilePlus, FileMinus, Eye, FileText } from 'lucide-react';
import { formatDateTime } from '../lib/format';

interface AuditEntry {
  id: number;
  actor: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: typeof LogIn }> = {
  login_success: { label: 'Inicio de sesion', color: 'bg-emerald-100 text-emerald-800', icon: LogIn },
  login_failed: { label: 'Login fallido', color: 'bg-red-100 text-red-800', icon: LogIn },
  logout: { label: 'Cierre de sesion', color: 'bg-slate-100 text-slate-700', icon: LogOut },
  status_change: { label: 'Cambio de estado', color: 'bg-blue-100 text-blue-800', icon: FileEdit },
  file_upload: { label: 'Subida de archivo', color: 'bg-amber-100 text-amber-800', icon: FilePlus },
  file_attach: { label: 'Adjuntar doc', color: 'bg-amber-100 text-amber-800', icon: FilePlus },
  file_detach: { label: 'Quitar doc', color: 'bg-slate-100 text-slate-700', icon: FileMinus },
  worker_lookup: { label: 'Consulta publica', color: 'bg-purple-100 text-purple-800', icon: Eye },
  submission_created: { label: 'Censo creado', color: 'bg-emerald-100 text-emerald-800', icon: FileText },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  director: { label: 'Director', color: 'bg-purple-100 text-purple-800' },
  presidente: { label: 'Presidente', color: 'bg-blue-100 text-blue-800' },
  vocal: { label: 'Vocal', color: 'bg-amber-100 text-amber-800' },
  capturista: { label: 'Capturista', color: 'bg-slate-100 text-slate-700' },
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterActor) params.append('actor', filterActor);
      if (filterAction) params.append('action', filterAction);
      params.append('page', String(page));
      params.append('limit', '50');

      const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      setEntries(data?.data || []);
      setTotal(data?.total || 0);
      setTotalPages(data?.total_pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [page, filterActor, filterAction]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 mb-2">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-700">Auditoria</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bitacora de acceso y cambios</h1>
          <p className="text-sm text-slate-500 mt-1">
            Trazabilidad inmutable de todas las acciones administrativas. {total} eventos registrados.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-slate-800 font-medium text-sm">
          <Filter className="h-4 w-4 text-slate-500" />
          Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={filterActor}
            onChange={(e) => { setFilterActor(e.target.value); setPage(1); }}
            placeholder="Usuario (admin, presidente...)"
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Todas las acciones</option>
            <option value="login_success">Inicio de sesion</option>
            <option value="login_failed">Login fallido</option>
            <option value="status_change">Cambio de estado</option>
            <option value="file_upload">Subida de archivo</option>
            <option value="file_attach">Adjuntar doc</option>
            <option value="worker_lookup">Consulta publica</option>
            <option value="submission_created">Censo creado</option>
          </select>
          <button
            onClick={() => { setFilterActor(''); setFilterAction(''); setPage(1); }}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cuando</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quien</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Accion</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Detalle</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">Cargando auditoria...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">Sin eventos registrados.</td>
                </tr>
              ) : (
                entries.map((e) => {
                  const actionInfo = ACTION_LABELS[e.action] || { label: e.action, color: 'bg-slate-100 text-slate-700', icon: Activity };
                  const roleInfo = ROLE_LABELS[e.actor_role] || { label: e.actor_role, color: 'bg-slate-100 text-slate-700' };
                  const Icon = actionInfo.icon;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-900">{e.actor}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${actionInfo.color}`}>
                          <Icon className="w-3 h-3" />
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {e.target_type && (
                          <span className="text-slate-500">{e.target_type} #{e.target_id}</span>
                        )}
                        {e.details && (
                          <div className="mt-1 text-[10px] text-slate-500 truncate max-w-md" title={e.details}>
                            {e.details}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{e.ip || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Pagina {page} de {totalPages} ({total} eventos)</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
