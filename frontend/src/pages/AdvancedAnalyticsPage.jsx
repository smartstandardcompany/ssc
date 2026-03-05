import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BranchFilter } from '@/components/BranchFilter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, ArrowUpRight, ArrowDownRight, BarChart3, Activity, RefreshCw, Target, Zap } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#f97316', '#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

function KPICard({ title, value, subValue, trend, icon: Icon, color = 'orange' }) {
  const isUp = trend > 0;
  const colorMap = {
    orange: 'from-orange-50 to-amber-50 border-orange-200',
    blue: 'from-blue-50 to-cyan-50 border-blue-200',
    green: 'from-emerald-50 to-green-50 border-emerald-200',
    red: 'from-red-50 to-rose-50 border-red-200',
    purple: 'from-purple-50 to-violet-50 border-purple-200',
  };
  return (
    <Card className={`bg-gradient-to-br ${colorMap[color] || colorMap.orange}`} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-xl sm:text-2xl font-bold font-outfit mt-1">{value}</p>
            {subValue && <p className="text-[11px] text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`p-2 rounded-lg ${color === 'orange' ? 'bg-orange-100' : color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-emerald-100' : color === 'red' ? 'bg-red-100' : 'bg-purple-100'}`}>
              <Icon size={18} className={color === 'orange' ? 'text-orange-600' : color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-purple-600'} />
            </div>
            {trend !== undefined && trend !== null && (
              <div className={`flex items-center gap-0.5 text-[10px] font-medium ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(trend).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [branchRadar, setBranchRadar] = useState([]);
  const [salesFunnel, setSalesFunnel] = useState([]);
  const [expenseTree, setExpenseTree] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [kpiRes, trendRes, custRes, cfRes, radarRes, funnelRes, treeRes] = await Promise.all([
        api.get('/reports/kpi-gauges').catch(() => ({ data: { gauges: [] } })),
        api.get('/reports/revenue-trends').catch(() => ({ data: { weekly: [], growth: {} } })),
        api.get('/reports/supplier-balance').catch(() => ({ data: [] })),
        api.get('/reports/cashflow-waterfall').catch(() => ({ data: [] })),
        api.get('/reports/branch-radar').catch(() => ({ data: [] })),
        api.get('/reports/sales-funnel').catch(() => ({ data: { funnel: [], summary: {} } })),
        api.get('/reports/expense-treemap').catch(() => ({ data: { tree: [], total: 0 } })),
      ]);
      
      // Parse KPIs from gauges
      const gauges = kpiRes.data?.gauges || [];
      const salesGauge = gauges.find(g => g.name === 'Sales Target');
      const profitGauge = gauges.find(g => g.name === 'Profit Margin');
      const collectionGauge = gauges.find(g => g.name === 'Collection Rate');
      setKpis({
        total_revenue: salesGauge?.current || 0,
        total_expenses: Math.abs(profitGauge?.current || 0),
        revenue_trend: kpiRes.data?.growth?.avg_weekly,
        total_customers: funnelRes.data?.funnel?.[0]?.value || 0,
        avg_order_value: salesGauge?.current && funnelRes.data?.funnel?.[2]?.value > 0 
          ? salesGauge.current / funnelRes.data.funnel[2].value : 0,
      });
      
      // Revenue trends - use weekly data
      setSalesTrend((trendRes.data?.weekly || []).map(w => ({
        date: w.week,
        total: w.sales,
        expenses: w.expenses,
        profit: w.profit,
      })));
      
      // Top customers from supplier balance (reuse existing data)
      setTopCustomers(custRes.data || []);
      
      // Cash flow
      setCashflow(Array.isArray(cfRes.data) ? cfRes.data : []);
      
      // Branch radar
      setBranchRadar(Array.isArray(radarRes.data) ? radarRes.data : []);
      
      // Sales funnel - transform for pie chart
      const funnel = funnelRes.data?.funnel || [];
      const summary = funnelRes.data?.summary || {};
      setSalesFunnel(Object.entries(summary).filter(([k, v]) => v > 0 && k !== 'total').map(([k, v]) => ({
        name: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: v,
      })));
      
      // Expense treemap
      setExpenseTree((treeRes.data?.tree || []).map(t => ({
        name: t.name,
        value: t.value,
      })));
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-orange-500" size={32} /></div></DashboardLayout>;
  }

  const totalRevenue = kpis?.total_revenue || kpis?.revenue || 0;
  const totalExpenses = kpis?.total_expenses || kpis?.expenses || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
  const totalCustomers = kpis?.total_customers || topCustomers.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="advanced-analytics-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="analytics-dashboard-title">
              <BarChart3 className="text-orange-500" /> Advanced Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Comprehensive business intelligence dashboard</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Button variant="outline" onClick={fetchAll} className="rounded-full h-8 text-xs" data-testid="refresh-analytics">
              <RefreshCw size={12} className="mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="kpi-row">
          <KPICard title="Total Revenue" value={`SAR ${totalRevenue.toLocaleString()}`} icon={DollarSign} color="green" trend={kpis?.revenue_trend} />
          <KPICard title="Total Expenses" value={`SAR ${totalExpenses.toLocaleString()}`} icon={ShoppingCart} color="red" trend={kpis?.expense_trend} />
          <KPICard title="Net Profit" value={`SAR ${netProfit.toLocaleString()}`} subValue={`${profitMargin.toFixed(1)}% margin`} icon={TrendingUp} color={netProfit >= 0 ? 'green' : 'red'} />
          <KPICard title="Customers" value={totalCustomers.toLocaleString()} icon={Users} color="blue" />
          <KPICard title="Avg Order" value={`SAR ${(kpis?.avg_order_value || 0).toFixed(0)}`} icon={Target} color="purple" />
        </div>

        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="revenue" className="text-xs" data-testid="tab-revenue"><TrendingUp size={12} className="mr-1" /> Revenue</TabsTrigger>
            <TabsTrigger value="cashflow" className="text-xs" data-testid="tab-cashflow"><Activity size={12} className="mr-1" /> Cash Flow</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs" data-testid="tab-customers"><Users size={12} className="mr-1" /> Customers</TabsTrigger>
            <TabsTrigger value="branches" className="text-xs" data-testid="tab-branches"><Package size={12} className="mr-1" /> Branches</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs" data-testid="tab-expenses"><DollarSign size={12} className="mr-1" /> Expenses</TabsTrigger>
          </TabsList>

          {/* Revenue Tab */}
          <TabsContent value="revenue">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="revenue-trend-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-outfit">Revenue Trend</CardTitle>
                  <CardDescription className="text-xs">Daily revenue over the period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={salesTrend.slice(-30)}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || ''} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [`SAR ${Number(v).toLocaleString()}`, 'Revenue']} />
                      <Area type="monotone" dataKey="total" stroke="#f97316" fill="url(#colorRev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="sales-funnel-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-outfit">Sales by Payment Mode</CardTitle>
                  <CardDescription className="text-xs">Revenue distribution by payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  {salesFunnel.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={salesFunnel} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {salesFunnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `SAR ${Number(v).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No sales data available</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow">
            <Card data-testid="cashflow-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-outfit">Cash Flow Waterfall</CardTitle>
                <CardDescription className="text-xs">Income and expense flow over time</CardDescription>
              </CardHeader>
              <CardContent>
                {cashflow.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={cashflow}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `SAR ${Number(v).toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net" fill="#f97316" name="Net" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">No cash flow data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab - Shows Top Suppliers by Volume */}
          <TabsContent value="customers">
            <Card data-testid="top-customers-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-outfit">Top Suppliers by Transaction Volume</CardTitle>
                <CardDescription className="text-xs">Your highest-volume suppliers with expense & payment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {topCustomers.length > 0 ? (
                  <div className="space-y-2">
                    {topCustomers.sort((a, b) => (b.total_expenses + b.total_paid) - (a.total_expenses + a.total_paid)).slice(0, 10).map((c, i) => {
                      const total = c.total_expenses + c.total_paid;
                      const maxVal = topCustomers.reduce((m, s) => Math.max(m, s.total_expenses + s.total_paid), 1);
                      const pct = (total / maxVal) * 100;
                      return (
                        <div key={c.id || i} className="flex items-center gap-3" data-testid={`supplier-bar-${i}`}>
                          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium truncate">{c.name}</span>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-red-600">Exp: SAR {c.total_expenses?.toLocaleString()}</span>
                                <span className="text-green-600">Paid: SAR {c.total_paid?.toLocaleString()}</span>
                                <Badge variant="outline" className="text-[10px]">{c.transaction_count} txns</Badge>
                              </div>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No supplier data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branches Tab */}
          <TabsContent value="branches">
            <Card data-testid="branch-radar-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-outfit">Branch Performance Comparison</CardTitle>
                <CardDescription className="text-xs">Multi-dimensional branch analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {branchRadar.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={branchRadar}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} />
                      {branchRadar[0] && Object.keys(branchRadar[0]).filter(k => k !== 'metric').map((key, i) => (
                        <Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                      ))}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">No branch data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card data-testid="expense-breakdown-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-outfit">Expense Breakdown by Category</CardTitle>
                <CardDescription className="text-xs">Where your money is going</CardDescription>
              </CardHeader>
              <CardContent>
                {expenseTree.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={expenseTree.slice(0, 8)} cx="50%" cy="50%" outerRadius={100} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name?.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}>
                          {expenseTree.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `SAR ${Number(v).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {expenseTree.slice(0, 10).map((item, i) => (
                        <div key={item.name || i} className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-sm">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold">SAR {item.value?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No expense data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
