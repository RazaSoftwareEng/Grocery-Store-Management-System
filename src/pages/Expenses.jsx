import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatShortDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Wallet, Plus, Trash2, Download, RefreshCw, DollarSign, Calendar } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { value: 'RENT', label: 'Shop Rent & Lease' },
  { value: 'ELECTRICITY', label: 'Electricity & Utilities (LESCO/WAPDA)' },
  { value: 'SALARIES', label: 'Staff Salaries & Daily Wages' },
  { value: 'TRANSPORT', label: 'Stock Transport & Freight' },
  { value: 'PACKAGING', label: 'Packaging Bags & Receipt Paper' },
  { value: 'MAINTENANCE', label: 'Equipment & Shop Maintenance' },
  { value: 'REFRESHMENT', label: 'Tea, Water & Refreshments' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous Operating Costs' },
];

export function Expenses() {
  const { currencySymbol } = useStore();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [formData, setFormData] = useState({
    title: '',
    category: 'RENT',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    reference: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await api.getExpenses();
      if (res.success) setExpenses(res.data || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    return true;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount) || 0;
    if (amt <= 0) {
      showToast('Amount must be greater than zero', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveExpense(formData);
      if (res.success) {
        showToast('Expense recorded successfully to Google Sheets', 'success');
        await loadExpenses();
        setIsModalOpen(false);
        setFormData({
          title: '',
          category: 'RENT',
          amount: '',
          date: new Date().toISOString().slice(0, 10),
          paymentMethod: 'CASH',
          reference: '',
          notes: '',
        });
      } else {
        showToast(res.error || 'Failed to record expense', 'error');
      }
    } catch {
      showToast('Error recording expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Delete expense "${exp.title}" (${formatCurrency(exp.amount, currencySymbol)})?`)) {
      return;
    }

    try {
      const res = await api.deleteExpense(exp.expenseId);
      if (res.success) {
        showToast('Expense deleted', 'info');
        await loadExpenses();
      }
    } catch {
      showToast('Failed to delete expense', 'error');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      { key: 'expenseId', label: 'Expense ID' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount' },
      { key: 'date', label: 'Date' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'reference', label: 'Reference' },
      { key: 'notes', label: 'Notes' },
    ];
    exportToCsv('Operating_Expenses', headers, filteredExpenses);
  };

  const columns = [
    {
      header: 'Expense Title & Date',
      key: 'title',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 leading-snug">{row.title}</span>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatShortDate(row.date || row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs uppercase">
          {row.category}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      key: 'amount',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-sm">
          {formatCurrency(row.amount, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Paid Via',
      key: 'paymentMethod',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">{row.paymentMethod}</span>
      ),
    },
    {
      header: 'Reference / Notes',
      key: 'notes',
      render: (row) => (
        <div className="max-w-xs text-xs text-slate-500 truncate">
          {row.reference && <strong className="text-slate-700">Ref: {row.reference} • </strong>}
          {row.notes || '—'}
        </div>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleDeleteExpense(row)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
          title="Delete expense"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Operating Expenses</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record store utility bills, shop rent, staff wages, and daily operating costs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadExpenses}>
            Sync
          </Button>
          <Button variant="outline" size="sm" icon={Download} onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setIsModalOpen(true)}
            className="font-bold shadow-sm"
          >
            Add Expense
          </Button>
        </div>
      </div>

      {/* Expense Summary KPI Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-600 to-amber-700 rounded-2xl text-white flex items-center justify-between shadow-xs">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Total Recorded Expenses
          </p>
          <p className="text-2xl font-black mt-0.5 tracking-tight">
            {formatCurrency(totalExpenseSum, currencySymbol)}
          </p>
        </div>
        <div className="p-3 bg-white/10 rounded-2xl">
          <Wallet className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Categories
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setSelectedCategory(c.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === c.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedExpenses}
          isLoading={isLoading}
          keyField="expenseId"
          emptyMessage="No expenses recorded for this category."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredExpenses.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Operating Expense"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <Input
            label="Expense Description *"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Commercial Electricity Bill - September"
            required
            autoFocus
          />

          <Select
            label="Expense Category *"
            options={EXPENSE_CATEGORIES}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Amount Paid (${currencySymbol}) *`}
              type="number"
              step="any"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              required
            />

            <Input
              label="Payment Date *"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Payment Method"
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'ONLINE', label: 'EasyPaisa / JazzCash' },
                { value: 'CHEQUE', label: 'Cheque' },
              ]}
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            />

            <Input
              label="Receipt / Bill Reference #"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="e.g. LESCO-1122"
            />
          </div>

          <Input
            label="Optional Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Paid by cashier from counter cash"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} icon={Wallet}>
              Save Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
