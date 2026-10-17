import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatShortDate } from '../utils/formatters';
import { todayStr, monthStartStr } from '../utils/dates';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { Wallet, Plus, Ban, Download, RefreshCw, Calendar, Edit } from 'lucide-react';

const emptyForm = () => ({
  expenseId: null,
  title: '',
  category: 'RENT',
  amount: '',
  date: todayStr(),
  paymentMethod: 'CASH',
  reference: '',
  notes: '',
  paidFromDrawer: false,
});

const dateCls = 'h-[38px] px-3 text-[13px] bg-white border border-slate-300 rounded-xl';

export function Expenses() {
  const { currencySymbol } = useStore();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [startDate, setStartDate] = useState(monthStartStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [showVoided, setShowVoided] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pageSize = 15;

  const todayIso = todayStr();
  const catLabel = (code) => categories.find((c) => c.code === code)?.name || code;
  const categoryOptions = categories
    .filter((c) => c.status === 'ACTIVE' || c.code === formData.category)
    .map((c) => ({ value: c.code, label: c.name }));

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

  const loadExpenses = async () => {
    setIsLoading(true);
    const res = await api.getExpenses({ startDate, endDate });
    setIsLoading(false);
    if (res.success) setExpenses(res.data || []);
    else showToast(res.error || 'Could not load expenses', 'error');
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    api.getExpenseCategories().then((res) => res.success && setCategories(res.data));
  }, []);

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    if (!showVoided && e.status === 'VOIDED') return false;
    return true;
  });
  const activeExpenses = filteredExpenses.filter((e) => e.status !== 'VOIDED');
  const totalExpenseSum = activeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openAddModal = () => {
    v.reset();
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    v.reset();
    setFormData({
      expenseId: exp.expenseId,
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      date: String(exp.date).slice(0, 10),
      paymentMethod: exp.paymentMethod || 'CASH',
      reference: exp.reference || '',
      notes: exp.notes || '',
      paidFromDrawer: Boolean(exp.paidFromDrawer),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    setIsSubmitting(true);
    const res = await api.saveExpense({ ...formData, title: formData.title.trim() });
    setIsSubmitting(false);
    if (res.success) {
      showToast(formData.expenseId ? 'Expense updated' : `Expense of ${formatCurrency(formData.amount, currencySymbol)} recorded`, 'success');
      setIsModalOpen(false);
      loadExpenses();
    } else {
      showToast(res.error || 'Failed to save expense', 'error');
    }
  };

  const handleVoid = async (e) => {
    e.preventDefault();
    if (voidReason.trim().length < 3) {
      showToast('Give a reason for voiding', 'warning');
      return;
    }
    const res = await api.voidExpense(voiding.expenseId, voidReason.trim());
    if (res.success) {
      showToast('Expense voided (kept in the records and audit log)', 'info');
      setVoiding(null);
      loadExpenses();
    } else showToast(res.error || 'Could not void', 'error');
  };

  const handleExportCsv = () => {
    exportToCsv('Operating_Expenses', [
      { key: 'expenseId', label: 'Expense ID' },
      { key: 'title', label: 'Title' },
      { key: 'categoryName', label: 'Category' },
      { key: 'amount', label: 'Amount' },
      { key: 'date', label: 'Date' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'paidFromDrawer', label: 'From drawer' },
      { key: 'reference', label: 'Reference' },
      { key: 'notes', label: 'Notes' },
      { key: 'status', label: 'Status' },
      { key: 'voidReason', label: 'Void reason' },
      { key: 'createdBy', label: 'Recorded by' },
    ], filteredExpenses.map((x) => ({ ...x, categoryName: catLabel(x.category) })));
  };

  const columns = [
    {
      header: 'Expense & date',
      key: 'title',
      render: (row) => (
        <div>
          <span className={`font-semibold leading-snug ${row.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
            {row.title}
          </span>
          {row.status === 'VOIDED' && <span className="ml-2 text-xs text-rose-600">Voided: {row.voidReason}</span>}
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatShortDate(row.date)} · {row.createdBy}
          </p>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (row) => <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">{catLabel(row.category)}</span>,
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (row) => <span className="font-mono font-semibold text-slate-900 text-sm">{formatCurrency(row.amount, currencySymbol)}</span>,
    },
    {
      header: 'Paid via',
      key: 'paymentMethod',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.paymentMethod}
          {row.paidFromDrawer && <span className="block text-amber-700">From drawer</span>}
        </span>
      ),
    },
    {
      header: 'Reference / notes',
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
      render: (row) =>
        row.status === 'VOIDED' ? (
          <span className="text-xs text-slate-400">by {row.voidedBy}</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" icon={Edit} onClick={() => openEditModal(row)} aria-label={`Edit ${row.title}`} />
            <Button
              variant="ghost"
              size="sm"
              icon={Ban}
              onClick={() => {
                setVoiding(row);
                setVoidReason('');
              }}
              title="Void expense"
              className="text-slate-400 hover:text-rose-600"
            />
          </div>
        ),
    },
  ];

  const pill = (on) =>
    `h-8 px-3 rounded-full text-[13px] font-medium border transition-colors whitespace-nowrap ${
      on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description="Rent, bills, wages and other running costs. Mistakes are voided, never deleted."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} onClick={loadExpenses} aria-label="Refresh expenses">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="secondary" icon={Download} onClick={handleExportCsv}>Export</Button>
            <Button variant="primary" icon={Plus} onClick={openAddModal}>Add expense</Button>
          </>
        }
      />

      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between animate-rise">
        <div>
          <p className="text-[13px] text-slate-500">
            {selectedCategory === 'ALL' ? 'Total expenses in this period' : `Total for ${catLabel(selectedCategory)}`}
          </p>
          <p className="text-2xl font-semibold mt-1 tracking-tight tabular text-slate-900">{formatCurrency(totalExpenseSum, currencySymbol)}</p>
          <p className="text-xs text-slate-500 mt-1 tabular">{activeExpenses.length} entries</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
          <Wallet className="w-5 h-5" strokeWidth={1.8} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={startDate} max={endDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} aria-label="From" className={dateCls} />
        <input type="date" value={endDate} min={startDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} aria-label="To" className={dateCls} />
        <label className="inline-flex items-center gap-2 text-[13px] text-slate-600">
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
          Show voided
        </label>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button type="button" onClick={() => setSelectedCategory('ALL')} className={pill(selectedCategory === 'ALL')}>All</button>
        {categories.filter((c) => c.status === 'ACTIVE').map((c) => (
          <button key={c.code} type="button" onClick={() => { setSelectedCategory(c.code); setCurrentPage(1); }} className={pill(selectedCategory === c.code)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedExpenses}
          isLoading={isLoading}
          keyField="expenseId"
          emptyMessage="No expenses in this period"
          emptyDescription="Record rent, bills and wages to see your true profit."
          emptyAction={<Button size="sm" icon={Plus} onClick={openAddModal}>Add expense</Button>}
        />
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredExpenses.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.expenseId ? 'Edit expense' : 'Record expense'}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" form="expense-form" variant="primary" isLoading={isSubmitting} icon={Wallet}>Save expense</Button>
          </>
        }
      >
        <form id="expense-form" ref={v.formRef} onSubmit={handleSave} noValidate className="space-y-4">
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
            options={categoryOptions}
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
              disabled={formData.paidFromDrawer}
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
          <Input label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} optional />
          <label className="flex items-start gap-2.5 text-[13px] text-slate-700 p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={formData.paidFromDrawer}
              onChange={(e) => setFormData({ ...formData, paidFromDrawer: e.target.checked, paymentMethod: e.target.checked ? 'CASH' : formData.paymentMethod })}
            />
            <span>
              <span className="font-medium">Paid from the cash drawer</span>
              <span className="block text-xs text-slate-500">Linked to the open shift and subtracted from its expected cash.</span>
            </span>
          </label>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title="Void expense"
        subtitle={voiding ? `${voiding.title} · ${formatCurrency(voiding.amount, currencySymbol)}` : ''}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoiding(null)}>Cancel</Button>
            <Button type="submit" form="void-expense-form" variant="danger" icon={Ban}>Void expense</Button>
          </>
        }
      >
        <form id="void-expense-form" onSubmit={handleVoid} className="space-y-3">
          <p className="text-[13px] text-slate-600">The expense stays in your records as voided and no longer counts in totals.</p>
          <Input label="Reason *" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus placeholder="e.g. Entered twice" />
        </form>
      </Modal>
    </div>
  );
}
