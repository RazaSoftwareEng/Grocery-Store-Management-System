import React from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function ProductCard({ product, onAdd, currencySymbol, allowNegativeStock }) {
  const stock = Number(product.currentStock) || 0;
  const minStock = Number(product.minimumStock) || 0;
  const isOutOfStock = stock <= 0 && !allowNegativeStock;
  const isLowStock = stock > 0 && stock <= minStock;

  return (
    <div
      onClick={() => !isOutOfStock && onAdd(product)}
      className={`group relative bg-white rounded-xl border transition-all duration-150 p-2.5 sm:p-3 flex flex-col justify-between text-left select-none ${
        isOutOfStock
          ? 'opacity-60 border-slate-200 cursor-not-allowed bg-slate-50/80'
          : 'border-slate-200/90 hover:border-emerald-500 hover:shadow-md cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]'
      }`}
    >
      <div>
        {/* Category & Stock Status Header */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[95px]"
            title={product.categoryName}
          >
            {product.categoryName || 'General'}
          </span>

          {isOutOfStock ? (
            <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded">
              Out
            </span>
          ) : isLowStock ? (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {stock} left
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-500">
              {stock} {product.unit || 'pcs'}
            </span>
          )}
        </div>

        {/* Product Name (Always 2-line height so all cards align perfectly) */}
        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[2rem] leading-snug group-hover:text-emerald-700 transition-colors">
          {product.name}
        </h4>

        {/* Barcode / SKU snippet */}
        {(product.barcode || product.sku) && (
          <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">
            {product.barcode || product.sku}
          </p>
        )}
      </div>

      {/* Price & Add Button Footer */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
        <div className="min-w-0 flex-1">
          <span className="text-xs sm:text-sm font-black text-slate-900 font-mono tracking-tight block truncate">
            {formatCurrency(product.sellingPrice, currencySymbol)}
          </span>
          <span className="text-[9px] text-slate-400 block -mt-0.5 truncate">
            per {product.unit || 'pc'}
          </span>
        </div>

        <button
          type="button"
          disabled={isOutOfStock}
          aria-label={`Add ${product.name} to cart`}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
