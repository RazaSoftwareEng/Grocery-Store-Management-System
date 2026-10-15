import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Table } from '../components/common/Table';
import {
  TrendingUp,
  DollarSign,
  Download,
  Calendar,
  Wallet,
  Package,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const PIE_COLORS = ['#059669', '#0284c7', '#d97706', '#9333ea', '#e11d48', '#64748b'];

export function Reports() {
  const { currencySymbol } = useStore();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = async (start = startDate, end = endDate) => {
    try {
      setIsLoading(true);
      const res = await api.getReports({ startDate: start, endDate: end });
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleQuickPreset = (days) => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
    loadReports(start, end);
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const summaryRows = [
      { Metric: 'Gross Sales Revenue', Amount: reportData.totalSalesRevenue },
      { Metric: 'Cost of Goods Sold (COGS)', Amount: reportData.totalCOGS },
      { Metric: 'Gross Profit', Amount: reportData.grossProfit },
      { Metric: 'Operating Expenses', Amount: reportData.totalExpenses },
      { Metric: 'Estimated Net Profit', Amount: reportData.estimatedNetProfit },
      { Metric: 'Discounts Given', Amount: reportData.totalDiscount },
      { Metric: 'Sales Tax Collected', Amount: reportData.totalTax },
      { Metric: 'Current Stock Cost Valuation', Amount: reportData.inventoryValuation?.costValue },
      { Metric: 'Current Stock Retail Valuation', Amount: reportData.inventoryValuation?.retailValue },
    ];
    exportToCsv(`Grocery_Financial_Statement_${startDate}_to_${endDate}`, [
      { key: 'Metric', label: 'Financial Metric' },
      { key: 'Amount', label: `Amount (${currencySymbol})` },
    ], summaryRows);
  };

  // Prepare chart datasets
  const profitComparisonData = reportData ? [
    {
      name: 'Revenue & Profit',
      Revenue: reportData.totalSalesRevenue || 0,
      COGS: reportData.totalCOGS || 0,
      GrossProfit: reportData.grossProfit || 0,
      NetProfit: Math.max(0, reportData.estimatedNetProfit || 0),
    }
  ] : [];

  const paymentPieData = reportData?.paymentMethodsBreakdown
    ? Object.entries(reportData.paymentMethodsBreakdown).map(([key, val]) => ({
        name: key,
        value: val,
      }))
    : [];

  const expenseBarData = reportData?.expenseByCategory
    ? Object.entries(reportData.expenseByCategory).map(([key, val]) => ({
        category: key,
        amount: val,
      }))
    : [];

  const topProductsColumns = [
    {
      header: 'Product Name',
      key: 'name',
      render: (row) => <span className="font-bold text-slate-800">{row.name}</span>,
    },
    {
      header: 'Units Sold',
      key: 'quantity',
      render: (row) => <span className="font-semibold text-slate-700">{row.quantity}</span>,
    },
    {
      header: 'Revenue Generated',
      key: 'revenue',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900">
          {formatCurrency(row.revenue, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Gross Profit Generated',
      key: 'profit',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-700">
          {formatCurrency(row.profit, currencySymbol)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Date Range Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Financial Analytics & Profit Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Accurate profit and loss calculations using cost price snapshots from Google Sheets.
          </p>
        </div>

        {/* Date Filter & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickPreset(0)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(7)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(30)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Last 30 Days
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadReports(startDate, endDate)}
              className="text-xs py-1.5 px-3 font-bold"
            >
              Apply
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleExportCsv}
            className="text-xs py-1.5"
          >
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards: Revenue, COGS, Gross Profit, Expenses, Net Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Sales Revenue
          </p>
          <p className="text-xl font-black text-slate-900 mt-1">
            {formatCurrency(reportData?.totalSalesRevenue || 0, currencySymbol)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Completed counter sales</p>
        </Card>

        <Card className="border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cost of Goods (COGS)
          </p>
          <p className="text-xl font-black text-slate-700 mt-1">
            {formatCurrency(reportData?.totalCOGS || 0, currencySymbol)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Snapshot wholesale cost</p>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Gross Profit
          </p>
          <p className="text-xl font-black text-emerald-950 mt-1">
            {formatCurrency(reportData?.grossProfit || 0, currencySymbol)}
          </p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Revenue minus COGS</p>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Operating Expenses
          </p>
          <p className="text-xl font-black text-amber-950 mt-1">
            {formatCurrency(reportData?.totalExpenses || 0, currencySymbol)}
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5">Rent, utility bills, salaries</p>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
            Estimated Net Profit
          </p>
          <p
            className={`text-xl font-black mt-1 ${
              (reportData?.estimatedNetProfit || 0) >= 0
                ? 'text-indigo-950'
                : 'text-rose-700'
            }`}
          >
            {formatCurrency(reportData?.estimatedNetProfit || 0, currencySymbol)}
          </p>
          <p className="text-[10px] text-indigo-700 mt-0.5">Gross profit minus expenses</p>
        </Card>
      </div>

      {/* Inventory Stock Valuation Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Store Inventory Health & Valuation
          </span>
          <p className="text-sm font-semibold text-slate-300 mt-0.5">
            Total Current Stock Valuation in Google Sheets
          </p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-slate-400">Total Stock Cost Value</p>
            <p className="text-lg font-black text-white font-mono">
              {formatCurrency(reportData?.inventoryValuation?.costValue || 0, currencySymbol)}
            </p>
          </div>
          <div className="pl-6 border-l border-slate-700">
            <p className="text-xs text-emerald-400">Total Stock Retail Value</p>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {formatCurrency(reportData?.inventoryValuation?.retailValue || 0, currencySymbol)}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown Pie Chart */}
        <Card
          title="Revenue by Payment Method"
          subtitle="Distribution of tender types across transactions"
        >
          <div className="h-64 w-full">
            {paymentPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    fontSize={11}
                  >
                    {paymentPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => formatCurrency(val, currencySymbol)}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No payment data available in selected period
              </div>
            )}
          </div>
        </Card>

        {/* Operating Expenses by Category Bar Chart */}
        <Card
          title="Operating Expenses by Category"
          subtitle="Breakdown of utility bills, rent, and overheads"
        >
          <div className="h-64 w-full pt-2">
            {expenseBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseBarData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="category"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val, currencySymbol), 'Expense']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="amount" fill="#d97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No expenses recorded in selected period
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top Performing Products Table */}
      <Card
        title="Top Revenue & Profit Generating Products"
        subtitle="Ranked performance by gross profit contribution"
      >
        <Table
          columns={topProductsColumns}
          data={reportData?.topProducts || []}
          isLoading={isLoading}
          keyField="name"
          emptyMessage="No sales data in selected period."
        />
      </Card>
    </div>
  );
}
