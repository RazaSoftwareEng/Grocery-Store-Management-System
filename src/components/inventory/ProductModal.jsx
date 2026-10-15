import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Sparkles,
  Barcode,
  Plus,
  Boxes,
  TrendingUp,
  Tag,
  CheckCircle2,
  PackagePlus,
  Package
} from 'lucide-react';

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

export function ProductModal({
  isOpen,
  onClose,
  product = null,
  onSave,
}) {
  const { categories, refreshAllData, saveProductOptimistic, currencySymbol } = useStore();
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
  const [isAddingCategory, setIsAddingCategory] = useState(false);

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
        currentStock: '10', // Clear starting stock default
        minimumStock: '5',
        expiryDate: '',
        status: 'ACTIVE',
      });
    }
  }, [product, categories, isOpen]);

  const generateRandomSku = () => {
    setFormData((prev) => ({
      ...prev,
      sku: 'SKU-' + Math.floor(100000 + Math.random() * 900000),
    }));
  };

  const handleStockChip = (amount) => {
    const cur = Number(formData.currentStock) || 0;
    setFormData((prev) => ({ ...prev, currentStock: String(cur + amount) }));
  };

  const handleSetStock = (val) => {
    setFormData((prev) => ({ ...prev, currentStock: String(val) }));
  };

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('Please enter a category name', 'warning');
      return;
    }

    try {
      setIsAddingCategory(true);
      const res = await api.saveCategory({
        name: newCategoryName.trim(),
        description: 'Created via product modal',
        status: 'ACTIVE',
      });

      if (res.success) {
        showToast(`Category "${newCategoryName.trim()}" created in Google Sheet!`, 'success');
        await refreshAllData();
        const createdId = res.data?.categoryId;
        if (createdId) {
          setFormData((prev) => ({ ...prev, categoryId: createdId }));
        }
        setNewCategoryName('');
        setShowQuickCategory(false);
      } else {
        showToast(res.error || 'Failed to create category', 'error');
      }
    } catch {
      showToast('Error creating category in Google Sheets', 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Product name is required', 'warning');
      return;
    }

    if (!formData.categoryId) {
      showToast('Please select a category', 'warning');
      return;
    }

    const cost = parseFloat(formData.costPrice) || 0;
    const sell = parseFloat(formData.sellingPrice) || 0;

    if (sell < cost && sell > 0) {
      const confirmUnder = window.confirm(
        `Warning: Selling price (${currencySymbol} ${sell}) is less than cost price (${currencySymbol} ${cost}). Continue?`
      );
      if (!confirmUnder) return;
    }

    try {
      setIsSubmitting(true);

      // Instant optimistic save (0ms reaction for end user)
      showToast(
        product ? 'Product updated successfully' : `Added "${formData.name.trim()}" with ${formData.currentStock} ${formData.unit} stock!`,
        'success'
      );
      if (onSave) onSave();
      onClose();

      // Trigger background sync to Google Sheets
      await saveProductOptimistic(formData);
    } catch {
      showToast('Error syncing product to Google Sheets', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.categoryId,
    label: c.name,
  }));

  const stockNum = Number(formData.currentStock) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product Details' : 'Add New Grocery Product'}
      subtitle={
        product
          ? `Update catalog item: ${product.name}`
          : 'Create a new grocery item with instant stock entry in Google Sheets'
      }
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Title */}
        <Input
          label="Product Title / Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. Super Kernel Basmati Rice 5kg or Olper's Milk 1L"
          required
          autoFocus
        />

        {/* Category & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Product Category *
              </label>
              <button
                type="button"
                onClick={() => setShowQuickCategory(!showQuickCategory)}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {showQuickCategory ? 'Cancel' : '+ New Category'}
              </button>
            </div>

            {showQuickCategory ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Frozen Foods, Dairy..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleQuickAddCategory}
                  isLoading={isAddingCategory}
                  className="px-2.5 py-2 text-xs font-bold shrink-0"
                >
                  Save
                </Button>
              </div>
            ) : (
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                required
              >
                {categoryOptions.length === 0 ? (
                  <option value="">No categories created yet - click + New Category above</option>
                ) : (
                  categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <Select
            label="Unit of Measurement *"
            options={UNIT_OPTIONS}
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            required
          />
        </div>

        {/* PROMINENT STOCK ENTRY CARD */}
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/70 rounded-2xl border-2 border-emerald-200/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-emerald-950 block">
                  {product ? 'Current Inventory Stock Level' : 'Initial Stock Quantity on Hand *'}
                </label>
                <p className="text-[11px] text-emerald-700">
                  How many <strong className="uppercase">{formData.unit}</strong> are physically in your shop right now?
                </p>
              </div>
            </div>

            {/* Live Stock Status Indicator */}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                stockNum > Number(formData.minimumStock || 5)
                  ? 'bg-emerald-200 text-emerald-900'
                  : stockNum > 0
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-rose-200 text-rose-900'
              }`}
            >
              {stockNum > 0 ? `📦 ${stockNum} ${formData.unit}` : '🔴 Out of Stock (0)'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <div className="relative w-full sm:w-48">
              <input
                type="number"
                min="0"
                step="any"
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                className="w-full px-4 py-2.5 text-base font-black bg-white border-2 border-emerald-400 rounded-xl text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="10"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 uppercase">
                {formData.unit}
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mr-1">
                Quick:
              </span>
              {[5, 10, 25, 50, 100].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => handleSetStock(qty)}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {qty}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleStockChip(10)}
                className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs"
                title="Add 10 more to current stock"
              >
                +10
              </button>
            </div>
          </div>
        </div>

        {/* Pricing & Margins */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <Input
            label={`Purchase / Cost Price (${currencySymbol}) *`}
            type="number"
            step="any"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            placeholder="0.00"
            required
          />

          <Input
            label={`Retail Selling Price (${currencySymbol}) *`}
            type="number"
            step="any"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        {/* SKU, Barcode & Minimum Threshold */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                SKU Code *
              </label>
              <button
                type="button"
                onClick={generateRandomSku}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Auto
              </button>
            </div>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
              required
            />
          </div>

          <Input
            label="Barcode (Scan / Type)"
            icon={Barcode}
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            placeholder="e.g. 896400012345"
          />

          <Input
            label="Min Stock Warning Level"
            type="number"
            value={formData.minimumStock}
            onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
            placeholder="5"
          />
        </div>

        {/* Status */}
        {product && (
          <div className="pt-1">
            <Select
              label="Product Status"
              options={[
                { value: 'ACTIVE', label: 'Active (Visible in POS & Catalog)' },
                { value: 'INACTIVE', label: 'Inactive / Hidden' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} icon={PackagePlus}>
            {product ? 'Update Product' : 'Save & Add Product (Instant)'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
