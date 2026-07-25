import { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, Check, Loader2, RotateCcw } from 'lucide-react';

interface Props {
  submissionId: number;
  attached: boolean;
  onChange: (attached: boolean) => void;
}

export default function DocumentAttachMock({ submissionId, attached, onChange }: Props) {
  const [busy, setBusy] = useState(false);

  const handleAttach = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/attach`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Error al adjuntar');
      await new Promise((resolve) => setTimeout(resolve, 600));
      onChange(true);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/detach`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Error al reemplazar');
      await new Promise((resolve) => setTimeout(resolve, 300));
      onChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (attached) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Informe adjunto</p>
            <p className="text-xs text-emerald-700">Documento guardado para este registro.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDetach}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          Reemplazar
        </button>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleAttach}
      disabled={busy}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-red-400 hover:bg-red-50/50 px-4 py-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {busy ? (
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      ) : (
        <Upload className="w-5 h-5 text-slate-500 group-hover:text-red-600 transition-colors" />
      )}
      <div className="text-left">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-red-700 transition-colors">
          {busy ? 'Adjuntando...' : 'Adjuntar informe medico'}
        </p>
        <p className="text-xs text-slate-500">PDF, JPG o PNG (max 5MB)</p>
      </div>
    </motion.button>
  );
}
