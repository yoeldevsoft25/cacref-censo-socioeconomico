import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  days: number;
  status: string;
  sla?: 'ON_TRACK' | 'WARNING' | 'OVERDUE';
}

export default function SlaBadge({ days, status, sla }: Props) {
  if (status === 'RESUELTO' || status === 'DESCARTADO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
        <CheckCircle2 className="w-3 h-3" />
        Cerrado
      </span>
    );
  }

  const computed: 'ON_TRACK' | 'WARNING' | 'OVERDUE' = sla || (() => {
    if (status === 'COMITE' && days > 7) return 'OVERDUE';
    if (status === 'COMITE' && days > 3) return 'WARNING';
    if (['EN_REVISION', 'REGISTRADO'].includes(status) && days > 5) return 'WARNING';
    return 'ON_TRACK';
  })();

  const styles = {
    ON_TRACK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
    OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  }[computed];

  const Icon = computed === 'OVERDUE' ? AlertTriangle : Clock;
  const label = days <= 0 ? 'Hoy' : `${days} dia${days === 1 ? '' : 's'}`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
