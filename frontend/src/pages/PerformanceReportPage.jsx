import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Target,
  Award, ArrowUp, ArrowDown, Minus, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

function KPICard({ title, value, prev, suffix = '', prefix = '', growth, icon: Icon, color }) {
  const isUp = growth > 0;
  const isDown = growth < 0;
  return (
    <Card data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        {growth !== undefined && growth !== null && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            {isUp ? <ArrowUp className="h-3 w-3 text-emerald-600" /> : isDown ? <ArrowDown className="h-3 w-3 text-red-500" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
            <span className={isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-muted-foreground'}>
              {Math.abs(growth)}%
            </span>
            <span className="text-muted-foreground">vs prev period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerformanceReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [tab, setTab] = useState('overview');

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/performance-report?period=${period}`);
      setData(d);
    } catch { toast.error('Failed to load performance report'); }
    finally { setLoading(false); }
  };

  if (loading || !data) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground" data-testid="performance-loading">Loading performance report...</div>
    </DashboardLayout>
  );

  const { kpi, sales_trend, branch_ranking, employee_performance, expense_breakdown, payment_distribution } = data;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'branches', label: 'Branches', icon: ShoppingCart },
    { id: 'expenses', label: 'Expenses', icon: PieIcon },
  ];

  const statusBadge = (status) => {
    const map = {
      excellent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      needs_attention: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[status] || map.good;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="performance-report-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="performance-report-title">Performance Report</h1>
            <p className="text-sm text-muted-foreground">Comprehensive business & employee performance analysis</p>
          </div>
          <Select value={period} onValueChange={setPeriod} data-testid="period-selector">
            <SelectTrigger className="w-40" data-testid="period-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit" data-testid="performance-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="kpi-cards">
          <KPICard title="Total Sales" value={kpi.total_sales} prefix="SAR " growth={kpi.sales_growth} icon={DollarSign} color="bg-sky-500" />
          <KPICard title="Total Expenses" value={kpi.total_expenses} prefix="SAR " growth={kpi.expense_growth} icon={TrendingDown} color="bg-red-500" />
          <KPICard title="Net Profit" value={kpi.net_profit} prefix="SAR " growth={null} icon={TrendingUp} color="bg-emerald-500" />
          <KPICard title="Transactions" value={kpi.total_transactions} growth={null} icon={ShoppingCart} color="bg-violet-500" />
          <KPICard title="Task Compliance" value={kpi.task_compliance} suffix="%" growth={null} icon={Target} color="bg-amber-500" />
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Sales & Profit Trend */}
            <Card data-testid="sales-trend-chart">
              <CardHeader><CardTitle className="text-base">Sales & Profit Trend</CardTitle></CardHeader>
              <CardContent>
                {sales_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={sales_trend}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `SAR ${v.toLocaleString()}`} />
                      <Legend />
                      <Area type="monotone" dataKey="sales" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} strokeWidth={2} name="Sales" />
                      <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} name="Expenses" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} name="Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>}
              </CardContent>
            </Card>

            {/* Payment Distribution + Quick Stats */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card data-testid="payment-distribution-chart">
                <CardHeader><CardTitle className="text-base">Payment Distribution</CardTitle></CardHeader>
                <CardContent>
                  {payment_distribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={payment_distribution} dataKey="amount" nameKey="mode" cx="50%" cy="50%" outerRadius={90} label={({ mode, percent }) => `${mode} ${(percent * 100).toFixed(0)}%`}>
                          {payment_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `SAR ${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No payment data</p>}
                </CardContent>
              </Card>

              <Card data-testid="quick-stats">
                <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Avg Transaction Value</span>
                    <span className="font-semibold">SAR {kpi.avg_transaction.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Profit Margin</span>
                    <span className={`font-semibold ${kpi.profit_margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{kpi.profit_margin}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Total Employees</span>
                    <span className="font-semibold">{kpi.employee_count}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Salary Paid</span>
                    <span className="font-semibold">SAR {kpi.total_salary_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Task Compliance</span>
                    <Badge className={kpi.task_compliance >= 80 ? 'bg-emerald-100 text-emerald-700' : kpi.task_compliance >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                      {kpi.task_compliance}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <Card data-testid="employee-performance-table">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" /> Employee Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employee_performance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="emp-table">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Role</th>
                        <th className="pb-2 pr-3">Branch</th>
                        <th className="pb-2 pr-3 text-right">Tasks</th>
                        <th className="pb-2 pr-3 text-right">Completed</th>
                        <th className="pb-2 pr-3 text-right">Compliance</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee_performance.map((emp, i) => (
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 pr-3 font-medium">{emp.name}</td>
                          <td className="py-2 pr-3 capitalize">{emp.role}</td>
                          <td className="py-2 pr-3">{emp.branch}</td>
                          <td className="py-2 pr-3 text-right">{emp.tasks_received}</td>
                          <td className="py-2 pr-3 text-right">{emp.tasks_completed}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{emp.compliance}%</td>
                          <td className="py-2 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(emp.status)}`}>
                              {emp.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No employee data</p>}
            </CardContent>
          </Card>
        )}

        {tab === 'branches' && (
          <div className="space-y-4">
            <Card data-testid="branch-performance-chart">
              <CardHeader><CardTitle className="text-base">Branch Revenue Comparison</CardTitle></CardHeader>
              <CardContent>
                {branch_ranking.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branch_ranking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `SAR ${v.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="sales" fill="#0ea5e9" name="Sales" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No branch data</p>}
              </CardContent>
            </Card>

            <Card data-testid="branch-ranking-table">
              <CardHeader><CardTitle className="text-base">Branch Rankings</CardTitle></CardHeader>
              <CardContent>
                {branch_ranking.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-3">#</th>
                          <th className="pb-2 pr-3">Branch</th>
                          <th className="pb-2 pr-3 text-right">Sales</th>
                          <th className="pb-2 pr-3 text-right">Expenses</th>
                          <th className="pb-2 pr-3 text-right">Profit</th>
                          <th className="pb-2 pr-3 text-right">Txns</th>
                          <th className="pb-2 text-right">Avg Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branch_ranking.map((b, i) => (
                          <tr key={b.branch_id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 pr-3 font-medium">{b.name}</td>
                            <td className="py-2 pr-3 text-right">SAR {b.sales.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right text-red-500">SAR {b.expenses.toLocaleString()}</td>
                            <td className={`py-2 pr-3 text-right font-semibold ${b.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>SAR {b.profit.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right">{b.transactions}</td>
                            <td className="py-2 text-right">SAR {b.avg_ticket.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No branch data</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'expenses' && (
          <div className="space-y-4">
            <Card data-testid="expense-breakdown-chart">
              <CardHeader><CardTitle className="text-base">Expense Breakdown by Category</CardTitle></CardHeader>
              <CardContent>
                {expense_breakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={expense_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `SAR ${v.toLocaleString()}`} />
                      <Bar dataKey="amount" fill="#8b5cf6" name="Amount" radius={[4, 4, 0, 0]}>
                        {expense_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No expense data</p>}
              </CardContent>
            </Card>

            <Card data-testid="expense-breakdown-table">
              <CardHeader><CardTitle className="text-base">Expense Details</CardTitle></CardHeader>
              <CardContent>
                {expense_breakdown.length > 0 ? (
                  <div className="space-y-2">
                    {expense_breakdown.map((cat, i) => {
                      const total = expense_breakdown.reduce((s, c) => s + c.amount, 0);
                      const pct = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm flex-1">{cat.category}</span>
                          <span className="text-sm font-medium">SAR {cat.amount.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No expense data</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
