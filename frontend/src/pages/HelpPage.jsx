import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, ShoppingCart, FileInput, Store, Users, Truck, Receipt, ArrowLeftRight, AlertTriangle, Handshake, UserCheck, FileWarning, BarChart3, CreditCard, FileText, Settings, HelpCircle } from 'lucide-react';

const sections = [
  { icon: LayoutDashboard, title: 'Dashboard', color: 'text-primary', items: [
    'View total sales, expenses, supplier payments, net profit',
    'Cash & Bank in hand after all expenses',
    'Filter by branch (click branch chips) and date period',
    'VAT 15% toggle: check "Show VAT 15% Calculation"',
    'Due fines, due salaries, supplier dues displayed',
    'Branch-to-branch dues with payback tracking',
    'Upcoming recurring expenses alerts',
    'Document expiry alerts',
  ]},
  { icon: ShoppingCart, title: 'Sales', color: 'text-success', items: [
    'Click "+ Add Sale" → choose Branch Sale or Online Sale',
    'Add payment details: Cash, Bank, or Credit with amounts',
    'Discount auto-calculates final amount',
    'Filter by branch chips and date period',
    'Export to PDF or Excel',
  ]},
  { icon: FileInput, title: 'Invoices', color: 'text-primary', items: [
    'Click "+ New Invoice" to create invoice',
    'Click colored item chips to add products (admin adds them via "New Product")',
    'Or click "Add Row" for custom items',
    'Search customers by typing in search box',
    'Select payment mode: Cash/Bank/Credit',
    'Invoice auto-creates a sale entry',
    'Credit invoices show "Receive" button to collect payment',
  ]},
  { icon: Store, title: 'Branches', color: 'text-info', items: [
    'Each branch card shows: Sales, Expenses, Supplier Payments, Net Profit',
    'Cash In Hand and Bank In Hand per branch',
    'Click eye icon for detailed breakdown (cash/bank split)',
    'Set recurring expenses (rent etc.) in Expenses page → Recurring section',
  ]},
  { icon: Users, title: 'Customers', color: 'text-warning', items: [
    'Add customers with branch assignment',
    'Table shows: Total Sales, Cash, Bank, Credit Balance per customer',
    '"Receive" button for customers with credit balance (supports discount)',
    '"Report" button → view purchase history with invoice items',
    'PDF icon → download customer statement for sharing',
  ]},
  { icon: Truck, title: 'Suppliers', color: 'text-error', items: [
    'Add suppliers with category, sub-category, branch, credit limit',
    'Each card shows Cash Paid / Bank Paid with branch-wise breakdown',
    '"Pay Credit" to settle outstanding amounts (select branch, cash/bank)',
    'Credit status bar shows utilization',
  ]},
  { icon: Receipt, title: 'Expenses', color: 'text-error', items: [
    'Add expenses with category, sub-category, branch, supplier link',
    'Filter by branch and date',
    'Bottom section: Recurring Expenses (rent, insurance, etc.)',
    '"+ Add Recurring" → set name, amount, frequency, due date',
    '"Renew & Pay" → pays and auto-sets next due date',
  ]},
  { icon: ArrowLeftRight, title: 'Cash Transfers', color: 'text-info', items: [
    'Track cash/bank movements between branches and office',
    'Select From branch → To branch, sender name, receiver name',
    'These create branch-to-branch dues on Dashboard',
  ]},
  { icon: AlertTriangle, title: 'Fines & Penalties', color: 'text-warning', items: [
    'Record government fines: type, department, amount, branch',
    'Optionally charge to employee with monthly salary deduction',
    '"Pay" button for partial or full payment',
    'Salary Deductions tab: deduct for late, absence, misbehavior',
    'Employee gets notification when deducted',
  ]},
  { icon: Handshake, title: 'Partners', color: 'text-primary', items: [
    'Add business partners with share percentage',
    'Record transactions: Investment, Withdrawal, Profit Share, Expense',
    'Each partner card shows invested, withdrawn, balance',
    'Filter by branch',
  ]},
  { icon: UserCheck, title: 'Employees', color: 'text-success', items: [
    'Add employees with salary, document ID, position, leave entitlements',
    'Pay salary: select month from dropdown (prevents duplicate payment)',
    'Payment types: Salary, Bonus, Overtime, Advance/Loan, Loan Repayment, Tickets, ID Card, Old Balance',
    'All payments auto-create expense records',
    '"View" → 6 tabs: Payments, Loan, Leave, Deductions, Salary History, Documents',
    'Salary History: track increments (old → new salary with date)',
    '"Leave" button: auto-calculates days from date range',
    'Employee Portal: employees login to view payslips, apply leave, submit requests',
    'Time In/Out attendance tracking',
    'Letters: Salary Certificate, Employment, NOC, Experience (auto-filled PDF)',
  ]},
  { icon: FileWarning, title: 'Documents', color: 'text-warning', items: [
    'Track documents with expiry dates (license, insurance, permit, etc.)',
    'Upload actual files as backup (PDF, images)',
    'Download/share attached files anytime',
    'Auto-alerts when approaching expiry on Dashboard',
    'Add custom document types',
  ]},
  { icon: BarChart3, title: 'Reports', color: 'text-info', items: [
    '5 tabs: Overview, Period Compare, Branch Compare, Trends, Detailed',
    'Period Compare: Day/Month/Year with % change arrows',
    'Branch Compare: select 2 branches side by side',
    'Trends: 6-month sales vs expenses area chart',
    'Export to PDF/Excel',
  ]},
  { icon: Settings, title: 'Settings', color: 'text-stone-500', items: [
    'Email (SMTP): configure email server for notifications',
    'WhatsApp: add Twilio credentials for WhatsApp alerts',
    'Notifications: choose which alerts to send (daily sales, expiry, leave)',
    'Import Data: upload old data from Excel (customers, suppliers, employees, sales, expenses)',
    'Backup: download complete database backup as JSON',
    'Deploy: step-by-step guide to deploy on your own server',
    'Company: set address, logo, VAT settings (appears on letters & payslips)',
  ]},
  { icon: HelpCircle, title: 'User Roles & Permissions', color: 'text-primary', items: [
    'Admin: full access to everything',
    'Manager: sales, invoices, customers, suppliers, expenses, employees, reports',
    'Operator: limited to sales, invoices, customers',
    'Employee: only My Portal (payslips, leave, requests)',
    'Custom permissions: Users page → Edit → check/uncheck individual pages',
  ]},
];

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2">Help & Guide</h1>
          <p className="text-muted-foreground">How to use SSC Track - complete guide for all modules</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="border-stone-100 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="font-outfit text-base flex items-center gap-2">
                    <Icon size={20} className={s.color} />
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {s.items.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary mt-1 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader><CardTitle className="font-outfit">Quick Tips</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Branch Filtering</div>
                <p className="text-muted-foreground">Click branch name chips at top of any page. Select multiple branches to combine data. Click "Clear" to reset.</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Date Filtering</div>
                <p className="text-muted-foreground">Use "Period" dropdown: All Time, Today, This Month, This Year, or Custom date range.</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Employee Portal</div>
                <p className="text-muted-foreground">Employees login with their email (auto-created when you add employee with email). Default password: emp@123</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Import Old Data</div>
                <p className="text-muted-foreground">Settings → Import Data → Download template → Fill your data → Upload. Supports dates from 2018.</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Backup</div>
                <p className="text-muted-foreground">Settings → Backup → Download Full Backup. Save to OneDrive or Google Drive regularly.</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <div className="font-medium mb-1">Currency</div>
                <p className="text-muted-foreground">All amounts in SAR (Saudi Riyal). VAT 15% calculation available on Dashboard (toggle on/off).</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
