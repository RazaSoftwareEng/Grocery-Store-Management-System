import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  ShoppingCart,
  RefreshCw,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Users as UsersIcon,
  PackageCheck,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Kbd } from '../common/Button';
import { ConnectGoogleSheetModal } from '../common/ConnectGoogleSheetModal';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/counter': 'My counter',
  '/pos': 'POS billing',
  '/products': 'Products',
  '/categories': 'Categories',
  '/inventory': 'Stock movements',
  '/purchases': 'Purchases',
  '/suppliers': 'Suppliers',
  '/sales': 'Sales & invoices',
  '/customers': 'Customers',
  '/expenses': 'Expenses',
  '/reports': 'Reports & profit',
  '/users': 'Staff & cashiers',
  '/settings': 'Settings',
};

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handle(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    }
    function handleKey(event) {
      if (event.key === 'Escape') onOutside();
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onOutside]);
}

export function Header({ onToggleMobileNav }) {
  const { settings, products, isLiveBackend, refreshAllData, isLoading } = useStore();
  const { currentUser, logout, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  useClickOutside(userMenuRef, () => setShowUserMenu(false));
  useClickOutside(notifRef, () => setShowNotifications(false));

  // Calculate low stock products
  const lowStockProducts = products.filter(
    (p) => p.status !== 'INACTIVE' && Number(p.currentStock) <= Number(p.minimumStock)
  );

  const handleRefresh = async () => {
    await refreshAllData();
    showToast('Store data refreshed', 'success');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPosPage = location.pathname === '/pos';
  const pageTitle = PAGE_TITLES[location.pathname] || '';
  const displayName = currentUser?.fullName || currentUser?.username || 'Staff user';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
      {/* Left: mobile nav toggle & breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1.5 text-[13px] min-w-0" aria-label="Breadcrumb">
          <span className="hidden sm:inline text-slate-500 truncate max-w-[180px]">{settings.storeName}</span>
          {pageTitle && (
            <>
              <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="font-medium text-slate-900 truncate">{pageTitle}</span>
            </>
          )}
        </nav>
      </div>

      {/* Right: status, sync, alerts, POS, account */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => isAdmin && setShowConnectModal(true)}
          className={`hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
            isAdmin ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
          } border-slate-200 text-slate-700`}
          title={
            isLiveBackend
              ? `${api.backendName} is connected${isAdmin ? '. Click to configure.' : ''}`
              : `Running in local demo mode${isAdmin ? '. Click to connect a database.' : ''}`
          }
        >
          <span className="relative flex w-2 h-2">
            {isLiveBackend && <span className="absolute inset-0 rounded-full bg-brand-500 opacity-60 animate-ping" />}
            <span className={`relative w-2 h-2 rounded-full ${isLiveBackend ? 'bg-brand-500' : 'bg-amber-500'}`} />
          </span>
          {isLiveBackend ? api.backendName : 'Demo mode'}
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-60"
          title="Sync data"
          aria-label="Sync data"
        >
          <RefreshCw className={`w-[18px] h-[18px] ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
        </button>

        {/* Low stock alerts */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className={`p-2 rounded-lg relative transition-colors ${
              showNotifications ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label={`Stock alerts (${lowStockProducts.length})`}
            aria-expanded={showNotifications}
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {lowStockProducts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="text-[13px] font-semibold text-slate-900">
                  Stock alerts <span className="text-slate-400 font-normal tabular">({lowStockProducts.length})</span>
                </span>
                {isAdmin && lowStockProducts.length > 0 && (
                  <Link
                    to="/products?filter=low_stock"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    View all
                  </Link>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {lowStockProducts.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <PackageCheck className="w-6 h-6 text-brand-500 mx-auto mb-2" strokeWidth={1.8} />
                    <p className="text-[13px] text-slate-600">All stock levels are healthy</p>
                  </div>
                ) : (
                  lowStockProducts.map((p) => {
                    const stock = Number(p.currentStock) || 0;
                    const min = Number(p.minimumStock) || 1;
                    const pct = Math.max(4, Math.min(100, (stock / min) * 100));
                    return (
                      <div key={p.productId} className="px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13px] font-medium text-slate-800 truncate">{p.name}</p>
                          <span className="text-xs tabular text-slate-500 shrink-0">
                            <span className={`font-semibold ${stock <= 0 ? 'text-rose-600' : 'text-amber-700'}`}>{stock}</span> / {p.minimumStock}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${stock <= 0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {!isPosPage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/pos')}
            icon={ShoppingCart}
            className="ml-1"
          >
            <span className="hidden sm:inline">Open POS</span>
          </Button>
        )}
        {isPosPage && (
          <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 ml-1">
            <Kbd>F2</Kbd> search <Kbd>F8</Kbd> pay
          </span>
        )}

        {/* Account menu */}
        <div className="relative pl-2 ml-1 border-l border-slate-200" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-expanded={showUserMenu}
            aria-label="Account menu"
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <p className="font-medium text-slate-900 text-[13px] leading-4 truncate max-w-[130px]">{displayName}</p>
              <p className="text-xs text-slate-500 leading-4">{isAdmin ? 'Store manager' : 'Cashier'}</p>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 hidden lg:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right">
              <div className="px-2.5 py-2 border-b border-slate-100 mb-1">
                <p className="font-medium text-slate-900 text-[13px] truncate">{displayName}</p>
                <p className="text-xs text-slate-500">{isAdmin ? 'Store manager' : 'Cashier'}</p>
              </div>

              {isAdmin && (
                <Link
                  to="/users"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-2.5 h-9 text-[13px] text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <UsersIcon className="w-4 h-4 text-slate-400" />
                  Manage staff accounts
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 h-9 text-[13px] text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <ConnectGoogleSheetModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </header>
  );
}
