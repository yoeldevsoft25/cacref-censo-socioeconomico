import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
    onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
    const [credentials, setCredentials] = useState({ user: '', pass: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Credenciales incorrectas. Acceso denegado.');
            }
            onLogin();
        } catch (err: any) {
            setError(err.message || 'Credenciales incorrectas. Acceso denegado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 relative overflow-hidden">
            {/* Imagen institucional generada con IA, fuertemente difuminada para uso decorativo */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: 'url(/bg/institucional-2.jpg)',
                    filter: 'blur(32px) saturate(0.8) brightness(0.8)',
                    transform: 'scale(1.2)',
                }}
                aria-hidden="true"
            />
            {/* Overlay blanco para legibilidad */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#fee2e2_0%,transparent_70%)] opacity-40 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-md"
            >
                {/* Card */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-900/5 overflow-hidden">
                    {/* Top accent bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-red-700" />

                    <div className="p-10">
                        {/* Logo & Header */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mb-5 shadow-sm">
                                <Lock className="w-7 h-7 text-red-600" />
                            </div>
                            <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
                                Acceso Administrativo
                            </h1>
                        <p className="text-sm text-slate-500 mt-1 text-center">
                            Panel de gestion exclusivo. Solo personal autorizado.
                        </p>
                    </div>

                    <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                        <p className="font-semibold text-slate-700 mb-1.5">Usuarios de demo (clave: censo2025)</p>
                        <ul className="space-y-0.5 font-mono text-[10px]">
                            <li><strong>admin</strong> &middot; Director</li>
                            <li><strong>presidente</strong> &middot; Presidente del comite</li>
                            <li><strong>vocal</strong> &middot; Vocal del comite</li>
                            <li><strong>capturista</strong> &middot; Capturista (solo lectura)</li>
                        </ul>
                    </div>

                        {/* Error message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-tech tracking-wider uppercase text-slate-600 mb-2">
                                    Usuario
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        id="admin-user"
                                        autoComplete="username"
                                        value={credentials.user}
                                        onChange={(e) => setCredentials(p => ({ ...p, user: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-all"
                                        placeholder="Nombre de usuario"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-tech tracking-wider uppercase text-slate-600 mb-2">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        id="admin-pass"
                                        autoComplete="current-password"
                                        value={credentials.pass}
                                        onChange={(e) => setCredentials(p => ({ ...p, pass: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-tech font-bold uppercase tracking-wider text-sm rounded-full shadow-md shadow-red-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Verificando...
                                    </span>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4" />
                                        Ingresar
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 mt-5">
                    Censo Socioeconomico y Salud CACREF - Acceso Restringido
                </p>
            </motion.div>

            {/* Crédito IA — imagen decorativa */}
            <div className="absolute bottom-3 right-4 z-20 text-[10px] font-medium text-slate-500/80 bg-white/70 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-200/60">
                Imagen generada con IA · carácter ilustrativo
            </div>
        </div>
    );
}
