import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { ArrowLeftRight, Download, Filter, RefreshCw } from 'lucide-react';

export function Inventory() {
  const { products } = useStore();
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [movementType, setMovementType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadMovements = async () => {
    try {
      setIsLoading(true);
      const res = await api.getStockMovements({
        productId: selectedProduct === 'ALL' ? undefined : selectedProduct,
      });
      if (res.success) {
        setMovements(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [selectedProduct]);

  // Map product names
  const prodMap = {};
  products.forEach((p) => {
    prodMap[p.productId] = p.name;
  });

  const filteredMovements = movements.filter((m) => {
    if (movementType !== 'ALL' && m.movementType !== movementType) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredMovements.length / pageSize) || 1;
  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportCsv = () => {
    const headers = [
      { key: 'createdAt', label: 'Date/Time' },
      { key: 'productName', label: 'Product Name' },
      { key: 'movementType', label: 'Type' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'previousStock', label: 'Previous Stock' },
      { key: 'newStock', label: 'New Stock' },
      { key: 'referenceId', label: 'Reference' },
      { key: 'reason', label: 'Reason' },
      { key: 'createdBy', label: 'Recorded By' },
    ];
    const dataWithNames = filteredMovements.map((m) => ({
      ...m,
      productName: prodMap[m.productId] || m.productId,
    }));
    exportToCsv('Stock_Movement_History', headers, dataWithNames);
  };

  const columns = [
    {
      header: 'Date & Time',
      key: 'createdAt',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Product',
      key: 'productId',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800">
            {prodMap[row.productId] || row.productId}
          </span>
          <p className="text-[10px] text-slate-400 font-mono">{row.productId}</p>
        </div>
      ),
    },
    {
      header: 'Movement Type',
      key: 'movementType',
      render: (row) => {
        let variant = 'neutral';
        if (row.movementType === 'SALE') variant = 'info';
        else if (row.movementType === 'PURCHASE') variant = 'success';
        else if (row.movementType === 'ADJUSTMENT') variant = 'warning';
        else if (row.movementType === 'SALE_RETURN') variant = 'danger';

        return (
          <Badge variant={variant} size="xs">
            {row.movementType}
          </Badge>
        );
      },
    },
    {
      header: 'Change Qty',
      key: 'quantity',
      render: (row) => {
        const qty = Number(row.quantity);
        return (
          <span
            className={`font-mono font-bold text-xs ${
              qty > 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {qty > 0 ? `+${qty}` : qty}
          </span>
        );
      },
    },
    {
      header: 'Stock Transition',
      key: 'stock',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {row.previousStock} → <strong className="text-slate-900">{row.newStock}</strong>
        </span>
      ),
    },
    {
      header: 'Reference & Reason',
      key: 'reason',
      render: (row) => (
        <div className="max-w-xs">
          <span className="text-xs font-medium text-slate-800 block truncate">
            {row.reason || '—'}
          </span>
          {row.referenceId && (
            <span className="text-[10px] text-slate-400 font-mono">
              Ref: {row.referenceId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Recorded By',
      key: 'createdBy',
      render: (row) => (
        <span className="text-xs text-slate-500">{row.createdBy || 'System'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Inventory Movement History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete audit trail of sales, purchases, adjustments, and returns in Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadMovements}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" icon={Download} onClick={handleExportCsv}>
            Export Audit Log
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <select
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Products</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Movement Types</option>
            <option value="SALE">SALE (Counter Deductions)</option>
            <option value="PURCHASE">PURCHASE (Supplier Stock In)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Manual Corrections)</option>
            <option value="SALE_RETURN">SALE_RETURN (Restocked Returns)</option>
            <option value="INITIAL_STOCK">INITIAL_STOCK</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedMovements}
          isLoading={isLoading}
          keyField="movementId"
          emptyMessage="No stock movements recorded for the selected filter."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredMovements.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
