import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HelpCircle, ChevronLeft, ChevronRight, X, Lightbulb, Keyboard, BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// Tour steps for each page
const PAGE_TOURS = {
  '/': {
    title: 'Dashboard Overview',
    steps: [
      { title: 'Welcome to Dashboard', description: 'This is your command center. View sales, expenses, profit, and important alerts at a glance.', icon: '📊' },
      { title: 'Quick Stats Cards', description: 'Top cards show today\'s key metrics: Total Sales, Total Expenses, Net Profit, and Cash in Hand.', icon: '💰' },
      { title: 'Quick Actions', description: 'Use the Quick Actions panel to jump directly to common tasks like adding sales, expenses, or viewing reports.', icon: '⚡' },
      { title: 'Alerts Section', description: 'Keep an eye on upcoming document expirations, low stock items, and pending salaries.', icon: '🔔' },
      { title: 'Customize Widgets', description: 'Click the gear icon to show/hide widgets and personalize your dashboard.', icon: '⚙️' },
    ]
  },
  '/pos': {
    title: 'Quick Entry (POS)',
    steps: [
      { title: 'Easy Data Entry', description: 'This is your quick entry page for sales, expenses, supplier payments, and bills.', icon: '📝' },
      { title: 'Sale Entry', description: 'Enter branch, date, and amounts for cash/bank/credit sales. Click Submit to record.', icon: '💵' },
      { title: 'Online Sales', description: 'Switch to Online Platform tab to record sales from delivery apps. Select platform and enter amount.', icon: '🌐' },
      { title: 'Multi Expenses', description: 'In Expense tab, add multiple expense lines at once with category and supplier.', icon: '📋' },
      { title: 'Supplier Payments & Bills', description: 'Use Supplier Payment tab to pay suppliers, or Add Bill tab to record new purchases on credit.', icon: '🏦' },
    ]
  },
  '/sales': {
    title: 'Sales Management',
    steps: [
      { title: 'View All Sales', description: 'See all sales transactions with filters by date, branch, and payment mode.', icon: '📈' },
      { title: 'Add New Sale', description: 'Click + Add Sale to record a new transaction with customer and payment details.', icon: '➕' },
      { title: 'Credit Sales', description: 'Track credit sales and receive payments. Click "Receive" to record partial or full payments.', icon: '💳' },
      { title: 'Export Data', description: 'Use export buttons to download sales data as Excel or PDF for reporting.', icon: '📤' },
    ]
  },
  '/expenses': {
    title: 'Expense Management',
    steps: [
      { title: 'Track Expenses', description: 'Monitor all business expenses organized by category and supplier.', icon: '📊' },
      { title: 'Recurring Expenses', description: 'Set up recurring expenses (rent, utilities) with auto-reminders when due.', icon: '🔄' },
      { title: 'Category Management', description: 'Manage expense categories to better organize and analyze spending.', icon: '🏷️' },
    ]
  },
  '/stock': {
    title: 'Inventory Management',
    steps: [
      { title: 'Stock Overview', description: 'View current stock levels across all branches with balance and value.', icon: '📦' },
      { title: 'Stock In/Out', description: 'Record inventory movements - purchases (in) and usage/sales (out).', icon: '↕️' },
      { title: 'Low Stock Alerts', description: 'Get AI-powered alerts when items fall below minimum levels.', icon: '⚠️' },
      { title: 'Barcode Support', description: 'Scan barcodes to quickly find items or add stock entries.', icon: '📱' },
    ]
  },
  '/suppliers': {
    title: 'Supplier Management',
    steps: [
      { title: 'Supplier Directory', description: 'Manage all your suppliers with contact info, categories, and bank details.', icon: '🏢' },
      { title: 'Credit Tracking', description: 'Track credit balances with each supplier. View ledger for transaction history.', icon: '📒' },
      { title: 'Make Payments', description: 'Click Pay to record supplier payments. Choose cash, bank, or online.', icon: '💸' },
      { title: 'Statement Export', description: 'Generate and share supplier statements via email or WhatsApp.', icon: '📧' },
    ]
  },
  '/customers': {
    title: 'Customer Management',
    steps: [
      { title: 'Customer Database', description: 'Maintain customer records with contact details and credit limits.', icon: '👥' },
      { title: 'Credit Management', description: 'Track outstanding customer credits and receive payments.', icon: '💳' },
      { title: 'Customer Reports', description: 'View individual customer transaction history and statements.', icon: '📋' },
    ]
  },
  '/employees': {
    title: 'Employee Management',
    steps: [
      { title: 'Employee Records', description: 'Manage employee information, positions, and salaries.', icon: '👨‍💼' },
      { title: 'Salary Payments', description: 'Record monthly salary payments with deductions and advances.', icon: '💰' },
      { title: 'Leave Management', description: 'Track annual and sick leave balances and approvals.', icon: '🏖️' },
      { title: 'Document Tracking', description: 'Monitor document expirations like visas and contracts.', icon: '📄' },
    ]
  },
  '/reports': {
    title: 'Reports & Analytics',
    steps: [
      { title: 'Comprehensive Reports', description: 'Access detailed reports for sales, expenses, profit & loss, and more.', icon: '📊' },
      { title: 'Date Filtering', description: 'Filter reports by date range for specific periods.', icon: '📅' },
      { title: 'Export Options', description: 'Download reports as PDF or Excel for sharing and records.', icon: '⬇️' },
    ]
  },
  '/order-tracking': {
    title: 'Order Tracking',
    steps: [
      { title: 'Track Orders', description: 'Monitor order status from placed to delivered.', icon: '📦' },
      { title: 'Update Status', description: 'Click an order to update its status and notify the customer.', icon: '✏️' },
      { title: 'Notifications', description: 'Configure email/WhatsApp notifications for status changes.', icon: '🔔' },
    ]
  },
};

// Keyboard shortcuts reference
const KEYBOARD_SHORTCUTS = [
  { key: 'D', action: 'Go to Dashboard' },
  { key: 'P / N', action: 'Go to POS/Quick Entry' },
  { key: 'S', action: 'Go to Sales' },
  { key: 'E', action: 'Go to Expenses' },
  { key: 'I', action: 'Go to Stock/Inventory' },
  { key: 'R', action: 'Go to Reports' },
  { key: 'C', action: 'Go to Cashier' },
  { key: 'K', action: 'Go to Kitchen (KDS)' },
  { key: 'W', action: 'Go to Waiter' },
  { key: 'T', action: 'Go to Table Management' },
  { key: '?', action: 'Toggle Shortcuts Help' },
];

export function QuickHelpButton() {
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState('tour');
  const [currentStep, setCurrentStep] = useState(0);
  const location = useLocation();
  
  const pageTour = PAGE_TOURS[location.pathname] || PAGE_TOURS['/'];
  const steps = pageTour.steps || [];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetTour = () => {
    setCurrentStep(0);
    setActiveTab('tour');
  };

  useEffect(() => {
    resetTour();
  }, [location.pathname]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHelp(true)}
        className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg sm:bottom-4"
        data-testid="quick-help-btn"
      >
        <HelpCircle size={24} />
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden" data-testid="quick-help-dialog">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="text-amber-500" size={20} />
              Quick Help
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-2 border-b pb-2">
            <button
              onClick={() => setActiveTab('tour')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tour' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <BookOpen size={14} className="inline mr-1" />
              Page Tour
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'shortcuts' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <Keyboard size={14} className="inline mr-1" />
              Shortcuts
            </button>
          </div>

          {/* Tour Content */}
          {activeTab === 'tour' && (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-xs text-muted-foreground bg-stone-100 px-2 py-1 rounded">
                  {pageTour.title}
                </span>
              </div>

              {steps.length > 0 && (
                <>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 min-h-[180px]">
                    <div className="text-center mb-4">
                      <span className="text-4xl">{steps[currentStep]?.icon}</span>
                    </div>
                    <h3 className="font-bold text-lg text-center text-stone-800 mb-2">
                      {steps[currentStep]?.title}
                    </h3>
                    <p className="text-sm text-stone-600 text-center">
                      {steps[currentStep]?.description}
                    </p>
                  </div>

                  {/* Progress dots */}
                  <div className="flex justify-center gap-1.5">
                    {steps.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentStep(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentStep ? 'bg-emerald-500' : 'bg-stone-300'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                    >
                      <ChevronLeft size={14} /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">
                      {currentStep + 1} / {steps.length}
                    </span>
                    <Button
                      size="sm"
                      onClick={currentStep === steps.length - 1 ? () => setShowHelp(false) : nextStep}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      {currentStep === steps.length - 1 ? 'Done' : 'Next'} <ChevronRight size={14} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Shortcuts Content */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Press these keys anywhere in the app for quick navigation:
              </p>
              <div className="grid gap-2">
                {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-2 bg-stone-50 rounded-lg"
                  >
                    <span className="text-sm text-stone-600">{shortcut.action}</span>
                    <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono shadow-sm">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QuickHelpButton;
