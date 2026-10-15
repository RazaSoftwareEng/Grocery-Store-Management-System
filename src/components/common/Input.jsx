import React, { useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Labels written as "Name *" render the asterisk as a red required marker,
 * so existing call sites need no changes.
 */
function parseLabel(label, required) {
  if (typeof label !== 'string') return { text: label, isRequired: !!required };
  const trimmed = label.trim();
  const starred = trimmed.endsWith('*');
  return { text: starred ? trimmed.slice(0, -1).trim() : trimmed, isRequired: starred || !!required };
}

export function FieldLabel({ htmlFor, label, required, optional, aside }) {
  const { text, isRequired } = parseLabel(label, required);
  if (!text && !aside) return null;
  return (
    <div className="flex items-center justify-between gap-2 min-h-5">
      {text ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-800 leading-5">
          {text}
          {isRequired && <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>}
          {optional && !isRequired && <span className="ml-1.5 text-xs font-normal text-slate-400">Optional</span>}
        </label>
      ) : (
        <span />
      )}
      {aside}
    </div>
  );
}

export function FieldMessage({ id, error, warning, hint }) {
  if (error) {
    return (
      <p id={id} role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-rose-600 animate-in fade-in slide-in-from-top-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        <span>{error}</span>
      </p>
    );
  }
  if (warning) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs leading-4 text-amber-700 animate-in fade-in slide-in-from-top-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        <span>{warning}</span>
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="text-xs leading-4 text-slate-500">
        {hint}
      </p>
    );
  }
  return null;
}

export const controlBase =
  'w-full h-[38px] px-3 text-sm bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 ' +
  'transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ' +
  'read-only:bg-slate-50';

export function controlState(error, warning) {
  if (error) return 'border-rose-500 focus:ring-[3px] focus:ring-rose-600/15';
  if (warning) return 'border-amber-500 focus:ring-[3px] focus:ring-amber-600/15';
  return 'border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20';
}

export function Input({
  label,
  error,
  warning,
  hint,
  icon: Icon,
  suffix,
  isValid = false,
  optional = false,
  labelAside,
  className = '',
  containerClassName = '',
  id,
  type = 'text',
  name,
  required,
  ...props
}) {
  const autoId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || name || autoId;
  const msgId = `${inputId}-msg`;
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const showValid = isValid && !error && !warning && !suffix && !isPassword;

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${containerClassName}`} data-field={name || inputId}>
      <FieldLabel htmlFor={inputId} label={label} required={required} optional={optional} aside={labelAside} />
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
            <Icon className="w-4 h-4" strokeWidth={1.9} />
          </div>
        )}
        <input
          id={inputId}
          name={name}
          type={effectiveType}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || warning || hint ? msgId : undefined}
          className={`${controlBase} ${controlState(error, warning)} ${Icon ? 'pl-9' : ''} ${
            isPassword || showValid ? 'pr-10' : ''
          } ${suffix ? 'pr-12' : ''} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-medium text-slate-500 pointer-events-none">{suffix}</span>
        )}
        {showValid && (
          <CheckCircle2 className="absolute right-3 w-4 h-4 text-brand-600 animate-pop pointer-events-none" strokeWidth={2} />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <FieldMessage id={msgId} error={error} warning={warning} hint={hint} />
    </div>
  );
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236e7370' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[position:right_10px_center]";

export function Select({
  label,
  error,
  warning,
  hint,
  options = [],
  placeholder,
  optional = false,
  labelAside,
  isValid: _isValid, // eslint-disable-line no-unused-vars
  className = '',
  containerClassName = '',
  id,
  name,
  required,
  children,
  ...props
}) {
  const autoId = useId();
  const selectId = id || name || autoId;
  const msgId = `${selectId}-msg`;

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${containerClassName}`} data-field={name || selectId}>
      <FieldLabel htmlFor={selectId} label={label} required={required} optional={optional} aside={labelAside} />
      <select
        id={selectId}
        name={name}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error || warning || hint ? msgId : undefined}
        className={`${controlBase} ${controlState(error, warning)} appearance-none pr-9 cursor-pointer ${chevron} ${className}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      <FieldMessage id={msgId} error={error} warning={warning} hint={hint} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  warning,
  hint,
  optional = false,
  isValid: _isValid, // eslint-disable-line no-unused-vars
  className = '',
  containerClassName = '',
  id,
  name,
  required,
  rows = 3,
  ...props
}) {
  const autoId = useId();
  const areaId = id || name || autoId;
  const msgId = `${areaId}-msg`;

  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${containerClassName}`} data-field={name || areaId}>
      <FieldLabel htmlFor={areaId} label={label} required={required} optional={optional} />
      <textarea
        id={areaId}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error || warning || hint ? msgId : undefined}
        className={`${controlBase} ${controlState(error, warning)} h-auto py-2.5 resize-y ${className}`}
        {...props}
      />
      <FieldMessage id={msgId} error={error} warning={warning} hint={hint} />
    </div>
  );
}
