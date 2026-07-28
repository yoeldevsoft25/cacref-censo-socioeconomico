import { motion } from 'motion/react';
import { ChevronRight, HeartPulse, Shield, Users, Activity } from 'lucide-react';

const FEATURES = [
  {
    icon: HeartPulse,
    title: 'Salud Integral',
    desc: 'Medicamentos crónicos, cirugías y procedimientos pendientes.',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  {
    icon: Users,
    title: 'Grupo Familiar',
    desc: 'Necesidades de asistencia para familiares directos.',
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: Activity,
    title: 'Calidad de Vida',
    desc: 'Evaluación socioeconómica y bienestar general.',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
];

export default function Hero() {
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 55, damping: 16 } },
  };

  return (
    <section className="relative overflow-hidden min-h-[88svh] flex items-center pt-20 lg:pt-24">
      {/* ── Background layers ── */}
      {/* Carrusel institucional: dos imágenes IA en crossfade cada 7s, blur suave */}
      <div
        className="hero-slide-a absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/bg/institucional-1.jpg)',
          filter: 'blur(2px) saturate(0.95) brightness(1.0)',
          transform: 'scale(1.05)',
        }}
        aria-hidden="true"
      />
      <div
        className="hero-slide-b absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/bg/institucional-2.jpg)',
          filter: 'blur(2px) saturate(0.95) brightness(1.0)',
          transform: 'scale(1.05)',
          opacity: 0,
        }}
        aria-hidden="true"
      />
      {/* Overlay blanco/rojo para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/55 via-white/40 to-red-50/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-20%,rgba(220,38,38,0.10),transparent_60%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/80 to-transparent" />

      {/* Grid dots */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,#000_20%,transparent_100%)] pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-24 right-[15%] w-72 h-72 bg-red-200/20 rounded-full blur-3xl float-subtle pointer-events-none" />
      <div className="absolute bottom-20 left-[10%] w-56 h-56 bg-blue-200/15 rounded-full blur-3xl float-subtle pointer-events-none" style={{ animationDelay: '3s' }} />

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left column */}
          <motion.div variants={container} initial="hidden" animate="show" className="max-w-xl">

            <motion.div variants={item} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-100 mb-8">
              <Shield className="w-3.5 h-3.5 text-red-600" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-red-700">
                Registro Institucional CACREF
              </span>
            </motion.div>

            <motion.h1
              variants={item}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-display font-black text-slate-950 leading-[1.08] tracking-tight"
            >
              Censo
              <br />
              Socioeconómico
              <br />
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500">
                  y Salud
                </span>
                <span className="absolute -bottom-1 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 to-red-300 rounded-full opacity-30" />
              </span>
            </motion.h1>

            <motion.p variants={item} className="mt-6 text-base sm:text-[17px] text-slate-500 leading-relaxed max-w-md">
              Ayúdanos a identificar necesidades de medicamentos, cirugías y bienestar
              para priorizar los programas de apoyo a trabajadores, afiliados y familiares.
            </motion.p>

            <motion.div variants={item} className="mt-10 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => document.getElementById('census-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="group relative overflow-hidden bg-red-600 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/25 hover:shadow-red-600/35 w-full sm:w-auto"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 tracking-wide">Iniciar Censo</span>
                <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="/admin"
                className="glass-button text-sm font-semibold px-7 py-3.5 rounded-full flex items-center justify-center w-full sm:w-auto hover:text-slate-900"
              >
                Panel Administrativo
              </a>
            </motion.div>
          </motion.div>

          {/* Right column — Feature cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
            className="space-y-4"
          >
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: 'easeOut' }}
                className="group glass-panel p-5 sm:p-6 flex items-start gap-5 hover:shadow-2xl hover:shadow-slate-900/[0.06] hover:-translate-y-0.5 transition-all duration-300 cursor-default"
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl ${f.bg} ${f.border} border flex items-center justify-center`}>
                  <f.icon className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-slate-900 text-[15px]">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}

            {/* Trust badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60"
            >
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800 leading-relaxed">
                Datos protegidos con acceso restringido. No sustituye evaluación médica.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Crédito IA — imagen decorativa */}
      <div className="absolute bottom-3 right-4 z-20 text-[10px] font-medium text-slate-500/80 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-200/60">
        Imágenes generadas con IA · carácter ilustrativo
      </div>
    </section>
  );
}
