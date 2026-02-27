import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Target, Calendar, BarChart3, PieChart as PieIcon, Download, Brain, Plus, Zap, Package, Users, ShieldAlert, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];
const fmt = (v) => `SAR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [todayVsYest, setTodayVsYest] = useState(null);
  const [dailySummary, setDailySummary] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [cashierPerf, setCashierPerf] = useState([]);
  const [branchCashBank, setBranchCashBank] = useState([]);
  const [period, setPeriod] = useState('14');
  const [targetProgress, setTargetProgress] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [targetForm, setTargetForm] = useState({ branch_id: '', target_amount: '' });
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  const [expenseForecast, setExpenseForecast] = useState(null);
  const [stockReorder, setStockReorder] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState(null);
  const [customerChurn, setCustomerChurn] = useState(null);
  const [marginOptimizer, setMarginOptimizer] = useState(null);
  const [aiTab, setAiTab] = useState('expense_forecast');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tvyR, dsR, tcR, cpR, cbR, bR] = await Promise.all([
        api.get('/dashboard/today-vs-yesterday'),
        api.get('/reports/daily-summary'),
        api.get('/reports/top-customers'),
        api.get('/reports/cashier-performance'),
        api.get('/reports/branch-cashbank'),
        api.get('/branches'),
      ]);
      setTodayVsYest(tvyR.data); setDailySummary(dsR.data); setTopCustomers(tcR.data);
      setCashierPerf(cpR.data); setBranchCashBank(cbR.data); setBranches(bR.data);
      try { const tp = await api.get(`/targets/progress?month=${targetMonth}`); setTargetProgress(tp.data); } catch {}
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const loadForecast = async () => {
    setForecastLoading(true);
    try { const { data } = await api.get('/reports/sales-forecast'); setForecast(data); }
    catch { toast.error('Forecast failed'); }
    finally { setForecastLoading(false); }
  };

  const saveTarget = async () => {
    try {
      await api.post('/targets', { branch_id: targetForm.branch_id, month: targetMonth, target_amount: parseFloat(targetForm.target_amount) });
      toast.success('Target saved');
      setShowTargetDialog(false); setTargetForm({ branch_id: '', target_amount: '' });
      const tp = await api.get(`/targets/progress?month=${targetMonth}`); setTargetProgress(tp.data);
    } catch { toast.error('Failed'); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/analytics-pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.download = 'ssc_analytics_report.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading analytics...</div></div></DashboardLayout>;

  const tvy = todayVsYest || { today: {}, yesterday: {}, change: {} };
  const dayData = dailySummary.slice(0, parseInt(period)).reverse();
  const totalRevenue = dailySummary.reduce((s, d) => s + d.sales, 0);
  const avgDailySales = dailySummary.length > 0 ? totalRevenue / dailySummary.length : 0;
  const bestDay = dailySummary.reduce((best, d) => d.sales > (best?.sales || 0) ? d : best, null);
  const worstDay = dailySummary.filter(d => d.sales > 0).reduce((worst, d) => d.sales < (worst?.sales || Infinity) ? d : worst, null);

  const profitMarginData = dayData.map(d => ({ date: d.date.slice(5), margin: d.sales > 0 ? Math.round((d.sales - d.expenses) / d.sales * 100) : 0 }));
  const cumulativeData = dayData.reduce((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : { cumSales: 0, cumExp: 0 };
    acc.push({ date: d.date.slice(5), cumSales: prev.cumSales + d.sales, cumExp: prev.cumExp + d.expenses, cumProfit: (prev.cumSales + d.sales) - (prev.cumExp + d.expenses) });
    return acc;
  }, []);
  const paymentMixData = dailySummary.reduce((acc, d) => { acc.cash += d.cash || 0; acc.bank += d.bank || 0; acc.online += d.online || 0; acc.credit += d.credit || 0; return acc; }, { cash: 0, bank: 0, online: 0, credit: 0 });
  const paymentPie = Object.entries(paymentMixData).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));

  const ChgBadge = ({ value, invert }) => {
    if (value === null || value === undefined) return null;
    const isGood = invert ? value < 0 : value > 0;
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isGood ? 'bg-emerald-100 text-emerald-700' : value === 0 ? 'bg-stone-100 text-stone-500' : 'bg-red-100 text-red-700'}`}>{value > 0 ? '+' : ''}{value}%</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="analytics-page">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="analytics-title">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Deep insights into business performance</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={exportPDF} disabled={exporting} data-testid="export-pdf-btn">
              <Download size={14} className="mr-1" />{exporting ? 'Generating...' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={fetchAll}>Refresh</Button>
          </div>
        </div>

        {/* Today vs Yesterday */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="tvy-cards">
          {[
            { label: 'Today Sales', value: tvy.today.sales, change: tvy.change.sales, color: 'text-emerald-600' },
            { label: 'Today Expenses', value: tvy.today.expenses, change: tvy.change.expenses, invert: true, color: 'text-red-600' },
            { label: 'Today Profit', value: tvy.today.profit, change: tvy.change.profit, color: tvy.today.profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Transactions', value: tvy.today.count, change: tvy.change.count, color: 'text-blue-600', isCurrency: false },
            { label: 'Cash Today', value: tvy.today.cash, change: tvy.change.cash, color: 'text-emerald-600' },
            { label: 'Bank Today', value: tvy.today.bank, change: tvy.change.bank, color: 'text-blue-600' },
          ].map(c => (
            <Card key={c.label} className="border-stone-100"><CardContent className="p-3">
              <div className="flex justify-between items-start mb-1"><p className="text-[10px] text-muted-foreground font-medium">{c.label}</p><ChgBadge value={c.change} invert={c.invert} /></div>
              <p className={`text-base sm:text-lg font-bold font-outfit ${c.color}`}>{c.isCurrency === false ? (c.value || 0) : fmt(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* Key Metrics */}
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

        {/* Sales Target Tracker */}
        <Card className="border-orange-200 bg-orange-50/20" data-testid="target-tracker">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <CardTitle className="font-outfit text-base flex items-center gap-2"><Target size={16} className="text-orange-600" />Sales Target Tracker</CardTitle>
              <div className="flex gap-2 items-center">
                <Input type="month" value={targetMonth} onChange={async (e) => {
                  setTargetMonth(e.target.value);
                  try { const tp = await api.get(`/targets/progress?month=${e.target.value}`); setTargetProgress(tp.data); } catch {}
                }} className="h-8 w-36 text-xs rounded-lg" />
                <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setShowTargetDialog(true)} data-testid="set-target-btn"><Plus size={12} className="mr-1" />Set Target</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {targetProgress && targetProgress.overall.target > 0 ? (
              <div className="space-y-4">
                {/* Overall progress */}
                <div className="p-3 bg-white rounded-xl border border-orange-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">Overall</span>
                    <div className="text-right">
                      <span className="text-lg font-bold font-outfit text-orange-600">{targetProgress.overall.percentage}%</span>
                      <p className="text-[10px] text-muted-foreground">{fmt(targetProgress.overall.actual)} / {fmt(targetProgress.overall.target)}</p>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${targetProgress.overall.percentage >= 100 ? 'bg-emerald-500' : targetProgress.overall.percentage >= 70 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, targetProgress.overall.percentage)}%` }} data-testid="overall-progress-bar" />
                  </div>
                </div>
                {/* Per branch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {targetProgress.branches.filter(b => b.target > 0).map(b => (
                    <div key={b.branch_id} className="p-3 bg-white rounded-xl border" data-testid={`target-branch-${b.branch_id}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium">{b.branch_name}</span>
                        <Badge className={`text-[10px] ${b.percentage >= 100 ? 'bg-emerald-100 text-emerald-700' : b.percentage >= 70 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{b.percentage}%</Badge>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full ${b.percentage >= 100 ? 'bg-emerald-500' : b.percentage >= 70 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, b.percentage)}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Actual: {fmt(b.actual)}</span>
                        <span>Target: {fmt(b.target)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-2">No sales targets set for {targetMonth}</p>
                <Button size="sm" className="rounded-xl" onClick={() => setShowTargetDialog(true)}>Set Monthly Target</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Sales Forecast */}
        <Card className="border-purple-200 bg-purple-50/20" data-testid="forecast-section">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="font-outfit text-base flex items-center gap-2"><Brain size={16} className="text-purple-600" />AI Sales Forecast</CardTitle>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={loadForecast} disabled={forecastLoading} data-testid="load-forecast-btn">
                {forecastLoading ? 'Analyzing...' : 'Generate Forecast'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {forecast ? (
              <div className="space-y-3">
                <Badge variant="outline" className="text-[10px]">Method: {forecast.method === 'ai' ? 'AI-Powered (GPT-4o)' : 'Moving Average'}</Badge>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={[...(forecast.history || []).map(h => ({ date: h.date.slice(5), actual: h.sales })), ...(forecast.forecast || []).map(f => ({ date: f.date.slice(5), predicted: f.predicted_sales }))]}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="actual" name="Actual" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Mobile card view for forecast */}
                <div className="sm:hidden space-y-1">
                  {(forecast.forecast || []).map(f => (
                    <div key={f.date} className="flex justify-between items-center p-2 bg-white rounded-lg border text-xs">
                      <span className="font-medium">{f.date}</span>
                      <span className="font-bold text-purple-600">{fmt(f.predicted_sales)}</span>
                      <Badge variant="outline" className={`text-[9px] ${f.confidence === 'high' ? 'border-emerald-300' : f.confidence === 'medium' ? 'border-orange-300' : 'border-red-300'}`}>{f.confidence}</Badge>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm" data-testid="forecast-table">
                    <thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-right p-2 text-xs font-medium">Predicted Sales</th><th className="text-center p-2 text-xs font-medium">Confidence</th></tr></thead>
                    <tbody>{(forecast.forecast || []).map(f => (
                      <tr key={f.date} className="border-b hover:bg-purple-50/50">
                        <td className="p-2 font-medium">{f.date}</td>
                        <td className="p-2 text-right font-bold text-purple-600">{fmt(f.predicted_sales)}</td>
                        <td className="p-2 text-center"><Badge variant="outline" className={`text-[10px] ${f.confidence === 'high' ? 'border-emerald-300 text-emerald-600' : f.confidence === 'medium' ? 'border-orange-300 text-orange-600' : 'border-red-300 text-red-600'}`}>{f.confidence}</Badge></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain size={32} className="mx-auto text-purple-300 mb-2" />
                <p className="text-sm text-muted-foreground">Click "Generate Forecast" to get AI-powered sales predictions for the next 7 days</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base flex items-center gap-2"><Calendar size={16} />Daily Sales vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dayData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey="sales" name="Sales" fill="#22C55E" radius={[3, 3, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base flex items-center gap-2"><Target size={16} />Profit Margin Trend (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={profitMarginData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v, name) => name === 'margin' ? `${v}%` : fmt(v)} /><Area type="monotone" dataKey="margin" stroke="#F5841F" fill="#F5841F" fillOpacity={0.15} strokeWidth={2} dot={{ fill: '#F5841F', r: 3 }} /></AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Cumulative Revenue & Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cumulativeData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Line type="monotone" dataKey="cumSales" name="Revenue" stroke="#22C55E" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="cumExp" name="Expenses" stroke="#EF4444" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="cumProfit" name="Profit" stroke="#F5841F" strokeWidth={2.5} strokeDasharray="5 5" dot={false} /></LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Payment Method Distribution</CardTitle></CardHeader>
            <CardContent>
              {paymentPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={paymentPie} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{paymentPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-12">No payment data</p>}
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Top 5 Customers</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">{topCustomers.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-lg" data-testid={`top-customer-${i}`}>
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 text-white text-xs font-bold flex items-center justify-center shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-[10px] text-muted-foreground">{c.transaction_count} txns</p></div>
                <div className="text-right"><p className="text-sm font-bold text-emerald-600">{fmt(c.total_purchases)}</p>{c.credit_outstanding > 0 && <p className="text-[10px] text-red-500">Due: {fmt(c.credit_outstanding)}</p>}</div>
              </div>
            ))}{topCustomers.length === 0 && <p className="text-center text-muted-foreground py-4">No data</p>}</div></CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Top 5 Cashiers</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">{cashierPerf.slice(0, 5).map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-lg" data-testid={`top-cashier-${i}`}>
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 text-white text-xs font-bold flex items-center justify-center shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.name}</p><p className="text-[10px] text-muted-foreground">{u.branch} - {u.transaction_count} sales</p></div>
                <div className="text-right"><p className="text-sm font-bold text-blue-600">{fmt(u.total_sales)}</p><p className="text-[10px] text-muted-foreground">Avg: {fmt(u.avg_transaction)}</p></div>
              </div>
            ))}{cashierPerf.length === 0 && <p className="text-center text-muted-foreground py-4">No data</p>}</div></CardContent>
          </Card>
        </div>

        {/* Branch Performance */}
        {branchCashBank.length > 0 && (
          <Card className="border-stone-100">
            <CardHeader><CardTitle className="font-outfit text-base">Branch Performance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchCashBank.map(b => ({ name: b.branch_name, Sales: (b.sales_cash || 0) + (b.sales_bank || 0), Expenses: (b.expenses_cash || 0) + (b.expenses_bank || 0), Net: ((b.sales_cash || 0) + (b.sales_bank || 0)) - ((b.expenses_cash || 0) + (b.expenses_bank || 0)) }))}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey="Sales" fill="#22C55E" radius={[4, 4, 0, 0]} /><Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} /><Bar dataKey="Net" fill="#F5841F" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Set Target Dialog */}
        <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
          <DialogContent className="max-w-sm" data-testid="target-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Set Sales Target</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Month</Label><Input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Branch</Label>
                <Select value={targetForm.branch_id} onValueChange={(v) => setTargetForm(p => ({ ...p, branch_id: v }))}>
                  <SelectTrigger className="h-9" data-testid="target-branch-select"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Target Amount (SAR)</Label><Input type="number" value={targetForm.target_amount} onChange={(e) => setTargetForm(p => ({ ...p, target_amount: e.target.value }))} placeholder="50000" className="h-9" data-testid="target-amount-input" /></div>
              <Button onClick={saveTarget} className="w-full rounded-xl" disabled={!targetForm.branch_id || !targetForm.target_amount} data-testid="save-target-btn">Save Target</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
