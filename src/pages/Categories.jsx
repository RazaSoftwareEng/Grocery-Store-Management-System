import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { SearchInput } from '../components/common/SearchInput';
import { Layers, Plus, Edit, Trash2, Package } from 'lucide-react';

export function Categories() {
  const { categories, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'ACTIVE' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const handleOpenAdd = () => {
    setSelectedCategory(null);
    setFormData({ name: '', description: '', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setSelectedCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      status: cat.status || 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Category name is required', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveCategory({
        categoryId: selectedCategory?.categoryId,
        ...formData,
      });

      if (res.success) {
        showToast(selectedCategory ? 'Category updated' : 'Category created', 'success');
        await refreshAllData();
        setIsModalOpen(false);
      } else {
        showToast(res.error || 'Failed to save category', 'error');
      }
    } catch {
      showToast('Error saving category', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (cat) => {
    if (!window.confirm(`Deactivate category "${cat.name}"?`)) return;
    try {
      await api.deleteCategory(cat.categoryId, false);
      showToast('Category deactivated', 'info');
      await refreshAllData();
    } catch {
      showToast('Failed to deactivate category', 'error');
    }
  };

  const handleDeletePermanent = async (cat) => {
    if (!window.confirm(`Permanently delete category "${cat.name}" from Google Sheet? This cannot be undone.`)) return;
    try {
      const res = await api.deleteCategory(cat.categoryId, true);
      showToast(res.message || 'Category deleted', 'success');
      await refreshAllData();
    } catch {
      showToast('Failed to delete category', 'error');
    }
  };

  const columns = [
    {
      header: 'Category Name',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">{row.name}</span>
          {row.description && (
            <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Assigned Products',
      key: 'productCount',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold">
          <Package className="w-3.5 h-3.5" />
          {row.productCount || 0} products
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
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            icon={Edit}
            className="px-2 py-1 text-xs"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePermanent(row)}
            icon={Trash2}
            title="Permanently delete from Google Sheet"
            className="text-slate-400 hover:text-rose-600 px-1.5 py-1 text-xs"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Product Categories</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize products into logical grocery aisles and departments.
          </p>
        </div>

        <Button variant="primary" size="md" icon={Plus} onClick={handleOpenAdd} className="font-bold">
          Add Category
        </Button>
      </div>

      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search categories..."
          className="max-w-md w-full"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table columns={columns} data={filteredCategories} keyField="categoryId" />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedCategory ? 'Edit Category' : 'Create Category'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Dairy & Eggs"
            required
            autoFocus
          />

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. Fresh milk, cheeses, butter, and farm eggs"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
