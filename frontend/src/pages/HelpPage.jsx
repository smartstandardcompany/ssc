import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, ShoppingCart, FileInput, Store, Users, Truck, Receipt, ArrowLeftRight, AlertTriangle, Handshake, UserCheck, FileWarning, BarChart3, CreditCard, FileText, Settings, HelpCircle, Building2 } from 'lucide-react';

const sections = [
  { icon: LayoutDashboard, title: 'Dashboard', color: 'text-primary', items: [
    'View total sales, expenses, supplier payments, net profit with % of sales',
    'Cash & Bank in hand after all expenses',
    'Filter by branch chips + date period (Today/Month/Year/Custom)',
    'VAT 15% toggle: check "Show VAT 15% Calculation"',
    'Due fines, due salaries by branch, supplier dues',
    'Branch-to-branch dues with payback tracking (net balance)',
    'Branch loss alerts in RED when any branch is losing money',
    'Upcoming recurring expenses & document expiry alerts',
    '▲/▼ arrows comparing vs previous month on all cards',
  ]},
  { icon: ShoppingCart, title: 'Sales', color: 'text-success', items: [
    'Click "+ Add Sale" → choose Branch Sale or Online Sale',
    'Color-coded branch chips - click to select branch',
    'Color-coded customer chips for online sales',
    'Add payment details: Cash, Bank, or Credit with amounts',
    'Discount auto-calculates final amount',
    'Filter by branch chips and date period',
    'Export to PDF or Excel',
  ]},
  { icon: FileInput, title: 'Invoices', color: 'text-primary', items: [
    'Color-coded product chips - click to add items instantly',
    'Admin adds products via "New Product" button',
    'Operators select from colored chips or dropdown',
    'Search customers by typing in search box',
    'Credit invoices show "Receive" button + discount option',
    'Invoice auto-creates a sale entry',
  ]},
  { icon: Store, title: 'Branches', color: 'text-info', items: [
    'Each branch card shows: Sales, Expenses, Supplier Payments, Net Profit',
    'Cash & Bank In Hand per branch',
    'Expense category breakdown badges (salary, rent, tickets etc.)',
    'RED "LOSS" warning if branch expenses exceed sales',
    'Click eye icon for detailed breakdown',
  ]},
  { icon: Users, title: 'Customers', color: 'text-warning', items: [
    'Table shows: Total Sales, Cash, Bank, Credit Balance per customer',
    '"Report" button → purchase history with invoice items',
    '"Receive" button for credit balance (supports discount)',
    'PDF export → customer statement for sharing/tally',
  ]},
  { icon: Truck, title: 'Suppliers & Payments', color: 'text-error', items: [
    'Supplier cards show Cash/Bank paid with branch-wise breakdown',
    'Supplier Payments: Color-coded supplier chips - click to select',
    'Quick pay: Select supplier → Amount → Mode → Branch → Pay',
    '"Pay Credit" to settle outstanding amounts',
    'Sub-categories support for better organization',
  ]},
  { icon: Receipt, title: 'Expenses', color: 'text-error', items: [
    'Color-coded category chips: Salary(orange), Rent(green), Utilities(blue), Vehicle(purple) etc.',
    'Click category → sub-categories appear → enter amount → done',
    'Admin manages categories via "Categories" button',
    '"Recurring & Planned" tab: Add rent, insurance with due dates',
    '"Renew & Pay" button → pays + creates expense + auto-sets next due date',
  ]},
  { icon: ArrowLeftRight, title: 'Cash Transfers', color: 'text-info', items: [
    'Move cash/bank between branches and Company/Head Office',
    'Company Balance card shows: Cash & Bank at head office',
    'Tracks who sent, who received, with dates',
    'Creates branch-to-branch dues automatically',
  ]},
  { icon: AlertTriangle, title: 'Fines & Penalties', color: 'text-warning', items: [
    'Record fines: type (custom types addable), department, amount, branch',
    'Upload proof documents (PDF/images)',
    'Charge to employee with monthly salary deduction option',
    'Salary Deductions: late, absence, misbehavior (employee gets alert)',
    'Capital/Goodwill tab: track building purchases, branch acquisitions',
  ]},
  { icon: Handshake, title: 'Partners', color: 'text-primary', items: [
    '"Investment / Withdrawal" button to add invested amounts',
    'Partner salary: set monthly salary, pay via "Pay" button',
    'Salary types: Regular, Advance/Loan, Loan Repayment',
    'All partner salary → auto expense record',
    'Loan balance tracking per partner',
    'Share percentage displayed on each card',
  ]},
  { icon: Building2, title: 'Company Loans', color: 'text-info', items: [
    'Track bank loans, personal loans, partner loans',
    'Visual progress bar showing % paid',
    '"Pay" button → record repayment (auto creates expense)',
    'Monthly payment tracking with interest rate',
    'Branch-wise or company-wide loans',
  ]},
  { icon: UserCheck, title: 'Employees', color: 'text-success', items: [
    'Pay salary: month dropdown prevents duplicate payment',
    'Payment types: Salary, Bonus, Overtime, Advance, Loan Repayment, Tickets, ID Card, Old Balance',
    '"Paid From" shows which branch cash/bank is used',
    'View Summary → 6 tabs: Payments, Loan, Leave, Deductions, Salary History, Documents',
    'Salary History: track increments over time',
    'Leave: auto-calculates days, shows if currently on leave',
    'Employee Portal: attendance, payslips, leave requests, letter downloads',
    'Download employee report as PDF',
  ]},
  { icon: FileWarning, title: 'Documents', color: 'text-warning', items: [
    'Track documents with expiry dates + upload actual files',
    'Custom document types (add via dropdown)',
    'Auto-alerts on Dashboard when approaching expiry',
    'Download/share attached files anytime',
  ]},
  { icon: BarChart3, title: 'Reports', color: 'text-info', items: [
    '7 tabs: Overview, Branch Report, Expense Report, Period Compare, Branch vs Branch, Trends, Detailed',
    'Branch Report: per-branch breakdown with expense categories & supplier payments',
    'Expense Report: donut chart, branch-wise costs, salary chart by branch',
    'Period Compare: Day/Month/Year with % change',
    'Export to PDF/Excel, WhatsApp reports per branch',
  ]},
  { icon: Settings, title: 'Settings', color: 'text-stone-500', items: [
    'Email SMTP: configure for notifications',
    'WhatsApp: Twilio setup + send reports per branch',
    'Alerts: choose what to send (daily sales, expiry, leave)',
    'Import Data: upload old data from Excel (customers, suppliers, employees, sales, expenses)',
    'Backup: download complete database as JSON',
    'Deploy: step-by-step deployment guide',
    'Company: address, logo, VAT settings, CR/VAT numbers',
  ]},
  { icon: HelpCircle, title: 'User Roles & Permissions', color: 'text-primary', items: [
    'Admin: full access | Manager: operations | Operator: sales & invoices | Employee: portal only',
    'Custom permissions: Users → Edit → check/uncheck individual pages',
    'Permissions control which sidebar pages appear for each user',
    'Employee accounts auto-created when adding employee with email (password: emp@123)',
  ]},
];

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2">Help & Guide</h1>
          <p className="text-muted-foreground">Complete guide for SSC Track - all modules & features</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="border-stone-100 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3"><CardTitle className="font-outfit text-base flex items-center gap-2"><Icon size={20} className={s.color} />{s.title}</CardTitle></CardHeader>
                <CardContent><ul className="space-y-1.5">{s.items.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary mt-1 shrink-0">•</span><span>{item}</span></li>
                ))}</ul></CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader><CardTitle className="font-outfit">Quick Tips</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {[
                { t: 'Color-Coded Selection', d: 'Categories, suppliers, branches, customers all shown as colored chips. Click to select - no more scrolling dropdowns.' },
                { t: 'Branch Filtering', d: 'Click branch chips at top of any page. Multiple branches can be combined.' },
                { t: 'Date Filtering', d: 'Period dropdown: All Time, Today, This Month, This Year, or Custom range.' },
                { t: 'Company Balance', d: 'Cash Transfers page shows Company/Head Office cash & bank balance from branch transfers.' },
                { t: 'Employee Portal', d: 'Employees login with email (auto-created). Default password: emp@123. Time In/Out, payslips, leave.' },
                { t: 'Backup & Import', d: 'Settings → Backup (download JSON) | Import (upload Excel for old data from 2018+)' },
              ].map((tip, i) => (
                <div key={i} className="p-3 bg-white rounded-xl"><div className="font-medium mb-1">{tip.t}</div><p className="text-muted-foreground text-xs">{tip.d}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
