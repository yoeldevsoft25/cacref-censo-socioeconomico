import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X } from 'lucide-react';
import { DECISION_TIPOS } from '../lib/committee';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (decision: { tipo: string; monto_aprobado: number; observaciones: string }) => Promise<void>;
}

export default function DecisionCloseoutModal({ open, onClose, onConfirm }: Props) {
  const [tipo, setTipo] = useState<string>('MEDICAMENTO');
  const [monto, setMonto] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum < 0) {
      alert('Indica un monto valido.');
      return;
    }
    if (!observaciones.trim()) {
      alert('Las observaciones del comite son obligatorias.');
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ tipo, monto_aprobado: montoNum, observaciones: observaciones.trim() });
      setTipo('MEDICAMENTO');
      setMonto('');
      setObservaciones('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <button
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Cerrar"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">Cierre del comite</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Decision formal sobre el caso</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Tipo de apoyo aprobado</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {DECISION_TIPOS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Monto aprobado (USD)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-emerald-600 font-bold text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Observaciones del comite *</label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Fundamento de la decision, condiciones, vigencia..."
                    maxLength={1000}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Confirmar decision'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
