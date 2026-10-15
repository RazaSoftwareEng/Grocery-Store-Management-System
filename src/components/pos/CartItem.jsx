import React from 'react';
import { Minus, Plus, Trash2, Tag } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function CartItem({
  item,
  onUpdateQty,
  onRemove,
  onUpdateDiscount,
  currencySymbol,
}) {
  const lineTotal = item.sellingPrice * item.quantity - (item.discount || 0);

  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h5 className="text-xs font-bold text-slate-800 leading-snug truncate">
            {item.name}
          </h5>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
            <span>{formatCurrency(item.sellingPrice, currencySymbol)}</span>
            <span>×</span>
            <span className="font-semibold text-slate-700">
              {item.quantity} {item.unit}
            </span>
            {item.discount > 0 && (
              <span className="text-rose-600 font-medium">
                (-{formatCurrency(item.discount, currencySymbol)})
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-black text-slate-900 block">
            {formatCurrency(lineTotal, currencySymbol)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(item.productId)}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 mt-0.5 inline-block"
            title="Remove from cart"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stepper & Discount row */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
            className="w-6 h-6 rounded-md bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdateQty(item.productId, Math.max(1, parseInt(e.target.value) || 1))}
            className="w-10 text-center text-xs font-bold bg-transparent text-slate-800 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
            className="w-6 h-6 rounded-md bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              const current = item.discount || 0;
              const val = prompt(`Enter discount for ${item.name} (${currencySymbol}):`, current);
              if (val !== null) {
                onUpdateDiscount(item.productId, parseFloat(val) || 0);
              }
            }}
            className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors"
          >
            <Tag className="w-3 h-3" />
            {item.discount > 0 ? `Disc: ${item.discount}` : 'Discount'}
          </button>
        </div>
      </div>
    </div>
  );
}
