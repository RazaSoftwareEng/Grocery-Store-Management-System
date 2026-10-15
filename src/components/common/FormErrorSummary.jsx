import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Lists every visible error after a submit attempt; each item jumps to its field. */
export function FormErrorSummary({ validation, className = '' }) {
  const { submitted, visibleErrors, jumpTo } = validation;
  if (!submitted || visibleErrors.length === 0) return null;

  return (
    <div
      role="alert"
      className={`flex gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50 text-[13px] leading-5 animate-in fade-in slide-in-from-top-1 ${className}`}
    >
      <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" strokeWidth={2} />
      <div className="min-w-0 text-slate-800">
        <p className="font-semibold text-rose-700">
          Fix {visibleErrors.length} field{visibleErrors.length > 1 ? 's' : ''} to continue
        </p>
        <ul className="mt-1 space-y-0.5 list-disc pl-4 marker:text-rose-300">
          {visibleErrors.map((e) => (
            <li key={e.name}>
              <button
                type="button"
                onClick={() => jumpTo(e.name)}
                className="text-left underline decoration-rose-300 underline-offset-2 hover:decoration-rose-600"
              >
                {e.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
