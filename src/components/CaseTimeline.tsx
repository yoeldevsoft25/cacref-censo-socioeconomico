import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Activity, CheckCircle2, FileText, MessageCircle, User, AlertTriangle, GitBranch, UserCheck, Mail } from 'lucide-react';
import { formatDateTime, workflowStatusLabel } from '../lib/format';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'comment' | 'decision' | 'created' | 'assigned';
  created_at: string;
  author?: string;
  author_role?: string;
  title?: string;
  body?: string;
  from_status?: string;
  to_status?: string;
}

const TYPE_STYLES: Record<string, { color: string; bg: string; ring: string; icon: typeof Activity }> = {
  status_change: { color: 'text-blue-600', bg: 'bg-blue-100', ring: 'ring-blue-200', icon: GitBranch },
  comment: { color: 'text-purple-600', bg: 'bg-purple-100', ring: 'ring-purple-200', icon: MessageCircle },
  decision: { color: 'text-emerald-600', bg: 'bg-emerald-100', ring: 'ring-emerald-200', icon: CheckCircle2 },
  created: { color: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200', icon: FileText },
  assigned: { color: 'text-amber-600', bg: 'bg-amber-100', ring: 'ring-amber-200', icon: UserCheck },
};

function eventDescription(ev: TimelineEvent): string {
  if (ev.type === 'status_change' && ev.from_status && ev.to_status) {
    return `Cambio de ${workflowStatusLabel(ev.from_status)} a ${workflowStatusLabel(ev.to_status)}`;
  }
  if (ev.type === 'status_change' && ev.to_status && !ev.from_status) {
    return `Inicio como ${workflowStatusLabel(ev.to_status)}`;
  }
  if (ev.type === 'decision') return 'Decision del comite registrada';
  if (ev.type === 'assigned') return 'Caso asignado';
  if (ev.type === 'created') return 'Censo registrado en el sistema';
  return ev.title;
}

interface Props {
  history: any[];
  comments: any[];
  decision?: { tipo: string; monto_aprobado: number; observaciones: string; decision_at: string } | null;
  assigned_to?: string | null;
  created_at?: string;
}

export default function CaseTimeline({ history, comments, decision, assigned_to, created_at }: Props) {
  const events: TimelineEvent[] = useMemo(() => {
    const all: TimelineEvent[] = [];

    if (created_at) {
      all.push({
        id: 'created',
        type: 'created',
        created_at: created_at,
        title: 'Censo registrado',
      });
    }

    if (assigned_to) {
      const assignEv = history.find(h => h.note && h.note.toLowerCase().includes('asignado'));
      all.push({
        id: 'assigned',
        type: 'assigned',
        created_at: assignEv?.changed_at || created_at || new Date().toISOString(),
        title: `Asignado a ${assigned_to}`,
      });
    }

    history.forEach((h: any) => {
      all.push({
        id: `h-${h.id}`,
        type: 'status_change',
        created_at: h.changed_at,
        from_status: h.from_status,
        to_status: h.to_status,
        author: 'Comite',
        body: h.note || undefined,
      });
    });

    if (decision && decision.decision_at) {
      all.push({
        id: 'decision',
        type: 'decision',
        created_at: decision.decision_at,
        author: 'Comite',
        body: `${decision.observaciones} - Monto: $${decision.monto_aprobado.toFixed(2)}`,
      });
    }

    comments.forEach((c: any) => {
      all.push({
        id: `c-${c.id}`,
        type: 'comment',
        created_at: c.created_at,
        author: c.author,
        author_role: c.author_role,
        body: c.body,
      });
    });

    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [history, comments, decision, assigned_to, created_at]);

  if (events.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sin eventos registrados.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
      <ul className="space-y-3">
        {events.map((ev, i) => {
          const style = TYPE_STYLES[ev.type];
          const Icon = style.icon;
          return (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="relative pl-10"
            >
              <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full ${style.bg} ${style.color} ring-4 ${style.ring} flex items-center justify-center`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-900">
                    {eventDescription(ev)}
                  </p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatDateTime(ev.created_at)}
                  </span>
                </div>
                {ev.author && (
                  <p className="text-[10px] text-slate-500 mb-1">
                    {ev.author}{ev.author_role && ` (${ev.author_role})`}
                  </p>
                )}
                {ev.body && (
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">
                    {ev.body}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
