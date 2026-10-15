import React from 'react';

const variants = {
  success: { box: 'bg-brand-50 text-brand-700 border-brand-100', dot: 'bg-brand-500' },
  warning: { box: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  danger: { box: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  info: { box: 'bg-info-50 text-info-700 border-info-200', dot: 'bg-info-500' },
  neutral: { box: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const sizes = {
  xs: 'h-5 px-2 text-xs gap-1.5',
  sm: 'h-[22px] px-2 text-xs gap-1.5',
  md: 'h-6 px-2.5 text-[13px] gap-1.5',
};

// "PAYMENT_DUE" -> "Payment due"; mixed-case text is left alone
function humanize(value) {
  if (typeof value !== 'string' || value !== value.toUpperCase() || !/[A-Z]/.test(value)) return value;
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function Badge({ children, variant = 'neutral', size = 'sm', dot = true, className = '' }) {
  const v = variants[variant] || variants.neutral;
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${v.box} ${
        sizes[size] || sizes.sm
      } ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />}
      {React.Children.map(children, humanize)}
    </span>
  );
}
