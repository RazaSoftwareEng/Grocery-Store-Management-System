import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { formatCurrency } from '../utils/formatters';
import {
  ShoppingCart,
  Receipt,
  Banknote,
  CreditCard,
  BookUser,
  Printer,
  RefreshCw,
  ScanBarcode,
  Keyboard,
} from 'lucide-react';

const PAYMENT_LABELS = {
  CASH: 'Cash',
  CARD: 'Card',
  ONLINE: 'Online',
  BANK_TRANSFER: 'Bank',
  CREDIT: 'Udhaar',
};

export function CashierCounter() {
  const { currentUser } = useAuth();
  const { currencySymbol } = useStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptData, setReceiptData] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    const res = await api.getCashierSummary(currentUser?.userId);
    if (res.success) {
      setSummary(res.data);
    } else {
      showToast(res.error || 'Could not load your bills', 'error');
    }
    setIsLoading(false);
  }, [currentUser?.userId, showToast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleReprint = async (sale) => {
    const res = await api.getSaleDetails(sale.saleId);
    if (res.success) {
      setReceiptData(res.data);
      setIsReceiptOpen(true);
    } else {
      showToast(res.error || 'Could not load bill', 'error');
    }
  };

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cards = [
    {
      title: 'My Sales Today',
      value: formatCurrency(summary?.totalSales, currencySymbol),
      subtitle: `${summary?.billCount || 0} bills`,
      icon: Receipt,
      color: 'bg-brand-50 border border-brand-100 text-brand-600',
    },
    {
      title: 'Cash in Drawer',
      value: formatCurrency(summary?.cashTotal, currencySymbol),
      subtitle: 'Cash bills only',
      icon: Banknote,
      color: 'bg-slate-50 border border-slate-200 text-slate-500',
    },
    {
      title: 'Card / Online',
      value: formatCurrency(summary?.otherTotal, currencySymbol),
      subtitle: 'Card, online & bank',
      icon: CreditCard,
      color: 'bg-slate-50 border border-slate-200 text-slate-500',
    },
    {
      title: 'Udhaar (Credit)',
      value: formatCurrency(summary?.creditTotal, currencySymbol),
      subtitle: 'Added to customer accounts',
      icon: BookUser,
      color: 'bg-slate-50 border border-slate-200 text-slate-500',
    },
  ];

  const columns = [
    {
      header: 'Invoice',
      key: 'invoiceNumber',
      render: (row) => <span className="font-mono font-semibold text-slate-900">{row.invoiceNumber}</span>,
    },
    {
      header: 'Time',
      key: 'date',
      render: (row) =>
        new Date(row.date || row.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
    },
    { header: 'Customer', key: 'customerName' },
    {
      header: 'Payment',
      key: 'paymentMethod',
      render: (row) => PAYMENT_LABELS[row.paymentMethod] || row.paymentMethod,
    },
    {
      header: 'Total',
      key: 'total',
      className: 'text-right font-semibold text-slate-900',
      headerClassName: 'text-right',
      render: (row) => formatCurrency(row.total, currencySymbol),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status === 'COMPLETED' ? 'success' : 'danger'} size="xs">
          {row.status === 'COMPLETED' ? 'Paid' : 'Cancelled'}
        </Badge>
      ),
    },
    {
      header: '',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => handleReprint(row)}>
          Reprint
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Start billing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 animate-rise">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="text-[13px] text-slate-500">{today}</p>
            <h1 className="text-2xl font-semibold text-slate-900 mt-0.5 tracking-tight">
              {currentUser?.fullName || currentUser?.username}'s counter
            </h1>
            <ol className="mt-4 grid sm:grid-cols-3 gap-2 text-[13px] text-slate-600">
              {[
                { Icon: ScanBarcode, text: 'Scan a barcode or type a name, then Enter' },
                { Icon: ShoppingCart, text: 'Check the bill and press F8 to pay' },
                { Icon: Printer, text: 'Print the receipt' },
              ].map(({ Icon, text }, i) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-px">
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.8} />
                    {text}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <Button variant="primary" size="lg" icon={ShoppingCart} onClick={() => navigate('/pos')} className="shrink-0">
            Start new bill
          </Button>
        </div>
      </div>

      {/* Today's totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-xs">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-slate-500">{card.title}</p>
                <p className="text-lg font-semibold text-slate-900 tabular truncate">{card.value}</p>
                <p className="text-xs text-slate-400">{card.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's bills */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">My bills today</h3>
            <p className="text-xs text-slate-500">
              Reprint a bill if the customer asks for a copy
              {summary?.cancelledCount ? ` • ${summary.cancelledCount} cancelled by manager` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadSummary} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
        <Table
          columns={columns}
          data={summary?.sales || []}
          isLoading={isLoading && !summary}
          keyField="saleId"
          emptyMessage="No bills yet today"
          emptyDescription="Your bills will show up here as you complete sales."
        />
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Keyboard className="w-3.5 h-3.5" />
        Shortcuts: F2 search · Enter add item · F8 pay · F4 clear bill
      </p>

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        saleData={receiptData}
        isReprint
      />
    </div>
  );
}
