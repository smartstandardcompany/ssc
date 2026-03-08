import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, ShoppingCart, Package, Users, BarChart3, Receipt, DollarSign, TrendingUp, Truck, FileText, Settings, CheckCircle, HelpCircle, ChefHat, UtensilsCrossed, Monitor, Gift, User, Shield, CalendarDays, CreditCard, FileBarChart } from 'lucide-react';

const MODULE_TOURS = {
  '/sales': {
    key: 'sales_tour',
    steps: [
      { title: 'Sales Management', description: 'Record all your business transactions here. Filter by date, branch, and payment mode to find specific sales.', icon: ShoppingCart, target: null },
      { title: 'Add New Sale', description: 'Click this button to record a new sale. You can add multiple payment methods (split payment) for a single transaction.', icon: DollarSign, target: '[data-testid="add-sale-btn"], [data-testid="new-sale-btn"], button:has-text("Add Sale"), button:has-text("New Sale")' },
      { title: 'Filter & Search', description: 'Use the date filter and branch selector to narrow down your sales records. You can also search by customer name.', icon: FileText, target: '[data-testid="date-filter"]' },
      { title: 'Export Data', description: 'Export your sales data as CSV or PDF for reporting and accounting purposes.', icon: Receipt, target: '[data-testid="export-btn"]' },
    ]
  },
  '/stock': {
    key: 'stock_tour',
    steps: [
      { title: 'Inventory Management', description: 'Track all your stock items, manage quantities, and set minimum stock levels to get alerts when items run low.', icon: Package, target: null },
      { title: 'Stock In/Out', description: 'Record stock entries (purchases) and usage to keep your inventory accurate. Each transaction is logged for audit.', icon: TrendingUp, target: '[data-testid="stock-in-btn"], button:has-text("Stock In")' },
      { title: 'Low Stock Alerts', description: 'Items below their minimum level are highlighted. Set minimum levels in item settings to enable this feature.', icon: Package, target: '[data-testid="low-stock-items"]' },
      { title: 'Branch Transfers', description: 'Transfer items between branches with a request-approve workflow. Navigate to Transfers page for multi-branch management.', icon: Truck, target: null },
    ]
  },
  '/employees': {
    key: 'employees_tour',
    steps: [
      { title: 'Employee Management', description: 'Manage your team\'s information, salary payments, leaves, and offboarding process from this page.', icon: Users, target: null },
      { title: 'Add Employee', description: 'Add new team members with their salary, department, and contact details. You can also link them to user accounts for portal access.', icon: Users, target: '[data-testid="add-employee-btn"], button:has-text("Add Employee")' },
      { title: 'Salary Payments', description: 'Record individual or bulk salary payments. Track payment history and generate payslips.', icon: DollarSign, target: '[data-testid="pay-salary-btn"]' },
      { title: 'Offboarding', description: 'For departing employees, use the Exit/Terminate buttons to initiate the offboarding process with clearance checklists and settlement calculations.', icon: FileText, target: null },
    ]
  },
  '/analytics': {
    key: 'analytics_tour',
    steps: [
      { title: 'Analytics & Reports', description: 'Get comprehensive insights into your business performance with charts, trends, and AI-powered predictions.', icon: BarChart3, target: null },
      { title: 'Date Range Selection', description: 'Adjust the time period to analyze specific weeks, months, or custom date ranges.', icon: FileText, target: '[data-testid="date-range-picker"]' },
      { title: 'AI Insights', description: 'The Predictive Analytics Hub uses AI to analyze your data and provide actionable recommendations for profit, revenue, and customer retention.', icon: TrendingUp, target: '[data-testid="ai-insights-tab"]' },
      { title: 'Export Reports', description: 'Download charts and reports as images or PDFs for presentations and meetings.', icon: Receipt, target: null },
    ]
  },
  '/settings': {
    key: 'settings_tour',
    steps: [
      { title: 'System Settings', description: 'Configure your SSC Track system including email, WhatsApp notifications, and general preferences.', icon: Settings, target: null },
      { title: 'Email Configuration', description: 'Set up SMTP email settings to enable automated reports, notifications, and scheduled emails.', icon: FileText, target: null },
      { title: 'WhatsApp Integration', description: 'Connect your Twilio WhatsApp to receive business reports and alerts directly on WhatsApp.', icon: FileText, target: null },
    ]
  },
  '/pos': {
    key: 'pos_tour',
    steps: [
      { title: 'Point of Sale', description: 'Quick-entry page for recording sales, expenses, supplier payments, and customer credits in one place.', icon: Monitor, target: null },
      { title: 'Entry Type', description: 'Switch between Sale, Expense, and Supplier Payment tabs to record different transaction types quickly.', icon: Receipt, target: null },
      { title: 'Online & Regular Sales', description: 'For online platform sales (HungerStation, Jahez, etc.), switch to Online mode and select the platform. Commission is calculated automatically.', icon: ShoppingCart, target: null },
      { title: 'Recent Entries', description: 'Your last entries appear at the bottom for quick reference. You can also view them in the full Sales or Expenses page.', icon: FileText, target: null },
    ]
  },
  '/kitchen': {
    key: 'kitchen_tour',
    steps: [
      { title: 'Kitchen Stock Usage', description: 'Track ingredient and item usage in the kitchen. Select a branch, pick items, and record how much was used.', icon: ChefHat, target: null },
      { title: 'Select Branch', description: 'Choose your branch to see available stock items and their current balance.', icon: Package, target: null },
      { title: 'Add Items to Cart', description: 'Use +/- buttons or type quantities directly to add items you\'ve used. The cart shows your selection before submitting.', icon: UtensilsCrossed, target: null },
      { title: 'Submit Usage', description: 'Once you\'ve selected all items, click Submit to record the usage. Stock levels update automatically.', icon: CheckCircle, target: null },
    ]
  },
  '/customer-portal/dashboard': {
    key: 'customer_portal_tour',
    steps: [
      { title: 'Customer Portal', description: 'Welcome to your customer dashboard! View your account overview, order history, and loyalty points all in one place.', icon: User, target: null },
      { title: 'Orders', description: 'Track your current and past orders. Click on any order to see detailed status and item breakdown.', icon: ShoppingCart, target: null },
      { title: 'Statements & Invoices', description: 'View your account statements and download invoices for your records.', icon: FileText, target: null },
      { title: 'Loyalty Points', description: 'Earn points on every purchase and redeem them for discounts. Check your tier status and rewards history.', icon: Gift, target: null },
    ]
  },
  '/suppliers': {
    key: 'suppliers_tour',
    steps: [
      { title: 'Supplier Management', description: 'Manage all your suppliers, track purchases, payments, and credit balances in one place.', icon: Truck, target: null },
      { title: 'View Ledger', description: 'Click on a supplier to see their full transaction ledger with branch-wise breakdown, debit/credit history, and running balance.', icon: FileText, target: null },
      { title: 'Make Payment', description: 'Record supplier payments via cash or bank. Track payment history and outstanding balances per branch.', icon: DollarSign, target: null },
      { title: 'Share Statement', description: 'Export or share supplier statements via Email, WhatsApp, or download as PDF/Excel.', icon: Receipt, target: null },
    ]
  },
  '/advanced-analytics': {
    key: 'advanced_analytics_tour',
    steps: [
      { title: 'Advanced Analytics', description: 'Your comprehensive business intelligence dashboard with KPIs, charts, and multi-dimensional analysis.', icon: BarChart3, target: null },
      { title: 'KPI Cards', description: 'Track key metrics at a glance: Revenue, Expenses, Net Profit, Customers, and Average Order Value.', icon: TrendingUp, target: null },
      { title: 'Analytics Tabs', description: 'Switch between Revenue, Cash Flow, Customers, Branches, and Expenses tabs for deep analysis.', icon: BarChart3, target: null },
      { title: 'Branch Comparison', description: 'The Branches tab shows a radar chart comparing branch performance across multiple metrics.', icon: Package, target: null },
    ]
  },
  '/data-management': {
    key: 'data_management_tour',
    steps: [
      { title: 'Data Management', description: 'Monitor your database health, archive old records, and manage data lifecycle.', icon: Package, target: null },
      { title: 'Smart Recommendations', description: 'AI-powered suggestions show which collections need attention based on growth rate and age analysis.', icon: TrendingUp, target: null },
      { title: 'Archive & Restore', description: 'Archive old records to keep your database lean. Restore or permanently purge archived data anytime.', icon: FileText, target: null },
      { title: 'Auto-Archive', description: 'Enable automated archiving on a weekly or monthly schedule. Configure per-collection thresholds.', icon: Settings, target: null },
    ]
  },
  '/daily-summary': {
    key: 'daily_summary_tour',
    steps: [
      { title: 'Daily & Range Summary', description: 'Get a quick overview of your business activity for any day or date range. View sales, expenses, and supplier payments with cash/bank breakdowns.', icon: CalendarDays, target: null },
      { title: 'Single Day / Date Range', description: 'Toggle between Single Day and Date Range modes. In Date Range mode, pick start and end dates or use quick presets (7d, 30d, 90d).', icon: CalendarDays, target: '[data-testid="mode-range"]' },
      { title: 'Summary vs Day by Day', description: 'In Date Range mode, switch between Summary (totals + cash/bank breakdown) and Day by Day (table with each date listed).', icon: BarChart3, target: '[data-testid="view-daily"]' },
      { title: 'Branch Filter', description: 'Filter the summary by a specific branch to see that branch\'s performance in isolation.', icon: Package, target: '[data-testid="branch-select"]' },
    ]
  },
  '/expenses': {
    key: 'expenses_tour',
    steps: [
      { title: 'Expense Management', description: 'Track all business expenses organized by category. Filter by date, branch, category, and payment mode.', icon: Receipt, target: null },
      { title: 'Add Expense', description: 'Record a new expense with category, amount, payment mode, and optional receipt attachment.', icon: DollarSign, target: '[data-testid="add-expense-btn"], button:has-text("Add Expense")' },
      { title: 'Categories', description: 'Expenses are grouped by category (Salary, Rent, Supplies, etc.) for easy tracking and reporting.', icon: FileText, target: null },
      { title: 'Export & Reports', description: 'Export expense data to CSV/PDF or view detailed expense reports in the Reports section.', icon: Receipt, target: '[data-testid="export-btn"]' },
    ]
  },
  '/customers': {
    key: 'customers_tour',
    steps: [
      { title: 'Customer Management', description: 'Manage your customer database, track credit balances, and view purchase history.', icon: Users, target: null },
      { title: 'Add Customer', description: 'Register new customers with contact details, branch, and credit limit. Customers can also be created during sales.', icon: Users, target: '[data-testid="add-customer-btn"], button:has-text("Add Customer")' },
      { title: 'Credit Tracking', description: 'Each customer has a credit balance. When they pay on credit, the balance increases; when they settle, it decreases.', icon: CreditCard, target: null },
      { title: 'Customer Ledger', description: 'Click a customer to view their full transaction history, statements, and credit/debit breakdown.', icon: FileText, target: null },
    ]
  },
  '/invoices': {
    key: 'invoices_tour',
    steps: [
      { title: 'Invoice Management', description: 'Create professional invoices with VAT calculation, QR codes, and ZATCA Phase 2 compliance.', icon: FileText, target: null },
      { title: 'Create Invoice', description: 'Generate invoices from sales or create standalone invoices. VAT is calculated automatically at 15%.', icon: DollarSign, target: '[data-testid="create-invoice-btn"], button:has-text("Create Invoice")' },
      { title: 'Status Tracking', description: 'Track invoice status: Draft, Sent, Paid, or Overdue. Filter by status to see which need attention.', icon: CheckCircle, target: null },
      { title: 'Download & Share', description: 'Download invoices as PDF with QR code for ZATCA compliance, or share directly via WhatsApp/Email.', icon: Receipt, target: null },
    ]
  },
  '/report-builder': {
    key: 'report_builder_tour',
    steps: [
      { title: 'Custom Report Builder', description: 'Create, save, and run custom report templates. Choose from 8 data sources and configure exactly what you need.', icon: FileBarChart, target: null },
      { title: 'Create Template', description: 'Click "New Template" to define your report: select data source, pick columns, set sorting, grouping, and filters.', icon: FileBarChart, target: '[data-testid="create-template-btn"]' },
      { title: 'Run Reports', description: 'Click "Run" on any template to generate the report instantly. Results show summary statistics and a data table.', icon: CheckCircle, target: null },
      { title: 'Export to CSV', description: 'After running a report, export the results as CSV for further analysis in Excel or Google Sheets.', icon: Receipt, target: null },
    ]
  },
  '/audit-trail': {
    key: 'audit_trail_tour',
    steps: [
      { title: 'Deletion Audit Trail', description: 'Monitor all record deletion attempts across your organization. See who deleted what, when, and whether it was allowed.', icon: Shield, target: null },
      { title: 'Filter & Search', description: 'Filter audit logs by module (Sales, Expenses, etc.) and status (Allowed/Denied). Use the search bar for quick lookups.', icon: FileText, target: '[data-testid="audit-search"]' },
      { title: 'Status Tracking', description: 'Each entry shows whether the deletion was Allowed or Denied based on your Access Control policies.', icon: Shield, target: null },
      { title: 'Configure Policies', description: 'To change who can delete records and time limits, go to Settings > Access Control tab.', icon: Settings, target: null },
    ]
  },
};

export default function ModuleTour() {
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tourConfig, setTourConfig] = useState(null);

  useEffect(() => {
    const path = location.pathname;
    const config = MODULE_TOURS[path];
    if (!config) {
      setIsVisible(false);
      setTourConfig(null);
      return;
    }

    // Tours are opt-in: only show if user explicitly reset tours from Settings
    // Check if this specific tour was enabled (not just "not completed")
    const enabled = localStorage.getItem(`ssc_${config.key}_enabled`);
    const completed = localStorage.getItem(`ssc_${config.key}_completed`);
    if (enabled === 'true' && completed !== 'true') {
      setTourConfig(config);
      setCurrentStep(0);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      setTourConfig(null);
    }
  }, [location.pathname]);

  if (!isVisible || !tourConfig) return null;

  const step = tourConfig.steps[currentStep];
  const Icon = step.icon;
  const total = tourConfig.steps.length;

  const handleNext = () => {
    if (currentStep < total - 1) setCurrentStep(currentStep + 1);
    else handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(`ssc_${tourConfig.key}_completed`, 'true');
    setIsVisible(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9999]" onClick={handleComplete} data-testid="module-tour-overlay" />
      <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] shadow-2xl border-orange-200 bg-white dark:bg-stone-900 z-[10000]" data-testid="module-tour-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow">
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-white">{step.title}</h3>
                <p className="text-[11px] text-muted-foreground">Step {currentStep + 1} of {total}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleComplete} data-testid="module-tour-close">
              <X size={16} />
            </Button>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 mb-4 leading-relaxed">{step.description}</p>
          <div className="w-full h-1 bg-stone-200 dark:bg-stone-700 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / total) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleComplete} className="text-muted-foreground text-xs" data-testid="module-tour-skip">Skip</Button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(currentStep - 1)} className="gap-1 h-8" data-testid="module-tour-prev">
                  <ChevronLeft size={14} /> Back
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="gap-1 h-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white" data-testid="module-tour-next">
                {currentStep === total - 1 ? 'Got it!' : 'Next'} {currentStep < total - 1 && <ChevronRight size={14} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function ResetModuleTourButton() {
  const handleReset = () => {
    Object.keys(MODULE_TOURS).forEach(path => {
      const config = MODULE_TOURS[path];
      localStorage.removeItem(`ssc_${config.key}_completed`);
      localStorage.setItem(`ssc_${config.key}_enabled`, 'true');
    });
    window.location.reload();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 text-xs" data-testid="reset-tours-btn">
      <HelpCircle size={14} /> Restart All Tours
    </Button>
  );
}
