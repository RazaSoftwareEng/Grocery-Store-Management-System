import React from 'react';

const baseStyles =
  'relative inline-flex items-center justify-center font-medium whitespace-nowrap select-none rounded-xl border ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-[3px] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed enabled:active:translate-y-px';

const variants = {
  primary:
    'bg-brand-600 hover:enabled:bg-brand-700 text-white border-transparent shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(19_68_48/0.25)] focus-visible:ring-brand-600/25',
  success:
    'bg-brand-600 hover:enabled:bg-brand-700 text-white border-transparent shadow-xs focus-visible:ring-brand-600/25',
  secondary:
    'bg-white hover:enabled:bg-slate-50 text-slate-900 border-slate-300 hover:enabled:border-slate-400 shadow-xs focus-visible:ring-brand-600/20',
  outline:
    'bg-white hover:enabled:bg-slate-50 text-slate-800 border-slate-300 hover:enabled:border-slate-400 shadow-xs focus-visible:ring-brand-600/20',
  ghost:
    'bg-transparent hover:enabled:bg-slate-100 text-slate-600 hover:enabled:text-slate-900 border-transparent focus-visible:ring-brand-600/20',
  danger:
    'bg-rose-600 hover:enabled:bg-rose-700 text-white border-transparent shadow-xs focus-visible:ring-rose-600/25',
  'danger-soft':
    'bg-rose-50 hover:enabled:bg-rose-100 text-rose-700 border-rose-200 focus-visible:ring-rose-600/20',
};

const sizes = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-[30px] px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-[18px] text-[15px] gap-2',
};

const iconSizes = { xs: 'w-3.5 h-3.5', sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-[18px] h-[18px]' };

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  icon: Icon,
  type = 'button',
  onClick,
  ...props
}) {
  const iconCls = `${iconSizes[size] || iconSizes.md} shrink-0`;
  const onDark = variant === 'primary' || variant === 'success' || variant === 'danger';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={`w-4 h-4 rounded-full border-2 animate-spin ${
              onDark ? 'border-white/35 border-t-white' : 'border-slate-300 border-t-brand-600'
            }`}
          />
        </span>
      )}
      <span className={`inline-flex items-center justify-center gap-[inherit] ${isLoading ? 'invisible' : ''}`}>
        {Icon ? <Icon className={iconCls} strokeWidth={1.9} /> : null}
        {children}
      </span>
    </button>
  );
}

/** Small keyboard-shortcut hint, e.g. <Kbd>F9</Kbd> */
export function Kbd({ children, className = '', onDark = false }) {
  return (
    <kbd
      className={`inline-flex items-center font-mono text-[11px] leading-none px-1.5 py-[3px] rounded border border-b-2 ${
        onDark ? 'bg-white/15 border-white/25 text-white' : 'bg-white border-slate-300 text-slate-500'
      } ${className}`}
    >
      {children}
    </kbd>
  );
}
