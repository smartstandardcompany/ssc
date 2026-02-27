import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
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
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') setShowInstall(false);
      setInstallPrompt(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <LanguageProvider>
    <div className="App">
      {showInstall && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 flex items-center justify-center gap-4 shadow-lg" data-testid="install-banner">
          <span className="text-sm font-medium">Install SSC Track as an app for quick access!</span>
          <button onClick={handleInstall} className="bg-white text-primary px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100">Install App</button>
          <button onClick={() => setShowInstall(false)} className="text-white/80 hover:text-white text-sm">Later</button>
        </div>
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <LoginPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/" element={isAuthenticated ? (() => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.role === 'employee' ? <Navigate to="/my-portal" /> : <DashboardPage />;
          })() : <Navigate to="/login" />} />
          <Route path="/sales" element={isAuthenticated ? <SalesPage /> : <Navigate to="/login" />} />
          <Route path="/branches" element={isAuthenticated ? <BranchesPage /> : <Navigate to="/login" />} />
          <Route path="/customers" element={isAuthenticated ? <CustomersPage /> : <Navigate to="/login" />} />
          <Route path="/suppliers" element={isAuthenticated ? <SuppliersPage /> : <Navigate to="/login" />} />
          <Route path="/supplier-payments" element={isAuthenticated ? <SupplierPaymentsPage /> : <Navigate to="/login" />} />
          <Route path="/expenses" element={isAuthenticated ? <ExpensesPage /> : <Navigate to="/login" />} />
          <Route path="/reports" element={isAuthenticated ? <ReportsPage /> : <Navigate to="/login" />} />
          <Route path="/analytics" element={isAuthenticated ? <AnalyticsPage /> : <Navigate to="/login" />} />
          <Route path="/credit-report" element={isAuthenticated ? <CreditReportPage /> : <Navigate to="/login" />} />
          <Route path="/supplier-report" element={isAuthenticated ? <SupplierReportPage /> : <Navigate to="/login" />} />
          <Route path="/category-report" element={isAuthenticated ? <CategoryReportPage /> : <Navigate to="/login" />} />
          <Route path="/employees" element={isAuthenticated ? <EmployeesPage /> : <Navigate to="/login" />} />
          <Route path="/documents" element={isAuthenticated ? <DocumentsPage /> : <Navigate to="/login" />} />
          <Route path="/my-portal" element={isAuthenticated ? <EmployeePortalPage /> : <Navigate to="/login" />} />
          <Route path="/leave-approvals" element={isAuthenticated ? <LeaveApprovalsPage /> : <Navigate to="/login" />} />
          <Route path="/notifications" element={isAuthenticated ? <NotificationsPage /> : <Navigate to="/login" />} />
          <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />} />
          <Route path="/help" element={isAuthenticated ? <HelpPage /> : <Navigate to="/login" />} />
          <Route path="/cash-transfers" element={isAuthenticated ? <CashTransfersPage /> : <Navigate to="/login" />} />
          <Route path="/fines" element={isAuthenticated ? <FinesPage /> : <Navigate to="/login" />} />
          <Route path="/partners" element={isAuthenticated ? <PartnersPage /> : <Navigate to="/login" />} />
          <Route path="/company-loans" element={isAuthenticated ? <CompanyLoansPage /> : <Navigate to="/login" />} />
          <Route path="/bank-statements" element={isAuthenticated ? <BankStatementsPage /> : <Navigate to="/login" />} />
          <Route path="/invoices" element={isAuthenticated ? <InvoicesPage /> : <Navigate to="/login" />} />
          <Route path="/stock" element={isAuthenticated ? <StockPage /> : <Navigate to="/login" />} />
          <Route path="/kitchen" element={isAuthenticated ? <KitchenPage /> : <Navigate to="/login" />} />
          <Route path="/schedule" element={isAuthenticated ? <SchedulePage /> : <Navigate to="/login" />} />
          <Route path="/users" element={isAuthenticated ? <UsersPage /> : <Navigate to="/login" />} />
          <Route path="/reconciliation" element={isAuthenticated ? <ReconciliationPage /> : <Navigate to="/login" />} />
          <Route path="/pos" element={isAuthenticated ? <POSPage /> : <Navigate to="/login" />} />
          <Route path="/pos-analytics" element={isAuthenticated ? <POSAnalyticsPage /> : <Navigate to="/login" />} />
          <Route path="/transfers" element={isAuthenticated ? <TransfersPage /> : <Navigate to="/login" />} />
          <Route path="/visualizations" element={isAuthenticated ? <VisualizationsPage /> : <Navigate to="/login" />} />
          <Route path="/cashier" element={<CashierLoginPage />} />
          <Route path="/cashier/pos" element={<CashierPOSPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
    </LanguageProvider>
  );
}

export default App;
