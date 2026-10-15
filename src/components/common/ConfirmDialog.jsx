import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  tone,
  isLoading = false,
}) {
  const kind = tone || (isDanger ? 'danger' : 'warning');
  const Icon = kind === 'danger' ? Trash2 : kind === 'info' ? HelpCircle : AlertTriangle;
  const tile =
    kind === 'danger'
      ? 'bg-rose-50 text-rose-600 border-rose-200'
      : kind === 'info'
      ? 'bg-brand-50 text-brand-600 border-brand-100'
      : 'bg-amber-50 text-amber-600 border-amber-200';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      showClose={false}
      closeOnBackdrop={!isLoading}
      bodyClassName="p-5"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading} data-autofocus>
            {cancelText}
          </Button>
          <Button variant={kind === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tile}`}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.9} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h4 className="text-base font-semibold text-slate-900 leading-6">{title}</h4>
          <div className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{message}</div>
        </div>
      </div>
    </Modal>
  );
}
