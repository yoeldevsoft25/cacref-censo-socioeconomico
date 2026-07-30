import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Mail, X, UserCheck } from 'lucide-react';
import { workflowStatusLabel, workflowStatusColor, WORKFLOW_STATUSES, type WorkflowStatus } from '../lib/format';
import { COMMITTEE_MEMBERS } from '../lib/committee';
import DecisionCloseoutModal from './DecisionCloseoutModal';

interface Props {
  submissionId: number;
  status: string;
  currentAssignee?: string | null;
  hasDecision?: boolean;
  onChange: () => void;
  align?: 'left' | 'right';
}

export default function WorkflowStatusControl({ submissionId, status, currentAssignee, hasDecision, onChange, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<WorkflowStatus | null>(null);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState<string>(currentAssignee || '');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decisionModal, setDecisionModal] = useState(false);

  const handleSelect = (newStatus: WorkflowStatus) => {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    setPending(newStatus);
    if (newStatus === 'RESUELTO' && !hasDecision) {
      setDecisionModal(true);
    }
  };

  const handleDecisionConfirm = async (decision: { tipo: string; monto_aprobado: number; observaciones: string }) => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: pending,
          note: note || null,
          assigned_to: assignee || null,
          decision,
          send_email: sendEmail,
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setOpen(false);
      setDecisionModal(false);
      setPending(null);
      setNote('');
      onChange();
    } catch (err) {
      console.error(err);
      alert('Error al cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: pending,
          note: note || null,
          assigned_to: assignee || null,
          send_email: sendEmail,
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setOpen(false);
      setPending(null);
      setNote('');
      onChange();
    } catch (err) {
      console.error(err);
      alert('Error al cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${workflowStatusColor(status)} hover:opacity-80 transition-opacity`}
        >
          {workflowStatusLabel(status)}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={`absolute z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-xl border border-slate-200 shadow-2xl p-3 ${align === 'left' ? 'left-0' : 'right-0'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">Cambiar estado</span>
                <button onClick={() => { setOpen(false); setPending(null); setNote(''); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {!pending ? (
                <div className="grid grid-cols-1 gap-1">
                  {WORKFLOW_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleSelect(s)}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between ${s === status ? 'bg-slate-50' : ''}`}
                    >
                      <span className={workflowStatusColor(s).split(' ')[1]}>{workflowStatusLabel(s)}</span>
                      {s === 'RESUELTO' && !hasDecision && (
                        <span className="text-[10px] text-emerald-600 font-semibold">requiere decision</span>
                      )}
                      {s === status && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    Cambiar a <strong>{workflowStatusLabel(pending)}</strong>
                  </p>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Asignar a miembro del comite</label>
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400"
                    >
                      <option value="">Sin asignar</option>
                      {COMMITTEE_MEMBERS.map(m => (
                        <option key={m.id} value={m.name}>{m.name} - {m.role}</option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nota (opcional, maximo 500 caracteres)"
                    maxLength={500}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg resize-none h-16 focus:outline-none focus:border-red-400"
                  />

                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-3.5 h-3.5 accent-red-600"
                    />
                    <Mail className="w-3 h-3" />
                    Notificar al trabajador por email
                  </label>

                  {pending === 'RESUELTO' && !hasDecision && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800">
                      Al confirmar, se abrira el formulario de decision del comite.
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPending(null)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Atras
                    </button>
                    <button
                      onClick={pending === 'RESUELTO' && !hasDecision ? () => setDecisionModal(true) : handleConfirm}
                      disabled={saving}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DecisionCloseoutModal
        open={decisionModal}
        onClose={() => setDecisionModal(false)}
        onConfirm={handleDecisionConfirm}
      />
    </>
  );
}
