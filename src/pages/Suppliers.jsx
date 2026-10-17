import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { LedgerStatement } from '../components/common/LedgerStatement';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { SearchInput } from '../components/common/SearchInput';
import { Plus, DollarSign, Edit, Phone, MapPin, BookOpen } from 'lucide-react';

export function Suppliers() {
  const { currencySymbol } = useStore();
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState(null);
  const [openPos, setOpenPos] = useState([]);
  const [paymentPurchaseId, setPaymentPurchaseId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const loadSupplierLedger = useCallback(
    (start, end) => api.getSupplierLedger(statementSupplier?.supplierId, { startDate: start, endDate: end }),
    [statementSupplier?.supplierId]
  );
  useEffect(() => {
    if (!paymentSupplier) return;
    setPaymentPurchaseId('');
    setPaymentMethod('CASH');
    api.getPurchases({ supplierId: paymentSupplier.supplierId, page: 1, pageSize: 100 }).then((res) => {
      if (res.success) setOpenPos(res.data.filter((p) => p.status !== 'CANCELLED' && Number(p.outstandingBalance) > 0));
    });
  }, [paymentSupplier]);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    outstandingBalance: '0',
    status: 'ACTIVE',
  });

  const v = useFormValidation(formData, {
    name: (val) => {
      const t = val.trim();
      if (!t) return 'Supplier name is required';
      if (t.length < 2) return 'Name must be at least 2 characters';
      const dup = suppliers.find(
        (s) => s.supplierId !== selectedSupplier?.supplierId && s.name?.trim().toLowerCase() === t.toLowerCase()
      );
      return dup ? 'A supplier with this name already exists' : '';
    },
    phone: rules.phone,
    email: rules.email,
    outstandingBalance: rules.nonNegative('Opening balance', { required: false }),
  });

  const payable = Number(paymentSupplier?.outstandingBalance) || 0;
  const payV = useFormValidation(
    { paymentAmount },
    {
      paymentAmount: (val) => {
        const msg = rules.positive('Payment amount')(val);
        if (msg) return msg;
        return Number(val) > payable ? `More than the ${formatCurrency(payable, currencySymbol)} you owe` : '';
      },
    }
  );

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const res = await api.getSuppliers();
      if (res.success) setSuppliers(res.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.contactPerson?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    setSelectedSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      outstandingBalance: '0',
      status: 'ACTIVE',
    });
    v.reset();
    setIsSupplierModalOpen(true);
  };

  const handleOpenEdit = (supp) => {
    setSelectedSupplier(supp);
    setFormData({
      name: supp.name || '',
      contactPerson: supp.contactPerson || '',
      phone: supp.phone || '',
      email: supp.email || '',
      address: supp.address || '',
      outstandingBalance: String(supp.outstandingBalance || '0'),
      status: supp.status || 'ACTIVE',
    });
    v.reset();
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);
      const res = await api.saveSupplier({
        supplierId: selectedSupplier?.supplierId,
        ...formData,
        name: formData.name.trim(),
      });

      if (res.success) {
        showToast(selectedSupplier ? `${formData.name.trim()} updated` : `${formData.name.trim()} added`, 'success');
        await loadSuppliers();
        setIsSupplierModalOpen(false);
      } else {
        showToast(res.error || 'Failed to save supplier', 'error');
      }
    } catch {
      showToast('Error saving supplier', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payV.validate()) return;
    const amt = parseFloat(paymentAmount) || 0;

    try {
      setIsSubmitting(true);
      const res = await api.recordSupplierPayment({
        supplierId: paymentSupplier.supplierId,
        amount: amt,
        reference: paymentNotes,
        purchaseId: paymentPurchaseId || null,
        method: paymentMethod,
      });

      if (res.success) {
        showToast(res.message || 'Payment recorded', 'success');
        await loadSuppliers();
        setIsPaymentModalOpen(false);
        setPaymentAmount('');
        setPaymentNotes('');
      } else {
        showToast(res.error || 'Failed to record payment', 'error');
      }
    } catch {
      showToast('Error recording payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Supplier',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900 leading-snug">{row.name}</span>
          {row.contactPerson && <p className="text-xs text-slate-500 mt-0.5">{row.contactPerson}</p>}
        </div>
      ),
    },
    {
      header: 'Contact',
      key: 'phone',
      render: (row) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          {row.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{row.phone}</span>
            </div>
          )}
          {row.address && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-xs">{row.address}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Payable',
      key: 'outstandingBalance',
      render: (row) => {
        const bal = Number(row.outstandingBalance) || 0;
        return (
          <span
            className={`tabular font-semibold text-sm ${bal > 0 ? 'text-amber-700' : 'text-slate-500'}`}
          >
            {formatCurrency(bal, currencySymbol)}
          </span>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="xs">
          {row.status || 'ACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="outline" size="sm" icon={BookOpen} onClick={() => setStatementSupplier(row)}>
            Statement
          </Button>
          {Number(row.outstandingBalance) > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={DollarSign}
              onClick={() => {
                setPaymentSupplier(row);
                setPaymentAmount(String(row.outstandingBalance));
                setPaymentNotes('');
                payV.reset();
                setIsPaymentModalOpen(true);
              }}
            >
              Pay
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={Edit}
            onClick={() => handleOpenEdit(row)}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Suppliers"
        description="Vendors, distributors and what you owe them."
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Add supplier
          </Button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, phone or market"
          className="max-w-md w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={filteredSuppliers}
          isLoading={isLoading}
          keyField="supplierId"
          emptyMessage={search ? `No suppliers match "${search}"` : 'No suppliers yet'}
          emptyDescription={search ? 'Try a different search.' : 'Add the distributors you buy stock from.'}
          emptyAction={!search && <Button size="sm" icon={Plus} onClick={handleOpenAdd}>Add supplier</Button>}
        />
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={selectedSupplier ? 'Edit supplier' : 'New supplier'}
        subtitle={selectedSupplier ? selectedSupplier.name : undefined}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSupplierModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="supplier-form" variant="primary" isLoading={isSubmitting}>
              {selectedSupplier ? 'Save changes' : 'Add supplier'}
            </Button>
          </>
        }
      >
        <form id="supplier-form" ref={v.formRef} onSubmit={handleSaveSupplier} noValidate className="space-y-4">
          <FormErrorSummary validation={v} />
          <Input
            label="Company name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. National Wholesale Distributors"
            autoFocus
            {...v.field('name')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact person"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="e.g. Haji Farooq"
              optional
            />
            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0301 5551122"
              optional
              className="tabular"
              {...v.field('phone')}
              isValid={v.field('phone').isValid && !!formData.phone}
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="orders@vendor.pk"
            optional
            {...v.field('email')}
            isValid={v.field('email').isValid && !!formData.email}
          />

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. Badami Bagh wholesale market, Lahore"
            optional
          />

          {!selectedSupplier && (
            <Input
              label="Opening balance you owe"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.outstandingBalance}
              onChange={(e) => setFormData({ ...formData, outstandingBalance: e.target.value })}
              placeholder="0.00"
              suffix={currencySymbol}
              className="tabular"
              {...v.field('outstandingBalance')}
            />
          )}
        </form>
      </Modal>

      {/* Record Payment Modal */}
      {paymentSupplier && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Pay supplier"
          subtitle={`You owe ${paymentSupplier.name} ${formatCurrency(paymentSupplier.outstandingBalance, currencySymbol)}`}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="supplier-payment-form" variant="primary" isLoading={isSubmitting} icon={DollarSign}>
                Record payment
              </Button>
            </>
          }
        >
          <form id="supplier-payment-form" ref={payV.formRef} onSubmit={handleRecordPayment} noValidate className="space-y-4">
            <Input
              label="Amount paid *"
              type="number"
              inputMode="decimal"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              suffix={currencySymbol}
              className="tabular"
              autoFocus
              hint={
                Number(paymentAmount) > 0 && Number(paymentAmount) <= payable
                  ? `Remaining after this: ${formatCurrency(payable - Number(paymentAmount), currencySymbol)}`
                  : undefined
              }
              {...payV.field('paymentAmount')}
            />

            <Input
              label="Reference, cheque # or bank"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Transfer TXN-1122"
              optional
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Against purchase order"
                value={paymentPurchaseId}
                onChange={(e) => setPaymentPurchaseId(e.target.value)}
                options={[{ value: '', label: 'General (account)' }, ...openPos.map((p) => ({ value: p.purchaseId, label: `${p.purchaseNumber} · due ${formatCurrency(p.outstandingBalance, currencySymbol)}` }))]}
              />
              <Select
                label="Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[{ value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'ONLINE', label: 'Online' }]}
              />
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(statementSupplier)}
        onClose={() => setStatementSupplier(null)}
        title={statementSupplier ? `${statementSupplier.name} · statement` : ''}
        subtitle={statementSupplier ? `You owe ${formatCurrency(statementSupplier.outstandingBalance, currencySymbol)}` : ''}
        maxWidth="max-w-4xl"
      >
        {statementSupplier && (
          <LedgerStatement party={statementSupplier} kind="supplier" load={loadSupplierLedger} debitLabel="Goods received" creditLabel="Paid / returned" />
        )}
      </Modal>
    </div>
  );
}
