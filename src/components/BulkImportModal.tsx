import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ImportResult {
  filename: string;
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; cedula: string; error: string }>;
}

export default function BulkImportModal({ open, onClose, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Solo se aceptan archivos CSV.');
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/submissions/bulk-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || 'Error al importar');
      }
      const data = await res.json();
      setResult(data);
      if (data.inserted > 0) onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = `nombre_apellido,cedula,telefono,correo,gerencia,unidad_operativa,anos_servicio,cargo,ingreso_individual,ingreso_familiar,afiliado_cacref,capacidad_cuota,requiere_medicamento_cronico,medicamento_detalle,requiere_cirugia,cirugia_detalle,familiar_requiere_asistencia,calidad_vida_escala,region_sede,vicepresidencia,direccion_ejecutiva
Juan Perez,12345678,04141111111,juan@example.com,Refinacion,Unidad Norte,15,Operador,750,1100,1,200,1,Losartan 50mg,0,,0,6,Caracas,VP Manufactura,Dir Ejecutiva
Maria Lopez,87654321,04142222222,maria@example.com,Produccion,Unidad Sur,8,Tecnico,520,780,1,150,0,,0,,1,5,Valencia,VP Produccion,Dir Ejecutiva`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-censo-cacref.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <button
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Cerrar"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">Importar CSV masivo</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Carga censos existentes desde un archivo CSV</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!result ? (
                <>
                  <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    Columnas requeridas: nombre_apellido, cedula, telefono, correo, gerencia, anos_servicio, cargo, ingreso_individual, ingreso_familiar, capacidad_cuota, calidad_vida_escala. Opcionales: resto.
                  </div>

                  <label className="block">
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFile(e.dataTransfer.files?.[0] || null); }}
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-amber-50/30 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      {file ? (
                        <>
                          <FileText className="w-10 h-10 text-amber-600 mb-2" />
                          <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-400 mb-2" />
                          <p className="text-sm font-semibold text-slate-900">Arrastra o haz click para subir</p>
                          <p className="text-xs text-slate-500">Solo CSV, max 5MB</p>
                        </>
                      )}
                    </div>
                  </label>

                  {error && (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={downloadTemplate}
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                    >
                      Descargar plantilla CSV
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={onClose}
                      type="button"
                      className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!file || uploading}
                      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {uploading ? 'Importando...' : 'Importar censos'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-900">Importacion completada</p>
                      <p className="text-sm text-emerald-800 mt-0.5">
                        <strong>{result.inserted}</strong> censos insertados, <strong>{result.skipped}</strong> omitidos de {result.filename}
                      </p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-amber-900 mb-1.5">Errores por fila ({result.errors.length}):</p>
                      <ul className="text-[10px] font-mono text-amber-800 space-y-0.5">
                        {result.errors.map((e, i) => (
                          <li key={i}>Fila {e.row}{e.cedula && ` (cedula ${e.cedula})`}: {e.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={reset}
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-red-600"
                    >
                      Importar otro archivo
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={onClose}
                      type="button"
                      className="px-5 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700"
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
