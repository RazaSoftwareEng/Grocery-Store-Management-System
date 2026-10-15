import React, { useState } from 'react';
import { api } from '../../services/api';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  Layers,
  ArrowLeftRight,
  Database,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCheck
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';

const ALL_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS Billing', icon: ShoppingCart, highlight: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: Layers },
  { to: '/inventory', label: 'Stock Movements', icon: ArrowLeftRight },
  { to: '/purchases', label: 'Purchases', icon: Boxes, adminOnly: true },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, adminOnly: true },
  { to: '/sales', label: 'Sales & Invoices', icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/expenses', label: 'Expenses', icon: Wallet, adminOnly: true },
  { to: '/reports', label: 'Reports & Profit', icon: BarChart3, adminOnly: true },
  { to: '/users', label: 'Staff & Cashiers', icon: UserCheck, adminOnly: true },
  { to: '/settings', label: 'Settings & DB', icon: Settings, adminOnly: true },
];

export function Sidebar({ onCloseMobile }) {
  const { settings, isLiveBackend } = useStore();
  const { currentUser, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Allow collapsing sidebar to save space on laptop screens
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('gsms_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('gsms_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter items based on user role
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <aside
      className={`h-full bg-slate-900 text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800 transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-56 xl:w-60'
      }`}
    >
      {/* Brand Header */}
      <div className={`p-3.5 flex items-center border-b border-slate-800/80 ${isCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20 shrink-0">
            <ShoppingCart className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-xs font-black text-white truncate leading-tight tracking-tight">
                {settings.storeName || 'Bismillah Grocery'}
              </h1>
              <p className="text-[10px] text-emerald-400 font-semibold truncate mt-0.5">
                {isAdmin ? 'Store Manager' : 'Cashier Counter'}
              </p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="hidden lg:flex p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar (more screen space)'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-xl text-xs font-medium transition-all duration-150 ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                } ${
                  isActive
                    ? item.highlight
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                      : 'bg-slate-800 text-white font-bold'
                    : item.highlight
                    ? 'text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!isCollapsed && item.highlight && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                  POS
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer: Backend status & Logout */}
      <div className="p-2 border-t border-slate-800 bg-slate-950/40 space-y-1.5">
        <NavLink
          to="/settings"
          onClick={onCloseMobile}
          title={isCollapsed ? (isLiveBackend ? `${api.backendName} Live` : 'Local Demo Mode') : undefined}
          className={`flex items-center rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors ${
            isCollapsed ? 'justify-center p-2' : 'justify-between p-2'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-200 truncate">
                  {isLiveBackend ? `${api.backendName} Live` : 'Local Mode'}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {isLiveBackend ? 'Auto-synced' : 'Click to connect'}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </NavLink>

        {/* Quick Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Log Out' : undefined}
          className={`w-full flex items-center rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center p-2' : 'gap-2 px-3 py-1.5'
          }`}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}
