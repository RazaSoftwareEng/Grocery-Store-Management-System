import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SearchInput } from '../common/SearchInput';
import { formatCurrency } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { UserCheck, UserPlus, Phone, CreditCard } from 'lucide-react';

export function CustomerSelectModal({ isOpen, onClose, onSelect }) {
  const { customers, currencySymbol, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    creditLimit: '10000',
    notes: '',
  });

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.customerId?.toLowerCase().includes(q)
    );
  });

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      showToast('Please enter customer name', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveCustomer(newCustomer);
      if (res.success) {
        showToast('Customer created successfully', 'success');
        await refreshAllData();
        onSelect(res.data);
        onClose();
      } else {
        showToast(res.error || 'Failed to create customer', 'error');
      }
    } catch {
      showToast('Error creating customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showAddForm ? 'Add New Customer' : 'Select Customer'}
      subtitle={
        showAddForm
          ? 'Enter customer details for store credit and ledger tracking'
          : 'Choose a customer to attach to this invoice or select Walk-in'
      }
      maxWidth="max-w-lg"
    >
      {!showAddForm ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone or ID..."
              className="flex-1"
              autoFocus
            />
            <Button
              variant="outline"
              size="md"
              icon={UserPlus}
              onClick={() => setShowAddForm(true)}
            >
              New
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {filteredCustomers.map((c) => {
              const balance = Number(c.outstandingBalance) || 0;
              const isWalkIn = c.customerId === 'WALK-IN';

              return (
                <div
                  key={c.customerId}
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{c.name}</h4>
                      {isWalkIn && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {c.phone}
                      </p>
                    )}
                  </div>

                  {!isWalkIn && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                        Outstanding
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          balance > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(balance, currencySymbol)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                No customer found matching "{search}"
              </p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input
            label="Full Name *"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            placeholder="e.g. Haji Muhammad Tariq"
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="e.g. +92 300 1234567"
            />
            <Input
              label="Credit Limit (PKR)"
              type="number"
              value={newCustomer.creditLimit}
              onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })}
              placeholder="10000"
            />
          </div>

          <Input
            label="Street Address"
            value={newCustomer.address}
            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
            placeholder="e.g. House 45, Street 2, Main Market"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
              disabled={isSubmitting}
            >
              Back to List
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Save & Select
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
