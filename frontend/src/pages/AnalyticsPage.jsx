import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Target, Calendar, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadialBarChart, RadialBar } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];
const fmt = (v) => `SAR ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [todayVsYest, setTodayVsYest] = useState(null);
  const [dailySummary, setDailySummary] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [cashierPerf, setCashierPerf] = useState([]);
  const [branchCashBank, setBranchCashBank] = useState([]);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('14');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tvyR, dsR, tcR, cpR, cbR, stR] = await Promise.all([
        api.get('/dashboard/today-vs-yesterday'),
        api.get('/reports/daily-summary'),
        api.get('/reports/top-customers'),
        api.get('/reports/cashier-performance'),
        api.get('/reports/branch-cashbank'),
        api.get('/dashboard/stats'),
      ]);
      setTodayVsYest(tvyR.data);
      setDailySummary(dsR.data);
      setTopCustomers(tcR.data);
      setCashierPerf(cpR.data);
      setBranchCashBank(cbR.data);
      setStats(stR.data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading analytics...</div></div></DashboardLayout>;

  const tvy = todayVsYest || { today: {}, yesterday: {}, change: {} };
  const dayData = dailySummary.slice(0, parseInt(period)).reverse();
  const totalRevenue = dailySummary.reduce((s, d) => s + d.sales, 0);
  const totalExpenses = dailySummary.reduce((s, d) => s + d.expenses, 0);
  const avgDailySales = dailySummary.length > 0 ? totalRevenue / dailySummary.length : 0;
  const bestDay = dailySummary.reduce((best, d) => d.sales > (best?.sales || 0) ? d : best, null);
  const worstDay = dailySummary.filter(d => d.sales > 0).reduce((worst, d) => d.sales < (worst?.sales || Infinity) ? d : worst, null);

  const profitMarginData = dayData.map(d => ({
    date: d.date.slice(5),
    margin: d.sales > 0 ? Math.round((d.sales - d.expenses) / d.sales * 100) : 0,
    sales: d.sales,
  }));

  const cumulativeData = dayData.reduce((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : { cumSales: 0, cumExp: 0 };
    acc.push({ date: d.date.slice(5), cumSales: prev.cumSales + d.sales, cumExp: prev.cumExp + d.expenses, cumProfit: (prev.cumSales + d.sales) - (prev.cumExp + d.expenses) });
    return acc;
  }, []);

  const paymentMixData = dailySummary.reduce((acc, d) => {
    acc.cash += d.cash || 0;
    acc.bank += d.bank || 0;
    acc.online += d.online || 0;
    acc.credit += d.credit || 0;
    return acc;
  }, { cash: 0, bank: 0, online: 0, credit: 0 });
  const paymentPie = Object.entries(paymentMixData).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));

  const ChgBadge = ({ value, invert }) => {
    if (value === null || value === undefined) return null;
    const isGood = invert ? value < 0 : value > 0;
    return (
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} data-testid={`chg-badge`}>
        {value > 0 ? '+' : ''}{value}%
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="analytics-page">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="analytics-title">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Deep insights into business performance</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchAll}>Refresh</Button>
          </div>
        </div>

        {/* Today vs Yesterday Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="tvy-cards">
          {[
            { label: 'Today Sales', value: tvy.today.sales, change: tvy.change.sales, icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Today Expenses', value: tvy.today.expenses, change: tvy.change.expenses, invert: true, icon: TrendingDown, color: 'text-red-600' },
            { label: 'Today Profit', value: tvy.today.profit, change: tvy.change.profit, icon: Target, color: tvy.today.profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Transactions', value: tvy.today.count, change: tvy.change.count, icon: BarChart3, color: 'text-blue-600', isCurrency: false },
            { label: 'Cash Today', value: tvy.today.cash, change: tvy.change.cash, icon: PieIcon, color: 'text-emerald-600' },
            { label: 'Bank Today', value: tvy.today.bank, change: tvy.change.bank, icon: PieIcon, color: 'text-blue-600' },
          ].map(c => (
            <Card key={c.label} className="border-stone-100"><CardContent className="p-3">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] text-muted-foreground font-medium">{c.label}</p>
                <ChgBadge value={c.change} invert={c.invert} />
              </div>
              <p className={`text-base sm:text-lg font-bold font-outfit ${c.color}`} data-testid={`tvy-${c.label.toLowerCase().replace(/\s/g,'-')}`}>
                {c.isCurrency === false ? (c.value || 0) : fmt(c.value || 0)}
              </p>
              <p className="text-[9px] text-muted-foreground">Yesterday: {c.isCurrency === false ? (c.label === 'Transactions' ? tvy.yesterday?.count : '-') : fmt(c.label.includes('Sales') ? tvy.yesterday?.sales : c.label.includes('Exp') ? tvy.yesterday?.expenses : c.label.includes('Profit') ? tvy.yesterday?.profit : c.label.includes('Cash') ? tvy.yesterday?.cash : tvy.yesterday?.bank || 0)}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-orange-100 bg-orange-50/30"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-orange-600 font-medium">Avg Daily Sales</p>
            <p className="text-lg font-bold font-outfit text-orange-700">{fmt(avgDailySales)}</p>
          </CardContent></Card>
          {bestDay && <Card className="border-emerald-100 bg-emerald-50/30"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-medium">Best Day</p>
            <p className="text-lg font-bold font-outfit text-emerald-700">{fmt(bestDay.sales)}</p>
            <p className="text-[9px] text-muted-foreground">{bestDay.date}</p>
          </CardContent></Card>}
          {worstDay && <Card className="border-red-100 bg-red-50/30"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">Slowest Day</p>
            <p className="text-lg font-bold font-outfit text-red-700">{fmt(worstDay.sales)}</p>
            <p className="text-[9px] text-muted-foreground">{worstDay.date}</p>
          </CardContent></Card>}
          <Card className="border-blue-100 bg-blue-50/30"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium">Total Revenue</p>
            <p className="text-lg font-bold font-outfit text-blue-700">{fmt(totalRevenue)}</p>
          </CardContent></Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Sales vs Expenses */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base flex items-center gap-2"><Calendar size={16} />Daily Sales vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dayData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Profit Margin Trend */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base flex items-center gap-2"><Target size={16} />Profit Margin Trend (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={profitMarginData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v, name) => name === 'margin' ? `${v}%` : fmt(v)} />
                  <Area type="monotone" dataKey="margin" stroke="#F5841F" fill="#F5841F" fillOpacity={0.15} strokeWidth={2} dot={{ fill: '#F5841F', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cumulative Revenue */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Cumulative Revenue & Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="cumSales" name="Revenue" stroke="#22C55E" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="cumExp" name="Expenses" stroke="#EF4444" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="cumProfit" name="Profit" stroke="#F5841F" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment Mix */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Payment Method Distribution</CardTitle></CardHeader>
            <CardContent>
              {paymentPie.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={paymentPie} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {paymentPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-center text-muted-foreground py-12">No payment data</p>}
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Customers */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Top 5 Customers</CardTitle></CardHeader>
            <CardContent>
              {topCustomers.length > 0 ? (
                <div className="space-y-2">
                  {topCustomers.slice(0, 5).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-lg" data-testid={`top-customer-${i}`}>
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 text-white text-xs font-bold flex items-center justify-center shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.transaction_count} transactions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{fmt(c.total_purchases)}</p>
                        {c.credit_outstanding > 0 && <p className="text-[10px] text-red-500">Due: {fmt(c.credit_outstanding)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">No customer data</p>}
            </CardContent>
          </Card>

          {/* Top 5 Cashiers */}
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Top 5 Cashiers</CardTitle></CardHeader>
            <CardContent>
              {cashierPerf.length > 0 ? (
                <div className="space-y-2">
                  {cashierPerf.slice(0, 5).map((u, i) => (
                    <div key={u.user_id} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-lg" data-testid={`top-cashier-${i}`}>
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 text-white text-xs font-bold flex items-center justify-center shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground">{u.branch} - {u.transaction_count} sales</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">{fmt(u.total_sales)}</p>
                        <p className="text-[10px] text-muted-foreground">Avg: {fmt(u.avg_transaction)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">No cashier data</p>}
            </CardContent>
          </Card>
        </div>

        {/* Branch Performance */}
        {branchCashBank.length > 0 && (
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Branch Performance Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchCashBank.map(b => ({
                  name: b.branch_name,
                  'Sales': (b.sales_cash || 0) + (b.sales_bank || 0),
                  'Expenses': (b.expenses_cash || 0) + (b.expenses_bank || 0),
                  'Net': ((b.sales_cash || 0) + (b.sales_bank || 0)) - ((b.expenses_cash || 0) + (b.expenses_bank || 0)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net" fill="#F5841F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
