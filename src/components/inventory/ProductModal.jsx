import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select, FieldLabel, FieldMessage, controlBase, controlState } from '../common/Input';
import { FormErrorSummary } from '../common/FormErrorSummary';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { api } from '../../services/api';
import { Sparkles, Barcode, Plus, Minus, PackagePlus, TrendingUp, TrendingDown, X } from 'lucide-react';

const UNIT_OPTIONS = [
  { value: 'piece', label: 'Piece (pc)' },
  { value: 'packet', label: 'Packet (pkt)' },
  { value: 'carton', label: 'Carton (ctn)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'bottle', label: 'Bottle (btl)' },
  { value: 'box', label: 'Box' },
  { value: 'dozen', label: 'Dozen' },
];

const isWhole = (v) => /^\d+(\.\d+)?$/.test(String(v).trim());

function Section({ title, description, children }) {
  return (
    <section className="grid md:grid-cols-[180px_minmax(0,1fr)] gap-x-6 gap-y-3 py-5 first:pt-0 border-b border-slate-200 last:border-0 last:pb-0">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {description && <p className="text-[13px] text-slate-500 mt-0.5 leading-5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">{children}</div>
    </section>
  );
}

export function ProductModal({
  isOpen,
  onClose,
  product = null,
  onSave,
}) {
  const { categories, products = [], refreshAllData, saveProductOptimistic, currencySymbol } = useStore();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'piece',
    costPrice: '',
    sellingPrice: '',
    currentStock: '10', // Default to 10 so it's not out-of-stock
    minimumStock: '5',
    expiryDate: '',
    status: 'ACTIVE',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const otherProducts = products.filter((p) => p.productId !== product?.productId);

  const v = useFormValidation(formData, {
    name: (val) => {
      const t = val.trim();
      if (!t) return 'Product name is required';
      if (t.length < 2) return 'Name must be at least 2 characters';
      if (t.length > 80) return 'Keep the name under 80 characters';
      if (otherProducts.some((p) => p.name?.trim().toLowerCase() === t.toLowerCase())) {
        return 'A product with this name already exists';
      }
      return '';
    },
    categoryId: (val) => (!val ? 'Choose a category' : ''),
    unit: (val) => (!val ? 'Choose a unit' : ''),
    costPrice: (val) => {
      if (String(val).trim() === '') return 'Enter the cost price';
      if (Number.isNaN(Number(val))) return 'Numbers only';
      return Number(val) < 0 ? "Cost price can't be negative" : '';
    },
    sellingPrice: (val) => {
      if (String(val).trim() === '') return 'Enter the selling price';
      if (Number.isNaN(Number(val))) return 'Numbers only';
      return Number(val) <= 0 ? 'Selling price must be more than 0' : '';
    },
    currentStock: (val) => {
      if (String(val).trim() === '') return 'Enter the stock quantity';
      return isWhole(val) ? '' : 'Enter 0 or a positive number';
    },
    minimumStock: (val) => (String(val).trim() === '' || isWhole(val) ? '' : 'Enter 0 or a positive number'),
    sku: (val) => {
      const t = val.trim();
      if (!t) return 'SKU is required';
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(t)) return '3–24 letters, numbers, dashes or underscores';
      const dup = otherProducts.find((p) => p.sku?.toLowerCase() === t.toLowerCase());
      return dup ? `Already used by "${dup.name}"` : '';
    },
    barcode: (val) => {
      const t = val.trim();
      if (!t) return '';
      if (!/^[A-Za-z0-9-]{4,32}$/.test(t)) return 'Letters and numbers only (4–32 characters)';
      const dup = otherProducts.find((p) => p.barcode && p.barcode === t);
      return dup ? `Already used by "${dup.name}"` : '';
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        productId: product.productId,
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || (categories[0]?.categoryId || ''),
        unit: product.unit || 'piece',
        costPrice: String(product.costPrice ?? ''),
        sellingPrice: String(product.sellingPrice ?? ''),
        currentStock: String(product.currentStock ?? '10'),
        minimumStock: String(product.minimumStock ?? '5'),
        expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : '',
        status: product.status || 'ACTIVE',
      });
    } else {
      setFormData({
        name: '',
        sku: 'SKU-' + Math.floor(100000 + Math.random() * 900000),
        barcode: '',
        categoryId: categories[0]?.categoryId || '',
        unit: 'piece',
        costPrice: '',
        sellingPrice: '',
        currentStock: '10',
        minimumStock: '5',
        expiryDate: '',
        status: 'ACTIVE',
      });
    }
  }, [product, categories, isOpen]);

  useEffect(() => {
    if (isOpen) {
      v.reset();
      setShowQuickCategory(false);
      setNewCategoryName('');
      setNewCategoryError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const generateRandomSku = () => {
    setFormData((prev) => ({
      ...prev,
      sku: 'SKU-' + Math.floor(100000 + Math.random() * 900000),
    }));
    v.touch('sku');
  };

  const handleStockStep = (amount) => {
    setFormData((prev) => ({
      ...prev,
      currentStock: String(Math.max(0, (Number(prev.currentStock) || 0) + amount)),
    }));
    v.touch('currentStock');
  };

  const handleSetStock = (val) => {
    setFormData((prev) => ({ ...prev, currentStock: String(val) }));
    v.touch('currentStock');
  };

  const handleQuickAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setNewCategoryError('Enter a category name');
      return;
    }
    if (categories.some((c) => c.name?.trim().toLowerCase() === name.toLowerCase())) {
      setNewCategoryError('This category already exists');
      return;
    }

    try {
      setIsAddingCategory(true);
      const res = await api.saveCategory({
        name,
        description: 'Created via product modal',
        status: 'ACTIVE',
      });

      if (res.success) {
        showToast(`Category "${name}" created`, 'success');
        await refreshAllData();
        const createdId = res.data?.categoryId;
        if (createdId) {
          setFormData((prev) => ({ ...prev, categoryId: createdId }));
        }
        setNewCategoryName('');
        setNewCategoryError('');
        setShowQuickCategory(false);
      } else {
        setNewCategoryError(res.error || 'Failed to create category');
      }
    } catch {
      setNewCategoryError('Could not create the category. Check your connection and try again.');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);

      const res = await saveProductOptimistic(formData);
      if (res.success) {
        showToast(
          product
            ? `"${formData.name.trim()}" updated`
            : `"${formData.name.trim()}" added with ${formData.currentStock} ${formData.unit} in stock`,
          'success'
        );
        if (onSave) onSave();
        onClose();
      } else {
        showToast(res.error || 'Could not save the product', 'error');
      }
    } catch {
      showToast('Could not save the product. Check your connection and try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.categoryId,
    label: c.name,
  }));

  const stockNum = Number(formData.currentStock) || 0;
  const minNum = Number(formData.minimumStock) || 0;
  const cost = parseFloat(formData.costPrice);
  const sell = parseFloat(formData.sellingPrice);
  const hasPrices = cost >= 0 && sell > 0 && !Number.isNaN(cost);
  const margin = hasPrices ? sell - cost : 0;
  const marginPct = hasPrices ? (margin / sell) * 100 : 0;
  const isLoss = hasPrices && sell < cost;

  const stockErr = v.errorFor('currentStock');
  const minWarn =
    !v.errorFor('minimumStock') && formData.minimumStock !== '' && minNum > stockNum
      ? 'Higher than current stock, so this item will show as low stock.'
      : '';

  const stockStatus =
    stockNum <= 0
      ? { label: 'Out of stock', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
      : stockNum <= minNum
      ? { label: 'Low stock', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
      : { label: 'In stock', cls: 'bg-brand-50 text-brand-700 border-brand-100' };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit product' : 'Add product'}
      subtitle={product ? product.name : 'Add a new item to your catalog with its opening stock.'}
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" variant="primary" isLoading={isSubmitting} icon={PackagePlus}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form id="product-form" ref={v.formRef} onSubmit={handleSubmit} noValidate>
        <FormErrorSummary validation={v} className="mb-5" />

        <Section title="Basic details" description="Customers see this name on the receipt.">
          <Input
            label="Product name *"
            value={formData.name}
            onChange={set('name')}
            placeholder="e.g. Olper's Full Cream Milk 1L"
            containerClassName="sm:col-span-2"
            hint="Include brand and size so cashiers can find it quickly."
            autoFocus
            {...v.field('name')}
          />

          <div className="flex flex-col gap-1.5 min-w-0" data-field="categoryId">
            <FieldLabel
              htmlFor="categoryId"
              label="Category *"
              aside={
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickCategory(!showQuickCategory);
                    setNewCategoryError('');
                  }}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  {showQuickCategory ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {showQuickCategory ? 'Cancel' : 'New category'}
                </button>
              }
            />

            {showQuickCategory ? (
              <div className="animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (newCategoryError) setNewCategoryError('');
                    }}
                    placeholder="e.g. Frozen foods"
                    aria-label="New category name"
                    aria-invalid={newCategoryError ? 'true' : undefined}
                    className={`${controlBase} ${controlState(newCategoryError)}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddCategory();
                      }
                    }}
                  />
                  <Button variant="primary" onClick={handleQuickAddCategory} isLoading={isAddingCategory} className="shrink-0">
                    Save
                  </Button>
                </div>
                <div className="mt-1.5">
                  <FieldMessage error={newCategoryError} />
                </div>
              </div>
            ) : (
              <Select
                id="categoryId"
                options={categoryOptions}
                placeholder={categoryOptions.length === 0 ? 'No categories yet. Create one first.' : 'Select a category'}
                value={formData.categoryId}
                onChange={set('categoryId')}
                containerClassName="contents"
                {...v.field('categoryId')}
              />
            )}
          </div>

          <Select
            label="Unit *"
            options={UNIT_OPTIONS}
            value={formData.unit}
            onChange={set('unit')}
            {...v.field('unit')}
          />
        </Section>

        <Section title="Pricing" description="The margin updates as you type.">
          <Input
            label="Cost price *"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={formData.costPrice}
            onChange={set('costPrice')}
            placeholder="0.00"
            suffix={currencySymbol}
            className="tabular"
            {...v.field('costPrice')}
          />
          <Input
            label="Selling price *"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={formData.sellingPrice}
            onChange={set('sellingPrice')}
            placeholder="0.00"
            suffix={currencySymbol}
            className="tabular"
            warning={isLoss ? 'Below cost price. You will lose money on each sale.' : ''}
            {...v.field('sellingPrice')}
          />

          <div
            className={`sm:col-span-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[13px] transition-colors duration-200 ${
              !hasPrices
                ? 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
                : isLoss
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-brand-100 bg-brand-50 text-brand-700'
            }`}
            aria-live="polite"
          >
            {isLoss ? <TrendingDown className="w-4 h-4 shrink-0" /> : <TrendingUp className="w-4 h-4 shrink-0" />}
            {hasPrices ? (
              <span>
                {isLoss ? 'Loss' : 'Margin'}{' '}
                <span className="font-semibold tabular">
                  {currencySymbol} {Math.abs(margin).toFixed(2)}
                </span>{' '}
                per {formData.unit} · <span className="font-semibold tabular">{marginPct.toFixed(1)}%</span>
              </span>
            ) : (
              <span>Enter cost and selling price to see your margin</span>
            )}
          </div>
        </Section>

        <Section title="Inventory" description="Stock on hand and the level that triggers a low-stock alert.">
          <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-2" data-field="currentStock">
            <FieldLabel htmlFor="currentStock" label={product ? 'Current stock *' : 'Opening stock *'} aside={
              <span className={`inline-flex items-center h-5 px-2 rounded-full border text-xs font-medium ${stockStatus.cls}`}>
                {stockStatus.label}
              </span>
            } />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-stretch w-full sm:w-52">
                <button
                  type="button"
                  onClick={() => handleStockStep(-1)}
                  aria-label="Decrease stock"
                  className={`w-10 shrink-0 flex items-center justify-center border rounded-l-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors ${
                    stockErr ? 'border-rose-500' : 'border-slate-300'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="currentStock"
                  name="currentStock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="any"
                  value={formData.currentStock}
                  onChange={set('currentStock')}
                  onBlur={() => v.touch('currentStock')}
                  aria-invalid={stockErr ? 'true' : undefined}
                  className={`${controlBase} ${controlState(stockErr)} rounded-none text-center font-semibold tabular border-x-0 focus:ring-0`}
                />
                <button
                  type="button"
                  onClick={() => handleStockStep(1)}
                  aria-label="Increase stock"
                  className={`w-10 shrink-0 flex items-center justify-center border rounded-r-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors ${
                    stockErr ? 'border-rose-500' : 'border-slate-300'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-0.5">Quick set</span>
                {[5, 10, 25, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => handleSetStock(qty)}
                    className={`h-7 min-w-9 px-2 text-xs font-medium tabular rounded-lg border transition-colors ${
                      Number(formData.currentStock) === qty
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>
            <FieldMessage
              error={stockErr}
              hint={`How many ${formData.unit} are physically in the shop right now?`}
            />
          </div>

          <Input
            label="Low-stock alert at"
            type="number"
            inputMode="numeric"
            min="0"
            value={formData.minimumStock}
            onChange={set('minimumStock')}
            placeholder="5"
            className="tabular"
            optional
            warning={minWarn}
            {...v.field('minimumStock')}
          />

          <Input
            label="Expiry date"
            type="date"
            value={formData.expiryDate}
            onChange={set('expiryDate')}
            optional
            name="expiryDate"
            warning={
              formData.expiryDate && new Date(formData.expiryDate) < new Date(new Date().toDateString())
                ? 'This date is already in the past.'
                : ''
            }
          />

          <Input
            label="SKU *"
            value={formData.sku}
            onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
            className="font-mono text-[13px]"
            labelAside={
              <button
                type="button"
                onClick={generateRandomSku}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Generate
              </button>
            }
            {...v.field('sku')}
          />

          <Input
            label="Barcode"
            icon={Barcode}
            value={formData.barcode}
            onChange={set('barcode')}
            placeholder="Scan or type"
            className="font-mono text-[13px]"
            optional
            hint="Scan with the barcode reader while this field is focused."
            {...v.field('barcode')}
            isValid={v.field('barcode').isValid && !!formData.barcode}
          />

          {product && (
            <Select
              label="Status"
              options={[
                { value: 'ACTIVE', label: 'Active (visible in POS and catalog)' },
                { value: 'INACTIVE', label: 'Inactive (hidden)' },
              ]}
              value={formData.status}
              onChange={set('status')}
              containerClassName="sm:col-span-2"
            />
          )}
        </Section>
      </form>
    </Modal>
  );
}
