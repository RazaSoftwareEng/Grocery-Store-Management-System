import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { ProductModal } from '../components/inventory/ProductModal';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingCart,
  Boxes,
  Wallet,
  ArrowUpRight,
  Receipt,
  Printer,
  ChevronRight,
  Clock,
  BarChart2,
  Users as UsersIcon,
  Plus,
  Layers,
  Settings,
  Sparkles,
  Database
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
    refreshAllData,
    dashboardStats,
    isLiveBackend,
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

  const kpis = [
    {
      title: "Today's Total Sales",
      value: formatCurrency(stats?.todaySalesTotal || 0, currencySymbol),
      subtitle: `${stats?.todayCompletedSalesCount || 0} completed orders today`,
      icon: DollarSign,
      color: 'bg-emerald-500 text-white',
      trend: isLiveBackend ? `Live ${api.backendName}` : 'Local Demo',
    },
    {
      title: "Today's Gross Profit",
      value: formatCurrency(stats?.todayGrossProfit || 0, currencySymbol),
      subtitle: 'Revenue minus unit cost prices',
      icon: TrendingUp,
      color: 'bg-teal-600 text-white',
      trend: 'Real-time COGS',
    },
    {
      title: 'Active Products',
      value: stats?.totalProductsCount || 0,
      subtitle: 'Total catalog items',
      icon: Package,
      color: 'bg-indigo-600 text-white',
      actionText: 'View Inventory',
      actionUrl: '/products',
    },
    {
      title: 'Low-Stock Alerts',
      value: stats?.lowStockCount || 0,
      subtitle: 'Items at or below minimum threshold',
      icon: AlertTriangle,
      color: stats?.lowStockCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white',
      actionText: 'Restock Items',
      actionUrl: '/products?filter=low_stock',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Management Hub */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-3xl text-white shadow-xl p-5 sm:p-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-bold border border-white/10">
              <span className={`w-2 h-2 rounded-full ${isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <Database className="w-3.5 h-3.5" />
              <span>{isLiveBackend ? `${api.backendName} Database: Active & Connected` : 'Local Mode'}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black mt-3 tracking-tight">
              Welcome back, {currentUser?.fullName || currentUser?.username || 'Store Manager'}!
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
              Control your grocery inventory, manage cashiers, monitor real-time gross profit, and process customer sales from one place.
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="lg"
              icon={ShoppingCart}
              onClick={() => navigate('/pos')}
              className="bg-white text-slate-950 hover:bg-emerald-50 font-black shadow-lg text-sm sm:text-base px-5 py-3 cursor-pointer"
            >
              Open POS Register
            </Button>
          </div>
        </div>

        {/* Quick Management Command Center Bar */}
        <div className="mt-6 pt-5 border-t border-white/15">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300 mb-3">
            Quick Management Hub
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Product</span>
              </div>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">With instant stock</p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/categories')}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                <Layers className="w-4 h-4 text-teal-400" />
                <span>Categories</span>
              </div>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Organize aisles</p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>Purchases</span>
              </div>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Supplier stock-in</p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span>Expenses</span>
              </div>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Bills & utilities</p>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/users')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                  <UsersIcon className="w-4 h-4 text-violet-400" />
                  <span>Staff & Users</span>
                </div>
                <p className="text-[10px] text-emerald-200/70 mt-0.5">Cashier logins</p>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left backdrop-blur-xs border border-white/10 group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-emerald-300">
                  <Settings className="w-4 h-4 text-rose-400" />
                  <span>Store Settings</span>
                </div>
                <p className="text-[10px] text-emerald-200/70 mt-0.5">Receipts & setup</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card key={idx} className="relative overflow-hidden border-slate-200 shadow-2xs">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {kpi.title}
                  </p>
                  <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                    {kpi.value}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                </div>
                <div className={`p-3 rounded-2xl shrink-0 shadow-sm ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {kpi.actionUrl && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={kpi.actionUrl}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    {kpi.actionText} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Charts Section: 7-Day Sales Trend & Best Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Revenue Trend Chart */}
        <Card
          title="7-Day Sales Revenue Trend"
          subtitle="Daily sales performance over the past week"
          className="lg:col-span-2 shadow-2xs"
        >
          <div className="h-72 w-full pt-2">
            {stats?.weeklySalesTrend && stats.weeklySalesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.weeklySalesTrend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${currencySymbol} ${val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val, currencySymbol), 'Sales']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No recent sales to display in trend chart
              </div>
            )}
          </div>
        </Card>

        {/* Top 5 Best-Selling Products */}
        <Card
          title="Best-Selling Products"
          subtitle="Top performing items by volume sold"
          className="shadow-2xs"
        >
          <div className="space-y-3 pt-1">
            {stats?.bestSellingProducts && stats.bestSellingProducts.length > 0 ? (
              stats.bestSellingProducts.map((p, idx) => (
                <div
                  key={p.productId || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.totalQuantity} units sold
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">
                    {formatCurrency(p.totalRevenue, currencySymbol)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-12 text-center">
                Start selling products in POS to see best sellers here
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Grid: Low Stock Alert Items with 1-Click Restock & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Warning List with Quick Restock Button */}
        <Card
          title="Stock Alerts (Low Inventory)"
          subtitle="Restock these products before they run out"
          className="shadow-2xs"
          actions={
            <Link
              to="/products?filter=low_stock"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
            >
              View All ({stats?.lowStockCount || 0})
            </Link>
          }
        >
          <div className="space-y-2">
            {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
              stats.lowStockItems.map((item) => (
                <div
                  key={item.productId}
                  className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Available: <strong className="font-black text-amber-950">{item.currentStock} {item.unit}</strong> (Min: {item.minimumStock})
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => quickAdjustStock(item.productId, 10)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                      title="Instantly add +10 stock"
                    >
                      +10 Restock
                    </button>
                    <Link
                      to="/products"
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold text-xs transition-colors"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                All products have sufficient stock levels.
              </p>
            )}
          </div>
        </Card>

        {/* Recent Completed Sales */}
        <Card
          title="Recent Sales Transactions"
          subtitle="Latest counter invoices processed"
          className="shadow-2xs"
          actions={
            <Link
              to="/sales"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
            >
              View All Sales
            </Link>
          }
        >
          <div className="space-y-2">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <div
                  key={sale.saleId}
                  className="p-3 rounded-xl border border-slate-200/80 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{sale.invoiceNumber}</span>
                      <Badge variant="success" size="xs">
                        {sale.paymentMethod}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {sale.customerName || 'Walk-in'} • {formatDate(sale.date || sale.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-black text-slate-900 text-sm">
                      {formatCurrency(sale.total, currencySymbol)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReprintReceipt(sale)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Reprint receipt"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                No recent transactions found. Complete a sale in POS to see it here!
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Add Product Modal (triggered directly from quick command center) */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
      />

      {/* Receipt Reprint Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={selectedSaleDetails}
      />
    </div>
  );
}
