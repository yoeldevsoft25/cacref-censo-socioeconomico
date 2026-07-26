import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            CACREF &middot; Censo Socioeconomico y de Salud &middot; 2026
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <Link to="/metodologia" className="hover:text-red-600 transition-colors">Metodologia</Link>
            <span className="text-slate-300">·</span>
            <Link to="/privacidad" className="hover:text-red-600 transition-colors">Privacidad</Link>
            <span className="text-slate-300">·</span>
            <Link to="/legal" className="hover:text-red-600 transition-colors">Marco legal</Link>
            <span className="text-slate-300">·</span>
            <Link to="/transparencia" className="hover:text-red-600 transition-colors">Transparencia</Link>
            <span className="text-slate-300">·</span>
            <Link to="/consulta" className="hover:text-red-600 transition-colors">Consulta</Link>
          </div>
          <p className="text-xs text-slate-400">
            Hecho por <span className="font-semibold text-slate-700">Y.D.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
