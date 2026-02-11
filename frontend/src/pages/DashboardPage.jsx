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
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
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
      const [statsRes, alertsRes] = await Promise.all([
        api.get(`/dashboard/stats${q}`),
        api.get('/documents/alerts/upcoming'),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
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

  const statCards = [
    {
      title: 'Total Sales',
      value: `$${stats?.total_sales?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      testId: 'total-sales-card'
    },
    {
      title: 'Total Expenses',
      value: `$${stats?.total_expenses?.toFixed(2) || '0.00'}`,
      icon: TrendingDown,
      color: 'text-error',
      bgColor: 'bg-error/10',
      testId: 'total-expenses-card'
    },
    {
      title: 'Supplier Payments',
      value: `$${stats?.total_supplier_payments?.toFixed(2) || '0.00'}`,
      icon: Building2,
      color: 'text-info',
      bgColor: 'bg-info/10',
      testId: 'supplier-payments-card'
    },
    {
      title: 'Net Profit',
      value: `$${stats?.net_profit?.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: stats?.net_profit >= 0 ? 'text-success' : 'text-error',
      bgColor: stats?.net_profit >= 0 ? 'bg-success/10' : 'bg-error/10',
      testId: 'net-profit-card'
    },
    {
      title: 'Pending Credits',
      value: `$${stats?.pending_credits?.toFixed(2) || '0.00'}`,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      testId: 'pending-credits-card'
    },
  ];

  const paymentModeCards = [
    {
      title: 'Cash Sales',
      value: `$${stats?.cash_sales?.toFixed(2) || '0.00'}`,
      icon: Wallet,
      color: 'text-cash',
      bgColor: 'bg-cash/10',
      testId: 'cash-sales-card'
    },
    {
      title: 'Bank Sales',
      value: `$${stats?.bank_sales?.toFixed(2) || '0.00'}`,
      icon: Building2,
      color: 'text-bank',
      bgColor: 'bg-bank/10',
      testId: 'bank-sales-card'
    },
    {
      title: 'Credit Sales',
      value: `$${stats?.credit_sales?.toFixed(2) || '0.00'}`,
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
        <BranchFilter onChange={setBranchFilter} className="mb-4" />

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="stat-card border-border" data-testid={card.testId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`${card.bgColor} p-2 rounded-lg`}><Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2} /></div>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold font-outfit" data-testid={`${card.testId}-value`}>{card.value}</div></CardContent>
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
                <div className={`text-3xl font-bold font-outfit ${(stats?.cash_in_hand || 0) >= 0 ? 'text-cash' : 'text-error'}`} data-testid="cash-in-hand-value">${(stats?.cash_in_hand || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Cash Sales - Cash Expenses - Cash Supplier Payments</p>
              </CardContent>
            </Card>
            <Card className="stat-card border-border border-bank/30 bg-gradient-to-br from-bank/5 to-bank/10" data-testid="bank-in-hand-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bank In Hand</CardTitle>
                <div className="bg-bank/20 p-2 rounded-lg"><Building2 className="h-5 w-5 text-bank" strokeWidth={2} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold font-outfit ${(stats?.bank_in_hand || 0) >= 0 ? 'text-bank' : 'text-error'}`} data-testid="bank-in-hand-value">${(stats?.bank_in_hand || 0).toFixed(2)}</div>
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

        {/* Quick Actions */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Add your branches and customers before recording sales</li>
              <li>• Record credit sales and mark them as received when payment comes in</li>
              <li>• Track all expenses by category for better financial insights</li>
              <li>• Use the Reports section to view detailed analytics</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
