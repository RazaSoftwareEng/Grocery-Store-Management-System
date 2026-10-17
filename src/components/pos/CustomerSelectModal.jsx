import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SearchInput } from '../common/SearchInput';
import { EmptyState } from '../common/Table';
import { formatCurrency } from '../../utils/formatters';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFormValidation, rules } from '../../hooks/useFormValidation';
import { api } from '../../services/api';
import { UserPlus, Phone, ArrowLeft, Users, ChevronRight } from 'lucide-react';

const EMPTY_CUSTOMER = { name: '', phone: '', address: '', creditLimit: '0', notes: '' };

export function CustomerSelectModal({ isOpen, onClose, onSelect }) {
  const { currencySymbol, walkInCustomer } = useStore();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);

  const v = useFormValidation(newCustomer, {
    name: (val) => {
      const t = val.trim();
      if (!t) return 'Customer name is required';
      return t.length < 2 ? 'Name must be at least 2 characters' : '';
    },
    phone: (val) => {
      const msg = rules.phone(val);
      if (msg) return msg;
      return '';
    },
    creditLimit: rules.nonNegative('Credit limit', { required: false }),
  });

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setShowAddForm(false);
      setNewCustomer(EMPTY_CUSTOMER);
      v.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Server-side search (debounced)
  useEffect(() => {
    if (!isOpen || showAddForm) return undefined;
    let cancelled = false;
    setIsSearching(true);
    const t = setTimeout(async () => {
      const res = await api.searchCustomers(search);
      if (cancelled) return;
      setIsSearching(false);
      if (res.success) setCustomers(res.data);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, isOpen, showAddForm]);

  const filteredCustomers = search.trim() ? customers : [walkInCustomer, ...customers];

  const set = (key) => (e) => setNewCustomer((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);
      const res = await api.saveCustomer({ ...newCustomer, name: newCustomer.name.trim() });
      if (res.success) {
        showToast(`${newCustomer.name.trim()} added and selected`, 'success');
        onSelect(res.data);
        onClose();
      } else {
        showToast(res.error || 'Failed to create customer', 'error');
      }
    } catch {
      showToast('Could not save the customer. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showAddForm ? 'New customer' : 'Select customer'}
      subtitle={showAddForm ? 'Needed for credit sales and the customer ledger.' : 'Attach a customer to this bill, or keep walk-in.'}
      maxWidth="max-w-lg"
      footer={
        showAddForm ? (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setShowAddForm(false)} disabled={isSubmitting}>
              Back
            </Button>
            <Button type="submit" form="new-customer-form" variant="primary" isLoading={isSubmitting}>
              Save and select
            </Button>
          </>
        ) : null
      }
    >
      {!showAddForm ? (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, phone or ID"
              className="flex-1"
              autoFocus
            />
            <Button variant="secondary" icon={UserPlus} onClick={() => setShowAddForm(true)}>
              New
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1.5 stagger">
            {filteredCustomers.map((c) => {
              const balance = Number(c.outstandingBalance) || 0;
              const isWalkIn = c.customerId === 'WALK-IN';

              return (
                <button
                  type="button"
                  key={c.customerId}
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{c.name}</span>
                      {isWalkIn && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 rounded font-medium">Default</span>
                      )}
                    </div>
                    {c.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 tabular">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {c.phone}
                      </p>
                    )}
                  </div>

                  {!isWalkIn && (
                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 block">Outstanding</span>
                      <span className={`text-[13px] font-semibold tabular ${balance > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        {formatCurrency(balance, currencySymbol)}
                      </span>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors shrink-0" />
                </button>
              );
            })}

            {filteredCustomers.length === 0 && !isSearching && (
              <EmptyState
                icon={Users}
                title={`No customer matches "${search}"`}
                description="Check the spelling, or add them as a new customer."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UserPlus}
                    onClick={() => {
                      setNewCustomer({ ...EMPTY_CUSTOMER, name: search });
                      setShowAddForm(true);
                    }}
                  >
                    Add "{search}"
                  </Button>
                }
              />
            )}
          </div>
        </div>
      ) : (
        <form
          id="new-customer-form"
          ref={v.formRef}
          onSubmit={handleCreateCustomer}
          noValidate
          className="space-y-4 animate-in fade-in slide-in-from-right-2"
        >
          <Input
            label="Full name *"
            value={newCustomer.name}
            onChange={set('name')}
            placeholder="e.g. Haji Muhammad Tariq"
            autoFocus
            {...v.field('name')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              value={newCustomer.phone}
              onChange={set('phone')}
              placeholder="0300 1234567"
              optional
              className="tabular"
              {...v.field('phone')}
              isValid={v.field('phone').isValid && !!newCustomer.phone}
            />
            {isAdmin && (
            <Input
              label="Credit limit"
              hint="0 = no limit"
              type="number"
              inputMode="decimal"
              min="0"
              value={newCustomer.creditLimit}
              onChange={set('creditLimit')}
              placeholder="10000"
              suffix={currencySymbol}
              className="tabular"
              {...v.field('creditLimit')}
            />
            )}
          </div>
          {!isAdmin && (
            <p className="text-xs text-slate-500">New customers start with no khata limit. The store manager can set one.</p>
          )}

          <Input
            label="Address"
            value={newCustomer.address}
            onChange={set('address')}
            placeholder="e.g. House 45, Street 2, Main Market"
            optional
          />
        </form>
      )}
    </Modal>
  );
}
