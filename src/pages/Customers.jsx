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
import { Users, UserPlus, DollarSign, Edit, Phone, Download, MapPin } from 'lucide-react';

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
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Customer name is required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveCustomer({
        customerId: selectedCustomer?.customerId,
        ...formData,
      });

      if (res.success) {
        showToast(selectedCustomer ? 'Customer updated' : 'Customer created', 'success');
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
    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      showToast('Payment amount must be greater than zero', 'warning');
      return;
    }

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
      header: 'Customer Name',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 leading-snug">{row.name}</span>
          {row.customerId === 'WALK-IN' && (
            <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
              Default Counter
            </span>
          )}
          {row.notes && <p className="text-xs text-slate-400 mt-0.5">{row.notes}</p>}
        </div>
      ),
    },
    {
      header: 'Contact Info',
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
      header: 'Outstanding Balance (Khata)',
      key: 'outstandingBalance',
      render: (row) => {
        const bal = Number(row.outstandingBalance) || 0;
        return (
          <span
            className={`font-mono font-bold text-sm ${
              bal > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(bal, currencySymbol)}
          </span>
        );
      },
    },
    {
      header: 'Credit Limit',
      key: 'creditLimit',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono">
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
                  setIsPaymentModalOpen(true);
                }}
                className="text-xs px-2 py-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                title="Receive payment from customer"
              >
                Pay
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={Edit}
              onClick={() => handleOpenEdit(row)}
              className="text-xs px-2 py-1"
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Customer CRM & Khata</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track customer contact lists, credit limits, and store credit debt balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Download} onClick={handleExportCsv}>
            Export Customers
          </Button>
          <Button variant="primary" size="md" icon={UserPlus} onClick={handleOpenAdd} className="font-bold">
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search customers by name, phone or neighborhood..."
          className="max-w-md w-full"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table columns={columns} data={paginatedCustomers} keyField="customerId" />

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
        title={selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <Input
            label="Full Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Dr. Tariq Mahmood"
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+92 321 4567890"
            />
            <Input
              label={`Credit Limit (${currencySymbol})`}
              type="number"
              step="any"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
              placeholder="10000"
            />
          </div>

          <Input
            label="Street Address / Residence"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. House 12-A, Main Avenue"
          />

          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Regular neighborhood customer, pays at month end"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsCustomerModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Debt Payment Modal */}
      {paymentCustomer && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Receive Customer Debt Payment"
          subtitle={`Customer: ${paymentCustomer.name} • Total Debt: ${formatCurrency(paymentCustomer.outstandingBalance, currencySymbol)}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <Input
              label={`Payment Amount (${currencySymbol}) *`}
              type="number"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Receipt Notes / Reference"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Cash paid at counter, settlement of Sep bill"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsPaymentModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} icon={DollarSign}>
                Record Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
