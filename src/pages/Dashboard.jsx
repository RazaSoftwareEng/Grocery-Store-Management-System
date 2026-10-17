import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getStoreTimeZone } from '../utils/dates';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/Table';
import { CountUp } from '../components/common/CountUp';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { ProductModal } from '../components/inventory/ProductModal';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  Boxes,
  Wallet,
  Receipt,
  Printer,
  ChevronRight,
  BarChart2,
  Users as UsersIcon,
  Plus,
  Layers,
  Settings,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function Dashboard() {
  const {
    currencySymbol,
    dashboardStats,
    quickAdjustStock,
  } = useStore();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(dashboardStats);
  const [isLoading, setIsLoading] = useState(!dashboardStats);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Sync state if context cache updates
  useEffect(() => {
    if (dashboardStats) {
      setStats(dashboardStats);
      setIsLoading(false);
    }
  }, [dashboardStats]);

  // Background fetch to keep stats ultra-fresh
  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const res = await api.getDashboardStats();
        if (res?.success && res.data && isMounted) {
          setStats(res.data);
        }
      } catch (err) {
        console.warn('Dashboard stats background fetch warning:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleReprintReceipt = async (sale) => {
    try {
      const res = await api.getSaleDetails(sale.saleId);
      if (res.success) {
        setSelectedSaleDetails(res.data);
        setIsReceiptModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching sale details:', err);
    }
  };

  const hour = Number(new Date().toLocaleString('en-US', { timeZone: getStoreTimeZone(), hour: 'numeric', hourCycle: 'h23' }));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (currentUser?.fullName || currentUser?.username || 'there').split(' ')[0];
  const lowCount = Number(stats?.lowStockCount) || 0;
  const money = (n) => formatCurrency(n, currencySymbol);

  const kpis = [
    {
      title: "Today's sales",
      value: stats?.todaySalesTotal || 0,
      format: money,
      subtitle: `${stats?.todayCompletedSalesCount || 0} completed orders`,
      icon: Receipt,
    },
    {
      title: 'Gross profit today',
      value: stats?.todayGrossProfit || 0,
      format: money,
      subtitle: 'Sales minus cost of goods',
      icon: TrendingUp,
    },
    {
      title: 'Active products',
      value: stats?.totalProductsCount || 0,
      subtitle: 'In your catalog',
      icon: Package,
      actionText: 'View products',
      actionUrl: '/products',
    },
    {
      title: 'Low stock',
      value: lowCount,
      subtitle: lowCount > 0 ? 'At or below their alert level' : 'Every item is well stocked',
      icon: AlertTriangle,
      tone: lowCount > 0 ? 'warning' : 'neutral',
      actionText: 'Restock',
      actionUrl: '/products?filter=low_stock',
    },
  ];

  const quickActions = [
    { label: 'Add product', icon: Plus, onClick: () => setIsProductModalOpen(true) },
    { label: 'Categories', icon: Layers, onClick: () => navigate('/categories') },
    { label: 'New purchase', icon: Boxes, onClick: () => navigate('/purchases') },
    { label: 'Record expense', icon: Wallet, onClick: () => navigate('/expenses') },
    ...(isAdmin
      ? [
          { label: 'Staff', icon: UsersIcon, onClick: () => navigate('/users') },
          { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            {new Date().toLocaleDateString('en-PK', { timeZone: getStoreTimeZone(), weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button variant="primary" icon={ShoppingCart} onClick={() => navigate('/pos')}>
          Open POS
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between text-[13px] text-slate-500">
                <span>{kpi.title}</span>
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                    kpi.tone === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-600'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.8} />
                </span>
              </div>
              {isLoading && !stats ? (
                <span className="skeleton block h-7 w-32 mt-3" />
              ) : (
                <p
                  className={`text-[26px] leading-8 font-semibold tracking-tight tabular mt-2 ${
                    kpi.tone === 'warning' ? 'text-amber-700' : 'text-slate-900'
                  }`}
                >
                  <CountUp value={kpi.value} format={kpi.format} />
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
              {kpi.actionUrl && (
                <Link
                  to={kpi.actionUrl}
                  className="mt-3 pt-3 border-t border-slate-100 text-[13px] font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 group"
                >
                  {kpi.actionText}
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="h-9 px-3 inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-xs transition-all"
          >
            <Icon className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Sales trend & best sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Sales, last 7 days" subtitle="Completed sales per day" className="lg:col-span-2">
          <div className="h-72 w-full">
            {stats?.weeklySalesTrend && stats.weeklySalesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.weeklySalesTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2a7d5a" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#2a7d5a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ebeae5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#9a9e9b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={6}
                  />
                  <YAxis
                    stroke="#9a9e9b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k` : val)}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cfcec7', strokeDasharray: '3 3' }}
                    formatter={(val) => [money(val), 'Sales']}
                    labelStyle={{ color: '#6e7370', marginBottom: 2 }}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e3e2dc',
                      boxShadow: '0 8px 28px rgb(24 27 26 / 0.12)',
                      fontSize: '13px',
                      fontFamily: 'Geist, system-ui, sans-serif',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#1f6a4b"
                    strokeWidth={2}
                    fill="url(#salesGrad)"
                    activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: '#1f6a4b' }}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BarChart2}
                title="No sales this week yet"
                description="The chart fills in as sales are completed at the POS."
              />
            )}
          </div>
        </Card>

        <Card title="Best sellers" subtitle="By units sold" bodyClassName="p-2">
          {stats?.bestSellingProducts && stats.bestSellingProducts.length > 0 ? (
            <ul className="stagger">
              {stats.bestSellingProducts.map((p, idx) => (
                <li
                  key={p.productId || idx}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-[13px] font-semibold text-slate-400 tabular shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 tabular">{p.totalQuantity} sold</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-slate-900 tabular shrink-0">
                    {money(p.totalRevenue)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No best sellers yet"
              description="Sell a few items at the POS to see what moves fastest."
            />
          )}
        </Card>
      </div>

      {/* This month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Expenses this month', value: stats?.totalExpenses, to: '/expenses' },
          { label: 'Customer khata to collect', value: stats?.customerReceivables, to: '/customers' },
          { label: 'Owed to suppliers', value: stats?.supplierPayables, to: '/suppliers' },
        ].map((x) => (
          <Link key={x.label} to={x.to} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300">
            <p className="text-[13px] text-slate-500">{x.label}</p>
            <p className="text-lg font-semibold text-slate-900 tabular">{money(x.value)}</p>
          </Link>
        ))}
      </div>

      {Number(stats?.expiringCount) > 0 && (
        <Card
          title="Expiring soon"
          subtitle={`Expired or expiring within ${stats.expiryAlertDays} days`}
          bodyClassName="p-0"
          actions={
            <Link to="/products?filter=expiring" className="text-[13px] text-brand-600 hover:text-brand-700 font-medium">
              View all ({stats.expiringCount})
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100">
            {stats.expiringItems.map((item) => (
              <li key={item.productId} className="px-5 py-2.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="font-medium text-slate-900 truncate">{item.name}</span>
                <span className="text-xs tabular shrink-0 text-slate-500">
                  {item.currentStock} {item.unit} ·{' '}
                  <span className={item.daysLeft < 0 ? 'text-rose-600 font-semibold' : 'text-amber-700 font-semibold'}>
                    {item.daysLeft < 0 ? `expired ${-item.daysLeft} days ago` : item.daysLeft === 0 ? 'expires today' : `${item.daysLeft} days left`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Low stock & recent sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card
          title="Needs restock"
          subtitle="At or below their alert level"
          bodyClassName="p-0"
          actions={
            <Link to="/products?filter=low_stock" className="text-[13px] text-brand-600 hover:text-brand-700 font-medium">
              View all ({lowCount})
            </Link>
          }
        >
          {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {stats.lowStockItems.map((item) => {
                const cur = Number(item.currentStock) || 0;
                const min = Number(item.minimumStock) || 1;
                const pct = Math.max(4, Math.min(100, (cur / min) * 100));
                return (
                  <li key={item.productId} className="px-5 py-3 flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
                        <span className="text-xs text-slate-500 tabular shrink-0">
                          <span className={`font-semibold ${cur <= 0 ? 'text-rose-600' : 'text-amber-700'}`}>{cur}</span> / {item.minimumStock} {item.unit}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-100 mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-700 ${cur <= 0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={() => quickAdjustStock(item.productId, 10)}
                      title="Add 10 to stock"
                      className="shrink-0"
                    >
                      10
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Package} title="Stock levels look healthy" description="Nothing is below its alert level right now." />
          )}
        </Card>

        <Card
          title="Recent sales"
          subtitle="Latest invoices from the counter"
          bodyClassName="p-0"
          actions={
            <Link to="/sales" className="text-[13px] text-brand-600 hover:text-brand-700 font-medium">
              View all
            </Link>
          }
        >
          {stats?.recentSales && stats.recentSales.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {stats.recentSales.map((sale) => (
                <li key={sale.saleId} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-900 tabular">{sale.invoiceNumber}</span>
                      <Badge variant="neutral" size="xs" dot={false}>
                        {sale.paymentMethod}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {sale.customerName || 'Walk-in'} · {formatDate(sale.date || sale.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-semibold text-slate-900 tabular">{money(sale.total)}</span>
                    <button
                      type="button"
                      onClick={() => handleReprintReceipt(sale)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Reprint receipt"
                      aria-label={`Reprint receipt ${sale.invoiceNumber}`}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No sales yet"
              description="Completed sales from the POS show up here."
              action={
                <Button size="sm" icon={ShoppingCart} onClick={() => navigate('/pos')}>
                  Open POS
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <ProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedSaleDetails}
        isReprint
      />
    </div>
  );
}
