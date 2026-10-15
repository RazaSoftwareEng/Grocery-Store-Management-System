import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { Table } from '../components/common/Table';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { PageHeader } from '../components/common/Card';
import { useFormValidation } from '../hooks/useFormValidation';
import { SearchInput } from '../components/common/SearchInput';
import { Plus, Edit, Trash2, Package } from 'lucide-react';

export function Categories() {
  const { categories, refreshAllData } = useStore();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'ACTIVE' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const v = useFormValidation(formData, {
    name: (val) => {
      const t = val.trim();
      if (!t) return 'Category name is required';
      if (t.length < 2) return 'Name must be at least 2 characters';
      const dup = categories.find(
        (c) => c.categoryId !== selectedCategory?.categoryId && c.name?.trim().toLowerCase() === t.toLowerCase()
      );
      return dup ? 'A category with this name already exists' : '';
    },
    description: (val) => (val.length > 160 ? 'Keep the description under 160 characters' : ''),
  });

  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const handleOpenAdd = () => {
    setSelectedCategory(null);
    setFormData({ name: '', description: '', status: 'ACTIVE' });
    v.reset();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setSelectedCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      status: cat.status || 'ACTIVE',
    });
    v.reset();
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!v.validate()) return;

    try {
      setIsSubmitting(true);
      const res = await api.saveCategory({
        categoryId: selectedCategory?.categoryId,
        ...formData,
        name: formData.name.trim(),
      });

      if (res.success) {
        showToast(selectedCategory ? `"${formData.name.trim()}" updated` : `"${formData.name.trim()}" created`, 'success');
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
    if (!(await confirm({ title: `Deactivate "${cat.name}"?`, message: 'The category is hidden from new products. Existing products keep it.', confirmText: 'Deactivate' }))) return;
    try {
      await api.deleteCategory(cat.categoryId, false);
      showToast('Category deactivated', 'info');
      await refreshAllData();
    } catch {
      showToast('Failed to deactivate category', 'error');
    }
  };

  const handleDeletePermanent = async (cat) => {
    if (!(await confirm({ title: `Delete "${cat.name}"?`, message: 'The category is removed permanently. This cannot be undone.', confirmText: 'Delete category', tone: 'danger' }))) return;
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
      header: 'Category',
      key: 'name',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900">{row.name}</span>
          {row.description && (
            <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Products',
      key: 'productCount',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 tabular">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          {row.productCount || 0}
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
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePermanent(row)}
            icon={Trash2}
            title="Delete category"
            aria-label={`Delete ${row.name}`}
            className="w-[30px] px-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description="Group products into aisles and departments."
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Add category
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search categories..."
          className="max-w-md w-full"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={filteredCategories}
          keyField="categoryId"
          emptyMessage={search ? `No categories match "${search}"` : 'No categories yet'}
          emptyDescription={search ? 'Try a different search.' : 'Create your first category to start organising products.'}
          emptyAction={!search && <Button size="sm" icon={Plus} onClick={handleOpenAdd}>Add category</Button>}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedCategory ? 'Edit category' : 'New category'}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" variant="primary" isLoading={isSubmitting}>
              {selectedCategory ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form id="category-form" ref={v.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Category name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Dairy & eggs"
            autoFocus
            {...v.field('name')}
          />

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g. Fresh milk, cheese, butter and eggs"
            optional
            {...v.field('description')}
            isValid={false}
          />
        </form>
      </Modal>
    </div>
  );
}
