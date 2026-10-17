import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { printElement } from '../utils/print';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { LedgerStatement } from '../components/common/LedgerStatement';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { UserPlus, DollarSign, Edit, Phone, Download, BookOpen, Printer, Scale } from 'lucide-react';

const PAGE_SIZE = 20;
const EMPTY = { name: '', phone: '', email: '', address: '', creditLimit: '10000', notes: '', status: 'ACTIVE', openingBalance: '' };
const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'ONLINE', label: 'EasyPaisa / JazzCash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export function Customers() {
  const { currencySymbol, settings } = useStore();
  const { showToast } = useToast();
  const f = (n) => formatCurrency(n, currencySymbol);

  const [tab, setTab] = useState('list'); // list | aging
  const [customers, setCustomers] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [aging, setAging] = useState([]);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', reference: '', notes: '' });
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const receiptRef = useRef(null);

  const [detail, setDetail] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [adjust, setAdjust] = useState({ amount: '', notes: '' });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await api.getCustomers({ search: debounced, filter, page: currentPage, pageSize: PAGE_SIZE });
    setIsLoading(false);
    if (res.success) {
      setCustomers(res.data);
      setCount(res.count);
    } else showToast(res.error, 'error');
  }, [debounced, filter, currentPage, showToast]);

  const loadAging = useCallback(async () => {
    const res = await api.getCustomerAging();
    if (res.success) setAging(res.data);
    else showToast(res.error, 'error');
  }, [showToast]);

  useEffect(() => {
    if (tab === 'list') load();
    else loadAging();
  }, [tab, load, loadAging]);

  const reload = () => (tab === 'list' ? load() : loadAging());

  const v = useFormValidation(formData, {
    name: (val) => (val.trim().length < 2 ? 'Name must be at least 2 characters' : ''),
    phone: rules.phone,
    email: rules.email,
    creditLimit: rules.nonNegative('Credit limit', { required: false }),
    openingBalance: (val) => (val !== '' && Number.isNaN(Number(val)) ? 'Numbers only' : ''),
  });

  const openAdd = () => {
    setSelectedCustomer(null);
    setFormData(EMPTY);
    v.reset();
    setIsCustomerModalOpen(true);
  };

  const openEdit = (c) => {
    setSelectedCustomer(c);
    setFormData({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: String(c.creditLimit ?? 0),
      notes: c.notes || '',
      status: c.status || 'ACTIVE',
      openingBalance: '',
    });
    v.reset();
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    setIsSubmitting(true);
    const res = await api.saveCustomer({ ...formData, name: formData.name.trim(), customerId: selectedCustomer?.customerId });
    setIsSubmitting(false);
    if (res.success) {
      showToast(res.message, 'success');
      setIsCustomerModalOpen(false);
      reload();
    } else showToast(res.error || 'Failed to save customer', 'error');
  };

  const openPayment = (c) => {
    setPaymentCustomer(c);
    setPayment({ amount: Number(c.outstandingBalance) > 0 ? String(c.outstandingBalance) : '', method: 'CASH', reference: '', notes: '' });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payment.amount);
    if (!amount || amount <= 0) return showToast('Enter an amount greater than 0', 'warning');
    setIsSubmitting(true);
    const res = await api.recordCustomerPayment({ customerId: paymentCustomer.customerId, ...payment, amount });
    setIsSubmitting(false);
    if (res.success) {
      setPaymentReceipt(res.data);
      setPaymentCustomer(null);
      reload();
    } else showToast(res.error || 'Payment failed', 'error');
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const res = await api.adjustCustomerBalance(adjusting.customerId, Number(adjust.amount), adjust.notes);
    if (res.success) {
      showToast('Balance adjusted', 'success');
      setAdjusting(null);
      reload();
    } else showToast(res.error, 'error');
  };

  const loadLedger = useCallback((start, end) => api.getCustomerLedger(detail?.customerId, { startDate: start, endDate: end }), [detail?.customerId]);

  const handleExportCsv = async () => {
    const res = await api.getCustomers({ search: debounced, filter, page: 1, pageSize: 5000 });
    if (!res.success) return showToast(res.error, 'error');
    exportToCsv('Customers', [
      { key: 'customerId', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'creditLimit', label: 'Credit limit' },
      { key: 'outstandingBalance', label: 'Balance' },
      { key: 'status', label: 'Status' },
    ], res.data);
  };

  const balanceCell = (b) => {
    const n = Number(b) || 0;
    return (
      <span className={`font-semibold tabular ${n > 0 ? 'text-amber-700' : n < 0 ? 'text-brand-700' : 'text-slate-500'}`}>
        {f(Math.abs(n))}{n < 0 ? ' advance' : ''}
      </span>
    );
  };

  const columns = [
    {
      header: 'Customer',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900">{row.name}</span>
          {row.status !== 'ACTIVE' && <Badge size="xs" className="ml-2">Inactive</Badge>}
          <p className="text-xs text-slate-500 flex items-center gap-1 tabular">
            {row.phone && <><Phone className="w-3 h-3" />{row.phone}</>}
            <span className="font-mono text-slate-400 ml-1">{row.customerId}</span>
          </p>
        </div>
      ),
    },
    { header: 'Credit limit', key: 'creditLimit', render: (row) => <span className="text-xs tabular">{Number(row.creditLimit) > 0 ? f(row.creditLimit) : 'No limit'}</span> },
    { header: 'Khata balance', key: 'outstandingBalance', render: (row) => balanceCell(row.outstandingBalance) },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" icon={BookOpen} onClick={() => setDetail(row)}>Khata</Button>
          <Button size="sm" variant="secondary" icon={DollarSign} onClick={() => openPayment(row)}>Receive</Button>
          <Button size="sm" variant="ghost" icon={Edit} onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} />
        </div>
      ),
    },
  ];

  const agingCols = [
    { header: 'Customer', key: 'name', render: (r) => <div><span className="font-semibold">{r.name}</span><p className="text-xs text-slate-500">{r.phone}</p></div> },
    { header: 'Balance', key: 'balance', render: (r) => balanceCell(r.balance) },
    { header: '0–30 days', key: 'days0to30', className: 'tabular', render: (r) => f(r.days0to30) },
    { header: '31–60', key: 'days31to60', className: 'tabular text-amber-700', render: (r) => f(r.days31to60) },
    { header: '61–90', key: 'days61to90', className: 'tabular text-orange-700', render: (r) => f(r.days61to90) },
    { header: '90+', key: 'days90plus', className: 'tabular text-rose-700 font-semibold', render: (r) => f(r.days90plus) },
    { header: 'Oldest', key: 'oldestDays', render: (r) => (r.oldestDays !== null && r.oldestDays !== undefined ? `${r.oldestDays} days` : '—') },
    {
      header: '',
      key: 'a',
      className: 'text-right',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={BookOpen} onClick={() => setDetail({ ...r, outstandingBalance: r.balance })}>Khata</Button>
      ),
    },
  ];
  const overdue = aging.filter((a) => a.isOverdue);
  const agingTotals = aging.reduce((t, a) => ({
    b0: t.b0 + Number(a.days0to30), b31: t.b31 + Number(a.days31to60), b61: t.b61 + Number(a.days61to90), b90: t.b90 + Number(a.days90plus),
  }), { b0: 0, b31: 0, b61: 0, b90: 0 });

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`-mb-px h-10 px-3 text-[13px] font-medium border-b-2 ${tab === id ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers & khata"
        description="Credit customers, payments received and what is still owed."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={handleExportCsv}>Export</Button>
            <Button icon={UserPlus} onClick={openAdd}>Add customer</Button>
          </>
        }
      />

      <div className="flex gap-1 border-b border-slate-200">
        {tabBtn('list', 'All customers')}
        {tabBtn('aging', `Aging & overdue${overdue.length ? ` (${overdue.length})` : ''}`)}
      </div>

      {tab === 'list' ? (
        <>
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
            <SearchInput value={search} onChange={(val) => { setSearch(val); setCurrentPage(1); }} placeholder="Name, phone or ID" className="flex-1 min-w-[220px]" />
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }} aria-label="Balance filter"
              className="h-[38px] px-3 text-[13px] bg-white border border-slate-300 rounded-xl">
              <option value="">All balances</option>
              <option value="OWING">Owe money (khata)</option>
              <option value="ADVANCE">Have advance</option>
            </select>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Table columns={columns} data={customers} isLoading={isLoading} keyField="customerId" emptyMessage="No customers found" />
            <Pagination currentPage={currentPage} totalPages={Math.ceil(count / PAGE_SIZE) || 1} totalItems={count} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['0–30 days', agingTotals.b0], ['31–60 days', agingTotals.b31], ['61–90 days', agingTotals.b61], ['Over 90 days', agingTotals.b90]].map(([l, val]) => (
              <div key={l} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <p className="text-[13px] text-slate-500">{l}</p>
                <p className="text-lg font-semibold tabular">{f(val)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Payments are matched to the oldest credit first. Overdue = anything older than 30 days.</p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Table columns={agingCols} data={aging} keyField="customerId" emptyMessage="Nobody owes you money right now" />
          </div>
        </>
      )}

      {/* Add / edit */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title={selectedCustomer ? 'Edit customer' : 'New customer'}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCustomerModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" form="customer-form" isLoading={isSubmitting}>Save customer</Button>
          </>
        }
      >
        <form id="customer-form" ref={v.formRef} onSubmit={handleSaveCustomer} noValidate className="space-y-4">
          <FormErrorSummary validation={v} />
          <Input label="Full name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoFocus {...v.field('name')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} hint="Must be unique" optional {...v.field('phone')} />
            <Input label="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} optional {...v.field('email')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Credit limit" type="number" min="0" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })} suffix={currencySymbol} hint="0 = no limit" {...v.field('creditLimit')} />
            {selectedCustomer ? (
              <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
            ) : (
              <Input label="Opening khata balance" type="number" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })} suffix={currencySymbol} hint="Owed before using this system" optional {...v.field('openingBalance')} />
            )}
          </div>
          <Input label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} optional />
          <Input label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} optional />
        </form>
      </Modal>

      {/* Receive payment */}
      <Modal
        isOpen={Boolean(paymentCustomer)}
        onClose={() => setPaymentCustomer(null)}
        title="Receive khata payment"
        subtitle={paymentCustomer ? `${paymentCustomer.name} · balance ${f(paymentCustomer.outstandingBalance)}` : ''}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaymentCustomer(null)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" form="payment-form" icon={DollarSign} isLoading={isSubmitting}>Record payment</Button>
          </>
        }
      >
        <form id="payment-form" onSubmit={handleRecordPayment} className="space-y-4">
          <Input label="Amount *" type="number" min="0" step="any" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} suffix={currencySymbol} autoFocus
            hint={Number(payment.amount) > Number(paymentCustomer?.outstandingBalance) ? 'More than the balance: the extra is kept as an advance' : undefined} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Method" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} options={METHOD_OPTIONS} />
            <Input label="Reference" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} optional />
          </div>
          <Input label="Notes" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} optional />
          {payment.method === 'CASH' && <p className="text-xs text-slate-500">Cash goes into your open shift's drawer total, if you have one open.</p>}
        </form>
      </Modal>

      {/* Payment receipt */}
      <Modal isOpen={Boolean(paymentReceipt)} onClose={() => setPaymentReceipt(null)} title="Payment recorded" maxWidth="max-w-sm">
        {paymentReceipt && (
          <div className="space-y-3">
            <div ref={receiptRef} className="font-mono text-xs border border-slate-200 rounded-xl p-4 space-y-1 max-w-[80mm] mx-auto bg-white">
              <p className="text-center font-semibold uppercase text-sm">{settings.storeName}</p>
              <p className="text-center">{settings.phone}</p>
              <p className="text-center font-semibold border-y border-dashed border-slate-300 py-1 my-2">PAYMENT RECEIPT</p>
              <Line l="Receipt #" r={paymentReceipt.entryId} />
              <Line l="Date" r={formatDate(paymentReceipt.createdAt)} />
              <Line l="Customer" r={paymentReceipt.customerName} />
              <Line l="Method" r={`${paymentReceipt.paymentMethod}${paymentReceipt.reference && paymentReceipt.reference !== 'Khata payment' ? ` (${paymentReceipt.reference})` : ''}`} />
              <Line l="Previous balance" r={f(paymentReceipt.balanceBefore)} />
              <Line l="Amount received" r={<strong>{f(paymentReceipt.credit)}</strong>} />
              <Line l="New balance" r={<strong>{f(paymentReceipt.balanceAfter)}{Number(paymentReceipt.balanceAfter) < 0 ? ' (advance)' : ''}</strong>} />
              <Line l="Received by" r={paymentReceipt.createdBy} />
              <p className="text-center pt-2 text-slate-500">Shukriya!</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" icon={Printer} onClick={() => printElement(receiptRef.current, { pageSize: '80mm auto' })}>Print receipt</Button>
              <Button onClick={() => setPaymentReceipt(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Khata statement */}
      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.name} · khata` : ''}
        subtitle={detail ? `Balance ${f(detail.outstandingBalance)}${detail.phone ? ` · ${detail.phone}` : ''}` : ''}
        maxWidth="max-w-4xl"
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex gap-2 no-print">
              <Button size="sm" icon={DollarSign} onClick={() => openPayment(detail)}>Receive payment</Button>
              <Button size="sm" variant="secondary" icon={Scale} onClick={() => { setAdjusting(detail); setAdjust({ amount: '', notes: '' }); }}>Adjust balance</Button>
            </div>
            <LedgerStatement party={detail} kind="customer" load={loadLedger} debitLabel="Udhaar (debit)" creditLabel="Paid / returned" />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust khata balance"
        subtitle="Positive adds to what the customer owes, negative reduces it."
        maxWidth="max-w-sm"
        footer={<Button type="submit" form="adjust-form">Save adjustment</Button>}
      >
        <form id="adjust-form" onSubmit={handleAdjust} className="space-y-3">
          <Input label="Amount (+ / −) *" type="number" step="any" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} suffix={currencySymbol} autoFocus />
          <Input label="Reason *" value={adjust.notes} onChange={(e) => setAdjust({ ...adjust, notes: e.target.value })} placeholder="e.g. Settled old dispute" />
        </form>
      </Modal>
    </div>
  );
}

function Line({ l, r }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{l}</span>
      <span className="text-right">{r}</span>
    </div>
  );
}
