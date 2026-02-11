import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Wallet, Building2, CreditCard, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { DateFilter } from '@/components/DateFilter';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [branchDues, setBranchDues] = useState(null);
  const [pendingSalaries, setPendingSalaries] = useState({ employees: [], branch_summary: {}, totals: { total_salary: 0, total_paid: 0, total_pending: 0 }, period: '' });
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [showVat, setShowVat] = useState(false);
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
        api.get('/reports/branch-dues'),
        api.get('/employees/pending-summary'),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setBranchDues(duesRes.data);
      setPendingSalaries(pendRes.data);
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
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your sales and expense tracking dashboard</p>
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <BranchFilter onChange={setBranchFilter} />
          <DateFilter onFilterChange={setDateFilter} />
        </div>

        {/* Main Stats Grid */}
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

        {/* Cash & Bank In Hand */}
        <div>
          <h2 className="text-2xl font-bold font-outfit mb-4">Cash & Bank In Hand</h2>
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

        {/* Payment Mode Breakdown */}
        <div>
          <h2 className="text-2xl font-bold font-outfit mb-4">Payment Mode Breakdown</h2>
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

        {/* Spending Breakdown */}
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

        {/* Supplier Dues, Due Fines & Due Salaries */}
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

          {branchDues && Object.keys(branchDues.dues || {}).length > 0 && (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Branch-to-Branch Dues</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(branchDues.dues).map(([key, amt]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-info/10 rounded-lg border border-info/20" data-testid="branch-due-item">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="font-bold text-info"> SAR {amt.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-2">
                    <span className="text-sm font-bold">Total Cross-Branch</span>
                    <span className="font-bold text-primary"> SAR {(branchDues.total_cross_branch || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

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

      </div>
    </DashboardLayout>
  );
}
