import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation } from 'react-router-dom';
import CensusForm from './components/CensusForm';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import Hero from './components/Hero';
import MethodologyPage from './components/MethodologyPage';
import Footer from './components/Footer';
import AuditLogPage from './components/AuditLogPage';
import TransparencyPage from './components/TransparencyPage';
import ConsultationPage from './components/ConsultationPage';
import NotificationBell from './components/NotificationBell';
import PrivacyPage from './components/PrivacyPage';

function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <img src="/Logo_Original.png" alt="CACREF" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
              <div className="h-6 w-px bg-slate-200" />
              <img src="/logo2.jpeg" alt="FUTPV" className="h-9 w-auto object-contain rounded-sm transition-transform group-hover:scale-105" />
            </Link>

            <div className="flex items-center gap-4">
              <Link
                to="/metodologia"
                className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                Metodologia
              </Link>
              <Link
                to="/consulta"
                className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                Consulta
              </Link>
              <Link
                to="/transparencia"
                className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                Transparencia
              </Link>
              <Link
                to="/privacidad"
                className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-wider"
              >
                Privacidad
              </Link>
              <span className="hidden sm:block text-xs font-medium text-slate-400 uppercase tracking-wider">
                Censo Socioeconómico y Salud
              </span>
              {!isHome && (
                <Link
                  to="/"
                  className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors uppercase tracking-wider"
                >
                  ← Inicio
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
      </nav>

      {isHome && <Hero />}
    </>
  );
}

function ProtectedAdminRoute() {
  const [session, setSession] = useState<{ user: { username: string; role: string; name: string } } | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            // /api/admin/me returns { ok, user }; normalize to { user }
            setSession(data?.user ? { user: data.user } : null);
          } else {
            setSession(null);
          }
        }
      } catch {
        if (!cancelled) setSession(null);
      }
    };
    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (session === 'loading') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-slate-500">
        Verificando sesion...
      </div>
    );
  }

  if (!session) {
    return <AdminLogin onLogin={() => window.location.reload()} />;
  }

  return (
    <div>
      <div className="flex justify-end items-center gap-3 px-4 sm:px-6 lg:px-8 mb-2 pt-2">
        <NotificationBell />
        <span className="inline-flex items-center gap-2 text-xs">
          <span className="text-slate-500">Sesion:</span>
          <span className="font-semibold text-slate-700">{session.user.name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
            session.user.role === 'director' ? 'bg-purple-100 text-purple-800' :
            session.user.role === 'presidente' ? 'bg-blue-100 text-blue-800' :
            session.user.role === 'vocal' ? 'bg-amber-100 text-amber-800' :
            'bg-slate-100 text-slate-700'
          }`}>
            {session.user.role}
          </span>
        </span>
        {session.user.role === 'director' && (
          <Link
            to="/auditoria"
            className="text-xs text-slate-400 hover:text-purple-600 transition-colors font-semibold uppercase tracking-wider"
          >
            Auditoria
          </Link>
        )}
        <button
          onClick={async () => {
            try {
              await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
            } finally {
              setSession(null);
            }
          }}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors font-semibold uppercase tracking-wider"
        >
          Cerrar sesion
        </button>
      </div>
      <Routes>
        <Route path="auditoria" element={<AuditLogPage />} />
        <Route path="*" element={<AdminDashboard user={session.user} />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<CensusForm />} />
          <Route path="/metodologia" element={<MethodologyPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/consulta" element={<ConsultationPage />} />
          <Route path="/transparencia" element={<TransparencyPage />} />
        </Route>
        <Route path="/admin/*" element={<ProtectedAdminRoute />} />
        <Route path="/auditoria/*" element={<ProtectedAdminRoute />} />
      </Routes>
    </Router>
  );
}

function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">
      <Header />
      <main className="relative pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
