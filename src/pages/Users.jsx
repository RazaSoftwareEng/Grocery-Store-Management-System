import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { FormErrorSummary } from '../components/common/FormErrorSummary';
import { useFormValidation } from '../hooks/useFormValidation';
import { formatDate } from '../utils/formatters';
import {
  UserPlus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Edit,
} from 'lucide-react';

export function Users() {
  const { users, refreshAllData, settings } = useStore();
  const [pin, setPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const defaultMax = settings.cashierMaxDiscountPercent ?? '10';
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [userList, setUserList] = useState(users || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    role: 'CASHIER',
    password: '',
    status: 'ACTIVE',
    perms: { canGiveDiscount: true, maxDiscountPercent: '', canReturn: false, canViewReports: false },
  });

  const v = useFormValidation(
    { ...formData, isNew: !editingUser },
    {
      fullName: (val) => {
        const t = val.trim();
        if (!t) return 'Full name is required';
        return t.length < 2 ? 'Name must be at least 2 characters' : '';
      },
      username: (val) => {
        const t = val.trim().toLowerCase();
        if (!t) return 'Username is required';
        if (!/^[a-z0-9._-]{3,24}$/.test(t)) return '3–24 characters: letters, numbers, dot, dash or underscore';
        if (!editingUser && userList.some((u) => u.username?.toLowerCase() === t)) return 'This username is already taken';
        return '';
      },
      password: (val, all) => {
        if (!val) return all.isNew ? 'Set a password or PIN' : '';
        return val.length < 6 ? 'Use at least 6 characters' : '';
      },
      role: (val) => (!val ? 'Choose a role' : ''),
    }
  );

  // Keep local userList in sync with store
  useEffect(() => {
    if (users && users.length > 0) {
      setUserList(users);
    }
  }, [users]);

  // Load latest users from backend
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.getUsers();
      if (res.success && res.data) {
        setUserList(res.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      fullName: '',
      role: 'CASHIER',
      password: '',
      status: 'ACTIVE',
      perms: { canGiveDiscount: true, maxDiscountPercent: '', canReturn: false, canViewReports: false },
    });
    v.reset();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setFormData({
      userId: u.userId,
      username: u.username || '',
      fullName: u.fullName || '',
      role: u.role || 'CASHIER',
      password: '', // Blank unless changing
      status: u.status || 'ACTIVE',
      perms: {
        canGiveDiscount: u.permissions?.canGiveDiscount ?? true,
        maxDiscountPercent: u.permissions?.maxDiscountPercent ?? '',
        canReturn: Boolean(u.permissions?.canReturn),
        canViewReports: Boolean(u.permissions?.canViewReports),
      },
    });
    v.reset();
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      showToast('The primary administrator account cannot be deleted.', 'error');
      return;
    }

    if (!(await confirm({ title: `Delete ${u.fullName || u.username}?`, message: 'This staff member will no longer be able to sign in. Past sales keep their name.', confirmText: 'Delete account', tone: 'danger' }))) {
      return;
    }

    try {
      // Optimistic delete
      setUserList((prev) => prev.filter((item) => (item.userId || item.username) !== (u.userId || u.username)));
      showToast(`User ${u.username} deleted`, 'info');

      const res = await api.deleteUser(u.userId || u.username);
      if (res.success) {
        await refreshAllData(true);
      } else {
        showToast(res.error || 'Failed to delete user on server', 'error');
        loadUsers();
      }
    } catch {
      showToast('Could not delete the account. Try again.', 'error');
      loadUsers();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!v.validate()) return;

    try {
      setIsLoading(true);
      const payload = {
        ...formData,
        username: formData.username.trim().toLowerCase(),
        permissions: {
          canGiveDiscount: formData.perms.canGiveDiscount,
          maxDiscountPercent: formData.perms.maxDiscountPercent === '' ? null : Number(formData.perms.maxDiscountPercent),
          canReturn: formData.perms.canReturn,
          canViewReports: formData.perms.canViewReports,
        },
        fullName: formData.fullName.trim() || formData.username.trim(),
      };

      const res = await api.saveUser(payload);
      if (res.success) {
        showToast(
          editingUser ? `${payload.fullName} updated` : `Account created for ${payload.fullName}`,
          'success'
        );
        setIsModalOpen(false);
        await refreshAllData(true);
        await loadUsers();
      } else {
        showToast(res.error || 'Failed to save user', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Could not save the account. Try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    {
      header: 'Staff Member',
      key: 'fullName',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
            {(row.fullName || row.username || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-slate-900 leading-snug">
              {row.fullName || row.username}
            </div>
            <div className="text-xs text-slate-500 font-mono">@{row.username}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      key: 'role',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
          {row.role === 'ADMIN' ? (
            <ShieldCheck className="w-4 h-4 text-brand-600" strokeWidth={1.8} />
          ) : (
            <ShoppingCart className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
          )}
          {row.role === 'ADMIN' ? 'Store manager' : 'Cashier'}
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
      header: 'Last sign-in',
      key: 'lastLogin',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastLoginAt ? formatDate(row.lastLoginAt) : 'Never'}
          {row.mustChangePassword && <span className="block text-amber-700">Must change password</span>}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            icon={Edit}
            title="Edit user details"
          >
            Edit
          </Button>
          {row.username !== 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteUser(row)}
              icon={Trash2}
              title="Delete user"
              aria-label={`Delete ${row.username}`}
              className="w-[30px] px-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Staff & cashiers"
        description={`${userList.length} accounts · managers have full access, cashiers can only bill.`}
        actions={
          <Button variant="primary" icon={UserPlus} onClick={handleOpenAdd}>
            Add staff
          </Button>
        }
      />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setIsSavingPin(true);
          const res = await api.setManagerPin(pin);
          setIsSavingPin(false);
          if (res.success) {
            setPin('');
            showToast('Manager PIN saved', 'success');
          } else showToast(res.error, 'error');
        }}
        className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] font-semibold text-slate-900">My manager PIN</p>
          <p className="text-xs text-slate-500">
            Typed at the counter to approve discounts over {defaultMax}%, over-limit khata and cashier returns. 4 to 8 digits.
          </p>
        </div>
        <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="New PIN" aria-label="New manager PIN" containerClassName="w-36" />
        <Button type="submit" variant="secondary" isLoading={isSavingPin} disabled={pin.length < 4}>Save PIN</Button>
      </form>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={userList}
          keyField="userId"
          isLoading={isLoading && userList.length === 0}
          emptyMessage="No staff accounts yet"
          emptyDescription="Add a cashier so they can sign in at the counter."
        />
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit staff member' : 'New staff account'}
        subtitle={editingUser ? `@${editingUser.username}` : 'They sign in with this username and password.'}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" form="user-form" variant="primary" isLoading={isLoading}>
              {editingUser ? 'Save changes' : 'Create account'}
            </Button>
          </>
        }
      >
        <form id="user-form" ref={v.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormErrorSummary validation={v} />
          <Input
            label="Full name *"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="e.g. Muhammad Usman"
            autoFocus
            {...v.field('fullName')}
          />

          <Input
            label="Username *"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            placeholder="e.g. cashier2"
            disabled={Boolean(editingUser)}
            hint={editingUser ? "Usernames can't be changed." : 'Lowercase, no spaces.'}
            className="font-mono text-[13px]"
            autoComplete="off"
            {...v.field('username')}
          />

          <Input
            label={editingUser ? 'New password or PIN' : 'Password or PIN *'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={editingUser ? 'Leave blank to keep the current one' : 'At least 4 characters'}
            autoComplete="new-password"
            optional={Boolean(editingUser)}
            {...v.field('password')}
          />

          <Select
            label="Role *"
            options={[
              { value: 'CASHIER', label: 'Cashier (POS billing only)' },
              { value: 'ADMIN', label: 'Store manager (full access)' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            {...v.field('role')}
          />

          {editingUser && (
            <Select
              label="Status"
              options={[
                { value: 'ACTIVE', label: 'Active (can sign in)' },
                { value: 'INACTIVE', label: 'Suspended' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          )}

          {formData.role === 'CASHIER' && (
            <fieldset className="p-3 rounded-xl border border-slate-200 space-y-2 text-[13px]">
              <legend className="px-1 text-xs font-medium text-slate-500">Cashier permissions</legend>
              {[
                ['canGiveDiscount', 'Can give discounts'],
                ['canReturn', 'Can return items without manager PIN (own bills)'],
                ['canViewReports', 'Can view reports'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(formData.perms[k])}
                    onChange={(e) => setFormData({ ...formData, perms: { ...formData.perms, [k]: e.target.checked } })} />
                  {label}
                </label>
              ))}
              <Input label="Max discount %" type="number" min="0" max="100" value={formData.perms.maxDiscountPercent}
                onChange={(e) => setFormData({ ...formData, perms: { ...formData.perms, maxDiscountPercent: e.target.value } })}
                placeholder={`Store default (${defaultMax}%)`} hint="Above this a manager PIN is needed" />
            </fieldset>
          )}
          <p className="text-xs text-slate-500">A password you set here is temporary: the user must choose a new one at next sign-in.</p>

        </form>
      </Modal>
    </div>
  );
}
