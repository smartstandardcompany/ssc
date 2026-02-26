import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Wallet, Building2, CreditCard, AlertTriangle, ArrowLeftRight, MessageCircle, Settings2, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { DateFilter } from '@/components/DateFilter';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const THEMES = {
  default: { bg: 'from-[#FDFBF7] to-[#FFF8F0]', card: 'border-stone-100', accent: 'text-primary' },
  dark: { bg: 'from-stone-900 to-stone-800', card: 'border-stone-700 bg-stone-800/50 text-white', accent: 'text-orange-400' },
  blue: { bg: 'from-blue-50 to-indigo-50', card: 'border-blue-100', accent: 'text-blue-600' },
  green: { bg: 'from-emerald-50 to-teal-50', card: 'border-emerald-100', accent: 'text-emerald-600' },
};
const PIE_COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6'];

const DEFAULT_WIDGETS = { stats: true, charts: true, cashBank: true, paymentMode: true, spending: true, dues: true, branchDues: true, vatSummary: true };

function getWidgetPrefs() {
  try { return { ...DEFAULT_WIDGETS, ...JSON.parse(localStorage.getItem('dashboard_widgets') || '{}') }; }
  catch { return DEFAULT_WIDGETS; }
}
function saveWidgetPrefs(prefs) { localStorage.setItem('dashboard_widgets', JSON.stringify(prefs)); }

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [branchDues, setBranchDues] = useState(null);
  const [pendingSalaries, setPendingSalaries] = useState({ employees: [], branch_summary: {}, totals: { total_salary: 0, total_paid: 0, total_pending: 0 }, period: '' });
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [showVat, setShowVat] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('dashboard_theme') || 'default');
  const [showPaybackDialog, setShowPaybackDialog] = useState(false);
  const [paybackData, setPaybackData] = useState({ from_branch_id: '', to_branch_id: '', amount: '', payment_mode: 'cash' });
  const [branches, setBranches] = useState([]);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [widgets, setWidgets] = useState(getWidgetPrefs());
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const t = THEMES[theme] || THEMES.default;

  const toggleWidget = (key) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    saveWidgetPrefs(updated);
  };

  const changeTheme = (newTheme) => { setTheme(newTheme); localStorage.setItem('dashboard_theme', newTheme); };
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });

  useEffect(() => {
    fetchStats();
  }, [branchFilter, dateFilter]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (branchFilter.length > 0) params.set('branch_ids', branchFilter.join(','));
      if (dateFilter.start) params.set('start_date', dateFilter.start.toISOString());
      if (dateFilter.end) params.set('end_date', dateFilter.end.toISOString());
      const q = params.toString() ? `?${params.toString()}` : '';
      const [statsRes, alertsRes, duesRes, pendRes] = await Promise.all([
        api.get(`/dashboard/stats${q}`),
        api.get('/documents/alerts/upcoming'),
        api.get('/reports/branch-dues-net'),
        api.get('/employees/pending-summary'),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setBranchDues(duesRes.data);
      setPendingSalaries(pendRes.data);
      const brRes = await api.get('/branches');
      setBranches(brRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const pctChange = (current, prev) => {
    if (!prev || prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / Math.abs(prev) * 100).toFixed(1);
  };
  const pctOfSales = (val) => stats?.total_sales > 0 ? (val / stats.total_sales * 100).toFixed(1) : 0;
  const ChangeIndicator = ({ current, previous, invert = false }) => {
    if (!previous && previous !== 0) return null;
    const change = pctChange(current, previous);
    const isUp = parseFloat(change) > 0;
    const isGood = invert ? !isUp : isUp;
    return (
      <span className={`inline-flex items-center text-xs font-medium ml-2 ${isGood ? 'text-success' : 'text-error'}`}>
        {isUp ? '▲' : '▼'} {Math.abs(change)}%
      </span>
    );
  };
  const PctBadge = ({ value }) => value > 0 ? <span className="text-xs text-muted-foreground ml-1">({value}% of sales)</span> : null;

  const statCards = [
    {
      title: 'Total Sales',
      value: `SAR ${stats?.total_sales?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_sales,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      testId: 'total-sales-card'
    },
    {
      title: 'Total Expenses',
      value: `SAR ${stats?.total_expenses?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_expenses,
      pct: stats?.expenses_pct_of_sales,
      invert: true,
      icon: TrendingDown,
      color: 'text-error',
      bgColor: 'bg-error/10',
      testId: 'total-expenses-card'
    },
    {
      title: 'Supplier Payments',
      value: `SAR ${stats?.total_supplier_payments?.toFixed(2) || '0.00'}`,
      pct: stats?.sp_pct_of_sales,
      icon: Building2,
      color: 'text-info',
      bgColor: 'bg-info/10',
      testId: 'supplier-payments-card'
    },
    {
      title: 'Net Profit',
      value: `SAR ${stats?.net_profit?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_net,
      pct: stats?.profit_pct_of_sales,
      icon: TrendingUp,
      color: stats?.net_profit >= 0 ? 'text-success' : 'text-error',
      bgColor: stats?.net_profit >= 0 ? 'bg-success/10' : 'bg-error/10',
      testId: 'net-profit-card'
    },
    {
      title: 'Pending Credits',
      value: `SAR ${stats?.pending_credits?.toFixed(2) || '0.00'}`,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      testId: 'pending-credits-card'
    },
  ];

  const paymentModeCards = [
    {
      title: 'Cash Sales',
      value: `SAR ${stats?.cash_sales?.toFixed(2) || '0.00'}`,
      icon: Wallet,
      color: 'text-cash',
      bgColor: 'bg-cash/10',
      testId: 'cash-sales-card'
    },
    {
      title: 'Bank Sales',
      value: `SAR ${stats?.bank_sales?.toFixed(2) || '0.00'}`,
      icon: Building2,
      color: 'text-bank',
      bgColor: 'bg-bank/10',
      testId: 'bank-sales-card'
    },
    {
      title: 'Credit Sales',
      value: `SAR ${stats?.credit_sales?.toFixed(2) || '0.00'}`,
      icon: CreditCard,
      color: 'text-credit',
      bgColor: 'bg-credit/10',
      testId: 'credit-sales-card'
    },
  ];

  return (
    <DashboardLayout>
      <div className={`space-y-8 min-h-screen p-1 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br ' + t.bg + ' text-white' : ''}`}>
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl sm:text-4xl font-bold font-outfit mb-1 ${t.accent}`} data-testid="dashboard-title">Dashboard</h1>
            <p className={theme === 'dark' ? 'text-stone-400' : 'text-muted-foreground'}>Smart Standard Company - Business Overview</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="dashboard-whatsapp-btn">
              <MessageCircle size={14} className="mr-1" />WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWidgetSettings(true)} data-testid="customize-dashboard-btn">
              <Settings2 size={14} className="mr-1" />Customize
            </Button>
            {Object.keys(THEMES).map(th => (
              <button key={th} onClick={() => changeTheme(th)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${theme === th ? 'bg-primary text-white border-primary' : 'bg-white border-stone-200 hover:border-primary'}`}>{th}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <BranchFilter onChange={setBranchFilter} />
          <DateFilter onFilterChange={setDateFilter} />
        </div>

        {/* Main Stats Grid */}
        {widgets.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            const rawVal = parseFloat(card.value.replace('$', '').replace(',', '')) || 0;
            return (
              <Card key={card.title} className="stat-card border-border" data-testid={card.testId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`${card.bgColor} p-2 rounded-lg`}><Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2} /></div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-outfit" data-testid={`${card.testId}-value`}>{card.value}</span>
                  </div>
                  <div className="flex items-center mt-1 flex-wrap">
                    {card.prev !== undefined && <ChangeIndicator current={rawVal} previous={card.prev} invert={card.invert} />}
                    {card.pct !== undefined && card.pct > 0 && <PctBadge value={card.pct} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        {/* Branch Loss Alerts */}
        {stats?.branch_loss_alerts?.length > 0 && (
          <Card className="border-error/50 bg-error/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2 text-error"><AlertTriangle size={18} />Branch Loss Alert</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">{stats.branch_loss_alerts.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-background rounded-xl border border-error/20">
                  <div><div className="font-medium text-sm">{a.branch}</div><div className="text-xs text-muted-foreground">Sales: SAR {a.sales.toFixed(0)} | Expenses: SAR {a.expenses.toFixed(0)}</div></div>
                  <Badge className="bg-error/20 text-error text-sm">Loss: SAR {Math.abs(a.profit).toFixed(2)}</Badge>
                </div>
              ))}</div>
            </CardContent>
          </Card>
        )}

        {/* Quick Charts */}
        {widgets.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats?.expense_by_category && Object.keys(stats.expense_by_category).length > 0 && (
            <Card className={t.card}>
              <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Expense Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={Object.entries(stats.expense_by_category).map(([k,v]) => ({name: k.replace('_',' '), value: v}))} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>{Object.keys(stats.expense_by_category).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `SAR ${v.toFixed(0)}`} /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card className={t.card}>
            <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Sales vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[{name: 'Sales', amount: stats?.total_sales || 0}, {name: 'Expenses', amount: stats?.total_expenses || 0}, {name: 'Supplier', amount: stats?.total_supplier_payments || 0}, {name: 'Profit', amount: stats?.net_profit || 0}]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{fontSize: 11}} /><YAxis tick={{fontSize: 10}} /><Tooltip formatter={(v) => `SAR ${v.toFixed(0)}`} />
                  <Bar dataKey="amount" radius={[6,6,0,0]}>{[{fill:'#22C55E'},{fill:'#EF4444'},{fill:'#0EA5E9'},{fill: (stats?.net_profit || 0) >= 0 ? '#22C55E' : '#EF4444'}].map((c,i) => <Cell key={i} fill={c.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Cash & Bank In Hand */}
        {widgets.cashBank && (
        <div>
          <h2 className="text-lg sm:text-2xl font-bold font-outfit mb-4">Cash & Bank In Hand</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="stat-card border-border border-cash/30 bg-gradient-to-br from-cash/5 to-cash/10" data-testid="cash-in-hand-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash In Hand</CardTitle>
                <div className="bg-cash/20 p-2 rounded-lg"><Wallet className="h-5 w-5 text-cash" strokeWidth={2} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold font-outfit ${(stats?.cash_in_hand || 0) >= 0 ? 'text-cash' : 'text-error'}`} data-testid="cash-in-hand-value">SAR {(stats?.cash_in_hand || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Cash Sales - Cash Expenses - Cash Supplier Payments</p>
              </CardContent>
            </Card>
            <Card className="stat-card border-border border-bank/30 bg-gradient-to-br from-bank/5 to-bank/10" data-testid="bank-in-hand-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bank In Hand</CardTitle>
                <div className="bg-bank/20 p-2 rounded-lg"><Building2 className="h-5 w-5 text-bank" strokeWidth={2} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold font-outfit ${(stats?.bank_in_hand || 0) >= 0 ? 'text-bank' : 'text-error'}`} data-testid="bank-in-hand-value">SAR {(stats?.bank_in_hand || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Bank Sales - Bank Expenses - Bank Supplier Payments</p>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Payment Mode Breakdown */}
        {widgets.paymentMode && (
        <div>
          <h2 className="text-lg sm:text-2xl font-bold font-outfit mb-4">Payment Mode Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paymentModeCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="stat-card border-border" data-testid={card.testId}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg`}>
                      <Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold font-outfit">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {/* Spending Breakdown */}
        {widgets.spending && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader><CardTitle className="font-outfit text-base">Cash vs Bank Spending</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-cash/10 rounded-lg"><span className="text-sm">Expenses (Cash)</span><span className="font-bold text-cash"> SAR {(stats?.expenses_cash || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-bank/10 rounded-lg"><span className="text-sm">Expenses (Bank)</span><span className="font-bold text-bank"> SAR {(stats?.expenses_bank || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-cash/10 rounded-lg"><span className="text-sm">Supplier Pay (Cash)</span><span className="font-bold text-cash"> SAR {(stats?.sp_cash || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-bank/10 rounded-lg"><span className="text-sm">Supplier Pay (Bank)</span><span className="font-bold text-bank"> SAR {(stats?.sp_bank || 0).toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="font-outfit text-base">Expense Categories</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.expense_by_category && Object.entries(stats.expense_by_category).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center p-2 bg-secondary/50 rounded" data-testid="expense-cat-item">
                    <span className="text-sm capitalize">{cat.replace('_', ' ')}</span>
                    <span className="font-bold text-sm"> SAR {amt.toFixed(2)}</span>
                  </div>
                ))}
                {(!stats?.expense_by_category || Object.keys(stats.expense_by_category).length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No expenses</p>}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Supplier Dues, Due Fines & Due Salaries */}
        {widgets.dues && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border border-warning/30 bg-warning/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Supplier Dues</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-warning" data-testid="supplier-dues"> SAR {(stats?.supplier_dues || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">Total owed to suppliers</p></CardContent>
          </Card>

          <Card className="border-border border-orange-300 bg-orange-50">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due Fines</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-outfit text-orange-600" data-testid="due-fines">SAR {(stats?.due_fines || 0).toFixed(2)}</div>
              {stats?.due_fines_list?.length > 0 && (
                <div className="mt-2 space-y-1">{stats.due_fines_list.map((f, i) => (
                  <div key={i} className="flex justify-between text-xs p-1.5 bg-background rounded"><span className="capitalize">{f.department}</span><span className="font-bold text-orange-600">SAR {f.amount.toFixed(0)}</span></div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border border-error/30 bg-error/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due Salaries</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-outfit text-error" data-testid="due-salaries"> SAR {(pendingSalaries.totals?.total_pending || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{pendingSalaries.period} | {(pendingSalaries.employees || []).filter(e => e.pending_salary > 0).length} employee(s)</p>
              {Object.keys(pendingSalaries.branch_summary || {}).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(pendingSalaries.branch_summary).map(([bName, bs]) => (
                    <div key={bName} className="flex justify-between text-xs p-1.5 bg-background rounded">
                      <span>{bName}</span>
                      <span><span className="text-success">Paid: SAR {bs.total_paid.toFixed(0)}</span> <span className="text-error font-bold">Due: SAR {bs.total_pending.toFixed(0)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {branchDues && (Object.keys(branchDues.dues || {}).length > 0 || Object.keys(branchDues.paybacks || {}).length > 0) && (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="font-outfit text-base">Branch-to-Branch Dues</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowPaybackDialog(true)}><ArrowLeftRight size={14} className="mr-1" />Record Payback</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(branchDues.dues || {}).map(([key, amt]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-error/5 rounded-lg border border-error/20" data-testid="branch-due-item">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="font-bold text-error"> SAR {amt.toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.entries(branchDues.paybacks || {}).map(([key, amt]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-success/5 rounded-lg border border-success/20">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="font-bold text-success"> SAR {amt.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-2">
                    <span className="text-sm font-bold">Net Due</span>
                    <span className="font-bold text-primary"> SAR {((branchDues.total_dues || 0) - (branchDues.total_paybacks || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* VAT Section (toggleable) */}
        {widgets.vatSummary && (
        <>
        <div className="flex items-center gap-3 mt-2">
          <Checkbox checked={showVat} onCheckedChange={setShowVat} id="vat-toggle" />
          <Label htmlFor="vat-toggle" className="cursor-pointer text-sm font-medium">Show VAT 15% Calculation</Label>
        </div>
        {showVat && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-stone-100 bg-blue-50 border-blue-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT on Sales (Output)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-blue-600">SAR {(stats?.vat_on_sales || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">15% of SAR {(stats?.total_sales || 0).toFixed(0)}</p></CardContent>
            </Card>
            <Card className="border-stone-100 bg-green-50 border-green-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT on Purchases (Input)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-green-600">SAR {(stats?.vat_on_purchases || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">15% of SAR {(stats?.total_supplier_payments || 0).toFixed(0)}</p></CardContent>
            </Card>
            <Card className="border-stone-100 bg-orange-50 border-orange-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT Payable</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-orange-600">SAR {(stats?.vat_payable || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">Output VAT - Input VAT</p></CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming Recurring Expenses */}
        {stats?.upcoming_expenses?.length > 0 && (
          <Card className="border-border border-error/30 bg-error/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><AlertTriangle size={18} className="text-error" />Upcoming Expenses ({stats.upcoming_expenses.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.upcoming_expenses.map((e, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-background rounded-lg border" data-testid="upcoming-expense">
                    <div><div className="font-medium text-sm">{e.name}</div><div className="text-xs text-muted-foreground capitalize">{e.category} | Due: {format(new Date(e.due_date), 'MMM dd, yyyy')}</div></div>
                    <div className="text-right"><div className="font-bold"> SAR {e.amount.toFixed(2)}</div><Badge className={e.days_left < 0 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>{e.days_left < 0 ? `${Math.abs(e.days_left)}d overdue` : `${e.days_left}d left`}</Badge></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Expiry Alerts */}
        {alerts.length > 0 && (
          <Card className="border-border border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Document Expiry Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id + a.type} className={`flex justify-between items-center p-3 rounded-lg ${a.days_left < 0 ? 'bg-error/10' : 'bg-warning/10'}`} data-testid="dashboard-alert">
                    <div>
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.related_to} | {format(new Date(a.expiry_date), 'MMM dd, yyyy')}</div>
                    </div>
                    <Badge className={a.days_left < 0 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>
                      {a.days_left < 0 ? `${Math.abs(a.days_left)}d overdue` : `${a.days_left}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payback Dialog */}
        <Dialog open={showPaybackDialog} onOpenChange={setShowPaybackDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-outfit">Record Branch Payback</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">When one branch pays back another branch for expenses paid on their behalf</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Paying Branch (who owes)</Label>
                  <Select value={paybackData.from_branch_id || "none"} onValueChange={(v) => setPaybackData({...paybackData, from_branch_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Receiving Branch (who paid)</Label>
                  <Select value={paybackData.to_branch_id || "none"} onValueChange={(v) => setPaybackData({...paybackData, to_branch_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={paybackData.amount} onChange={(e) => setPaybackData({...paybackData, amount: e.target.value})} placeholder="SAR 0.00" /></div>
                <div><Label>Mode</Label>
                  <Select value={paybackData.payment_mode} onValueChange={(v) => setPaybackData({...paybackData, payment_mode: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="rounded-xl w-full" onClick={async () => {
                if (!paybackData.from_branch_id || !paybackData.to_branch_id || !paybackData.amount) { toast.error('Fill all fields'); return; }
                try {
                  await api.post('/branch-paybacks', {...paybackData, amount: parseFloat(paybackData.amount), date: new Date().toISOString()});
                  toast.success('Payback recorded - dues updated');
                  setShowPaybackDialog(false);
                  setPaybackData({ from_branch_id: '', to_branch_id: '', amount: '', payment_mode: 'cash' });
                  fetchStats();
                } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
              }}>Record Payback</Button>
            </div>
          </DialogContent>
        </Dialog>
        <WhatsAppSendDialog open={showWhatsApp} onClose={() => setShowWhatsApp(false)} defaultType="daily_sales" branches={branches} />
      </div>
    </DashboardLayout>
  );
}
