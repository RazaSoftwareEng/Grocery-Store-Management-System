import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-xl',
  showClose = true,
  closeOnBackdrop = false,
  bodyClassName = 'p-5 sm:p-6',
}) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);
  const lastFocused = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  // Keep mounted while the exit animation plays
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 160);
      return () => clearTimeout(t);
    }
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isOpen) return undefined;

    lastFocused.current = document.activeElement;
    openCount += 1;
    document.body.style.overflow = 'hidden';

    // Focus the first field unless something inside already grabbed focus (autoFocus)
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        const target = panel.querySelector('[autofocus], [data-autofocus]') || panel.querySelector(FOCUSABLE);
        (target || panel).focus({ preventScroll: true });
      }
    });

    function handleKeyDown(e) {
      const panel = panelRef.current;
      if (!panel) return;
      // only the top-most modal reacts
      const all = document.querySelectorAll('[data-modal-panel]');
      if (all[all.length - 1] !== panel) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === 'Tab') {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = '';
      const prev = lastFocused.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/45 ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in duration-200'
      }`}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        data-modal-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${maxWidth} max-h-[92vh] flex flex-col overflow-hidden outline-none ${
          isClosing ? 'animate-out fade-out zoom-out-95' : 'animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              {title && (
                <h3 id={titleId} className="text-base font-semibold text-slate-900 leading-6">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-[13px] text-slate-500 mt-0.5 leading-5">{subtitle}</p>}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1.5 -mt-0.5 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>
        )}

        <div className={`overflow-y-auto flex-1 ${bodyClassName}`}>{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
