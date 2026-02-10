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
import UsersPage from "./pages/UsersPage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <LoginPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />} />
          <Route path="/" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />} />
          <Route path="/sales" element={isAuthenticated ? <SalesPage /> : <Navigate to="/login" />} />
          <Route path="/branches" element={isAuthenticated ? <BranchesPage /> : <Navigate to="/login" />} />
          <Route path="/customers" element={isAuthenticated ? <CustomersPage /> : <Navigate to="/login" />} />
          <Route path="/suppliers" element={isAuthenticated ? <SuppliersPage /> : <Navigate to="/login" />} />
          <Route path="/supplier-payments" element={isAuthenticated ? <SupplierPaymentsPage /> : <Navigate to="/login" />} />
          <Route path="/expenses" element={isAuthenticated ? <ExpensesPage /> : <Navigate to="/login" />} />
          <Route path="/reports" element={isAuthenticated ? <ReportsPage /> : <Navigate to="/login" />} />
          <Route path="/credit-report" element={isAuthenticated ? <CreditReportPage /> : <Navigate to="/login" />} />
          <Route path="/supplier-report" element={isAuthenticated ? <SupplierReportPage /> : <Navigate to="/login" />} />
          <Route path="/category-report" element={isAuthenticated ? <CategoryReportPage /> : <Navigate to="/login" />} />
          <Route path="/employees" element={isAuthenticated ? <EmployeesPage /> : <Navigate to="/login" />} />
          <Route path="/documents" element={isAuthenticated ? <DocumentsPage /> : <Navigate to="/login" />} />
          <Route path="/my-portal" element={isAuthenticated ? <EmployeePortalPage /> : <Navigate to="/login" />} />
          <Route path="/leave-approvals" element={isAuthenticated ? <LeaveApprovalsPage /> : <Navigate to="/login" />} />
          <Route path="/notifications" element={isAuthenticated ? <NotificationsPage /> : <Navigate to="/login" />} />
          <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />} />
          <Route path="/users" element={isAuthenticated ? <UsersPage /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
