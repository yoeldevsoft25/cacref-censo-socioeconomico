import { useEffect, useMemo, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import { GERENCIA_OPTIONS } from '../data/catalog';
import {
  Activity,
  Briefcase,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  Pill,
  Shield,
  Star,
  Upload,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import RecommendationPie from './Charts/RecommendationPie';
import GerenciaBar from './Charts/GerenciaBar';
import QualityOfLifeHistogram from './Charts/QualityOfLifeHistogram';
import WorkflowStatusControl from './WorkflowStatusControl';
import ExecutiveSummary from './ExecutiveSummary';
import PdfExportButton from './PdfExportButton';
import SlaBadge from './SlaBadge';
import DocumentAttachMock from './DocumentAttachMock';
import Pagination from './Pagination';
import SearchBar from './SearchBar';
import CommentsThread from './CommentsThread';
import BulkImportModal from './BulkImportModal';
import CasePrintButton from './CasePrintButton';
import CaseTimeline from './CaseTimeline';

interface Submission {
  id: number;
  nombre_apellido: string;
  cedula: string;
  telefono: string;
  correo: string;
  vicepresidencia?: string | null;
  direccion_ejecutiva?: string | null;
  gerencia: string;
  unidad_operativa?: string | null;
  anos_servicio: number;
  cargo: string;
  ingreso_individual: number;
  ingreso_familiar: number;
  afiliado_cacref: number | boolean;
  capacidad_cuota: number;
  requiere_medicamento_cronico: number | boolean;
  medicamento_detalle?: string | null;
  requiere_cirugia: number | boolean;
  cirugia_detalle?: string | null;
  familiar_requiere_asistencia: number | boolean;
  calidad_vida_escala: number;
  score: number;
  score_seniority?: number;
  score_payment_capacity?: number;
  score_affordability?: number;
  score_health_need?: number;
  score_cooperative_bonus?: number;
  risk_level?: 'BAJO' | 'MEDIO' | 'ALTO';
  recommendation?: 'APROBADO_PRIORIDAD_ALTA' | 'APROBADO_CONDICIONAL' | 'REQUIERE_COMITE' | 'NO_ELEGIBLE';
  affordability_ratio?: number;
  suggested_max_quota?: number;
  priority_bucket?: number;
  workflow_status?: string;
  workflow_notes?: string | null;
  workflow_updated_at?: string | null;
  decision_tipo?: string | null;
  decision_monto?: number | null;
  decision_observaciones?: string | null;
  decision_at?: string | null;
  assigned_to?: string | null;
  has_document?: number | boolean;
  days_in_state?: number;
  sla?: 'ON_TRACK' | 'WARNING' | 'OVERDUE';
  created_at: string;
}

interface Insights {
  total?: number | null;
  prioridad_alta?: number | null;
  condicional?: number | null;
  comite?: number | null;
  no_elegible?: number | null;
  score_promedio?: number | null;
  cuota_promedio?: number | null;
  ratio_cuota_ingreso_promedio?: number | null;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolLabel(value: number | boolean | undefined | null) {
  return Boolean(value) ? 'Si' : 'No';
}

function formatMoney(value: unknown) {
  return `$${toNumber(value).toFixed(2)}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function DataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-900 break-words">{value ?? 'N/D'}</p>
    </div>
  );
}

const ROLE_HIERARCHY: Record<string, number> = { capturista: 1, vocal: 2, presidente: 3, director: 4 };
function canDo(role: string | undefined, required: string): boolean {
  if (!role) return false;
  return (ROLE_HIERARCHY[role] || 0) >= (ROLE_HIERARCHY[required] || 0);
}

export default function AdminDashboard({ user }: { user?: { username: string; role: string; name: string } }) {
  const userRole = user?.role;
  const canMakeDecision = canDo(userRole, 'vocal');
  const canSeeAudit = canDo(userRole, 'director');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [insights, setInsights] = useState<Insights>({});
  const [executiveSummary, setExecutiveSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [activeTab, setActiveTab] = useState<'operativo' | 'ejecutivo'>('operativo');
  const [submissionFiles, setSubmissionFiles] = useState<any[]>([]);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [filters, setFilters] = useState({
    gerencia: '',
    minIngreso: '',
    maxIngreso: '',
    recommendation: '',
    riskLevel: '',
    assignedTo: '',
  });

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.gerencia.trim()) queryParams.append('gerencia', filters.gerencia.trim());
      if (filters.minIngreso) queryParams.append('minIngreso', filters.minIngreso);
      if (filters.maxIngreso) queryParams.append('maxIngreso', filters.maxIngreso);
      if (filters.recommendation) queryParams.append('recommendation', filters.recommendation);
      if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);
      if (filters.assignedTo.trim()) queryParams.append('assignedTo', filters.assignedTo.trim());
      if (search.trim()) queryParams.append('search', search.trim());
      queryParams.append('page', String(page));
      queryParams.append('limit', '50');

      const [submissionsResponse, insightsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/admin/submissions?${queryParams.toString()}`),
        fetch('/api/admin/insights'),
        fetch('/api/admin/executive-summary'),
      ]);

      const submissionsData = await submissionsResponse.json();
      const insightsData = await insightsResponse.json();
      const summaryData = await summaryResponse.json();
      setSubmissions(submissionsData?.data || []);
      setTotal(submissionsData?.total || 0);
      setTotalPages(submissionsData?.total_pages || 1);
      setInsights(insightsData || {});
      setExecutiveSummary(summaryData || null);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [filters, page, search]);

  useEffect(() => {
    if (selectedSubmission) {
      fetch(`/api/admin/submissions/${selectedSubmission.id}/files`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => setSubmissionFiles(Array.isArray(data) ? data : []))
        .catch(() => setSubmissionFiles([]));
    } else {
      setSubmissionFiles([]);
    }
  }, [selectedSubmission?.id, selectedSubmission?.has_document]);

  const [caseHistory, setCaseHistory] = useState<any[]>([]);
  useEffect(() => {
    if (selectedSubmission) {
      fetch(`/api/admin/submissions/${selectedSubmission.id}/history`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => setCaseHistory(Array.isArray(data) ? data : []))
        .catch(() => setCaseHistory([]));
    } else {
      setCaseHistory([]);
    }
  }, [selectedSubmission?.id]);

  const [caseComments, setCaseComments] = useState<any[]>([]);
  useEffect(() => {
    if (selectedSubmission) {
      fetch(`/api/admin/submissions/${selectedSubmission.id}/comments`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => setCaseComments(Array.isArray(data) ? data : []))
        .catch(() => setCaseComments([]));
    } else {
      setCaseComments([]);
    }
  }, [selectedSubmission?.id]);

  const filteredHealthSummary = useMemo(() => {
    return submissions.reduce(
      (acc, sub) => {
        if (Boolean(sub.requiere_medicamento_cronico)) acc.medicamentos += 1;
        if (Boolean(sub.requiere_cirugia)) acc.cirugias += 1;
        if (Boolean(sub.familiar_requiere_asistencia)) acc.familiares += 1;
        return acc;
      },
      { medicamentos: 0, cirugias: 0, familiares: 0 }
    );
  }, [submissions]);

  const handleFilterChange = (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const recommendationLabel = (recommendation?: Submission['recommendation']) => {
    switch (recommendation) {
      case 'APROBADO_PRIORIDAD_ALTA':
        return 'Prioridad Alta';
      case 'APROBADO_CONDICIONAL':
        return 'Aprobado Condicional';
      case 'REQUIERE_COMITE':
        return 'Revision Comite';
      case 'NO_ELEGIBLE':
        return 'No Elegible';
      default:
        return 'Sin Clasificar';
    }
  };

  const recommendationClass = (recommendation?: Submission['recommendation']) => {
    switch (recommendation) {
      case 'APROBADO_PRIORIDAD_ALTA':
        return 'bg-emerald-100 text-emerald-800';
      case 'APROBADO_CONDICIONAL':
        return 'bg-blue-100 text-blue-800';
      case 'REQUIERE_COMITE':
        return 'bg-amber-100 text-amber-800';
      case 'NO_ELEGIBLE':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const riskClass = (risk?: Submission['risk_level']) => {
    switch (risk) {
      case 'BAJO':
        return 'bg-emerald-100 text-emerald-700';
      case 'MEDIO':
        return 'bg-amber-100 text-amber-700';
      case 'ALTO':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const exportCsv = () => {
    if (!submissions.length) return;

    const columns: Array<[keyof Submission, string]> = [
      ['id', 'ID'],
      ['created_at', 'Fecha'],
      ['nombre_apellido', 'Nombre'],
      ['cedula', 'Cedula'],
      ['telefono', 'Telefono'],
      ['correo', 'Correo'],
      ['vicepresidencia', 'Vicepresidencia'],
      ['direccion_ejecutiva', 'Direccion Ejecutiva'],
      ['gerencia', 'Gerencia'],
      ['unidad_operativa', 'Unidad Operativa'],
      ['cargo', 'Cargo'],
      ['anos_servicio', 'Anos Servicio'],
      ['ingreso_individual', 'Ingreso Individual'],
      ['ingreso_familiar', 'Ingreso Familiar'],
      ['capacidad_cuota', 'Aporte Base 2%'],
      ['afiliado_cacref', 'Afiliado CACREF'],
      ['requiere_medicamento_cronico', 'Medicamento Cronico'],
      ['medicamento_detalle', 'Detalle Medicamento'],
      ['requiere_cirugia', 'Cirugia'],
      ['cirugia_detalle', 'Detalle Cirugia'],
      ['familiar_requiere_asistencia', 'Familiar Asistencia'],
      ['calidad_vida_escala', 'Calidad Vida'],
      ['risk_level', 'Riesgo'],
      ['recommendation', 'Recomendacion'],
      ['score', 'Score'],
    ];

    const csv = [
      columns.map(([, label]) => csvEscape(label)).join(','),
      ...submissions.map((row) =>
        columns
          .map(([key]) => {
            const value = row[key];
            if (typeof value === 'boolean') return csvEscape(value ? 'Si' : 'No');
            if (key === 'afiliado_cacref' || key === 'requiere_medicamento_cronico' || key === 'requiere_cirugia' || key === 'familiar_requiere_asistencia') {
              return csvEscape(boolLabel(value as number | boolean));
            }
            return csvEscape(value);
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `censo-salud-cacref-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string | number;
    icon: ComponentType<{ className?: string }>;
  }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-display font-bold text-slate-900">{value}</p>
        </div>
        <div className="h-11 w-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <BulkImportModal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onComplete={fetchDashboard}
      />
      {!canMakeDecision && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>Tu rol (<strong>{userRole}</strong>) solo permite lectura y movimiento a <strong>En revision</strong>. Las decisiones del comite requieren rol de Vocal o superior.</span>
        </div>
      )}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard de Censo Socioeconomico y Salud</h1>
          <p className="text-sm text-slate-500 mt-1">
            Priorizacion administrativa de necesidades declaradas por trabajadores y afiliados CACREF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMakeDecision && (
            <button
              type="button"
              onClick={() => setShowBulkImport(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </button>
          )}
          <PdfExportButton summary={executiveSummary} />
          <button
            type="button"
            onClick={exportCsv}
            disabled={!submissions.length}
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('operativo')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'operativo' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Operativo
        </button>
        <button
          onClick={() => setActiveTab('ejecutivo')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'ejecutivo' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Resumen Ejecutivo
        </button>
      </div>

      {activeTab === 'ejecutivo' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <ExecutiveSummary summary={executiveSummary} />
        </div>
      )}

      {activeTab === 'operativo' && (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Registros" value={toNumber(insights.total)} icon={Users} />
        <StatCard label="Prioridad Alta" value={toNumber(insights.prioridad_alta)} icon={Star} />
        <StatCard label="Medicamentos" value={filteredHealthSummary.medicamentos} icon={Pill} />
        <StatCard label="Cirugias" value={filteredHealthSummary.cirugias} icon={HeartPulse} />
      </div>

      {executiveSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Distribucion por Recomendacion</h3>
              <span className="text-xs text-slate-400">{executiveSummary.total} registros</span>
            </div>
            <RecommendationPie data={executiveSummary.por_recomendacion} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Riesgo por Gerencia</h3>
              <span className="text-xs text-slate-400">Top {executiveSummary.top_gerencias?.length || 0}</span>
            </div>
            <GerenciaBar data={executiveSummary.top_gerencias || []} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Calidad de Vida</h3>
              <span className="text-xs text-slate-400">Promedio {executiveSummary.calidad_vida_promedio}/10</span>
            </div>
            <QualityOfLifeHistogram values={submissions.map(s => Number(s.calidad_vida_escala))} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-medium">
          <Filter className="h-5 w-5 text-slate-500" />
          Filtros de evaluacion
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gerencia</label>
            <select
              name="gerencia"
              value={filters.gerencia}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="">Todas las gerencias</option>
              {GERENCIA_OPTIONS.filter((g) => g !== '').map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ingreso Minimo ($)</label>
            <input
              type="number"
              name="minIngreso"
              value={filters.minIngreso}
              onChange={handleFilterChange}
              placeholder="Ej. 500"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ingreso Maximo ($)</label>
            <input
              type="number"
              name="maxIngreso"
              value={filters.maxIngreso}
              onChange={handleFilterChange}
              placeholder="Ej. 2000"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recomendacion</label>
            <select
              name="recommendation"
              value={filters.recommendation}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="">Todas</option>
              <option value="APROBADO_PRIORIDAD_ALTA">Prioridad Alta</option>
              <option value="APROBADO_CONDICIONAL">Aprobado Condicional</option>
              <option value="REQUIERE_COMITE">Revision Comite</option>
              <option value="NO_ELEGIBLE">No Elegible</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Riesgo</label>
            <select
              name="riskLevel"
              value={filters.riskLevel}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="">Todos</option>
              <option value="BAJO">Bajo</option>
              <option value="MEDIO">Medio</option>
              <option value="ALTO">Alto</option>
            </select>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, cedula o gerencia..." />
          <div className="w-full sm:w-72">
            <label className="block text-xs font-medium text-slate-600 mb-1">Asignado a miembro del comite</label>
            <select
              name="assignedTo"
              value={filters.assignedTo}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="">Todos</option>
              <option value="Maria Rodriguez">Maria Rodriguez</option>
              <option value="Carlos Mendez">Carlos Mendez</option>
              <option value="Ana Torres">Ana Torres</option>
              <option value="Luis Gonzalez">Luis Gonzalez</option>
              <option value="Pedro Ramirez">Pedro Ramirez</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Postulante</span>
            <span className="hidden md:flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Laboral</span>
            <span className="hidden lg:flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Aporte</span>
            <span>Acciones</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500">Cargando datos...</div>
          ) : submissions.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">No se encontraron registros con los filtros actuales.</div>
          ) : (
            submissions.map((sub) => {
              const hasMedication = Boolean(sub.requiere_medicamento_cronico);
              const hasSurgery = Boolean(sub.requiere_cirugia);
              const hasFamilySupport = Boolean(sub.familiar_requiere_asistencia);
              const score = toNumber(sub.score);

              return (
                <div key={sub.id} className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,auto)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{sub.nombre_apellido}</p>
                      {sub.has_document ? <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">CI: {sub.cedula}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{sub.gerencia}</p>
                    <p className="text-xs text-slate-500">{sub.anos_servicio} años de servicio</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">Ingreso: {formatMoney(sub.ingreso_individual)}</p>
                    <p className="text-xs text-slate-500">Aporte base 2%: {formatMoney(sub.capacidad_cuota)}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {hasMedication && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">Medicamento</span>}
                      {hasSurgery && <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Cirugía</span>}
                      {hasFamilySupport && <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">Familiar</span>}
                      {!hasMedication && !hasSurgery && !hasFamilySupport && (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">Sin alerta</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Calidad de vida: {toNumber(sub.calidad_vida_escala, 5)}/10</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch lg:justify-center">
                    <div className="min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-red-700">{score.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">/ 100</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-red-600" style={{ width: `${Math.min(score, 100)}%` }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${recommendationClass(sub.recommendation)}`}>
                        {recommendationLabel(sub.recommendation)}
                      </span>
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${riskClass(sub.risk_level)}`}>
                        {sub.risk_level || 'N/D'}
                      </span>
                      <SlaBadge days={toNumber(sub.days_in_state, 0)} status={sub.workflow_status || 'REGISTRADO'} sla={sub.sla} />
                    </div>

                    {sub.assigned_to && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <UserCheck className="h-3 w-3" />
                        <span className="truncate">{sub.assigned_to}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <WorkflowStatusControl
                        submissionId={sub.id}
                        status={sub.workflow_status || 'REGISTRADO'}
                        currentAssignee={sub.assigned_to}
                        hasDecision={Boolean(sub.decision_tipo)}
                        onChange={fetchDashboard}
                        align="left"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedSubmission(sub)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-red-300 hover:text-red-700"
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>
      </>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px]"
            onClick={() => setSelectedSubmission(null)}
            aria-label="Cerrar detalle"
          />
          <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Detalle completo del registro</h3>
                <p className="text-sm text-slate-500">{selectedSubmission.nombre_apellido} - CI {selectedSubmission.cedula}</p>
              </div>
              <div className="flex items-center gap-2">
                <CasePrintButton
                  submission={selectedSubmission}
                  history={caseHistory}
                  comments={caseComments}
                  files={submissionFiles}
                />
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:text-red-600 hover:border-red-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Datos Personales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <DataItem label="Nombre" value={selectedSubmission.nombre_apellido} />
                  <DataItem label="Cedula" value={selectedSubmission.cedula} />
                  <DataItem label="Telefono" value={selectedSubmission.telefono} />
                  <DataItem label="Correo" value={selectedSubmission.correo} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Vinculacion CACREF</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <DataItem label="Afiliado CACREF" value={boolLabel(selectedSubmission.afiliado_cacref)} />
                  <DataItem label="Vicepresidencia" value={selectedSubmission.vicepresidencia || 'N/D'} />
                  <DataItem label="Direccion Ejecutiva" value={selectedSubmission.direccion_ejecutiva || 'N/D'} />
                  <DataItem label="Gerencia" value={selectedSubmission.gerencia} />
                  <DataItem label="Unidad Operativa" value={selectedSubmission.unidad_operativa || 'N/D'} />
                  <DataItem label="Cargo" value={selectedSubmission.cargo} />
                  <DataItem label="Anos de Servicio" value={selectedSubmission.anos_servicio} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Situacion Socioeconomica</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <DataItem label="Ingreso Individual" value={formatMoney(selectedSubmission.ingreso_individual)} />
                  <DataItem label="Ingreso Familiar" value={formatMoney(selectedSubmission.ingreso_familiar)} />
                  <DataItem label="Aporte base 2%" value={formatMoney(selectedSubmission.capacidad_cuota)} />
                  <DataItem
                    label="Ratio Aporte/Ingreso"
                    value={
                      typeof selectedSubmission.affordability_ratio === 'number'
                        ? `${(selectedSubmission.affordability_ratio * 100).toFixed(1)}%`
                        : 'N/D'
                    }
                  />
                  <DataItem
                    label="Aporte Sugerido"
                    value={
                      typeof selectedSubmission.suggested_max_quota === 'number'
                        ? formatMoney(selectedSubmission.suggested_max_quota)
                        : 'N/D'
                    }
                  />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Salud y Calidad de Vida</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <DataItem label="Medicamento Cronico" value={boolLabel(selectedSubmission.requiere_medicamento_cronico)} />
                  <DataItem label="Detalle Medicamento" value={selectedSubmission.medicamento_detalle || 'N/D'} />
                  <DataItem label="Cirugia o Procedimiento" value={boolLabel(selectedSubmission.requiere_cirugia)} />
                  <DataItem label="Detalle Cirugia" value={selectedSubmission.cirugia_detalle || 'N/D'} />
                  <DataItem label="Familiar con Asistencia" value={boolLabel(selectedSubmission.familiar_requiere_asistencia)} />
                  <DataItem label="Calidad de Vida" value={`${toNumber(selectedSubmission.calidad_vida_escala, 5)} / 10`} />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Evaluacion</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <DataItem label="Score Total" value={`${toNumber(selectedSubmission.score).toFixed(1)} / 100`} />
                  <DataItem label="Necesidad de Salud" value={`${toNumber(selectedSubmission.score_health_need).toFixed(1)} pts`} />
                  <DataItem label="Riesgo" value={selectedSubmission.risk_level || 'N/D'} />
                  <DataItem label="Recomendacion" value={recommendationLabel(selectedSubmission.recommendation)} />
                  <DataItem label="Prioridad" value={selectedSubmission.priority_bucket ?? 'N/D'} />
                  <DataItem label="Fecha Registro" value={selectedSubmission.created_at} />
                </div>
              </section>

              {selectedSubmission.workflow_status && (
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-3">Workflow del Comite</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <DataItem label="Estado actual" value={
                      <span className="inline-flex items-center gap-2">
                        <WorkflowStatusControl
                          submissionId={selectedSubmission.id}
                          status={selectedSubmission.workflow_status || 'REGISTRADO'}
                          currentAssignee={selectedSubmission.assigned_to}
                          hasDecision={Boolean(selectedSubmission.decision_tipo)}
                          onChange={() => { fetchDashboard(); setSelectedSubmission(null); }}
                        />
                      </span>
                    } />
                    <DataItem label="Asignado a" value={selectedSubmission.assigned_to || 'Sin asignar'} />
                    <DataItem label="Dias en estado" value={`${toNumber(selectedSubmission.days_in_state, 0)} dias`} />
                    {selectedSubmission.decision_tipo && (
                      <>
                        <DataItem label="Decision - Tipo" value={selectedSubmission.decision_tipo} />
                        <DataItem label="Decision - Monto" value={formatMoney(selectedSubmission.decision_monto)} />
                        <DataItem label="Decision - Fecha" value={selectedSubmission.decision_at || 'N/D'} />
                      </>
                    )}
                  </div>
                  {selectedSubmission.decision_observaciones && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 mb-1">Observaciones del comite</p>
                      <p className="text-sm text-emerald-900">{selectedSubmission.decision_observaciones}</p>
                    </div>
                  )}
                  {selectedSubmission.workflow_notes && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 mb-1">Ultima nota</p>
                      <p className="text-sm text-slate-800">{selectedSubmission.workflow_notes}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <DocumentAttachMock
                      submissionId={selectedSubmission.id}
                      attached={Boolean(selectedSubmission.has_document)}
                      onChange={() => { setSelectedSubmission({ ...selectedSubmission, has_document: !selectedSubmission.has_document }); fetchDashboard(); }}
                    />
                  </div>

                  {submissionFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 mb-2">
                        Archivos adjuntos ({submissionFiles.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {submissionFiles.map((f) => {
                          const typeLabels: Record<string, string> = {
                            CEDULA: 'Cédula',
                            MEDICAMENTO: 'Receta médica',
                            CIRUGIA: 'Informe médico',
                            FAMILIAR: 'Doc. familiar',
                            OTRO: 'Otro',
                          };
                          const sizeKb = (Number(f.size_bytes) / 1024).toFixed(1);
                          const isImage = String(f.mime_type || '').startsWith('image/');
                          return (
                            <AttachmentCard
                              key={String(f.id)}
                              file={f}
                              isImage={isImage}
                              typeLabel={typeLabels[f.file_type] || f.file_type}
                              sizeLabel={`${sizeKb} KB`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-white border border-slate-200 rounded-xl">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" />
                      Linea de tiempo del caso
                    </h4>
                    <CaseTimeline
                      history={caseHistory}
                      comments={caseComments}
                      decision={selectedSubmission.decision_tipo ? {
                        tipo: selectedSubmission.decision_tipo,
                        monto_aprobado: selectedSubmission.decision_monto || 0,
                        observaciones: selectedSubmission.decision_observaciones || '',
                        decision_at: selectedSubmission.decision_at,
                      } : null}
                      assigned_to={selectedSubmission.assigned_to}
                      created_at={selectedSubmission.created_at}
                    />
                  </div>

                  {user && (
                    <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <CommentsThread
                        submissionId={selectedSubmission.id}
                        currentUser={user}
                        canComment={canMakeDecision}
                      />
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      <AttachmentLightbox />
    </div>
  );
}

/**
 * Card para un archivo adjunto. Si es imagen muestra thumbnail; si no, ícono + nombre.
 * Al click abre un lightbox (si es imagen) o descarga/abre en pestaña nueva.
 */
function AttachmentCard({
  file,
  isImage,
  typeLabel,
  sizeLabel,
}: {
  file: any;
  isImage: boolean;
  typeLabel: string;
  sizeLabel: string;
  key?: string;
}) {
  const open = useAttachmentLightbox();
  const filename: string = file.original_name || file.id || 'archivo';
  return (
    <button
      type="button"
      onClick={() => {
        if (isImage) {
          open({ url: file.url, name: filename, mime: file.mime_type });
        } else {
          window.open(file.url, '_blank', 'noopener,noreferrer');
        }
      }}
      className="group flex flex-col items-stretch text-left rounded-xl border border-slate-200 hover:border-red-300 hover:shadow-md transition-all overflow-hidden bg-white"
    >
      <div className="aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img
            src={file.url}
            alt={filename}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <FileText className="w-8 h-8" />
            <span className="text-[10px] uppercase tracking-wider">PDF/Doc</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold text-slate-900 truncate" title={filename}>{filename}</p>
        <p className="text-[10px] text-slate-500">{typeLabel} · {sizeLabel}</p>
      </div>
    </button>
  );
}

/**
 * Lightbox simple para previsualizar imágenes adjuntas en pantalla completa.
 * Implementado como un context simple para evitar acoplar el modal al componente principal.
 */
type LightboxState = { url: string; name: string; mime: string } | null;
let _lightboxSetter: (s: LightboxState) => void = () => {};
export function useAttachmentLightbox() {
  return (state: LightboxState) => _lightboxSetter(state);
}
function AttachmentLightbox() {
  const [state, setState] = useState<LightboxState>(null);
  _lightboxSetter = setState;
  if (!state) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setState(null)}
    >
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 text-white">
          <p className="text-sm font-semibold truncate pr-4">{state.name}</p>
          <div className="flex items-center gap-2">
            <a
              href={state.url}
              download={state.name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </a>
            <button
              onClick={() => setState(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
          <img src={state.url} alt={state.name} className="max-w-full max-h-[80vh] object-contain" />
        </div>
      </div>
    </div>
  );
}
