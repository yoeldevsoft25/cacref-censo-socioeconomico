import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { generateCasePdf } from '../lib/pdf';

interface Props {
  submission: any;
  history?: any[];
  comments?: any[];
  files?: any[];
}

export default function CasePrintButton({ submission, history = [], comments = [], files = [] }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      generateCasePdf(submission, history, comments, files);
    } catch (err) {
      console.error(err);
      alert('Error al generar el PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      {loading ? 'Generando...' : 'Imprimir caso'}
    </button>
  );
}
