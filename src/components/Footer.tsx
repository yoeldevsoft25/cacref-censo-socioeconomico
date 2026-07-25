export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          CACREF &middot; Censo Socioeconomico y de Salud &middot; 2026
        </p>
        <p className="text-xs text-slate-400">
          Hecho por <span className="font-semibold text-slate-700">Y.D.</span>
          <span className="mx-2">&middot;</span>
          <span>Metodologia abierta</span>
        </p>
      </div>
    </footer>
  );
}
