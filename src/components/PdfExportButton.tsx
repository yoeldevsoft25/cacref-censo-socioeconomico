import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generateExecutivePdf } from '../lib/pdf';

interface Props {
  summary: any;
}

export default function PdfExportButton({ summary }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!summary) return;
    setLoading(true);
    try {
      generateExecutivePdf(summary);
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !summary}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? 'Generando...' : 'PDF Ejecutivo'}
    </button>
  );
}
