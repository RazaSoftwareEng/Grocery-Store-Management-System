import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PosBilling } from './pages/PosBilling';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Inventory } from './pages/Inventory';
import { Purchases } from './pages/Purchases';
import { Suppliers } from './pages/Suppliers';
import { Sales } from './pages/Sales';
import { Customers } from './pages/Customers';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { CashierCounter } from './pages/CashierCounter';
import { AuditLog } from './pages/AuditLog';
import { StockCount } from './pages/StockCount';
import { ChangePasswordScreen } from './components/common/ChangePasswordForm';

function ProtectedRoute({ children, adminOnly = false, permission }) {
  const { isAuthenticated, isAdmin, mustChangePassword, can } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword) {
    return <ChangePasswordScreen />;
  }

  if (adminOnly && !isAdmin && !(permission && can(permission))) {
    return <Navigate to="/pos" replace />;
  }

  return children;
}

function AdminOnly({ children }) {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>;
}

function PublicLoginRoute() {
  const { isAuthenticated, isCashier } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={isCashier ? "/pos" : "/"} replace />;
  }
  return <Login />;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <StoreProvider>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<PublicLoginRoute />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                {/* Counter cashiers: billing only */}
                <Route path="pos" element={<PosBilling />} />
                <Route path="counter" element={<CashierCounter />} />

                {/* Store manager only */}
                <Route index element={<AdminOnly><Dashboard /></AdminOnly>} />
                <Route path="products" element={<AdminOnly><Products /></AdminOnly>} />
                <Route path="categories" element={<AdminOnly><Categories /></AdminOnly>} />
                <Route path="inventory" element={<AdminOnly><Inventory /></AdminOnly>} />
                <Route path="purchases" element={<AdminOnly><Purchases /></AdminOnly>} />
                <Route path="suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />
                <Route path="sales" element={<AdminOnly><Sales /></AdminOnly>} />
                <Route path="customers" element={<AdminOnly><Customers /></AdminOnly>} />
                <Route path="expenses" element={<AdminOnly><Expenses /></AdminOnly>} />
                <Route path="reports" element={<ProtectedRoute adminOnly permission="canViewReports"><Reports /></ProtectedRoute>} />
                <Route path="stock-count" element={<AdminOnly><StockCount /></AdminOnly>} />
                <Route path="audit-log" element={<AdminOnly><AuditLog /></AdminOnly>} />
                <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
                <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </StoreProvider>
        </AuthProvider>
      </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
