import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Loader2, CheckCircle2, X, AlertCircle, FileText } from 'lucide-react';

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

interface Props {
  label: string;
  description?: string;
  fileType: 'CEDULA' | 'MEDICAMENTO' | 'CIRUGIA' | 'FAMILIAR' | 'OTRO';
  required?: boolean;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const hasExt = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasMime = ACCEPTED_MIME.includes(file.type);
  return hasExt || hasMime;
}

export default function FileUploadField({ label, description, required, value, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayError = error ?? internalError ?? undefined;
  const hasValue = !!value;

  const borderClass = displayError
    ? 'border-red-300 bg-red-50/40'
    : dragOver
      ? 'border-red-400 bg-red-50/60'
      : hasValue
        ? 'border-emerald-300 bg-emerald-50/40'
        : 'border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50';

  const handleUpload = async (file: File) => {
    setInternalError(null);
    if (file.size > MAX_BYTES) {
      setInternalError('El archivo excede el límite de 10MB.');
      return;
    }
    if (!isAcceptedFile(file)) {
      setInternalError('Formato no permitido. Use PDF, JPG o PNG.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/census/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Error al subir el archivo.');
      const uploaded: UploadedFile = {
        id: String((data as { id: unknown }).id),
        originalName: String((data as { originalName: unknown }).originalName),
        mimeType: String((data as { mimeType: unknown }).mimeType),
        sizeBytes: Number((data as { sizeBytes: unknown }).sizeBytes),
        url: String((data as { url: unknown }).url),
      };
      onChange(uploaded);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir el archivo.';
      setInternalError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
  };

  const handleClick = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!uploading) setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  };

  const handleRemove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    onChange(null);
    setInternalError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-2"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex items-center justify-center border border-dashed rounded-xl p-6 cursor-pointer transition-colors ${borderClass} ${uploading ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleSelect}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            <span className="text-sm font-semibold">Subiendo...</span>
          </div>
        ) : hasValue && value ? (
          <div className="flex items-center gap-3 w-full">
            <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-sm font-semibold text-slate-900 truncate">{value.originalName}</p>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatBytes(value.sizeBytes)} · {value.mimeType}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Quitar archivo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Upload className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {label}
                {required ? ' *' : ''}
              </p>
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
              <p className="text-[11px] text-slate-400 mt-1">PDF, JPG o PNG (máx. 10MB)</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {displayError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium pt-0.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{displayError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
