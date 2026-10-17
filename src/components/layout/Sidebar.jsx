import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  UserCheck,
  Store,
  ClipboardCheck,
  ScrollText,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';

const ALL_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { to: '/counter', label: 'My counter', icon: Store, cashierOnly: true },
  { to: '/pos', label: 'POS billing', icon: ShoppingCart },
  { group: 'Catalog', to: '/products', label: 'Products', icon: Package, adminOnly: true, badge: 'lowStock' },
  { group: 'Catalog', to: '/categories', label: 'Categories', icon: Layers, adminOnly: true },
  { group: 'Catalog', to: '/inventory', label: 'Stock movements', icon: ArrowLeftRight, adminOnly: true },
  { group: 'Catalog', to: '/stock-count', label: 'Stock count', icon: ClipboardCheck, adminOnly: true },
  { group: 'Buying', to: '/purchases', label: 'Purchases', icon: Boxes, adminOnly: true },
  { group: 'Buying', to: '/suppliers', label: 'Suppliers', icon: Truck, adminOnly: true },
  { group: 'Selling', to: '/sales', label: 'Sales & invoices', icon: Receipt, adminOnly: true },
  { group: 'Selling', to: '/customers', label: 'Customers', icon: Users, adminOnly: true },
  { group: 'Finance', to: '/expenses', label: 'Expenses', icon: Wallet, adminOnly: true },
  { group: 'Finance', to: '/reports', label: 'Reports & profit', icon: BarChart3, adminOnly: true, permission: 'canViewReports' },
  { group: 'Admin', to: '/users', label: 'Staff & cashiers', icon: UserCheck, adminOnly: true },
  { group: 'Admin', to: '/audit-log', label: 'Audit log', icon: ScrollText, adminOnly: true },
  { group: 'Admin', to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function Sidebar({ onCloseMobile }) {
  const { settings, products = [] } = useStore();
  const { isAdmin, logout, can } = useAuth();
  const navigate = useNavigate();

  // Allow collapsing sidebar to save space on laptop screens
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gsms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gsms_sidebar_collapsed', String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const lowStockCount = products.filter(
    (p) => p.status !== 'INACTIVE' && Number(p.currentStock) <= Number(p.minimumStock)
  ).length;

  // Filter items based on user role
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin && !(item.permission && can(item.permission))) return false;
    if (item.cashierOnly && isAdmin) return false;
    return true;
  });

  const storeName = settings.storeName || 'Bismillah Grocery';
  const initials = storeName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  let lastGroup = null;

  return (
    <aside
      className={`h-full bg-white text-slate-700 flex flex-col shrink-0 select-none border-r border-slate-200 transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
        isCollapsed ? 'w-[64px]' : 'w-60'
      }`}
    >
      {/* Brand */}
      <div className={`h-16 px-3.5 flex items-center border-b border-slate-200 gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-semibold text-[13px] shrink-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]">
          {initials || 'B'}
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0 animate-in fade-in">
            <p className="text-[13px] font-semibold text-slate-900 truncate leading-5">{storeName}</p>
            <p className="text-xs text-slate-500 truncate leading-4">{isAdmin ? 'Store manager' : 'Cashier counter'}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const showGroup = item.group && item.group !== lastGroup;
          lastGroup = item.group || lastGroup;
          const count = item.badge === 'lowStock' ? lowStockCount : 0;

          return (
            <React.Fragment key={item.to}>
              {showGroup &&
                (isCollapsed ? (
                  <div className="h-px bg-slate-200 my-2.5 mx-2" />
                ) : (
                  <p className="px-2.5 pt-4 pb-1.5 text-xs font-medium text-slate-400">{item.group}</p>
                ))}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center h-9 rounded-lg text-[13px] font-medium transition-colors duration-150 mb-0.5 ${
                    isCollapsed ? 'justify-center' : 'gap-2.5 px-2.5'
                  } ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute -left-2.5 top-2 bottom-2 w-[3px] rounded-r bg-brand-600 animate-in fade-in" />
                    )}
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                      strokeWidth={1.8}
                    />
                    {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {count > 0 &&
                      (isCollapsed ? (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                      ) : (
                        <span className="tabular text-[11px] font-medium px-1.5 h-[18px] inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {count}
                        </span>
                      ))}
                  </>
                )}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-slate-200 space-y-1">
        <div className={`flex ${isCollapsed ? 'flex-col' : ''} gap-1`}>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={`flex-1 flex items-center h-9 rounded-lg text-[13px] font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors ${
              isCollapsed ? 'justify-center' : 'gap-2.5 px-2.5'
            }`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
            {!isCollapsed && <span>Log out</span>}
          </button>
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 self-center"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
