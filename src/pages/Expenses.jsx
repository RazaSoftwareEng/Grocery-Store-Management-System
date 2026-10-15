import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { formatCurrency, formatShortDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { Wallet, Plus, Trash2, Download, RefreshCw, Calendar } from 'lucide-react';

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
  const confirm = useConfirm();

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

  const todayIso = new Date().toISOString().slice(0, 10);
  const v = useFormValidation(formData, {
    title: (val) => {
      const t = val.trim();
      if (!t) return 'Describe what this expense was for';
      return t.length < 3 ? 'Description must be at least 3 characters' : '';
    },
    category: (val) => (!val ? 'Choose a category' : ''),
    amount: rules.positive('Amount'),
    date: (val) => {
      if (!val) return 'Choose the payment date';
      return val > todayIso ? "Date can't be in the future" : '';
    },
  });

  const openAddModal = () => {
    v.reset();
    setIsModalOpen(true);
  };

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
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);
      const res = await api.saveExpense({ ...formData, title: formData.title.trim() });
      if (res.success) {
        showToast(`Expense of ${formatCurrency(formData.amount, currencySymbol)} recorded`, 'success');
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
    if (!(await confirm({ title: 'Delete this expense?', message: `"${exp.title}" for ${formatCurrency(exp.amount, currencySymbol)} will be removed from your records.`, confirmText: 'Delete expense', tone: 'danger' }))) {
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
          <span className="font-semibold text-slate-900 leading-snug">{row.title}</span>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
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
        <span className="font-mono font-semibold text-slate-900 text-sm">
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
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Delete expense"
          aria-label={`Delete ${row.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Expenses"
        description="Rent, bills, wages and other running costs."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} onClick={loadExpenses} aria-label="Refresh expenses">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="secondary" icon={Download} onClick={handleExportCsv}>
              Export
            </Button>
            <Button variant="primary" icon={Plus} onClick={openAddModal}>
              Add expense
            </Button>
          </>
        }
      />

      {/* Expense total */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between animate-rise">
        <div>
          <p className="text-[13px] text-slate-500">
            {selectedCategory === 'ALL'
              ? 'Total recorded expenses'
              : `Total for ${EXPENSE_CATEGORIES.find((c) => c.value === selectedCategory)?.label}`}
          </p>
          <p className="text-2xl font-semibold mt-1 tracking-tight tabular text-slate-900">
            {formatCurrency(totalExpenseSum, currencySymbol)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular">{filteredExpenses.length} entries</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
          <Wallet className="w-5 h-5" strokeWidth={1.8} />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`h-8 px-3 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setSelectedCategory(c.value)}
            className={`h-8 px-3 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap ${
              selectedCategory === c.value
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedExpenses}
          isLoading={isLoading}
          keyField="expenseId"
          emptyMessage="No expenses here yet"
          emptyDescription="Record rent, bills and wages to see your true profit."
          emptyAction={<Button size="sm" icon={Plus} onClick={openAddModal}>Add expense</Button>}
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
        title="Record expense"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" variant="primary" isLoading={isSubmitting} icon={Wallet}>
              Save expense
            </Button>
          </>
        }
      >
        <form id="expense-form" ref={v.formRef} onSubmit={handleCreateExpense} noValidate className="space-y-4">
          <FormErrorSummary validation={v} />
          <Input
            label="Description *"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Electricity bill, September"
            autoFocus
            {...v.field('title')}
          />

          <Select
            label="Category *"
            options={EXPENSE_CATEGORIES}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            {...v.field('category')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Amount *"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              suffix={currencySymbol}
              className="tabular"
              {...v.field('amount')}
            />

            <Input
              label="Payment date *"
              type="date"
              max={todayIso}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              {...v.field('date')}
              isValid={false}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Payment method"
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
              label="Bill or receipt #"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="e.g. LESCO-1122"
              optional
            />
          </div>

          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Paid from counter cash"
            optional
          />
        </form>
      </Modal>
    </div>
  );
}
