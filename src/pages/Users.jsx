import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { formatDate } from '../utils/formatters';
import {
  Users as UsersIcon,
  UserPlus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Edit,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Database
} from 'lucide-react';

export function Users() {
  const { users, refreshAllData, isLiveBackend } = useStore();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

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
  });

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
    });
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
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      showToast('The primary administrator account cannot be deleted.', 'error');
      return;
    }

    if (!window.confirm(`Delete user account "${u.fullName || u.username}" from Google Sheets?`)) {
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
      showToast('Error deleting user from Google Sheets', 'error');
      loadUsers();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      showToast('Username is required', 'warning');
      return;
    }

    if (!editingUser && !formData.password) {
      showToast('Password / PIN is required for new accounts', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        ...formData,
        username: formData.username.trim().toLowerCase(),
        fullName: formData.fullName.trim() || formData.username.trim(),
      };

      const res = await api.saveUser(payload);
      if (res.success) {
        showToast(
          editingUser ? 'User updated successfully' : 'New user created and saved to Google Sheets!',
          'success'
        );
        setIsModalOpen(false);
        await refreshAllData(true);
        await loadUsers();
      } else {
        showToast(res.error || 'Failed to save user', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error saving user to Google Sheets', 'error');
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
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
            {row.role === 'ADMIN' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShoppingCart className="w-5 h-5 text-teal-600" />
            )}
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-snug">
              {row.fullName || row.username}
            </div>
            <div className="text-xs text-slate-500 font-mono">@{row.username}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role & Permissions',
      key: 'role',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
            row.role === 'ADMIN'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-teal-50 text-teal-800 border border-teal-200'
          }`}
        >
          {row.role === 'ADMIN' ? '👑 Store Manager / Admin' : '🛒 Counter Cashier'}
        </span>
      ),
    },
    {
      header: 'Account Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="xs">
          {row.status || 'ACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Last Login',
      key: 'lastLogin',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastLogin ? formatDate(row.lastLogin) : 'Not logged in yet'}
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
            className="px-2 py-1 text-xs"
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
              className="text-slate-400 hover:text-rose-600 px-1.5 py-1 text-xs"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-emerald-600" />
            Staff & User Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage cashier accounts and store managers. All user records sync directly with Google Sheet 'Users'.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            icon={UserPlus}
            onClick={handleOpenAdd}
            className="font-bold shadow-sm"
          >
            Add New Staff / Cashier
          </Button>
        </div>
      </div>

      {/* Sheet Connection Banner */}
      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Connected Tab: <strong>Users</strong> in Google Sheets. Passwords and credentials are authenticated securely.
          </span>
        </div>
        <span className="font-bold text-emerald-700 hidden sm:inline">
          {userList.length} Total Accounts
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={userList}
          keyField="userId"
          emptyMessage="No user accounts found."
        />
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Edit Staff Member (@${editingUser.username})` : 'Add New Staff / Cashier'}
        subtitle="Credentials will be saved to your Google Sheets 'Users' tab."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="e.g. Muhammad Usman"
            required
            autoFocus
          />

          <Input
            label="Username / Login ID *"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="e.g. cashier2 or manager1"
            required
            disabled={Boolean(editingUser)}
          />

          <Input
            label={editingUser ? 'New Password / PIN (Leave blank to keep current)' : 'Password / Security PIN *'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            required={!editingUser}
          />

          <Select
            label="System Role *"
            options={[
              { value: 'CASHIER', label: 'Counter Cashier (POS Billing & Sales only)' },
              { value: 'ADMIN', label: 'Store Manager / Admin (Full Access to All Settings)' },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
          />

          {editingUser && (
            <Select
              label="Account Status"
              options={[
                { value: 'ACTIVE', label: 'Active (Can Log In)' },
                { value: 'INACTIVE', label: 'Suspended / Inactive' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
              {editingUser ? 'Update Staff Member' : 'Create Staff Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
