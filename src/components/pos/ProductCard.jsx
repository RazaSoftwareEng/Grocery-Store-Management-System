import React, { useRef } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function ProductCard({ product, onAdd, currencySymbol, allowNegativeStock }) {
  const stock = Number(product.currentStock) || 0;
  const minStock = Number(product.minimumStock) || 0;
  const isOutOfStock = stock <= 0 && !allowNegativeStock;
  const isLowStock = stock > 0 && stock <= minStock;
  const ref = useRef(null);

  const handleClick = () => {
    if (isOutOfStock) return;
    onAdd(product);
    const el = ref.current;
    if (el) {
      el.classList.remove('animate-flash');
      void el.offsetWidth; // restart the animation
      el.classList.add('animate-flash');
    }
  };

  return (
    <button
      type="button"
      ref={ref}
      onClick={handleClick}
      aria-disabled={isOutOfStock || undefined}
      aria-label={`${product.name}, ${formatCurrency(product.sellingPrice, currencySymbol)}${isOutOfStock ? ', out of stock' : ''}`}
      className={`group relative bg-white rounded-xl border p-3 flex flex-col justify-between text-left select-none transition-[border-color,box-shadow,transform] duration-150 ${
        isOutOfStock
          ? 'opacity-55 border-slate-200 cursor-not-allowed'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98]'
      }`}
    >
      <div className="w-full">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-xs text-slate-500 truncate" title={product.categoryName}>
            {product.categoryName || 'General'}
          </span>

          {isOutOfStock ? (
            <span className="text-xs font-medium text-rose-700 shrink-0">Out of stock</span>
          ) : isLowStock ? (
            <span className="text-xs font-medium text-amber-700 tabular shrink-0">{stock} left</span>
          ) : (
            <span className="text-xs text-slate-400 tabular shrink-0">
              {stock} {product.unit || 'pcs'}
            </span>
          )}
        </div>

        <h4 className="text-[13px] font-medium text-slate-900 line-clamp-2 min-h-[2.25rem] leading-[1.15rem]">
          {product.name}
        </h4>
      </div>

      <div className="w-full mt-3 flex items-end justify-between gap-1">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-900 tabular block truncate">
            {formatCurrency(product.sellingPrice, currencySymbol)}
          </span>
          <span className="text-xs text-slate-400 block truncate">per {product.unit || 'pc'}</span>
        </div>

        {!isOutOfStock && (
          <span className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 group-hover:bg-brand-600 group-hover:border-brand-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
            <Plus className="w-4 h-4" strokeWidth={2.2} />
          </span>
        )}
      </div>
    </button>
  );
}
