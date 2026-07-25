import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, ChevronLeft, Briefcase, User, CreditCard, HeartPulse, Pill, Shield, Stethoscope, Users, Sparkles } from 'lucide-react';
import FileUploadField, { type UploadedFile } from './FileUploadField';

const STEPS = [
  { id: 'personal', title: 'Datos Personales', subtitle: 'Información de contacto', icon: User },
  { id: 'vinculacion', title: 'Vinculación CACREF', subtitle: 'Datos laborales e institucionales', icon: Briefcase },
  { id: 'socioeconomico', title: 'Situación Económica', subtitle: 'Ingresos y capacidad de aporte', icon: CreditCard },
  { id: 'salud', title: 'Salud y Calidad de Vida', subtitle: 'Necesidades médicas y bienestar', icon: HeartPulse },
];

export default function CensusForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [consent, setConsent] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [error, setError] = useState('');
  const [canSubmitFinalStep, setCanSubmitFinalStep] = useState(false);
  const [attachedCount, setAttachedCount] = useState(0);

  const [formData, setFormData] = useState({
    nombre_apellido: '',
    cedula: '',
    telefono: '',
    correo: '',
    vicepresidencia: '',
    direccion_ejecutiva: '',
    gerencia: '',
    unidad_operativa: '',
    anos_servicio: '',
    cargo: '',
    afiliado_cacref: false,
    ingreso_individual: '',
    ingreso_familiar: '',
    capacidad_cuota: '',
    requiere_medicamento_cronico: false,
    medicamento_detalle: '',
    requiere_cirugia: false,
    cirugia_detalle: '',
    familiar_requiere_asistencia: false,
    calidad_vida_escala: '5',
    attachments: {
      cedula: null as UploadedFile | null,
      medicamento: null as UploadedFile | null,
      cirugia: null as UploadedFile | null,
      familiar: null as UploadedFile | null,
    },
  });

  const setAttachment = (key: 'cedula' | 'medicamento' | 'cirugia' | 'familiar', file: UploadedFile | null) => {
    setFormData((prev) => ({ ...prev, attachments: { ...prev.attachments, [key]: file } }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleField = (name: string) => {
    setFormData(prev => ({ ...prev, [name]: !(prev as any)[name] }));
  };

  const validateStep = () => {
    const hasText = (v: string) => v.trim() !== '';
    const step = STEPS[currentStep].id;
    if (step === 'personal') return hasText(formData.nombre_apellido) && hasText(formData.cedula) && hasText(formData.telefono) && hasText(formData.correo) && !!formData.attachments.cedula;
    if (step === 'vinculacion') return hasText(formData.gerencia) && hasText(formData.anos_servicio) && hasText(formData.cargo);
    if (step === 'socioeconomico') return hasText(formData.ingreso_individual) && hasText(formData.ingreso_familiar) && hasText(formData.capacidad_cuota);
    if (step === 'salud') {
      if (formData.requiere_medicamento_cronico && !hasText(formData.medicamento_detalle)) return false;
      if (formData.requiere_cirugia && !hasText(formData.cirugia_detalle)) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) { setCurrentStep(p => Math.min(p + 1, STEPS.length - 1)); setError(''); }
    else setError('Complete los campos obligatorios para continuar.');
  };
  const handlePrev = () => { setCurrentStep(p => Math.max(p - 1, 0)); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < STEPS.length - 1) { handleNext(); return; }
    if (!canSubmitFinalStep) return;
    if (!validateStep()) { setError('Complete los campos obligatorios.'); return; }
    if (!consent) { setError('Debe aceptar la politica de privacidad para continuar.'); return; }
    if (!privacyRead) { setError('Debe leer la politica de privacidad antes de enviar.'); return; }

    setIsSubmitting(true); setError('');
    try {
      const attachments = [
        ...(formData.attachments.cedula ? [{ uploadId: formData.attachments.cedula.id, fileType: 'CEDULA' as const }] : []),
        ...(formData.attachments.medicamento ? [{ uploadId: formData.attachments.medicamento.id, fileType: 'MEDICAMENTO' as const }] : []),
        ...(formData.attachments.cirugia ? [{ uploadId: formData.attachments.cirugia.id, fileType: 'CIRUGIA' as const }] : []),
        ...(formData.attachments.familiar ? [{ uploadId: formData.attachments.familiar.id, fileType: 'FAMILIAR' as const }] : []),
      ];
      const res = await fetch('/api/census', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          attachments,
          anos_servicio: parseInt(formData.anos_servicio),
          ingreso_individual: parseFloat(formData.ingreso_individual),
          ingreso_familiar: parseFloat(formData.ingreso_familiar),
          capacidad_cuota: parseFloat(formData.capacidad_cuota),
          calidad_vida_escala: parseInt(formData.calidad_vida_escala),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setAttachedCount(attachments.length);
      setSubmitSuccess(true);
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (currentStep === STEPS.length - 1) {
      const t = window.setTimeout(() => setCanSubmitFinalStep(true), 120);
      return () => window.clearTimeout(t);
    }
    setCanSubmitFinalStep(false);
  }, [currentStep]);

  /* ── Success screen ── */
  if (submitSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-10 sm:p-14 text-center rounded-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.04)_0%,transparent_60%)] pointer-events-none" />
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.15 }} className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-red-50 to-red-100 border border-red-200/50 flex items-center justify-center mb-8 shadow-lg shadow-red-600/10">
            <Sparkles className="w-9 h-9 text-red-600" />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">¡Registro Exitoso!</motion.h2>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 text-slate-500 leading-relaxed max-w-sm mx-auto">
            {attachedCount > 0
              ? `Sus datos y ${attachedCount} archivo${attachedCount === 1 ? '' : 's'} adjunto${attachedCount === 1 ? '' : 's'} han sido guardados. Serán utilizados exclusivamente para priorización institucional interna de CACREF.`
              : 'Sus datos han sido guardados. Serán utilizados exclusivamente para priorización institucional interna de CACREF.'}
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} onClick={() => window.location.reload()} className="mt-10 inline-flex items-center px-7 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-full shadow-sm transition-all">
            Volver al Inicio
          </motion.button>
        </motion.div>
      </div>
    );
  }

  /* ── Helpers ── */
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{children}</label>
  );
  const inputCls = "w-full px-4 py-3 text-[15px] bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all text-slate-900 placeholder:text-slate-350 shadow-sm outline-none hover:border-slate-300";
  const moneyInputCls = inputCls.replace('px-4', 'pl-10 pr-4');

  const ToggleCard = ({ id, checked, onToggle, icon: Icon, label, desc }: { id: string; checked: boolean; onToggle: () => void; icon: React.ComponentType<{ className?: string }>; label: string; desc?: string }) => (
    <div
      onClick={onToggle}
      className={`flex items-start gap-4 p-4 sm:p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
        checked ? 'bg-red-50/70 border-red-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <div className="pt-0.5 relative flex items-center justify-center">
        <input id={id} name={id} type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${checked ? 'bg-red-600 border-red-600' : 'border-slate-300 bg-white'}`}>
          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </div>
      </div>
      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${checked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'} transition-colors`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {desc && <span className="block mt-0.5 text-xs text-slate-500">{desc}</span>}
      </div>
    </div>
  );

  return (
    <div id="census-form" className="relative z-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 scroll-mt-20">

      {/* ── Stepper ── */}
      <div className="mb-10 sm:mb-14">
        <div className="flex items-center justify-between relative">
          {/* Track */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 rounded-full" />
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          />

          {STEPS.map((step, i) => {
            const active = i === currentStep;
            const done = i < currentStep;
            return (
              <div key={step.id} className="flex flex-col items-center z-10 relative">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                  active ? 'bg-white border-2 border-red-600 text-red-600 shadow-lg shadow-red-600/15 step-active' :
                  done ? 'bg-red-600 border-2 border-red-600 text-white shadow-md' :
                  'bg-white border-2 border-slate-200 text-slate-400'
                }`}>
                  <step.icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${done ? 'text-white' : ''}`} />
                </div>
                <span className={`mt-2.5 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase hidden sm:block absolute top-full whitespace-nowrap transition-colors ${
                  active ? 'text-red-600' : done ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        {/* Step header */}
        <div className="p-5 sm:p-8 border-b border-slate-100 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-bl from-red-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200/40 flex items-center justify-center text-red-600 shadow-sm">
              {React.createElement(STEPS[currentStep].icon, { className: 'w-5 h-5' })}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900 tracking-tight">{STEPS[currentStep].title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{STEPS[currentStep].subtitle}</p>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
              <span className="text-[11px] font-semibold text-slate-500">{currentStep + 1}</span>
              <span className="text-[11px] text-slate-400">/</span>
              <span className="text-[11px] text-slate-400">{STEPS.length}</span>
            </div>
          </div>
        </div>

        {/* Step body */}
        <div className="p-5 sm:p-8">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              <motion.div key={currentStep} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="space-y-6">

                {/* ── Step 1: Personal ── */}
                {currentStep === 0 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Nombre y Apellido *</Label>
                      <input type="text" name="nombre_apellido" value={formData.nombre_apellido} onChange={handleInputChange} className={inputCls} placeholder="Nombres y Apellidos completos" />
                    </div>
                    <div>
                      <Label>Cédula de Identidad *</Label>
                      <input type="text" name="cedula" value={formData.cedula} onChange={(e) => { setFormData(p => ({ ...p, cedula: e.target.value.replace(/\D/g, '') })); }} className={inputCls} placeholder="Solo números" />
                    </div>
                    <div>
                      <Label>Teléfono Celular *</Label>
                      <input type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} className={inputCls} placeholder="Ej. 04141234567" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Correo Electrónico *</Label>
                      <input type="email" name="correo" value={formData.correo} onChange={handleInputChange} className={inputCls} placeholder="correo@ejemplo.com" />
                    </div>
                    <div className="sm:col-span-2">
                      <FileUploadField
                        label="Foto de cédula (frontal)"
                        description="Sube una foto clara del frente de tu cédula de identidad"
                        fileType="CEDULA"
                        required
                        value={formData.attachments.cedula}
                        onChange={(f) => setAttachment('cedula', f)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Step 2: Vinculación ── */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label>Vicepresidencia</Label>
                      <input type="text" name="vicepresidencia" value={formData.vicepresidencia} onChange={handleInputChange} className={inputCls} placeholder="Ej. VP de Operaciones" />
                    </div>
                    <div>
                      <Label>Dirección Ejecutiva</Label>
                      <input type="text" name="direccion_ejecutiva" value={formData.direccion_ejecutiva} onChange={handleInputChange} className={inputCls} placeholder="Ej. Dir. Ejecutiva Comercial" />
                    </div>
                    <div>
                      <Label>Gerencia *</Label>
                      <input type="text" name="gerencia" value={formData.gerencia} onChange={handleInputChange} className={inputCls} placeholder="Ej. Gerencia de Transporte" />
                    </div>
                    <div>
                      <Label>Unidad Operativa</Label>
                      <input type="text" name="unidad_operativa" value={formData.unidad_operativa} onChange={handleInputChange} className={inputCls} placeholder="Ej. Unidad de Distribución" />
                    </div>
                    <div>
                      <Label>Años de Servicio *</Label>
                      <input type="number" name="anos_servicio" min="0" value={formData.anos_servicio} onChange={handleInputChange} className={inputCls} placeholder="Años" />
                    </div>
                    <div>
                      <Label>Cargo Actual *</Label>
                      <input type="text" name="cargo" value={formData.cargo} onChange={handleInputChange} className={inputCls} placeholder="Denominación de Rol" />
                    </div>
                    <div className="sm:col-span-2">
                      <ToggleCard id="afiliado_cacref" checked={formData.afiliado_cacref} onToggle={() => toggleField('afiliado_cacref')} icon={Briefcase} label="Soy socio activo de CACREF" desc="Cooperativa de Ahorro y Préstamo de Trabajadores" />
                    </div>
                  </div>
                )}

                {/* ── Step 3: Socioeconómico ── */}
                {currentStep === 2 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label>Ingreso Individual Mensual ($) *</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-red-500 font-bold text-sm">$</span></div>
                        <input type="number" name="ingreso_individual" min="0" step="0.01" value={formData.ingreso_individual} onChange={handleInputChange} className={moneyInputCls} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <Label>Ingreso Familiar Mensual ($) *</Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-red-500 font-bold text-sm">$</span></div>
                        <input type="number" name="ingreso_familiar" min="0" step="0.01" value={formData.ingreso_familiar} onChange={handleInputChange} className={moneyInputCls} placeholder="0.00" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Capacidad de Aporte Mensual ($) *</Label>
                      <div className="relative group max-w-sm">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-red-500 font-bold text-sm">$</span></div>
                        <input type="number" name="capacidad_cuota" min="0" step="0.01" value={formData.capacidad_cuota} onChange={handleInputChange} className={moneyInputCls} placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 4: Salud ── */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    {/* Privacy notice */}
                    <div className="px-4 py-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-800 leading-relaxed">
                      La información será utilizada por CACREF para diagnóstico socioeconómico y priorización interna.
                      No sustituye evaluación médica ni constituye aprobación automática de beneficios.
                    </div>

                    {/* LOPDP consent (Art. 12-15) */}
                    <div className="px-4 py-4 rounded-xl bg-blue-50/80 border-2 border-blue-200 space-y-3">
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-900 font-semibold">Consentimiento para tratamiento de datos personales (LOPDP)</p>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        Conforme a la Ley Organica de Proteccion de Datos Personales (Venezuela, 2021), autorizo a CACREF a tratar mis datos personales y de salud aqui proporcionados, unica y exclusivamente para los fines descritos en la politica de privacidad.
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyRead}
                          onChange={(e) => setPrivacyRead(e.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0"
                        />
                        <span className="text-[11px] text-blue-800 leading-relaxed">
                          He leido la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline font-semibold">politica de privacidad y tratamiento de datos</a> de CACREF.
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 accent-blue-600 shrink-0"
                        />
                        <span className="text-[11px] text-blue-800 leading-relaxed">
                          Acepto el tratamiento de mis datos personales y de salud para los fines indicados, conforme a la LOPDP. Entiendo que puedo revocar este consentimiento o ejercer mis derechos ARCO en cualquier momento.
                        </span>
                      </label>
                    </div>

                    <ToggleCard id="requiere_medicamento_cronico" checked={formData.requiere_medicamento_cronico} onToggle={() => toggleField('requiere_medicamento_cronico')} icon={Pill} label="¿Requiere medicamento crónico?" desc="Tratamientos continuos, de control o de alto costo" />

                    <AnimatePresence>
                      {formData.requiere_medicamento_cronico && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="pl-4 border-l-2 border-red-200 space-y-4">
                            <div>
                              <Label>Detalle del medicamento o condición *</Label>
                              <textarea name="medicamento_detalle" value={formData.medicamento_detalle} onChange={handleInputChange} className={inputCls + ' min-h-[80px] resize-y'} placeholder="Ej. Losartán 50mg, diario para hipertensión" />
                            </div>
                            <FileUploadField
                              label="Comprobante de medicamento (opcional)"
                              description="Receta, informe médico o indicación que respalde el tratamiento"
                              fileType="MEDICAMENTO"
                              value={formData.attachments.medicamento}
                              onChange={(f) => setAttachment('medicamento', f)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ToggleCard id="requiere_cirugia" checked={formData.requiere_cirugia} onToggle={() => toggleField('requiere_cirugia')} icon={Stethoscope} label="¿Requiere cirugía o procedimiento?" desc="Intervenciones pendientes de evaluación o seguimiento" />

                    <AnimatePresence>
                      {formData.requiere_cirugia && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="pl-4 border-l-2 border-red-200 space-y-4">
                            <div>
                              <Label>Detalle del procedimiento *</Label>
                              <textarea name="cirugia_detalle" value={formData.cirugia_detalle} onChange={handleInputChange} className={inputCls + ' min-h-[80px] resize-y'} placeholder="Ej. Cirugía de cataratas" />
                            </div>
                            <FileUploadField
                              label="Informe de cirugía o procedimiento (opcional)"
                              description="Indicación médica, referencia o informe del especialista"
                              fileType="CIRUGIA"
                              value={formData.attachments.cirugia}
                              onChange={(f) => setAttachment('cirugia', f)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <ToggleCard id="familiar_requiere_asistencia" checked={formData.familiar_requiere_asistencia} onToggle={() => toggleField('familiar_requiere_asistencia')} icon={Users} label="¿Familiar requiere asistencia médica?" desc="Familiar dependiente que necesite apoyo o tratamiento" />

                    <AnimatePresence>
                      {formData.familiar_requiere_asistencia && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="pl-4 border-l-2 border-red-200">
                            <FileUploadField
                              label="Documento del familiar (opcional)"
                              description="Informe o constancia médica del familiar dependiente"
                              fileType="FAMILIAR"
                              value={formData.attachments.familiar}
                              onChange={(f) => setAttachment('familiar', f)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Quality of life slider */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 sm:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <Label>Calidad de vida actual *</Label>
                          <p className="text-xs text-slate-400 mt-0.5">1 = situación crítica · 10 = estabilidad</p>
                        </div>
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl font-display font-bold text-red-600 shadow-sm">
                          {formData.calidad_vida_escala}
                        </div>
                      </div>
                      <input type="range" name="calidad_vida_escala" min="1" max="10" step="1" value={formData.calidad_vida_escala} onChange={handleInputChange} className="w-full" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-0.5">
                        <span>Crítica</span>
                        <span>Estable</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Navigation ── */}
            <div className="mt-8 sm:mt-10 pt-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
              <button type="button" onClick={handlePrev} disabled={currentStep === 0 || isSubmitting}
                className={`inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-full transition-all w-full sm:w-auto ${
                  currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-500 glass-button hover:text-slate-900'
                }`}>
                <ChevronLeft className="w-4 h-4 mr-1.5" /> Anterior
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button type="button" onClick={handleNext}
                  className="group inline-flex items-center justify-center w-full sm:w-auto px-7 py-3 text-sm font-semibold text-white rounded-full bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting}
                  className="group inline-flex items-center justify-center w-full sm:w-auto px-7 py-3 text-sm font-semibold text-white rounded-full bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]">
                  {isSubmitting ? 'Procesando…' : 'Enviar Censo'}
                  {!isSubmitting && <CheckCircle2 className="w-4 h-4 ml-2" />}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
