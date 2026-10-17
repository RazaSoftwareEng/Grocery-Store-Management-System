import React, { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';

/** Settings tab: add, rename and hide expense categories */
export function ExpenseCategoriesSettings() {
  const { showToast } = useToast();
  const [cats, setCats] = useState([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const res = await api.getExpenseCategories();
    if (res.success) setCats(res.data);
    else showToast(res.error, 'error');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (cat) => {
    setBusy(cat.categoryId || 'new');
    const res = await api.saveExpenseCategory(cat);
    setBusy('');
    if (res.success) {
      showToast(res.message, 'success');
      if (!cat.categoryId) setNewName('');
      load();
    } else showToast(res.error, 'error');
  };

  const update = (id, patch) => setCats((prev) => prev.map((c) => (c.categoryId === id ? { ...c, ...patch } : c)));

  return (
    <Card title="Expense categories" subtitle="Used on the Expenses page and in reports. Hidden categories stay on old expenses." className="max-w-3xl">
      <div className="space-y-2">
        {cats.map((c) => (
          <div key={c.categoryId} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs font-mono text-slate-500 truncate" title={c.code}>{c.code}</span>
            <Input value={c.name} onChange={(e) => update(c.categoryId, { name: e.target.value })} containerClassName="flex-1" aria-label="Category name" />
            <select
              value={c.status}
              onChange={(e) => update(c.categoryId, { status: e.target.value })}
              className="h-[38px] px-2 text-[13px] border border-slate-300 rounded-xl bg-white"
              aria-label="Status"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Hidden</option>
            </select>
            <Button variant="secondary" size="sm" icon={Save} onClick={() => save(c)} isLoading={busy === c.categoryId} disabled={!c.name.trim()}>
              Save
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category, e.g. Security guard" containerClassName="flex-1" aria-label="New category" />
          <Button icon={Plus} onClick={() => save({ name: newName.trim(), sortOrder: (cats.length + 1) * 10 })} isLoading={busy === 'new'} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
