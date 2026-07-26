import { useId, type ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface BaseProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

interface SelectProps extends BaseProps {
  options: (string | Option)[];
  value: string;
  onChange: (value: string) => void;
  /** Texto que se muestra cuando value es '' (placeholder del select). */
  placeholder?: string;
}

function toOption(item: string | Option): Option {
  if (typeof item === 'string') {
    // Convención: '' es "No aplica" (no se renderiza como opción visible).
    if (item === '') return { value: '', label: '__noop__' };
    return { value: item, label: item };
  }
  return item;
}

/**
 * Select estilizado que se integra con el sistema de diseño del proyecto.
 * Acepta strings o {value,label}. Strings vacíos se ocultan del dropdown
 * (se usan para "no aplica" sin ensuciar la UI).
 */
export function FormSelect({
  label,
  required,
  error,
  hint,
  disabled,
  options,
  value,
  onChange,
  placeholder = 'Seleccione...',
  className = '',
}: SelectProps) {
  const id = useId();
  const visibleOptions = options
    .map(toOption)
    .filter((o) => o.label !== '__noop__');
  const hasError = Boolean(error);
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs font-tech tracking-wider uppercase text-slate-600 mb-2"
      >
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          className={`w-full appearance-none pl-4 pr-10 py-3 bg-white border rounded-xl text-slate-900 focus:outline-none focus:ring-2 shadow-sm transition-all ${
            hasError
              ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
              : 'border-slate-300 focus:ring-red-500 focus:border-red-500'
          } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'hover:border-slate-400'}`}
        >
          <option value="">{placeholder}</option>
          {visibleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      {hint && !hasError && (
        <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>
      )}
      {hasError && (
        <p className="mt-1.5 text-[11px] text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}

interface CascadingSelectProps {
  /** Etiqueta visible del nivel actual. */
  label: string;
  /** Valor actual controlado. */
  value: string;
  /** Callback cuando cambia el valor. */
  onChange: (value: string) => void;
  /** Opciones disponibles. Vacío = select deshabilitado. */
  options: (string | Option)[];
  /** Si true, cuando el padre cambia, se resetea automáticamente este campo. */
  resetOnEmpty?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Select que se integra en una cascada. La diferencia con FormSelect es que
 * internamente maneja el caso de "sin opciones" (se renderiza deshabilitado)
 * y respeta el flag resetOnEmpty.
 */
export function CascadingSelect({
  label,
  value,
  onChange,
  options,
  resetOnEmpty = true,
  required,
  error,
  hint,
  disabled,
  placeholder = 'Seleccione...',
  className = '',
}: CascadingSelectProps) {
  const hasOptions = options.length > 0;
  const isDisabled = disabled || !hasOptions;
  return (
    <FormSelect
      label={label}
      required={required}
      error={error}
      hint={hint}
      disabled={isDisabled}
      options={options}
      value={hasOptions ? value : ''}
      onChange={(v) => {
        if (v === '' && resetOnEmpty) onChange('');
        else onChange(v);
      }}
      placeholder={hasOptions ? placeholder : 'Seleccione una opción anterior primero'}
      className={className}
    />
  );
}
