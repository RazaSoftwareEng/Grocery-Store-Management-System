import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { useFormValidation } from '../hooks/useFormValidation';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { Printer, RotateCcw, Download, RefreshCw, AlertTriangle } from 'lucide-react';

export function Sales() {
  const { currencySymbol, refreshAllData } = useStore();
  const { showToast } = useToast();

  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [cancellingSale, setCancellingSale] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const cancelV = useFormValidation(
    { cancelReason },
    {
      cancelReason: (val) => {
        const t = val.trim();
        if (!t) return 'Tell us why this sale is being returned';
        return t.length < 4 ? 'Add a little more detail (at least 4 characters)' : '';
      },
    }
  );
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const loadSales = async () => {
    try {
      setIsLoading(true);
      const res = await api.getSales();
      if (res.success) setSales(res.data || []);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const filteredSales = sales.filter((s) => {
    if (paymentFilter !== 'ALL' && s.paymentMethod !== paymentFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (!search.trim()) return true;

    const q = search.toLowerCase();
    return (
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q) ||
      s.cashierName?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleViewReceipt = async (sale) => {
    try {
      const res = await api.getSaleDetails(sale.saleId);
      if (res.success) {
        setSelectedSaleDetails(res.data);
        setIsReceiptModalOpen(true);
      }
    } catch {
      showToast('Error fetching invoice details', 'error');
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelV.validate()) return;

    try {
      setIsSubmittingCancel(true);
      const res = await api.cancelSale({
        saleId: cancellingSale.saleId,
        reason: cancelReason,
        authorizedBy: 'Store Manager',
      });

      if (res.success) {
        showToast('Sale cancelled. All inventory stock restored!', 'success');
        await refreshAllData();
        await loadSales();
        setCancellingSale(null);
        setCancelReason('');
      } else {
        showToast(res.error || 'Failed to cancel sale', 'error');
      }
    } catch {
      showToast('Error processing cancellation', 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'date', label: 'Date/Time' },
      { key: 'customerName', label: 'Customer' },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'discount', label: 'Discount' },
      { key: 'tax', label: 'Tax' },
      { key: 'total', label: 'Grand Total' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ];
    exportToCsv('Sales_Invoices_Report', headers, filteredSales);
  };

  const columns = [
    {
      header: 'Invoice #',
      key: 'invoiceNumber',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 font-mono">{row.invoiceNumber}</span>
          <p className="text-xs text-slate-500">{formatDate(row.date || row.createdAt)}</p>
        </div>
      ),
    },
    {
      header: 'Customer',
      key: 'customerName',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.customerName || 'Walk-in Customer'}
        </span>
      ),
    },
    {
      header: 'Cashier',
      key: 'cashierName',
      render: (row) => (
        <span className="text-xs text-slate-500">{row.cashierName || 'Cashier'}</span>
      ),
    },
    {
      header: 'Payment Method',
      key: 'paymentMethod',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
          {row.paymentMethod}
        </span>
      ),
    },
    {
      header: 'Total Paid',
      key: 'total',
      render: (row) => (
        <span className="font-semibold text-slate-900 text-sm">
          {formatCurrency(row.total, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'COMPLETED'
              ? 'success'
              : row.status === 'CANCELLED'
              ? 'danger'
              : 'warning'
          }
          size="xs"
        >
          {row.status || 'COMPLETED'}
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
            onClick={() => handleViewReceipt(row)}
            icon={Printer}
            className="text-xs px-2 py-1"
            title="View & reprint receipt"
          >
            Invoice
          </Button>

          {row.status === 'COMPLETED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCancellingSale(row);
                setCancelReason('');
                cancelV.reset();
              }}
              icon={RotateCcw}
              className="text-slate-500 hover:text-rose-700 hover:bg-rose-50"
              title="Return / cancel sale and restock items"
            >
              Return
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Sales & invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Every completed bill. Reprint receipts or process returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={RefreshCw} onClick={loadSales}>
            Refresh
          </Button>
          <Button variant="secondary" icon={Download} onClick={handleExportCsv}>
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search by invoice # or customer..."
          className="flex-1 min-w-[240px]"
        />

        <div className="flex items-center gap-2">
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="ONLINE">Bank / Online</option>
            <option value="CREDIT">Store Credit</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled / Returned</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedSales}
          isLoading={isLoading}
          keyField="saleId"
          emptyMessage="No sales transactions found matching filters."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSales.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedSaleDetails}
      />

      {/* Cancel Sale Modal */}
      {cancellingSale && (
        <Modal
          isOpen={Boolean(cancellingSale)}
          onClose={() => setCancellingSale(null)}
          title={`Return ${cancellingSale.invoiceNumber}`}
          subtitle={`${formatCurrency(cancellingSale.total, currencySymbol)} · ${cancellingSale.customerName}`}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancellingSale(null)} disabled={isSubmittingCancel}>
                Go back
              </Button>
              <Button type="submit" form="cancel-sale-form" variant="danger" isLoading={isSubmittingCancel} icon={RotateCcw}>
                Return and restock
              </Button>
            </>
          }
        >
          <form id="cancel-sale-form" ref={cancelV.formRef} onSubmit={handleConfirmCancel} noValidate className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>Every item on this invoice goes back into stock and the movement is logged.</p>
            </div>

            <Input
              label="Reason *"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Wrong item billed, damaged goods"
              autoFocus
              {...cancelV.field('cancelReason')}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
