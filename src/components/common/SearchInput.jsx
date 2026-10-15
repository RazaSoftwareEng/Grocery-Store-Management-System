import React from 'react';
import { Search, X } from 'lucide-react';

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  autoFocus = false,
  inputRef,
  onKeyDown,
  shortcut,
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
        <Search className="w-4 h-4" strokeWidth={1.9} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="w-full h-[38px] pl-9 pr-9 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 transition-[border-color,box-shadow]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          aria-label="Clear search"
          className="absolute right-2 text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors animate-in fade-in zoom-in-95"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        shortcut && (
          <kbd className="absolute right-2.5 pointer-events-none font-mono text-[11px] leading-none px-1.5 py-[3px] rounded border border-b-2 border-slate-300 text-slate-500 bg-white">
            {shortcut}
          </kbd>
        )
      )}
    </div>
  );
}
