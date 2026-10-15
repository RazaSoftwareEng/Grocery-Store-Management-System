import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  ShoppingCart,
  RefreshCw,
  Bell,
  User,
  ChevronDown,
  Store,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Database,
  LogOut,
  ShieldCheck,
  Users as UsersIcon
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { ConnectGoogleSheetModal } from '../common/ConnectGoogleSheetModal';

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate low stock products
  const lowStockProducts = products.filter(
    (p) => p.status !== 'INACTIVE' && Number(p.currentStock) <= Number(p.minimumStock)
  );

  const handleRefresh = async () => {
    await refreshAllData();
    showToast('Store data refreshed from Google Sheets', 'success');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPosPage = location.pathname === '/pos';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left: Mobile Nav toggle & Store info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs">
          <Store className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-700">{settings.storeName}</span>
          <span>•</span>
          <span className="text-slate-400 truncate max-w-xs">{settings.tagline}</span>
        </div>
      </div>

      {/* Right: Actions, Alerts, Refresh, POS Launch, User Session Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Google Sheet Live/Local Connection Badge Button */}
        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isLiveBackend
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
          title={
            isLiveBackend
              ? 'Google Sheets Backend is Live (Click to configure or view guide)'
              : 'Running in Local Demo Mode (Click to connect your Google Sheet)'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveBackend ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isLiveBackend ? api.backendName : 'Demo Mode'}
          </span>
        </button>

        {/* Sync / Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          isLoading={isLoading}
          icon={RefreshCw}
          title="Refresh data from Google Sheets"
          className="text-slate-500 hover:text-slate-800"
        >
          <span className="hidden md:inline">Sync</span>
        </Button>

        {/* Low Stock Alerts Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
            title="Stock alerts"
          >
            <Bell className="w-4 h-4" />
            {lowStockProducts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Stock Alerts ({lowStockProducts.length})
                </span>
                <Link
                  to="/products?filter=low_stock"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  View All
                </Link>
              </div>

              <div className="max-h-60 overflow-y-auto mt-2 space-y-1">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">All inventory levels are healthy</p>
                ) : (
                  lowStockProducts.map((p) => (
                    <div
                      key={p.productId}
                      className="p-2 rounded-xl bg-amber-50/60 border border-amber-100/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-amber-700">
                          Stock: {p.currentStock} {p.unit} (Min: {p.minimumStock})
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                        LOW
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* POS Quick Button (if not already on POS page) */}
        {!isPosPage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/pos')}
            icon={ShoppingCart}
            className="shadow-sm font-semibold"
          >
            Open POS
          </Button>
        )}

        {/* User Session Dropdown */}
        <div className="relative pl-2 border-l border-slate-200" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0">
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
              ) : (
                <User className="w-4 h-4 text-teal-700" />
              )}
            </div>
            <div className="hidden lg:block text-left">
              <p className="font-bold text-slate-800 text-xs leading-none truncate max-w-[120px]">
                {currentUser?.fullName || currentUser?.username || 'Staff User'}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {isAdmin ? 'Store Manager' : 'Cashier'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="font-bold text-slate-900 text-xs truncate">
                  {currentUser?.fullName || currentUser?.username}
                </p>
                <p className="text-[10px] text-slate-400">
                  Role: <span className="font-semibold text-emerald-600">{currentUser?.role || 'CASHIER'}</span>
                </p>
              </div>

              {isAdmin && (
                <Link
                  to="/users"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manage Staff Accounts</span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Google Sheets Connection Modal */}
      <ConnectGoogleSheetModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </header>
  );
}
