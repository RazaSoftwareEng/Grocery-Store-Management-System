import React, { useState } from 'react';
import { Minus, Plus, Trash2, Tag, Check, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function CartItem({
  item,
  onUpdateQty,
  onRemove,
  onUpdateDiscount,
  currencySymbol,
}) {
  const gross = item.sellingPrice * item.quantity;
  const lineTotal = gross - (item.discount || 0);

  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const discountValue = parseFloat(discountInput);
  const discountError =
    discountInput.trim() === ''
      ? ''
      : Number.isNaN(discountValue)
      ? 'Numbers only'
      : discountValue < 0
      ? "Can't be negative"
      : discountValue > gross
      ? `Max ${formatCurrency(gross, currencySymbol)}`
      : '';

  const openDiscount = () => {
    setDiscountInput(item.discount ? String(item.discount) : '');
    setIsEditingDiscount(true);
  };

  const applyDiscount = () => {
    if (discountError) return;
    onUpdateDiscount(item.productId, discountInput.trim() === '' ? 0 : discountValue);
    setIsEditingDiscount(false);
  };

  const remove = () => {
    setIsRemoving(true);
    setTimeout(() => onRemove(item.productId), 160);
  };

  return (
    <div
      className={`group py-3 px-3 bg-white rounded-xl border border-slate-200 transition-colors hover:border-slate-300 ${
        isRemoving ? 'animate-out fade-out slide-out-to-right-6' : 'animate-in fade-in slide-in-from-right-2 duration-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h5 className="text-[13px] font-medium text-slate-900 leading-snug truncate" title={item.name}>
            {item.name}
          </h5>
          <p className="text-xs text-slate-500 mt-0.5 tabular">
            {formatCurrency(item.sellingPrice, currencySymbol)} × {item.quantity} {item.unit}
            {item.discount > 0 && (
              <span className="text-rose-600"> · −{formatCurrency(item.discount, currencySymbol)}</span>
            )}
          </p>
        </div>

        <span key={lineTotal} className="text-[13px] font-semibold text-slate-900 tabular animate-bump inline-block">
          {formatCurrency(lineTotal, currencySymbol)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center h-7 rounded-lg border border-slate-300 overflow-hidden">
          <button
            type="button"
            onClick={() => (item.quantity <= 1 ? remove() : onUpdateQty(item.productId, item.quantity - 1))}
            aria-label={`Decrease ${item.name}`}
            className="w-7 h-full text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdateQty(item.productId, Math.max(1, parseInt(e.target.value) || 1))}
            aria-label={`Quantity of ${item.name}`}
            className="w-9 h-full text-center text-xs font-semibold tabular bg-transparent text-slate-900 border-x border-slate-200 focus:outline-none focus:bg-brand-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
            aria-label={`Increase ${item.name}`}
            className="w-7 h-full text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {isEditingDiscount ? (
          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1">
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyDiscount();
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsEditingDiscount(false);
                  }
                }}
                autoFocus
                placeholder="0"
                aria-label={`Discount on ${item.name}`}
                aria-invalid={discountError ? 'true' : undefined}
                className={`w-24 h-7 pl-2 pr-2 text-xs tabular rounded-lg border bg-white focus:outline-none focus:ring-[3px] ${
                  discountError
                    ? 'border-rose-500 focus:ring-rose-600/15'
                    : 'border-slate-300 focus:border-brand-600 focus:ring-brand-600/20'
                }`}
              />
              {discountError && (
                <span className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-rose-600 animate-in fade-in">
                  {discountError}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={applyDiscount}
              disabled={Boolean(discountError)}
              aria-label="Apply discount"
              className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingDiscount(false)}
              aria-label="Cancel discount"
              className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={openDiscount}
              className={`h-7 px-2 text-xs rounded-lg flex items-center gap-1 transition-colors ${
                item.discount > 0 ? 'text-rose-700 bg-rose-50 hover:bg-rose-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Tag className="w-3 h-3" />
              {item.discount > 0 ? 'Edit discount' : 'Discount'}
            </button>
            <button
              type="button"
              onClick={remove}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
              title="Remove from bill"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
