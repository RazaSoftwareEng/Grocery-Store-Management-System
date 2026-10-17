import React, { useRef, useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';

const COLUMNS = ['name', 'sku', 'barcode', 'category', 'unit', 'cost_price', 'selling_price', 'opening_stock', 'minimum_stock', 'expiry_date'];
const UNITS = ['piece', 'packet', 'carton', 'kg', 'gram', 'litre', 'bottle', 'box', 'dozen'];
const SAMPLE = [
  ['Olpers Milk 1L', '', '8964000000001', 'Dairy', 'piece', '270', '300', '24', '6', ''],
  ['Basmati Rice', 'RICE-KG', '', 'Grains', 'kg', '300', '350', '50', '10', ''],
  ['Tapal Danedar 450g', '', '8964000000002', 'Tea', 'packet', '760', '820', '12', '4', '2027-06-30'],
];

/** Minimal CSV parser: quoted fields, "" escapes, commas/newlines inside quotes */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const norm = (h) => String(h || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const HEADER_ALIASES = {
  product: 'name', product_name: 'name', item: 'name',
  cost: 'cost_price', purchase_price: 'cost_price',
  price: 'selling_price', sale_price: 'selling_price', retail_price: 'selling_price',
  stock: 'opening_stock', current_stock: 'opening_stock', quantity: 'opening_stock', qty: 'opening_stock',
  min_stock: 'minimum_stock', reorder_level: 'minimum_stock',
  expiry: 'expiry_date',
};

function toIsoDate(v) {
  const t = String(v || '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function ProductImportModal({ isOpen, onClose }) {
  const { products, categories, currencySymbol, refreshAllData } = useStore();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const reset = () => {
    setFileName('');
    setRows([]);
    setProgress(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const csv = '﻿' + [COLUMNS, ...SAMPLE].map((r) => r.map((c) => `"${c}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      showToast('The file has no product rows', 'warning');
      setRows([]);
      return;
    }
    const headers = table[0].map((h) => HEADER_ALIASES[norm(h)] || norm(h));
    if (!headers.includes('name') || !headers.includes('selling_price')) {
      showToast('The first row must have at least "name" and "selling_price" columns. Download the template.', 'error', 7000);
      setRows([]);
      return;
    }

    const bySku = new Map(products.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p]));
    const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [String(p.barcode), p]));
    const seenSku = new Set();
    const seenBarcode = new Set();

    setRows(
      table.slice(1).map((cells, idx) => {
        const r = Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? '').trim()]));
        const errors = [];
        const num = (key, { required = false } = {}) => {
          if (r[key] === '' || r[key] === undefined) {
            if (required) errors.push(`${key.replace('_', ' ')} is required`);
            return null;
          }
          const n = Number(String(r[key]).replace(/,/g, ''));
          if (!Number.isFinite(n) || n < 0) {
            errors.push(`${key.replace('_', ' ')} must be a number`);
            return null;
          }
          return n;
        };
        if (!r.name) errors.push('name is required');
        const sellingPrice = num('selling_price', { required: true });
        const costPrice = num('cost_price') ?? 0;
        const openingStock = num('opening_stock') ?? 0;
        const minimumStock = num('minimum_stock') ?? 5;
        const expiryDate = toIsoDate(r.expiry_date);
        if (expiryDate === null) errors.push('expiry_date must be YYYY-MM-DD or DD/MM/YYYY');
        const unit = (r.unit || 'piece').toLowerCase();

        const sku = r.sku || '';
        const barcode = r.barcode || '';
        if (sku && seenSku.has(sku.toLowerCase())) errors.push('SKU repeated in the file');
        if (barcode && seenBarcode.has(barcode)) errors.push('barcode repeated in the file');
        if (sku) seenSku.add(sku.toLowerCase());
        if (barcode) seenBarcode.add(barcode);

        const existing = (sku && bySku.get(sku.toLowerCase())) || (barcode && byBarcode.get(barcode)) || null;
        return {
          line: idx + 2,
          name: r.name,
          sku,
          barcode,
          category: r.category || '',
          unit: UNITS.includes(unit) ? unit : unit || 'piece',
          costPrice,
          sellingPrice,
          openingStock,
          minimumStock,
          expiryDate: expiryDate || '',
          existing,
          errors,
        };
      })
    );
  };

  const valid = rows.filter((r) => !r.errors.length);
  const newCount = valid.filter((r) => !r.existing).length;
  const updateCount = valid.length - newCount;

  const runImport = async () => {
    if (!valid.length) return;
    setIsImporting(true);
    setProgress(0);

    // Create missing categories first (matched by name, case-insensitive)
    const catIds = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.categoryId]));
    for (const name of [...new Set(valid.map((r) => r.category).filter(Boolean))]) {
      if (catIds.has(name.toLowerCase())) continue;
      const res = await api.saveCategory({ name, description: 'Created by bulk import', status: 'ACTIVE' });
      if (res.success) catIds.set(name.toLowerCase(), res.data.categoryId);
    }

    const failed = [];
    let done = 0;
    for (const r of valid) {
      const base = r.existing
        ? { ...r.existing }
        : { currentStock: r.openingStock, status: 'ACTIVE' };
      const res = await api.saveProduct({
        ...base,
        productId: r.existing?.productId || null,
        name: r.name,
        sku: r.sku || r.existing?.sku || '',
        barcode: r.barcode || r.existing?.barcode || '',
        categoryId: r.category ? catIds.get(r.category.toLowerCase()) || '' : r.existing?.categoryId || '',
        unit: r.unit,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        minimumStock: r.minimumStock,
        expiryDate: r.expiryDate || r.existing?.expiryDate || '',
      });
      if (!res.success) failed.push({ line: r.line, name: r.name, error: res.error });
      done += 1;
      setProgress(done);
    }

    setIsImporting(false);
    setResult({ ok: valid.length - failed.length, failed });
    refreshAllData(true);
    showToast(`${valid.length - failed.length} products imported${failed.length ? `, ${failed.length} failed` : ''}`, failed.length ? 'warning' : 'success');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Import products"
      subtitle="Add or update many products at once from a CSV file (Excel: File → Save As → CSV)."
      maxWidth="max-w-4xl"
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={isImporting}>Cancel</Button>
            <Button icon={Upload} onClick={runImport} isLoading={isImporting} disabled={!valid.length}>
              Import {valid.length || ''} products
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px]">
            <p className="font-semibold text-slate-900">1. Download the template</p>
            <p className="text-slate-500 mt-1">Fill it in Excel. Only name and selling_price are required.</p>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadTemplate} className="mt-3">
              Template CSV
            </Button>
          </div>
          <label className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white text-[13px] cursor-pointer block">
            <p className="font-semibold text-slate-900">2. Choose your file</p>
            <p className="text-slate-500 mt-1 truncate">{fileName || 'Click here and select a .csv file'}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-xl bg-brand-600 text-white font-medium">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Choose CSV
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={isImporting}
            />
          </label>
        </div>

        <p className="text-xs text-slate-500">
          A row whose SKU or barcode already exists updates that product (name, prices, category, unit). Its stock is not
          changed; use Stock count or Adjust for that. New categories are created automatically.
        </p>

        {isImporting && (
          <div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${(progress / valid.length) * 100}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1 tabular">{progress} / {valid.length} saved…</p>
          </div>
        )}

        {result && (
          <div className="p-3 rounded-xl border text-[13px] space-y-1 bg-emerald-50 border-emerald-200 text-emerald-900">
            <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {result.ok} products imported</p>
            {result.failed.map((f) => (
              <p key={f.line} className="text-rose-700">Line {f.line} ({f.name}): {f.error}</p>
            ))}
          </div>
        )}

        {rows.length > 0 && !result && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">{newCount} new</span>
              <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">{updateCount} update</span>
              {rows.length - valid.length > 0 && (
                <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                  {rows.length - valid.length} with errors (skipped)
                </span>
              )}
            </div>
            <div className="max-h-[45vh] overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Line</th>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Category</th>
                    <th className="text-right px-3 py-2">Price</th>
                    <th className="text-right px-3 py-2 hidden sm:table-cell">Stock</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? 'bg-rose-50/50' : ''}>
                      <td className="px-3 py-2 text-slate-400 tabular">{r.line}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{r.name || '—'}</p>
                        <p className="text-xs text-slate-500 font-mono">{[r.sku, r.barcode].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">{r.category || '—'}</td>
                      <td className="px-3 py-2 text-right tabular whitespace-nowrap">
                        {r.sellingPrice !== null ? formatCurrency(r.sellingPrice, currencySymbol) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular hidden sm:table-cell">
                        {r.existing ? '(kept)' : `${r.openingStock} ${r.unit}`}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.errors.length ? (
                          <span className="text-rose-700 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                            {r.errors.join('; ')}
                          </span>
                        ) : r.existing ? (
                          <span className="text-sky-700">Update</span>
                        ) : (
                          <span className="text-emerald-700">New</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
