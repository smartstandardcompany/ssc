import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, ShoppingCart, Package, Users, BarChart3, Receipt, DollarSign, TrendingUp, Truck, FileText, Settings, CheckCircle, HelpCircle } from 'lucide-react';

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
};

export default function ModuleTour() {
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tourConfig, setTourConfig] = useState(null);

  useEffect(() => {
    const path = location.pathname;
    const config = MODULE_TOURS[path];
    if (config) {
      const completed = localStorage.getItem(`ssc_${config.key}_completed`);
      if (completed !== 'true') {
        setTourConfig(config);
        setCurrentStep(0);
        setIsVisible(true);
      } else {
        setIsVisible(false);
        setTourConfig(null);
      }
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
    });
    localStorage.removeItem('ssc_dashboard_tour_completed');
    localStorage.removeItem('ssc_dashboard_tour_date');
    window.location.reload();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 text-xs" data-testid="reset-tours-btn">
      <HelpCircle size={14} /> Restart All Tours
    </Button>
  );
}
