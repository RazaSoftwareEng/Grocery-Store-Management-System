import React from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5',
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${className}`}>
      {(title || subtitle || actions) && (
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-slate-900 leading-6">{title}</h3>}
            {subtitle && <p className="text-[13px] text-slate-500 leading-5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** Standard heading used at the top of every screen */
export function PageHeader({ title, description, actions, icon: Icon }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="hidden sm:flex w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5" strokeWidth={1.8} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 leading-8 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
