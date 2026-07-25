import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

function buildPageList(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 1) return [];
  const window: Array<number | 'ellipsis'> = [];

  const addPage = (n: number) => window.push(n);
  const addEllipsis = () => window.push('ellipsis');

  if (total <= 5) {
    for (let i = 1; i <= total; i += 1) addPage(i);
    return window;
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  addPage(1);
  if (start > 2) addEllipsis();
  for (let i = start; i <= end; i += 1) addPage(i);
  if (end < total - 1) addEllipsis();
  addPage(total);

  return window;
}

export default function Pagination({ page, totalPages, total, onPageChange }: Props) {
  const safeTotal = Math.max(0, total);
  const safePages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), safePages);

  const perPage = Math.max(1, Math.ceil(safeTotal / safePages));
  const from = safeTotal === 0 ? 0 : (current - 1) * perPage + 1;
  const to = safeTotal === 0 ? 0 : Math.min(safeTotal, current * perPage);

  const pages = buildPageList(current, safePages);
  const canPrev = current > 1;
  const canNext = current < safePages;

  const go = (n: number) => {
    if (n < 1 || n > safePages || n === current) return;
    onPageChange(n);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200">
      <p className="text-xs text-slate-500">
        {safeTotal === 0
          ? 'Sin resultados'
          : `Mostrando ${from}-${to} de ${safeTotal}`}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={!canPrev}
          aria-label="Pagina anterior"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span
              key={`e-${idx}`}
              className="inline-flex items-center justify-center w-8 h-8 text-xs text-slate-400"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-current={p === current ? 'page' : undefined}
              className={`inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                p === current
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-red-600'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={!canNext}
          aria-label="Pagina siguiente"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
