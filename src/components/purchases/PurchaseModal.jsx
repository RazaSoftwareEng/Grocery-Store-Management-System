import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Trash2, Boxes } from 'lucide-react';

export function PurchaseModal({ isOpen, onClose, suppliers, onSuccess }) {
  const { products, currencySymbol } = useStore();
  const { showToast } = useToast();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplierId || '');
  const [items, setItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.productId || '');
  const [quantity, setQuantity] = useState('10');
  const [unitCost, setUnitCost] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSupplier = suppliers.find((s) => s.supplierId === supplierId);

  const handleAddItem = () => {
    const prod = products.find((p) => p.productId === selectedProductId);
    if (!prod) return;

    const qty = parseFloat(quantity) || 0;
    const cost = parseFloat(unitCost || prod.costPrice) || 0;

    if (qty <= 0) {
      showToast('Quantity must be greater than 0', 'warning');
      return;
    }

    // Check if already in items list
    const existingIdx = items.findIndex((it) => it.productId === prod.productId);
    if (existingIdx !== -1) {
      const updated = [...items];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].unitCost = cost;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: prod.productId,
          productName: prod.name,
          unit: prod.unit,
          quantity: qty,
          unitCost: cost,
        },
      ]);
    }

    setQuantity('10');
    setUnitCost('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supplierId) {
      showToast('Please select a supplier', 'warning');
      return;
    }

    if (!items.length) {
      showToast('Please add at least one product to this purchase order', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createPurchase({
        supplierId,
        supplierName: activeSupplier?.name || 'Supplier',
        items,
        amountPaid: parseFloat(amountPaid) || 0,
        notes,
      });

      if (res.success) {
        showToast('Purchase order created (Status: PENDING)', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'Failed to create purchase', 'error');
      }
    } catch {
      showToast('Error creating purchase order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Stock Purchase Order"
      subtitle="Record incoming goods from suppliers"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Supplier Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Supplier *"
            options={suppliers.map((s) => ({ value: s.supplierId, label: s.name }))}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          />

          <Input
            label="Order Notes / Delivery Note #"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Delivery challan # 4492"
          />
        </div>

        {/* Add Products Line Item Section */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Add Products to Purchase Order
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Select Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = products.find((prod) => prod.productId === e.target.value);
                  if (p) setUnitCost(String(p.costPrice));
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div>
              <Input
                label={`Cost Price (${currencySymbol})`}
                type="number"
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Unit Cost"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={handleAddItem}
              className="bg-white border border-slate-200 text-xs font-bold"
            >
              Add Item to Order
            </Button>
          </div>
        </div>

        {/* Added Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Item</th>
                <th className="p-2.5 text-center">Qty</th>
                <th className="p-2.5 text-right">Cost Price</th>
                <th className="p-2.5 text-right">Line Total</th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-800">{it.productName}</td>
                  <td className="p-2.5 text-center">
                    {it.quantity} {it.unit}
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    {formatCurrency(it.unitCost, currencySymbol)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(it.quantity * it.unitCost, currencySymbol)}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 text-xs">
                    No products added to this purchase order yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Payments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Input
            label={`Amount Paid Now (${currencySymbol})`}
            type="number"
            step="any"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
          />

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between text-xs">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-600">Total Purchase:</span>
              <span className="text-slate-900 font-bold">
                {formatCurrency(subtotal, currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
              <span className="text-slate-600">Balance on Credit:</span>
              <span className="text-amber-800">
                {formatCurrency(Math.max(0, subtotal - (parseFloat(amountPaid) || 0)), currencySymbol)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={Boxes}
            className="font-bold"
          >
            Create Purchase Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
