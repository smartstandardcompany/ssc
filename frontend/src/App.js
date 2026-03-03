import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import DashboardPage from "./pages/DashboardPage";
import SalesPage from "./pages/SalesPage";
import BranchesPage from "./pages/BranchesPage";
import CustomersPage from "./pages/CustomersPage";
import SuppliersPage from "./pages/SuppliersPage";
import SupplierPaymentsPage from "./pages/SupplierPaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReportsPage from "./pages/ReportsPage";
import CreditReportPage from "./pages/CreditReportPage";
import SupplierReportPage from "./pages/SupplierReportPage";
import CategoryReportPage from "./pages/CategoryReportPage";
import EmployeesPage from "./pages/EmployeesPage";
import DocumentsPage from "./pages/DocumentsPage";
import EmployeePortalPage from "./pages/EmployeePortalPage";
import LeaveApprovalsPage from "./pages/LeaveApprovalsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import CashTransfersPage from "./pages/CashTransfersPage";
import FinesPage from "./pages/FinesPage";
import PartnersPage from "./pages/PartnersPage";
import CompanyLoansPage from "./pages/CompanyLoansPage";
import BankStatementsPage from "./pages/BankStatementsPage";
import InvoicesPage from "./pages/InvoicesPage";
import UsersPage from "./pages/UsersPage";
import StockPage from "./pages/StockPage";
import KitchenPage from "./pages/KitchenPage";
import SchedulePage from "./pages/SchedulePage";
import ReconciliationPage from "./pages/ReconciliationPage";
import POSPage from "./pages/POSPage";
import POSAnalyticsPage from "./pages/POSAnalyticsPage";
import TransfersPage from "./pages/TransfersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import VisualizationsPage from "./pages/VisualizationsPage";
import CashierPOSPage from "./pages/CashierPOSPage";
import CashierLoginPage from "./pages/CashierLoginPage";
import KitchenDisplayPage from "./pages/KitchenDisplayPage";
import OrderStatusPage from "./pages/OrderStatusPage";
import MenuItemsPage from "./pages/MenuItemsPage";
import ShiftReportPage from "./pages/ShiftReportPage";
import CCTVPage from "./pages/CCTVPage";
import PartnerPLReportPage from "./pages/PartnerPLReportPage";
import TableManagementPage from "./pages/TableManagementPage";
import WaiterPage from "./pages/WaiterPage";
import LoanManagementPage from "./pages/LoanManagementPage";
import TaskRemindersPage from "./pages/TaskRemindersPage";
import TaskCompliancePage from "./pages/TaskCompliancePage";
import PerformanceReportPage from "./pages/PerformanceReportPage";
import AnomalyDetectionPage from "./pages/AnomalyDetectionPage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";
import PlatformsPage from "./pages/PlatformsPage";
import AssetsPage from "./pages/AssetsPage";
import ReservationsPage from "./pages/ReservationsPage";
import LoyaltyProgramPage from "./pages/LoyaltyProgramPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import DailySummaryPage from "./pages/DailySummaryPage";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ShortcutHelpDialog } from "@/components/ShortcutHelpDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ShieldAlert } from "lucide-react";

// Normalize permissions - support both old list format and new dict format
function normalizePermissions(perms) {
  if (Array.isArray(perms)) {
    const dict = {};
    perms.forEach(p => { dict[p] = 'write'; });
    return dict;
  }
  if (typeof perms === 'object' && perms !== null) return perms;
  return {};
}

// Check if user has access to a route based on perm and roles
function userHasAccess(user, perm, roles) {
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  if (roles && !roles.includes(user.role)) return false;
  if (perm) {
    const perms = normalizePermissions(user.permissions || []);
    const level = perms[perm];
    if (level !== 'read' && level !== 'write') return false;
  }
  return true;
}

// Access Denied page shown when user navigates to a restricted page
function AccessDeniedPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="access-denied-page">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-200 mb-2">Access Denied</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6 max-w-md">
          You don't have permission to access this page. Contact your administrator to request access.
        </p>
        <a href="/" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium" data-testid="go-to-dashboard-btn">
          Go to Dashboard
        </a>
      </div>
    </DashboardLayout>
  );
}

// ProtectedRoute: checks auth + role + permission
function ProtectedRoute({ children, perm, roles }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!userHasAccess(user, perm, roles)) {
    return <AccessDeniedPage />;
  }
  return children;
}

// AuthRoute: checks authentication only (no permission check)
function AuthRoute({ children }) {
  const isAuth = !!localStorage.getItem('token');
  return isAuth ? children : <Navigate to="/login" />;
}

function KeyboardShortcutProvider({ children }) {
  const { useKeyboardShortcuts } = require('@/hooks/useKeyboardShortcuts');
  useKeyboardShortcuts();
  return children;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <LanguageProvider>
    <div className="App">
      <BrowserRouter>
        <KeyboardShortcutProvider>
        <ShortcutHelpDialog />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={!isAuthenticated ? <LoginPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/cashier" element={<CashierLoginPage />} />
          <Route path="/cashier/pos" element={<CashierPOSPage />} />
          <Route path="/waiter" element={<WaiterPage />} />
          <Route path="/kds" element={<KitchenDisplayPage />} />
          <Route path="/order-status" element={<OrderStatusPage />} />

          {/* Auth-only routes (no permission check) */}
          <Route path="/change-password" element={<AuthRoute><ChangePasswordPage /></AuthRoute>} />
          <Route path="/my-portal" element={<AuthRoute><EmployeePortalPage /></AuthRoute>} />
          <Route path="/notifications" element={<AuthRoute><NotificationsPage /></AuthRoute>} />
          <Route path="/notification-preferences" element={<AuthRoute><NotificationPreferencesPage /></AuthRoute>} />
          <Route path="/help" element={<AuthRoute><HelpPage /></AuthRoute>} />

          {/* Dashboard / Home */}
          <Route path="/" element={isAuthenticated ? (() => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.must_change_password) return <Navigate to="/change-password?forced=true" />;
            return user.role === 'employee' ? <Navigate to="/my-portal" /> : <DashboardPage />;
          })() : <Navigate to="/login" />} />

          {/* Operations */}
          <Route path="/pos" element={<AuthRoute><ProtectedRoute perm="sales"><POSPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/pos-analytics" element={<AuthRoute><ProtectedRoute perm="dashboard" roles={['admin', 'manager']}><POSAnalyticsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/daily-summary" element={<AuthRoute><DailySummaryPage /></AuthRoute>} />

          {/* Finance */}
          <Route path="/sales" element={<AuthRoute><ProtectedRoute perm="sales"><SalesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/platforms" element={<AuthRoute><ProtectedRoute perm="sales"><PlatformsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/invoices" element={<AuthRoute><ProtectedRoute perm="invoices"><InvoicesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/expenses" element={<AuthRoute><ProtectedRoute perm="expenses"><ExpensesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/supplier-payments" element={<AuthRoute><ProtectedRoute perm="supplier_payments" roles={['admin', 'manager']}><SupplierPaymentsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/cash-transfers" element={<AuthRoute><ProtectedRoute perm="cash_transfers" roles={['admin', 'manager']}><CashTransfersPage /></ProtectedRoute></AuthRoute>} />

          {/* People */}
          <Route path="/customers" element={<AuthRoute><ProtectedRoute perm="customers"><CustomersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/loyalty" element={<AuthRoute><ProtectedRoute perm="customers"><LoyaltyProgramPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/suppliers" element={<AuthRoute><ProtectedRoute perm="suppliers" roles={['admin', 'manager']}><SuppliersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/employees" element={<AuthRoute><ProtectedRoute perm="employees" roles={['admin', 'manager']}><EmployeesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/loans" element={<AuthRoute><ProtectedRoute perm="employees" roles={['admin', 'manager']}><LoanManagementPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/leave-approvals" element={<AuthRoute><ProtectedRoute perm="employees" roles={['admin', 'manager']}><LeaveApprovalsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/schedule" element={<AuthRoute><ProtectedRoute perm="shifts" roles={['admin', 'manager']}><SchedulePage /></ProtectedRoute></AuthRoute>} />

          {/* Stock */}
          <Route path="/stock" element={<AuthRoute><ProtectedRoute perm="stock" roles={['admin', 'manager']}><StockPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/transfers" element={<AuthRoute><ProtectedRoute perm="stock" roles={['admin', 'manager']}><TransfersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/menu-items" element={<AuthRoute><ProtectedRoute perm="stock" roles={['admin', 'manager']}><MenuItemsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/table-management" element={<AuthRoute><ProtectedRoute perm="stock" roles={['admin', 'manager']}><TableManagementPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/reservations" element={<AuthRoute><ProtectedRoute perm="stock" roles={['admin', 'manager']}><ReservationsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/kitchen" element={<AuthRoute><ProtectedRoute perm="kitchen"><KitchenPage /></ProtectedRoute></AuthRoute>} />

          {/* Reports */}
          <Route path="/analytics" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><AnalyticsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/visualizations" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><VisualizationsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/shift-report" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><ShiftReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/partner-pl-report" element={<AuthRoute><ProtectedRoute perm="partners" roles={['admin']}><PartnerPLReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/reports" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><ReportsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/credit-report" element={<AuthRoute><ProtectedRoute perm="credit_report" roles={['admin', 'manager']}><CreditReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/supplier-report" element={<AuthRoute><ProtectedRoute perm="supplier_report" roles={['admin', 'manager']}><SupplierReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/category-report" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><CategoryReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/bank-statements" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin']}><BankStatementsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/reconciliation" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin']}><ReconciliationPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/performance-report" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><PerformanceReportPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/anomaly-detection" element={<AuthRoute><ProtectedRoute perm="reports" roles={['admin', 'manager']}><AnomalyDetectionPage /></ProtectedRoute></AuthRoute>} />

          {/* Assets */}
          <Route path="/assets" element={<AuthRoute><ProtectedRoute perm="branches" roles={['admin', 'manager']}><AssetsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/branches" element={<AuthRoute><ProtectedRoute perm="branches" roles={['admin', 'manager']}><BranchesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/cctv" element={<AuthRoute><ProtectedRoute perm="branches" roles={['admin', 'manager']}><CCTVPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/documents" element={<AuthRoute><ProtectedRoute perm="documents" roles={['admin', 'manager']}><DocumentsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/fines" element={<AuthRoute><ProtectedRoute perm="fines" roles={['admin', 'manager']}><FinesPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/partners" element={<AuthRoute><ProtectedRoute perm="partners" roles={['admin']}><PartnersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/company-loans" element={<AuthRoute><ProtectedRoute perm="partners" roles={['admin']}><CompanyLoansPage /></ProtectedRoute></AuthRoute>} />

          {/* Admin */}
          <Route path="/users" element={<AuthRoute><ProtectedRoute perm="users" roles={['admin']}><UsersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/settings" element={<AuthRoute><ProtectedRoute perm="settings" roles={['admin']}><SettingsPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/task-reminders" element={<AuthRoute><ProtectedRoute perm="settings" roles={['admin']}><TaskRemindersPage /></ProtectedRoute></AuthRoute>} />
          <Route path="/task-compliance" element={<AuthRoute><ProtectedRoute perm="settings" roles={['admin']}><TaskCompliancePage /></ProtectedRoute></AuthRoute>} />
          <Route path="/activity-logs" element={<AuthRoute><ProtectedRoute perm="settings" roles={['admin']}><ActivityLogsPage /></ProtectedRoute></AuthRoute>} />
        </Routes>
        </KeyboardShortcutProvider>
      </BrowserRouter>
      <PWAInstallPrompt />
      <Toaster position="top-right" richColors />
    </div>
    </LanguageProvider>
  );
}

export default App;
