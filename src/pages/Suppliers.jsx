import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { SearchInput } from '../components/common/SearchInput';
import { Truck, Plus, DollarSign, Edit, Phone, Mail, MapPin } from 'lucide-react';

export function Suppliers() {
  const { currencySymbol, refreshAllData } = useStore();
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

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    outstandingBalance: '0',
    status: 'ACTIVE',
  });

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
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Supplier name is required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveSupplier({
        supplierId: selectedSupplier?.supplierId,
        ...formData,
      });

      if (res.success) {
        showToast(selectedSupplier ? 'Supplier updated' : 'Supplier added', 'success');
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
    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) {
      showToast('Payment amount must be greater than zero', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.recordSupplierPayment({
        supplierId: paymentSupplier.supplierId,
        amount: amt,
        reference: paymentNotes,
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
      header: 'Supplier & Contact',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 leading-snug">{row.name}</span>
          {row.contactPerson && (
            <p className="text-xs text-slate-500 mt-0.5">Contact: {row.contactPerson}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Details',
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
      header: 'Outstanding Balance',
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
          {Number(row.outstandingBalance) > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={DollarSign}
              onClick={() => {
                setPaymentSupplier(row);
                setPaymentAmount(String(row.outstandingBalance));
                setIsPaymentModalOpen(true);
              }}
              className="text-xs px-2 py-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
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
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Suppliers Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage vendor contacts, wholesale distributors, and track outstanding payables.
          </p>
        </div>

        <Button variant="primary" size="md" icon={Plus} onClick={handleOpenAdd} className="font-bold">
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search suppliers by name, phone or market..."
          className="max-w-md w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table columns={columns} data={filteredSuppliers} isLoading={isLoading} keyField="supplierId" />
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <Input
            label="Company / Agency Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. National Wholesale Distributors"
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="e.g. Haji Farooq"
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+92 301 5551122"
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="orders@vendor.pk"
          />

          <Input
            label="Warehouse / Market Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. Badami Bagh Wholesale Market, Lahore"
          />

          {!selectedSupplier && (
            <Input
              label={`Initial Outstanding Balance (${currencySymbol})`}
              type="number"
              step="any"
              value={formData.outstandingBalance}
              onChange={(e) => setFormData({ ...formData, outstandingBalance: e.target.value })}
              placeholder="0.00"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsSupplierModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      {paymentSupplier && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Record Supplier Payment"
          subtitle={`Supplier: ${paymentSupplier.name} • Current Balance: ${formatCurrency(paymentSupplier.outstandingBalance, currencySymbol)}`}
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
              label="Payment Reference / Cheque # / Bank"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Online transfer # TXN-1122"
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
