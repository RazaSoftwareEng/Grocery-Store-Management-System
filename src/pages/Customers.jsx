import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation, rules } from '../hooks/useFormValidation';
import { UserPlus, DollarSign, Edit, Phone, Download, MapPin } from 'lucide-react';

export function Customers() {
  const { customers, currencySymbol, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: '10000',
    notes: '',
    status: 'ACTIVE',
  });

  const v = useFormValidation(formData, {
    name: (val) => {
      const t = val.trim();
      if (!t) return 'Customer name is required';
      return t.length < 2 ? 'Name must be at least 2 characters' : '';
    },
    phone: (val) => {
      const msg = rules.phone(val);
      if (msg) return msg;
      const digits = val.replace(/\D/g, '');
      const dup =
        digits &&
        customers.find(
          (c) => c.customerId !== selectedCustomer?.customerId && c.phone && c.phone.replace(/\D/g, '') === digits
        );
      return dup ? `This number belongs to ${dup.name}` : '';
    },
    creditLimit: rules.nonNegative('Credit limit', { required: false }),
  });

  const outstanding = Number(paymentCustomer?.outstandingBalance) || 0;
  const payV = useFormValidation(
    { paymentAmount },
    {
      paymentAmount: (val) => {
        const msg = rules.positive('Payment amount')(val);
        if (msg) return msg;
        return Number(val) > outstanding
          ? `More than the outstanding ${formatCurrency(outstanding, currencySymbol)}`
          : '';
      },
    }
  );

  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      creditLimit: '10000',
      notes: '',
      status: 'ACTIVE',
    });
    v.reset();
    setIsCustomerModalOpen(true);
  };

  const handleOpenEdit = (cust) => {
    setSelectedCustomer(cust);
    setFormData({
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      creditLimit: String(cust.creditLimit || '10000'),
      notes: cust.notes || '',
      status: cust.status || 'ACTIVE',
    });
    v.reset();
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);
      const res = await api.saveCustomer({
        customerId: selectedCustomer?.customerId,
        ...formData,
        name: formData.name.trim(),
      });

      if (res.success) {
        showToast(selectedCustomer ? `${formData.name.trim()} updated` : `${formData.name.trim()} added`, 'success');
        await refreshAllData();
        setIsCustomerModalOpen(false);
      } else {
        showToast(res.error || 'Failed to save customer', 'error');
      }
    } catch {
      showToast('Error saving customer', 'error');
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
      const res = await api.recordCustomerPayment({
        customerId: paymentCustomer.customerId,
        amount: amt,
        notes: paymentNotes,
      });

      if (res.success) {
        showToast(res.message || 'Payment recorded', 'success');
        await refreshAllData();
        setIsPaymentModalOpen(false);
        setPaymentAmount('');
        setPaymentNotes('');
      } else {
        showToast(res.error || 'Failed to record customer payment', 'error');
      }
    } catch {
      showToast('Error recording payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      { key: 'customerId', label: 'Customer ID' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'outstandingBalance', label: 'Outstanding Balance' },
      { key: 'creditLimit', label: 'Credit Limit' },
      { key: 'notes', label: 'Notes' },
    ];
    exportToCsv('Customers_Directory', headers, filteredCustomers);
  };

  const columns = [
    {
      header: 'Customer',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900 leading-snug">{row.name}</span>
          {row.customerId === 'WALK-IN' && (
            <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
              Default
            </span>
          )}
          {row.notes && <p className="text-xs text-slate-400 mt-0.5">{row.notes}</p>}
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
      header: 'Khata balance',
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
      header: 'Credit limit',
      key: 'creditLimit',
      render: (row) => (
        <span className="text-[13px] text-slate-500 tabular">
          {formatCurrency(row.creditLimit || 0, currencySymbol)}
        </span>
      ),
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
      render: (row) => {
        if (row.customerId === 'WALK-IN') return null;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {Number(row.outstandingBalance) > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={DollarSign}
                onClick={() => {
                  setPaymentCustomer(row);
                  setPaymentAmount(String(row.outstandingBalance));
                  setPaymentNotes('');
                  payV.reset();
                  setIsPaymentModalOpen(true);
                }}
                title="Receive payment from customer"
              >
                Receive
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={Edit}
              onClick={() => handleOpenEdit(row)}
              aria-label={`Edit ${row.name}`}
              title="Edit customer"
              className="w-[30px] px-0"
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Customers"
        description="Contacts, credit limits and khata balances."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={handleExportCsv}>
              Export
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={handleOpenAdd}>
              Add customer
            </Button>
          </>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search by name, phone or area"
          className="max-w-md w-full"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedCustomers}
          keyField="customerId"
          emptyMessage={search ? `No customers match "${search}"` : 'No customers yet'}
          emptyDescription={search ? 'Try a different name or number.' : 'Add customers to sell on credit and track their khata.'}
          emptyAction={!search && <Button size="sm" icon={UserPlus} onClick={handleOpenAdd}>Add customer</Button>}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title={selectedCustomer ? 'Edit customer' : 'New customer'}
        subtitle={selectedCustomer ? selectedCustomer.name : 'Needed for credit sales and the khata ledger.'}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCustomerModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" variant="primary" isLoading={isSubmitting}>
              {selectedCustomer ? 'Save changes' : 'Add customer'}
            </Button>
          </>
        }
      >
        <form id="customer-form" ref={v.formRef} onSubmit={handleSaveCustomer} noValidate className="space-y-4">
          <FormErrorSummary validation={v} />
          <Input
            label="Full name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Dr. Tariq Mahmood"
            autoFocus
            {...v.field('name')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0321 4567890"
              optional
              className="tabular"
              {...v.field('phone')}
              isValid={v.field('phone').isValid && !!formData.phone}
            />
            <Input
              label="Credit limit"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
              placeholder="10000"
              suffix={currencySymbol}
              className="tabular"
              {...v.field('creditLimit')}
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. House 12-A, Main Avenue"
            optional
          />

          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Pays at month end"
            optional
          />
        </form>
      </Modal>

      {/* Record Debt Payment Modal */}
      {paymentCustomer && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Receive khata payment"
          subtitle={`${paymentCustomer.name} owes ${formatCurrency(paymentCustomer.outstandingBalance, currencySymbol)}`}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="customer-payment-form" variant="primary" isLoading={isSubmitting} icon={DollarSign}>
                Record payment
              </Button>
            </>
          }
        >
          <form id="customer-payment-form" ref={payV.formRef} onSubmit={handleRecordPayment} noValidate className="space-y-4">
            <Input
              label="Amount received *"
              type="number"
              inputMode="decimal"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              suffix={currencySymbol}
              className="tabular"
              autoFocus
              hint={
                Number(paymentAmount) > 0 && Number(paymentAmount) <= outstanding
                  ? `Remaining after this: ${formatCurrency(outstanding - Number(paymentAmount), currencySymbol)}`
                  : undefined
              }
              {...payV.field('paymentAmount')}
            />

            <Input
              label="Notes or reference"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Cash at counter, September bill"
              optional
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
