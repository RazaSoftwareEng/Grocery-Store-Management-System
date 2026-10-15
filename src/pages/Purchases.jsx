import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { PurchaseModal } from '../components/purchases/PurchaseModal';
import { Boxes, Plus, CheckCircle, RefreshCw, Eye, Truck } from 'lucide-react';

export function Purchases() {
  const { currencySymbol, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [purRes, suppRes] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
      ]);
      if (purRes.success) setPurchases(purRes.data || []);
      if (suppRes.success) setSuppliers(suppRes.data || []);
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmPurchase = async (purchase) => {
    if (
      !window.confirm(
        `Confirm receipt of Purchase ${purchase.purchaseNumber}? This will automatically add all items to current store stock and update supplier ledger.`
      )
    ) {
      return;
    }

    try {
      const res = await api.confirmPurchase(purchase.purchaseId);
      if (res.success) {
        showToast('Purchase confirmed. Inventory stock updated!', 'success');
        await refreshAllData();
        loadData();
      } else {
        showToast(res.error || 'Failed to confirm purchase', 'error');
      }
    } catch {
      showToast('Error confirming purchase order', 'error');
    }
  };

  const totalPages = Math.ceil(purchases.length / pageSize) || 1;
  const paginatedPurchases = purchases.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const columns = [
    {
      header: 'PO Number & Date',
      key: 'purchaseNumber',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 font-mono">
            {row.purchaseNumber}
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {formatDate(row.date || row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      header: 'Supplier',
      key: 'supplierName',
      render: (row) => (
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Truck className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.supplierName}</span>
        </div>
      ),
    },
    {
      header: 'Total Amount',
      key: 'total',
      render: (row) => (
        <span className="font-bold text-slate-900 text-sm">
          {formatCurrency(row.total, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Paid Amount',
      key: 'amountPaid',
      render: (row) => (
        <span className="text-xs text-emerald-700 font-semibold">
          {formatCurrency(row.amountPaid, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Credit Balance',
      key: 'outstandingBalance',
      render: (row) => {
        const bal = Number(row.outstandingBalance) || 0;
        return (
          <span
            className={`text-xs font-bold ${
              bal > 0 ? 'text-amber-800' : 'text-slate-400'
            }`}
          >
            {bal > 0 ? formatCurrency(bal, currencySymbol) : 'Settled'}
          </span>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status === 'CONFIRMED' ? 'success' : 'warning'} size="xs">
          {row.status || 'PENDING'}
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
            onClick={() => setViewingPurchase(row)}
            icon={Eye}
            className="px-2 py-1 text-xs"
          >
            View
          </Button>

          {row.status !== 'CONFIRMED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleConfirmPurchase(row)}
              icon={CheckCircle}
              className="px-2 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
            >
              Confirm
            </Button>
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
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Stock Purchases & Orders
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Procure stock from suppliers, confirm deliveries, and automatically add to inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadData}>
            Sync
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setIsModalOpen(true)}
            className="font-bold shadow-sm"
          >
            New Purchase Order
          </Button>
        </div>
      </div>

      {/* Purchases Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedPurchases}
          isLoading={isLoading}
          keyField="purchaseId"
          emptyMessage="No purchases recorded yet. Create your first purchase order above!"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={purchases.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modals */}
      <PurchaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        suppliers={suppliers}
        onSuccess={() => {
          loadData();
          refreshAllData();
        }}
      />

      {/* View Purchase Details Modal */}
      {viewingPurchase && (
        <Modal
          isOpen={Boolean(viewingPurchase)}
          onClose={() => setViewingPurchase(null)}
          title={`Purchase Order: ${viewingPurchase.purchaseNumber}`}
          subtitle={`Supplier: ${viewingPurchase.supplierName} • Date: ${formatDate(viewingPurchase.date || viewingPurchase.createdAt)}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500">Order Status:</span>
                <span className="ml-2 font-bold uppercase">{viewingPurchase.status}</span>
              </div>
              <div>
                <span className="text-slate-500">Total:</span>
                <span className="ml-2 font-bold text-slate-900 text-sm">
                  {formatCurrency(viewingPurchase.total, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Items list */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Cost Price</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPurchase.items && viewingPurchase.items.length > 0 ? (
                    viewingPurchase.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-800">{it.productName}</td>
                        <td className="p-2.5 text-center font-semibold">
                          {it.quantity}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {formatCurrency(it.unitCost, currencySymbol)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.lineTotal, currencySymbol)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">
                        Line items data logged in Google Sheets
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {viewingPurchase.notes && (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <strong>Notes:</strong> {viewingPurchase.notes}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setViewingPurchase(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
