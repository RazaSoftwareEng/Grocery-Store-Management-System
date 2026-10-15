import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select, FieldMessage } from '../common/Input';
import { FormErrorSummary } from '../common/FormErrorSummary';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Trash2, Boxes, PackageOpen } from 'lucide-react';

export function PurchaseModal({ isOpen, onClose, suppliers, onSuccess }) {
  const { products, currencySymbol } = useStore();
  const { showToast } = useToast();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplierId || '');
  const [items, setItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.productId || '');
  const [quantity, setQuantity] = useState('10');
  const [unitCost, setUnitCost] = useState('');
  const [lineErrors, setLineErrors] = useState({});
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSupplier = suppliers.find((s) => s.supplierId === supplierId);
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  const v = useFormValidation(
    { supplierId, items, amountPaid },
    {
      supplierId: (val) => (!val ? 'Choose a supplier' : ''),
      items: (val) => (val.length === 0 ? 'Add at least one product to this order' : ''),
      amountPaid: (val) => {
        if (String(val).trim() === '') return '';
        const n = Number(val);
        if (Number.isNaN(n)) return 'Numbers only';
        if (n < 0) return "Amount can't be negative";
        if (subtotal > 0 && n > subtotal) return `Can't be more than the order total (${formatCurrency(subtotal, currencySymbol)})`;
        return '';
      },
    }
  );

  useEffect(() => {
    if (isOpen) {
      setSupplierId((prev) => prev || suppliers[0]?.supplierId || '');
      setSelectedProductId((prev) => prev || products[0]?.productId || '');
      v.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddItem = () => {
    const prod = products.find((p) => p.productId === selectedProductId);
    const errs = {};
    if (!prod) errs.selectedProductId = 'Choose a product';

    const qty = parseFloat(quantity);
    if (String(quantity).trim() === '' || Number.isNaN(qty)) errs.quantity = 'Enter a quantity';
    else if (qty <= 0) errs.quantity = 'Must be more than 0';

    const costRaw = unitCost === '' ? prod?.costPrice : unitCost;
    const cost = parseFloat(costRaw);
    if (Number.isNaN(cost)) errs.unitCost = 'Enter the unit cost';
    else if (cost < 0) errs.unitCost = "Can't be negative";

    setLineErrors(errs);
    if (Object.keys(errs).length) return;

    const existingIdx = items.findIndex((it) => it.productId === prod.productId);
    if (existingIdx !== -1) {
      const updated = [...items];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: updated[existingIdx].quantity + qty,
        unitCost: cost,
      };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

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
        showToast('Purchase order created. Confirm it when the goods arrive.', 'success');
        setItems([]);
        setNotes('');
        setAmountPaid('0');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'Failed to create purchase', 'error');
      }
    } catch {
      showToast('Could not create the purchase order. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const balance = Math.max(0, subtotal - (parseFloat(amountPaid) || 0));
  const itemsError = v.errorFor('items');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New purchase order"
      subtitle="Record goods coming in from a supplier."
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="purchase-form" variant="primary" isLoading={isSubmitting} icon={Boxes}>
            Create purchase order
          </Button>
        </>
      }
    >
      <form id="purchase-form" ref={v.formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormErrorSummary validation={v} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Supplier *"
            options={suppliers.map((s) => ({ value: s.supplierId, label: s.name }))}
            placeholder={suppliers.length ? 'Select a supplier' : 'No suppliers yet. Add one first.'}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            {...v.field('supplierId')}
          />

          <Input
            label="Notes or delivery challan #"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Challan #4492"
            optional
          />
        </div>

        {/* Line items */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden" data-field="items">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <p className="text-[13px] font-semibold text-slate-900 mb-3">Add products</p>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-start">
              <Select
                label="Product"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setLineErrors((prev) => ({ ...prev, selectedProductId: '' }));
                  const p = products.find((prod) => prod.productId === e.target.value);
                  if (p) setUnitCost(String(p.costPrice));
                }}
                error={lineErrors.selectedProductId}
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </Select>

              <Input
                label="Quantity"
                type="number"
                inputMode="decimal"
                min="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setLineErrors((prev) => ({ ...prev, quantity: '' }));
                }}
                className="tabular"
                error={lineErrors.quantity}
              />

              <Input
                label="Unit cost"
                type="number"
                inputMode="decimal"
                step="any"
                value={unitCost}
                onChange={(e) => {
                  setUnitCost(e.target.value);
                  setLineErrors((prev) => ({ ...prev, unitCost: '' }));
                }}
                placeholder={String(products.find((p) => p.productId === selectedProductId)?.costPrice ?? '0')}
                suffix={currencySymbol}
                className="tabular"
                error={lineErrors.unitCost}
              />

              <div className="flex flex-col gap-1.5">
                <span className="hidden sm:block min-h-5" />
                <Button variant="secondary" icon={Plus} onClick={handleAddItem}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {items.length === 0 ? (
              <div className={`py-8 px-4 text-center ${itemsError ? 'bg-rose-50/60' : ''}`}>
                <PackageOpen className={`w-6 h-6 mx-auto mb-2 ${itemsError ? 'text-rose-400' : 'text-slate-300'}`} strokeWidth={1.6} />
                <p className="text-[13px] text-slate-500">No products added yet.</p>
                <div className="flex justify-center mt-2">
                  <FieldMessage error={itemsError} />
                </div>
              </div>
            ) : (
              <table className="w-full text-[13px] text-left">
                <thead className="bg-white text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium">Item</th>
                    <th className="px-4 py-2 text-xs font-medium text-right">Qty</th>
                    <th className="px-4 py-2 text-xs font-medium text-right">Unit cost</th>
                    <th className="px-4 py-2 text-xs font-medium text-right">Total</th>
                    <th className="px-2 py-2 w-10"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.productId} className="hover:bg-slate-50 animate-in fade-in slide-in-from-top-1">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{it.productName}</td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {it.quantity} <span className="text-slate-400">{it.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{formatCurrency(it.unitCost, currencySymbol)}</td>
                      <td className="px-4 py-2.5 text-right tabular font-semibold text-slate-900">
                        {formatCurrency(it.quantity * it.unitCost, currencySymbol)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label={`Remove ${it.productName}`}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <Input
            label="Amount paid now"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
            suffix={currencySymbol}
            className="tabular"
            hint="Leave 0 if the whole amount is on credit."
            {...v.field('amountPaid')}
          />

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-[13px] space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Order total</span>
              <span className="text-slate-900 font-semibold tabular">{formatCurrency(subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-500">Balance on credit</span>
              <span className={`font-semibold tabular ${balance > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {formatCurrency(balance, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
