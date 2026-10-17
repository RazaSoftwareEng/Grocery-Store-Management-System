import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { IdleLock } from '../common/LockScreen';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isPos = location.pathname === '/pos';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f5f2] font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/40 animate-in fade-in"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onCloseMobile={() => setMobileNavOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header onToggleMobileNav={() => setMobileNavOpen(true)} />
        <main className={`flex-1 min-h-0 ${isPos ? 'p-2 sm:p-3 overflow-y-auto lg:overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <div
            key={location.pathname}
            className={`page-enter ${
              isPos ? 'flex-1 min-h-0 flex flex-col' : 'px-4 py-5 sm:px-6 sm:py-6 max-w-7xl w-full mx-auto'
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <IdleLock />
    </div>
  );
}
