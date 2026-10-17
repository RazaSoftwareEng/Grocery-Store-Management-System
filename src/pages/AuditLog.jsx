import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw, Download } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Modal } from '../components/common/Modal';
import { SearchInput } from '../components/common/SearchInput';
import { formatDate } from '../utils/formatters';
import { todayStr, addDays } from '../utils/dates';
import { exportToCsv } from '../utils/exportCsv';

const ACTIONS = [
  'LOGIN', 'CREATE_SALE', 'CANCEL_SALE', 'RETURN_SALE_ITEMS', 'CUSTOMER_PAYMENT', 'CUSTOMER_ADJUSTMENT', 'SUPPLIER_PAYMENT',
  'CREATE_PURCHASE', 'UPDATE_PURCHASE', 'RECEIVE_PURCHASE', 'RETURN_PURCHASE', 'CANCEL_PURCHASE',
  'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DEACTIVATE_PRODUCT', 'DELETE_PRODUCT', 'ADJUST_STOCK',
  'START_STOCK_COUNT', 'APPLY_STOCK_COUNT', 'CANCEL_STOCK_COUNT', 'OPEN_SHIFT', 'CLOSE_SHIFT',
  'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_VOID', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
  'CHANGE_OWN_PASSWORD', 'SET_MANAGER_PIN', 'MANAGER_PIN_APPROVED', 'MANAGER_PIN_FAILED',
];
const ENTITIES = ['SALE', 'PRODUCT', 'PURCHASE', 'CUSTOMER', 'SUPPLIER', 'EXPENSE', 'SHIFT', 'STOCK_COUNT', 'PROFILE'];
const PAGE_SIZE = 30;
const cls = 'h-[38px] px-3 text-[13px] bg-white border border-slate-300 rounded-xl text-slate-700';

export function AuditLog() {
  const { users } = useStore();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ userId: '', action: '', entity: '', startDate: addDays(todayStr(), -6), endDate: todayStr() });
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await api.getAuditLogs({ ...filters, search: debounced, page: currentPage, pageSize: PAGE_SIZE });
    setIsLoading(false);
    if (res.success) {
      setRows(res.data);
      setCount(res.count);
    } else showToast(res.error, 'error');
  }, [filters, debounced, currentPage, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const setF = (key) => (e) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setCurrentPage(1);
  };

  const exportCsv = async () => {
    const res = await api.getAuditLogs({ ...filters, search: debounced, page: 1, pageSize: 5000 });
    if (!res.success) return showToast(res.error, 'error');
    exportToCsv('Audit_Log', [
      { key: 'createdAt', label: 'Time' },
      { key: 'userName', label: 'User' },
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'entityId', label: 'Entity ID' },
      { key: 'detailsText', label: 'Details' },
    ], res.data.map((r) => ({ ...r, detailsText: JSON.stringify(r.details) })));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Audit log"
        description="Who did what, and when. Entries cannot be edited or deleted."
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} onClick={load}>Refresh</Button>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>Export</Button>
          </>
        }
      />
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} placeholder="Search entity ID or user" className="flex-1 min-w-[200px]" />
        <select value={filters.userId} onChange={setF('userId')} className={cls} aria-label="User">
          <option value="">All users</option>
          {users.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}</option>)}
        </select>
        <select value={filters.action} onChange={setF('action')} className={cls} aria-label="Action">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.entity} onChange={setF('entity')} className={cls} aria-label="Entity">
          <option value="">All records</option>
          {ENTITIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={filters.startDate} max={filters.endDate} onChange={setF('startDate')} className={cls} aria-label="From" />
        <input type="date" value={filters.endDate} min={filters.startDate} onChange={setF('endDate')} className={cls} aria-label="To" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          keyField="logId"
          data={rows}
          isLoading={isLoading}
          emptyMessage="No audit entries for these filters"
          onRowClick={setDetail}
          columns={[
            { header: 'Time', key: 'createdAt', render: (r) => <span className="text-xs font-mono text-slate-500">{formatDate(r.createdAt)}</span> },
            { header: 'User', key: 'userName', render: (r) => r.userName || r.userId },
            { header: 'Action', key: 'action', render: (r) => <span className={`text-xs font-semibold ${/FAILED|CANCEL|DELETE|VOID/.test(r.action) ? 'text-rose-700' : 'text-slate-800'}`}>{r.action}</span> },
            { header: 'Record', key: 'entity', render: (r) => <span className="text-xs">{r.entity} <span className="font-mono text-slate-400">{r.entityId}</span></span> },
            { header: 'Details', key: 'details', render: (r) => <span className="text-xs text-slate-500 truncate block max-w-[320px]">{JSON.stringify(r.details)}</span> },
          ]}
        />
        <Pagination currentPage={currentPage} totalPages={Math.ceil(count / PAGE_SIZE) || 1} totalItems={count} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>
      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.action} subtitle={detail ? `${detail.userName} · ${formatDate(detail.createdAt)}` : ''} maxWidth="max-w-2xl">
        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-[60vh]">{JSON.stringify(detail?.details, null, 2)}</pre>
      </Modal>
    </div>
  );
}
