import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { todayStr, addDays } from '../utils/dates';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import { useFormValidation } from '../hooks/useFormValidation';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { ReturnSaleModal } from '../components/pos/ReturnSaleModal';
import { Printer, RotateCcw, Download, RefreshCw, AlertTriangle, Ban } from 'lucide-react';

const PAGE_SIZE = 20;
const selectCls = 'h-[38px] px-3 text-[13px] bg-white border border-slate-300 rounded-xl text-slate-700';

export function Sales() {
  const { currencySymbol, refreshProducts } = useStore();
  const { showToast } = useToast();

  const [sales, setSales] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState(addDays(todayStr(), -29));
  const [endDate, setEndDate] = useState(todayStr());
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [returningSale, setReturningSale] = useState(null);
  const [cancellingSale, setCancellingSale] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const cancelV = useFormValidation(
    { cancelReason },
    { cancelReason: (val) => (val.trim().length < 4 ? 'Give a reason (at least 4 characters)' : '') }
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = { search: debounced, paymentMethod: paymentFilter, status: statusFilter, startDate, endDate };

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    const res = await api.getSales({ ...params, page: currentPage, pageSize: PAGE_SIZE });
    setIsLoading(false);
    if (res.success) {
      setSales(res.data);
      setCount(res.count);
    } else showToast(res.error || 'Could not load sales', 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, paymentFilter, statusFilter, startDate, endDate, currentPage, showToast]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filterChange = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const handleViewReceipt = async (sale) => {
    const res = await api.getSaleDetails(sale.saleId);
    if (res.success) {
      setSelectedSaleDetails(res.data);
      setIsReceiptModalOpen(true);
    } else showToast(res.error || 'Error fetching invoice details', 'error');
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelV.validate()) return;
    setIsSubmittingCancel(true);
    const res = await api.cancelSale({ saleId: cancellingSale.saleId, reason: cancelReason, refundMethod });
    setIsSubmittingCancel(false);
    if (res.success) {
      showToast(res.message || 'Sale cancelled and stock restored', 'success');
      refreshProducts();
      loadSales();
      setCancellingSale(null);
    } else showToast(res.error || 'Failed to cancel sale', 'error');
  };

  const handleExportCsv = async () => {
    const res = await api.getSales({ ...params, all: true });
    if (!res.success) return showToast(res.error, 'error');
    exportToCsv('Sales_Invoices_Report', [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'date', label: 'Date/Time' },
      { key: 'customerName', label: 'Customer' },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'discount', label: 'Bill discount' },
      { key: 'lineDiscountTotal', label: 'Line discounts' },
      { key: 'tax', label: 'Tax' },
      { key: 'total', label: 'Grand Total' },
      { key: 'creditAmount', label: 'To khata' },
      { key: 'returnedTotal', label: 'Returned' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ], res.data);
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
    { header: 'Customer', key: 'customerName', render: (row) => <span className="text-xs font-semibold text-slate-800">{row.customerName || 'Walk-in Customer'}</span> },
    { header: 'Cashier', key: 'cashierName', render: (row) => <span className="text-xs text-slate-500">{row.cashierName || 'Cashier'}</span> },
    {
      header: 'Payment',
      key: 'paymentMethod',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
          {row.paymentMethod}
          {Number(row.creditAmount) > 0 && row.paymentMethod !== 'CREDIT' ? ' + khata' : ''}
        </span>
      ),
    },
    {
      header: 'Total',
      key: 'total',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 text-sm">{formatCurrency(row.total, currencySymbol)}</span>
          {Number(row.returnedTotal) > 0 && row.status === 'COMPLETED' && (
            <p className="text-xs text-rose-600 tabular">−{formatCurrency(row.returnedTotal, currencySymbol)} returned</p>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => {
        const fullyReturned = row.status === 'COMPLETED' && Number(row.returnedTotal) >= Number(row.total) && Number(row.total) > 0;
        const part = row.status === 'COMPLETED' && Number(row.returnedTotal) > 0 && !fullyReturned;
        return (
          <Badge variant={row.status === 'CANCELLED' || fullyReturned ? 'danger' : part ? 'warning' : 'success'} size="xs">
            {fullyReturned ? 'Returned' : part ? 'Part returned' : row.status || 'COMPLETED'}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => {
        const canReturn = row.status === 'COMPLETED' && Number(row.returnedTotal) < Number(row.total);
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => handleViewReceipt(row)} icon={Printer} title="View & reprint receipt">
              Invoice
            </Button>
            {canReturn && (
              <Button variant="ghost" size="sm" onClick={() => setReturningSale(row)} icon={RotateCcw} title="Return some items">
                Return
              </Button>
            )}
            {row.status === 'COMPLETED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCancellingSale(row);
                  setCancelReason('');
                  setRefundMethod('CASH');
                  cancelV.reset();
                }}
                icon={Ban}
                className="text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                title="Cancel the whole sale"
              >
                Cancel
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Sales & invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">Every bill. Reprint receipts, return items or cancel a sale.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={RefreshCw} onClick={loadSales}>Refresh</Button>
          <Button variant="secondary" icon={Download} onClick={handleExportCsv}>Export</Button>
        </div>
      </div>

      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setCurrentPage(1); }}
          placeholder="Invoice #, customer or cashier..."
          className="flex-1 min-w-[220px]"
        />
        <input type="date" value={startDate} max={endDate} onChange={filterChange(setStartDate)} className={selectCls} aria-label="From date" />
        <input type="date" value={endDate} min={startDate} onChange={filterChange(setEndDate)} className={selectCls} aria-label="To date" />
        <select value={paymentFilter} onChange={filterChange(setPaymentFilter)} className={selectCls} aria-label="Payment method">
          <option value="">All payments</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="ONLINE">Bank / Online</option>
          <option value="CREDIT">Khata</option>
          <option value="SPLIT">Split</option>
        </select>
        <select value={statusFilter} onChange={filterChange(setStatusFilter)} className={selectCls} aria-label="Status">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="RETURNED">With returns</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table columns={columns} data={sales} isLoading={isLoading} keyField="saleId" emptyMessage="No sales found for these filters." />
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(count / PAGE_SIZE) || 1}
          totalItems={count}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} saleData={selectedSaleDetails} isReprint />

      <ReturnSaleModal
        sale={returningSale}
        isOpen={Boolean(returningSale)}
        onClose={() => setReturningSale(null)}
        onDone={() => {
          refreshProducts();
          loadSales();
        }}
      />

      {cancellingSale && (
        <Modal
          isOpen={Boolean(cancellingSale)}
          onClose={() => setCancellingSale(null)}
          title={`Cancel ${cancellingSale.invoiceNumber}`}
          subtitle={`${formatCurrency(cancellingSale.total, currencySymbol)} · ${cancellingSale.customerName}`}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancellingSale(null)} disabled={isSubmittingCancel}>Go back</Button>
              <Button type="submit" form="cancel-sale-form" variant="danger" isLoading={isSubmittingCancel} icon={Ban}>
                Cancel sale and restock
              </Button>
            </>
          }
        >
          <form id="cancel-sale-form" ref={cancelV.formRef} onSubmit={handleConfirmCancel} noValidate className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Everything not yet returned goes back into stock. Any unpaid khata part is removed from the customer's
                balance; only the paid part is refunded.
              </p>
            </div>
            <Input
              label="Reason *"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Wrong item billed, customer left"
              autoFocus
              {...cancelV.field('cancelReason')}
            />
            <Select
              label="Refund the paid part as"
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'CARD', label: 'Card reversal' },
                { value: 'ONLINE', label: 'Bank / online' },
              ]}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
