import React, { useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Printer, Check, Plus, Store, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';

export function ReceiptModal({
  isOpen,
  onClose,
  saleData,
}) {
  const { settings, currencySymbol } = useStore();
  const receiptRef = useRef(null);

  if (!saleData || !saleData.sale) return null;

  const sale = saleData.sale;
  const items = saleData.items || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sale Completed"
      subtitle={`Invoice ${sale.invoiceNumber} recorded successfully`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Success badge */}
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2.5 text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Inventory updated & recorded to Google Sheets</span>
        </div>

        {/* Thermal Receipt Paper Layout */}
        <div
          id="printable-receipt"
          ref={receiptRef}
          className="p-5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-xs shadow-inner space-y-3"
          style={{ maxWidth: '80mm', margin: '0 auto' }}
        >
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">
              {settings.storeName}
            </h2>
            {settings.tagline && (
              <p className="text-[10px] text-slate-500">{settings.tagline}</p>
            )}
            <p className="text-[10px] text-slate-500">{settings.address}</p>
            <p className="text-[10px] text-slate-500">Tel: {settings.phone}</p>
          </div>

          {/* Metadata */}
          <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-bold">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{formatDate(sale.date || sale.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span>{sale.cashierName || 'Cashier'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span>{sale.customerName || 'Walk-in'}</span>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2.5">
            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500">
              <span className="flex-1 text-left">Item</span>
              <span className="w-12 text-center">Qty</span>
              <span className="w-16 text-right">Price</span>
              <span className="w-16 text-right">Total</span>
            </div>

            {items.map((item, idx) => (
              <div key={item.saleItemId || idx} className="text-[11px]">
                <div className="font-semibold text-slate-900 truncate">
                  {item.productName || item.name}
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span className="flex-1 text-slate-400">
                    {item.discount > 0 ? `(Disc: ${item.discount})` : ''}
                  </span>
                  <span className="w-12 text-center font-bold">
                    {item.quantity} {item.unit || 'pc'}
                  </span>
                  <span className="w-16 text-right">
                    {formatCurrency(item.unitPrice || item.sellingPrice, currencySymbol)}
                  </span>
                  <span className="w-16 text-right font-bold text-slate-900">
                    {formatCurrency(item.lineTotal, currencySymbol)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Financial Totals */}
          <div className="space-y-1 text-xs pt-1 border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span>{formatCurrency(sale.subtotal, currencySymbol)}</span>
            </div>
            {Number(sale.discount) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount, currencySymbol)}</span>
              </div>
            )}
            {Number(sale.tax) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax:</span>
                <span>+{formatCurrency(sale.tax, currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
              <span>Grand Total:</span>
              <span>{formatCurrency(sale.total, currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 pt-1">
              <span>Paid via {sale.paymentMethod}:</span>
              <span>{formatCurrency(sale.amountPaid, currencySymbol)}</span>
            </div>
            {sale.paymentMethod === 'CASH' && Number(sale.change) > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-emerald-700">
                <span>Change Returned:</span>
                <span>{formatCurrency(sale.change, currencySymbol)}</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 space-y-1">
            <p className="text-[10px] text-slate-500 leading-tight">
              {settings.receiptFooter || 'Thank you for shopping with us! Please come again.'}
            </p>
            <p className="text-[9px] text-slate-400">Software: Grocery Store Management System</p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Printer}
              onClick={handlePrint}
            >
              Print Receipt
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={onClose}
              className="font-bold"
            >
              New Sale
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
