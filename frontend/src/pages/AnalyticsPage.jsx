import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Target, Calendar, BarChart3, PieChart as PieIcon, Download, Brain, Plus, Zap, Package, Users, ShieldAlert, AlertTriangle, Wallet, Clock, UserCheck, Bell, Truck, Crown, Activity, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
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
  // New AI Analytics States
  const [cashflowPrediction, setCashflowPrediction] = useState(null);
  const [seasonalForecast, setSeasonalForecast] = useState(null);
  const [employeePerformance, setEmployeePerformance] = useState(null);
  const [expenseAnomalies, setExpenseAnomalies] = useState(null);
  const [supplierOptimization, setSupplierOptimization] = useState(null);
  // New Prediction Models
  const [inventoryDemand, setInventoryDemand] = useState(null);
  const [customerCLV, setCustomerCLV] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [profitDecomp, setProfitDecomp] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tvyR, dsR, tcR, cpR, cbR, bR] = await Promise.all([
        api.get('/dashboard/today-vs-yesterday'),
        api.get('/reports/daily-summary'),
        api.get('/reports/top-customers'),
        api.get('/reports/cashier-performance'),
        api.get('/reports/branch-cashbank'),
        Promise.resolve({ data: [] }),
      ]);
      setTodayVsYest(tvyR.data); setDailySummary(dsR.data); setTopCustomers(tcR.data);
      setCashierPerf(cpR.data); setBranchCashBank(cbR.data); // branches from store
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

  const loadAiSection = async (section) => {
    setAiTab(section);
    try {
      if (section === 'expense_forecast' && !expenseForecast) {
        const { data } = await api.get('/reports/expense-forecast'); setExpenseForecast(data);
      } else if (section === 'stock_reorder' && !stockReorder) {
        const { data } = await api.get('/reports/stock-reorder'); setStockReorder(data);
      } else if (section === 'revenue_trends' && !revenueTrends) {
        const { data } = await api.get('/reports/revenue-trends'); setRevenueTrends(data);
      } else if (section === 'customer_churn' && !customerChurn) {
        const { data } = await api.get('/reports/customer-churn'); setCustomerChurn(data);
      } else if (section === 'margin_optimizer' && !marginOptimizer) {
        const { data } = await api.get('/reports/margin-optimizer'); setMarginOptimizer(data);
      } else if (section === 'cashflow_prediction' && !cashflowPrediction) {
        const { data } = await api.get('/reports/cashflow-prediction'); setCashflowPrediction(data);
      } else if (section === 'seasonal_forecast' && !seasonalForecast) {
        const { data } = await api.get('/reports/seasonal-forecast'); setSeasonalForecast(data);
      } else if (section === 'employee_performance' && !employeePerformance) {
        const { data } = await api.get('/reports/employee-performance'); setEmployeePerformance(data);
      } else if (section === 'expense_anomalies' && !expenseAnomalies) {
        const { data } = await api.get('/reports/expense-anomalies'); setExpenseAnomalies(data);
      } else if (section === 'supplier_optimization' && !supplierOptimization) {
        const { data } = await api.get('/reports/supplier-optimization'); setSupplierOptimization(data);
      } else if (section === 'inventory_demand' && !inventoryDemand) {
        const { data } = await api.get('/predictions/inventory-demand'); setInventoryDemand(data);
      } else if (section === 'customer_clv' && !customerCLV) {
        const { data } = await api.get('/predictions/customer-clv'); setCustomerCLV(data);
      } else if (section === 'peak_hours' && !peakHours) {
        const { data } = await api.get('/predictions/peak-hours'); setPeakHours(data);
      } else if (section === 'profit_decomposition' && !profitDecomp) {
        const { data } = await api.get('/predictions/profit-decomposition'); setProfitDecomp(data);
      }
    } catch { toast.error('Failed to load analytics'); }
  };

  useEffect(() => { loadAiSection('expense_forecast'); }, []);

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

        {/* AI Predictive Analytics Hub */}
        <Card className="border-indigo-200 bg-indigo-50/10" data-testid="ai-analytics-hub">
          <CardHeader>
            <CardTitle className="font-outfit text-base flex items-center gap-2"><Zap size={16} className="text-indigo-600" />Predictive Analytics Hub</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={aiTab} onValueChange={loadAiSection}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="expense_forecast" className="text-xs" data-testid="ai-expense-tab">Expense Forecast</TabsTrigger>
                <TabsTrigger value="stock_reorder" className="text-xs" data-testid="ai-stock-tab">Stock Reorder</TabsTrigger>
                <TabsTrigger value="revenue_trends" className="text-xs" data-testid="ai-revenue-tab">Revenue Trends</TabsTrigger>
                <TabsTrigger value="customer_churn" className="text-xs" data-testid="ai-churn-tab">Customer Churn</TabsTrigger>
                <TabsTrigger value="margin_optimizer" className="text-xs" data-testid="ai-margin-tab">Margin Optimizer</TabsTrigger>
                <TabsTrigger value="cashflow_prediction" className="text-xs" data-testid="ai-cashflow-tab"><Wallet size={12} className="mr-1" />Cash Flow</TabsTrigger>
                <TabsTrigger value="seasonal_forecast" className="text-xs" data-testid="ai-seasonal-tab"><Clock size={12} className="mr-1" />Seasonal</TabsTrigger>
                <TabsTrigger value="employee_performance" className="text-xs" data-testid="ai-employee-tab"><UserCheck size={12} className="mr-1" />Team Score</TabsTrigger>
                <TabsTrigger value="expense_anomalies" className="text-xs" data-testid="ai-anomalies-tab"><Bell size={12} className="mr-1" />Alerts</TabsTrigger>
                <TabsTrigger value="supplier_optimization" className="text-xs" data-testid="ai-supplier-tab"><Truck size={12} className="mr-1" />Suppliers</TabsTrigger>
                <TabsTrigger value="inventory_demand" className="text-xs" data-testid="ai-demand-tab"><Package size={12} className="mr-1" />Demand</TabsTrigger>
                <TabsTrigger value="customer_clv" className="text-xs" data-testid="ai-clv-tab"><Crown size={12} className="mr-1" />CLV</TabsTrigger>
                <TabsTrigger value="peak_hours" className="text-xs" data-testid="ai-peak-tab"><Activity size={12} className="mr-1" />Peak Hours</TabsTrigger>
                <TabsTrigger value="profit_decomposition" className="text-xs" data-testid="ai-profit-tab"><Layers size={12} className="mr-1" />Profit</TabsTrigger>
              </TabsList>

              {/* Expense Forecast */}
              <TabsContent value="expense_forecast">
                {expenseForecast ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Predicted Expenses for {expenseForecast.next_month}</p>
                        <p className="text-2xl font-bold text-red-600 font-outfit" data-testid="expense-forecast-total">{fmt(expenseForecast.total_predicted)}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Based on 6-month trends</Badge>
                    </div>
                    {expenseForecast.history?.length > 0 && (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={expenseForecast.history}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Bar dataKey="total" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {expenseForecast.categories?.slice(0, 9).map(c => (
                        <div key={c.category} className="flex items-center justify-between p-2.5 bg-white rounded-lg border text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${c.trend === 'up' ? 'bg-red-500' : c.trend === 'down' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                            <span className="font-medium truncate">{c.category}</span>
                          </div>
                          <span className="font-bold text-stone-700 shrink-0 ml-2">{fmt(c.predicted)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading expense forecast...</p>}
              </TabsContent>

              {/* Stock Reorder */}
              <TabsContent value="stock_reorder">
                {stockReorder ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-500">Total Items</p>
                        <p className="text-xl font-bold font-outfit">{stockReorder.total_items}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center" data-testid="items-needing-reorder">
                        <p className="text-xs text-red-600">Need Reorder</p>
                        <p className="text-xl font-bold font-outfit text-red-700">{stockReorder.items_needing_reorder}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Tracked</p>
                        <p className="text-xl font-bold font-outfit text-emerald-700">{stockReorder.predictions?.length || 0}</p>
                      </div>
                    </div>
                    {stockReorder.predictions?.length > 0 ? (
                      <div className="space-y-2">
                        {stockReorder.predictions.slice(0, 15).map(p => (
                          <div key={p.item_id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border ${p.urgency === 'critical' ? 'bg-red-50 border-red-200' : p.urgency === 'soon' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`} data-testid={`reorder-${p.item_id}`}>
                            <div className="flex items-center gap-2 min-w-0 mb-1 sm:mb-0">
                              <Badge className={`text-[9px] shrink-0 ${p.urgency === 'critical' ? 'bg-red-500' : p.urgency === 'soon' ? 'bg-amber-500' : p.urgency === 'normal' ? 'bg-blue-500' : 'bg-emerald-500'}`}>{p.urgency}</Badge>
                              <span className="text-sm font-medium truncate">{p.item_name}</span>
                              {p.category && <span className="text-xs text-stone-400">({p.category})</span>}
                            </div>
                            <div className="flex items-center gap-4 text-xs shrink-0">
                              <span>Balance: <b>{p.current_balance}</b> {p.unit}</span>
                              <span>Usage: <b>{p.daily_usage}</b>/day</span>
                              <span>Days Left: <b className={p.days_left <= 7 ? 'text-red-600' : 'text-stone-700'}>{p.days_left}</b></span>
                              <span>Reorder by: <b>{p.reorder_date}</b></span>
                              <span className="text-blue-600">Order: <b>{p.suggested_reorder_qty}</b> {p.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-muted-foreground py-6">No items with usage data to predict reorder timing.</p>}
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading stock reorder predictions...</p>}
              </TabsContent>

              {/* Revenue Trends */}
              <TabsContent value="revenue_trends">
                {revenueTrends ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Avg Weekly Growth</p>
                        <p className={`text-lg font-bold font-outfit ${revenueTrends.growth?.avg_weekly >= 0 ? 'text-emerald-600' : 'text-red-600'}`} data-testid="avg-weekly-growth">{revenueTrends.growth?.avg_weekly > 0 ? '+' : ''}{revenueTrends.growth?.avg_weekly}%</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-purple-600">Avg Monthly Growth</p>
                        <p className={`text-lg font-bold font-outfit ${revenueTrends.growth?.avg_monthly >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{revenueTrends.growth?.avg_monthly > 0 ? '+' : ''}{revenueTrends.growth?.avg_monthly}%</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Predicted Next Week</p>
                        <p className="text-lg font-bold font-outfit text-emerald-700" data-testid="predicted-next-week">{fmt(revenueTrends.growth?.predicted_next_week)}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-orange-600">Weekly Data Points</p>
                        <p className="text-lg font-bold font-outfit text-orange-700">{revenueTrends.weekly?.length || 0}</p>
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Weekly Revenue Trend</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={revenueTrends.weekly}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Area type="monotone" dataKey="sales" name="Sales" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2} />
                            <Area type="monotone" dataKey="profit" name="Profit" stroke="#F5841F" fill="#F5841F" fillOpacity={0.1} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Monthly Revenue Trend</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={revenueTrends.monthly}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Legend />
                            <Bar dataKey="sales" name="Sales" fill="#22C55E" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading revenue trends...</p>}
              </TabsContent>

              {/* Customer Churn */}
              <TabsContent value="customer_churn">
                {customerChurn ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="churn-summary">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Active</p>
                        <p className="text-xl font-bold font-outfit text-emerald-700">{customerChurn.summary?.active}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Medium Risk</p>
                        <p className="text-xl font-bold font-outfit text-amber-700">{customerChurn.summary?.medium_risk}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">High Risk</p>
                        <p className="text-xl font-bold font-outfit text-red-700">{customerChurn.summary?.high_risk}</p>
                      </div>
                      <div className="bg-stone-100 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-600">Lost</p>
                        <p className="text-xl font-bold font-outfit text-stone-700">{customerChurn.summary?.lost}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="churn-table">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left p-2">Customer</th><th className="text-left p-2">Phone</th><th className="text-right p-2">Last Purchase</th><th className="text-right p-2">Days Inactive</th><th className="text-right p-2">Purchases</th><th className="text-right p-2">Total Spent</th><th className="text-center p-2">Risk</th>
                        </tr></thead>
                        <tbody>
                          {customerChurn.customers?.slice(0, 20).map(c => (
                            <tr key={c.customer_id} className="border-b hover:bg-stone-50">
                              <td className="p-2 font-medium">{c.name}</td>
                              <td className="p-2 text-stone-500">{c.phone || '-'}</td>
                              <td className="p-2 text-right text-xs">{c.last_purchase_date === 'Never' ? 'Never' : c.last_purchase_date?.slice(0, 10)}</td>
                              <td className="p-2 text-right">{c.days_inactive > 900 ? '—' : c.days_inactive}</td>
                              <td className="p-2 text-right">{c.purchase_count}</td>
                              <td className="p-2 text-right">{fmt(c.total_spent)}</td>
                              <td className="p-2 text-center"><Badge className={`text-[9px] ${c.risk_level === 'lost' ? 'bg-stone-500' : c.risk_level === 'high' ? 'bg-red-500' : c.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}>{c.risk_level}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading customer churn analysis...</p>}
              </TabsContent>

              {/* Margin Optimizer */}
              <TabsContent value="margin_optimizer">
                {marginOptimizer ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="margin-summary">
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-600">Items Analyzed</p>
                        <p className="text-xl font-bold font-outfit">{marginOptimizer.total_analyzed}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Star Items</p>
                        <p className="text-xl font-bold font-outfit text-amber-700">{marginOptimizer.stars}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">To Promote</p>
                        <p className="text-xl font-bold font-outfit text-blue-700">{marginOptimizer.to_promote}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">Needs Review</p>
                        <p className="text-xl font-bold font-outfit text-red-700">{marginOptimizer.to_review}</p>
                      </div>
                    </div>
                    {marginOptimizer.items?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="margin-table">
                          <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left p-2">Item</th><th className="text-right p-2">Price</th><th className="text-right p-2">Cost</th><th className="text-right p-2">Margin</th><th className="text-right p-2">Qty Sold</th><th className="text-right p-2">Revenue</th><th className="text-right p-2">Profit</th><th className="text-center p-2">Action</th>
                          </tr></thead>
                          <tbody>
                            {marginOptimizer.items?.slice(0, 20).map(m => (
                              <tr key={m.item_id} className="border-b hover:bg-stone-50">
                                <td className="p-2 font-medium">{m.item_name}</td>
                                <td className="p-2 text-right">{fmt(m.unit_price)}</td>
                                <td className="p-2 text-right text-stone-500">{fmt(m.cost_price)}</td>
                                <td className={`p-2 text-right font-bold ${m.margin_pct >= 40 ? 'text-emerald-600' : m.margin_pct >= 20 ? 'text-blue-600' : 'text-red-600'}`}>{m.margin_pct}%</td>
                                <td className="p-2 text-right">{m.total_qty_sold}</td>
                                <td className="p-2 text-right">{fmt(m.total_revenue)}</td>
                                <td className={`p-2 text-right font-bold ${m.total_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.total_profit)}</td>
                                <td className="p-2 text-center"><Badge className={`text-[9px] ${m.recommendation === 'star' ? 'bg-amber-500' : m.recommendation === 'promote' ? 'bg-blue-500' : m.recommendation === 'review' ? 'bg-red-500' : 'bg-stone-400'}`}>{m.recommendation}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-center text-muted-foreground py-6">No items with sales data to analyze margins.</p>}
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading margin analysis...</p>}
              </TabsContent>

              {/* Cash Flow Prediction */}
              <TabsContent value="cashflow_prediction">
                {cashflowPrediction ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Current Cash</p>
                        <p className="text-lg font-bold font-outfit text-emerald-700" data-testid="current-cash">{fmt(cashflowPrediction.current_cash_balance)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Avg Daily Income</p>
                        <p className="text-lg font-bold font-outfit text-blue-700">{fmt(cashflowPrediction.weekly_patterns?.avg_daily_income)}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">Avg Daily Expense</p>
                        <p className="text-lg font-bold font-outfit text-red-700">{fmt(cashflowPrediction.weekly_patterns?.avg_daily_expense)}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${cashflowPrediction.risk_level === 'high' ? 'bg-red-100' : cashflowPrediction.risk_level === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                        <p className="text-xs text-stone-600">Risk Level</p>
                        <p className={`text-lg font-bold font-outfit capitalize ${cashflowPrediction.risk_level === 'high' ? 'text-red-700' : cashflowPrediction.risk_level === 'medium' ? 'text-amber-700' : 'text-emerald-700'}`} data-testid="cashflow-risk">{cashflowPrediction.risk_level}</p>
                      </div>
                    </div>
                    {cashflowPrediction.low_cash_alerts?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2"><AlertTriangle size={16} />Low Cash Alerts</p>
                        <div className="space-y-1">
                          {cashflowPrediction.low_cash_alerts.map((alert, i) => (
                            <div key={i} className="flex justify-between text-xs text-red-600">
                              <span>{alert.date}</span>
                              <span>Predicted: {fmt(alert.predicted_balance)} (Shortfall: {fmt(alert.shortfall)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-sm font-semibold mb-2">Weekly Pattern Insights</p>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div><span className="text-stone-500">Best Day:</span> <span className="font-bold text-emerald-600">{cashflowPrediction.weekly_patterns?.best_day}</span></div>
                        <div><span className="text-stone-500">Slowest Day:</span> <span className="font-bold text-red-600">{cashflowPrediction.weekly_patterns?.worst_day}</span></div>
                        <div><span className="text-stone-500">Highest Expense:</span> <span className="font-bold text-orange-600">{cashflowPrediction.weekly_patterns?.highest_expense_day}</span></div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={cashflowPrediction.predictions}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Area type="monotone" dataKey="predicted_balance" name="Balance" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading cash flow prediction...</p>}
              </TabsContent>

              {/* Seasonal Forecast */}
              <TabsContent value="seasonal_forecast">
                {seasonalForecast ? (
                  <div className="space-y-4">
                    <div className="bg-purple-50 rounded-xl p-3">
                      <p className="text-sm font-semibold text-purple-700 mb-2">AI Insights</p>
                      <div className="space-y-1">
                        {seasonalForecast.insights?.map((insight, i) => (
                          <p key={i} className="text-xs text-purple-600 flex items-center gap-2"><Zap size={12} />{insight}</p>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-xs text-emerald-600 mb-2 font-semibold">Best Days</p>
                        {seasonalForecast.best_days?.map((d, i) => (
                          <div key={i} className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{d.day}</span>
                            <span className="text-emerald-700 font-bold">{fmt(d.avg_sales)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-red-600 mb-2 font-semibold">Slowest Days</p>
                        {seasonalForecast.worst_days?.slice(-3).reverse().map((d, i) => (
                          <div key={i} className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{d.day}</span>
                            <span className="text-red-700 font-bold">{fmt(d.avg_sales)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Day of Week Performance</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={seasonalForecast.day_of_week_analysis}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Bar dataKey="avg_sales" name="Avg Sales" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Next 7 Days Forecast</p>
                      <div className="grid grid-cols-7 gap-2">
                        {seasonalForecast.next_week_forecast?.map((d, i) => (
                          <div key={i} className="bg-white border rounded-lg p-2 text-center">
                            <p className="text-[10px] text-stone-500">{d.day?.slice(0, 3)}</p>
                            <p className="text-xs font-bold text-purple-600">{fmt(d.predicted_sales)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading seasonal forecast...</p>}
              </TabsContent>

              {/* Employee Performance */}
              <TabsContent value="employee_performance">
                {employeePerformance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Team Size</p>
                        <p className="text-lg font-bold font-outfit text-blue-700">{employeePerformance.team_stats?.total_employees}</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-purple-600">Avg Score</p>
                        <p className="text-lg font-bold font-outfit text-purple-700">{employeePerformance.team_stats?.avg_score}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Top Performers</p>
                        <p className="text-lg font-bold font-outfit text-emerald-700" data-testid="top-performers-count">{employeePerformance.team_stats?.top_performers_count}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">Need Support</p>
                        <p className="text-lg font-bold font-outfit text-red-700">{employeePerformance.team_stats?.needs_improvement_count}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Team Performance Ranking</p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {employeePerformance.employees?.map((emp, i) => (
                          <div key={emp.employee_id} className={`flex items-center justify-between p-3 rounded-xl border ${emp.tier_color === 'emerald' ? 'bg-emerald-50 border-emerald-200' : emp.tier_color === 'blue' ? 'bg-blue-50 border-blue-200' : emp.tier_color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`} data-testid={`employee-${emp.employee_id}`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${emp.tier_color === 'emerald' ? 'bg-emerald-500' : emp.tier_color === 'blue' ? 'bg-blue-500' : emp.tier_color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}>#{i + 1}</span>
                              <div>
                                <p className="text-sm font-medium">{emp.name}</p>
                                <p className="text-[10px] text-stone-500">{emp.branch} • {emp.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <div className="text-right">
                                <p className="text-stone-500">Sales</p>
                                <p className="font-bold">{fmt(emp.metrics?.total_sales)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-stone-500">Score</p>
                                <p className="font-bold text-lg">{emp.scores?.overall}</p>
                              </div>
                              <Badge className={`text-[9px] ${emp.tier_color === 'emerald' ? 'bg-emerald-500' : emp.tier_color === 'blue' ? 'bg-blue-500' : emp.tier_color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}>{emp.tier}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading employee performance...</p>}
              </TabsContent>

              {/* Expense Anomalies */}
              <TabsContent value="expense_anomalies">
                {expenseAnomalies ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-600">Last Month</p>
                        <p className="text-lg font-bold font-outfit">{fmt(expenseAnomalies.spending_trend?.last_month)}</p>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-600">Prev Month</p>
                        <p className="text-lg font-bold font-outfit">{fmt(expenseAnomalies.spending_trend?.previous_month)}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${expenseAnomalies.spending_trend?.change_percent > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <p className="text-xs text-stone-600">Change</p>
                        <p className={`text-lg font-bold font-outfit ${expenseAnomalies.spending_trend?.change_percent > 0 ? 'text-red-600' : 'text-emerald-600'}`} data-testid="spending-change">{expenseAnomalies.spending_trend?.change_percent > 0 ? '+' : ''}{expenseAnomalies.spending_trend?.change_percent}%</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Anomalies</p>
                        <p className="text-lg font-bold font-outfit text-amber-700">{expenseAnomalies.anomalies?.length || 0}</p>
                      </div>
                    </div>
                    {expenseAnomalies.alerts?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2"><Bell size={16} />Alerts</p>
                        {expenseAnomalies.alerts.map((alert, i) => (
                          <p key={i} className={`text-xs mb-1 ${alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`}>{alert.message}</p>
                        ))}
                      </div>
                    )}
                    {expenseAnomalies.anomalies?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Unusual Expenses Detected</p>
                        <div className="space-y-2">
                          {expenseAnomalies.anomalies.map((a, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${a.severity === 'high' ? 'bg-red-50 border-red-200' : a.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                              <div>
                                <p className="text-sm font-medium">{a.category}</p>
                                <p className="text-[10px] text-stone-500">{a.date} • {a.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-red-600">{fmt(a.amount)}</p>
                                <p className="text-[10px] text-stone-500">+{a.deviation_percent}% above avg</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold mb-2">Category Spending Analysis</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {expenseAnomalies.category_analysis?.slice(0, 9).map(c => (
                          <div key={c.category} className="flex items-center justify-between p-2.5 bg-white rounded-lg border text-xs">
                            <div>
                              <span className="font-medium">{c.category}</span>
                              <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${c.trend === 'increasing' ? 'bg-red-100 text-red-600' : c.trend === 'decreasing' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-600'}`}>{c.trend}</span>
                            </div>
                            <span className="font-bold">{fmt(c.monthly_total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading expense analysis...</p>}
              </TabsContent>

              {/* Supplier Optimization */}
              <TabsContent value="supplier_optimization">
                {supplierOptimization ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-600">Suppliers</p>
                        <p className="text-lg font-bold font-outfit">{supplierOptimization.summary?.total_suppliers}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">Total Pending</p>
                        <p className="text-lg font-bold font-outfit text-red-700" data-testid="total-pending">{fmt(supplierOptimization.summary?.total_pending_amount)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Critical</p>
                        <p className="text-lg font-bold font-outfit text-amber-700">{supplierOptimization.summary?.critical_count}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${supplierOptimization.cash_impact?.can_afford_all ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-stone-600">After Payments</p>
                        <p className={`text-lg font-bold font-outfit ${supplierOptimization.cash_impact?.can_afford_all ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(supplierOptimization.cash_impact?.cash_after_payments)}</p>
                      </div>
                    </div>
                    {supplierOptimization.urgent_payments?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2"><AlertTriangle size={16} />Urgent Payments</p>
                        <div className="space-y-2">
                          {supplierOptimization.urgent_payments.map((s, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg">
                              <div>
                                <span className="font-medium">{s.name}</span>
                                <Badge className={`ml-2 text-[9px] ${s.priority === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`}>{s.priority}</Badge>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-red-600">{fmt(s.current_balance)}</p>
                                <p className="text-stone-500">Pay: {fmt(s.recommended_payment)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold mb-2">Recommended Payment Schedule</p>
                      {supplierOptimization.recommended_schedule?.length > 0 ? (
                        <div className="space-y-2">
                          {supplierOptimization.recommended_schedule.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                <div>
                                  <p className="text-sm font-medium">{s.supplier}</p>
                                  <p className="text-[10px] text-stone-500">Due: {s.date}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-blue-600">{fmt(s.amount)}</p>
                                <Badge className={`text-[9px] ${s.priority === 'critical' ? 'bg-red-500' : s.priority === 'high' ? 'bg-amber-500' : 'bg-stone-400'}`}>{s.priority}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-center text-muted-foreground py-4">No pending payments to schedule</p>}
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading supplier optimization...</p>}
              </TabsContent>

              {/* Inventory Demand Forecast */}
              <TabsContent value="inventory_demand">
                {inventoryDemand ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Items Tracked</p>
                        <p className="text-xl font-bold font-outfit text-blue-700" data-testid="demand-tracked">{inventoryDemand.total_items_tracked}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600">At Risk</p>
                        <p className="text-xl font-bold font-outfit text-red-700" data-testid="demand-risk">{inventoryDemand.items_at_risk}</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-purple-600">Forecast Period</p>
                        <p className="text-sm font-bold font-outfit text-purple-700">{inventoryDemand.forecast_period}</p>
                      </div>
                    </div>
                    {inventoryDemand.items?.length > 0 ? (
                      <div className="space-y-3">
                        {inventoryDemand.items.slice(0, 15).map(item => (
                          <div key={item.item_id} className={`p-3 rounded-xl border ${!item.stock_sufficient ? 'bg-red-50 border-red-200' : 'bg-white'}`} data-testid={`demand-${item.item_id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{item.item_name}</span>
                                <Badge className={`text-[9px] ${item.trend === 'increasing' ? 'bg-red-500' : item.trend === 'decreasing' ? 'bg-emerald-500' : 'bg-stone-400'}`}>{item.trend} {item.trend_percent > 0 ? '+' : ''}{item.trend_percent}%</Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span>Stock: <b>{item.current_stock}</b> {item.unit}</span>
                                <span>Demand: <b>{item.avg_daily_demand}</b>/day</span>
                                <span className={item.days_until_stockout <= 7 ? 'text-red-600 font-bold' : ''}>Stockout in: <b>{item.days_until_stockout}</b> days</span>
                              </div>
                            </div>
                            {item.dow_pattern && (
                              <div className="flex gap-1">
                                {item.dow_pattern.map(d => (
                                  <div key={d.day} className="flex-1 bg-stone-50 rounded p-1 text-center">
                                    <p className="text-[9px] text-stone-400">{d.day}</p>
                                    <p className="text-[10px] font-bold">{d.avg_demand}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-muted-foreground py-6">No items with demand data to forecast.</p>}
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading inventory demand forecast...</p>}
              </TabsContent>

              {/* Customer Lifetime Value */}
              <TabsContent value="customer_clv">
                {customerCLV ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-purple-600">Total Customers</p>
                        <p className="text-xl font-bold font-outfit text-purple-700" data-testid="clv-total">{customerCLV.total_customers}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Projected Revenue</p>
                        <p className="text-lg font-bold font-outfit text-emerald-700" data-testid="clv-revenue">{fmt(customerCLV.total_projected_revenue)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Avg CLV</p>
                        <p className="text-lg font-bold font-outfit text-amber-700">{fmt(customerCLV.avg_clv)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Segments</p>
                        <div className="flex justify-center gap-1 mt-1">
                          {Object.entries(customerCLV.segments || {}).map(([k, v]) => (
                            <Badge key={k} variant="outline" className={`text-[9px] ${k === 'Platinum' ? 'border-purple-300' : k === 'Gold' ? 'border-amber-300' : k === 'Silver' ? 'border-blue-300' : 'border-stone-300'}`}>{k}: {v}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="clv-table">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left p-2">Customer</th><th className="text-right p-2">Orders</th><th className="text-right p-2">Avg Order</th><th className="text-right p-2">Frequency</th><th className="text-right p-2">Retention</th><th className="text-right p-2">Annual CLV</th><th className="text-center p-2">Segment</th>
                        </tr></thead>
                        <tbody>
                          {customerCLV.customers?.slice(0, 20).map(c => (
                            <tr key={c.customer_id} className="border-b hover:bg-stone-50">
                              <td className="p-2 font-medium">{c.name}</td>
                              <td className="p-2 text-right">{c.order_count}</td>
                              <td className="p-2 text-right">{fmt(c.avg_order_value)}</td>
                              <td className="p-2 text-right">{c.purchase_frequency}/mo</td>
                              <td className="p-2 text-right">{c.retention_probability}%</td>
                              <td className="p-2 text-right font-bold text-emerald-600">{fmt(c.predicted_annual_clv)}</td>
                              <td className="p-2 text-center"><Badge className={`text-[9px] ${c.segment_color === 'purple' ? 'bg-purple-500' : c.segment_color === 'amber' ? 'bg-amber-500' : c.segment_color === 'blue' ? 'bg-blue-500' : 'bg-stone-400'}`}>{c.segment}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading customer lifetime value...</p>}
              </TabsContent>

              {/* Peak Hours */}
              <TabsContent value="peak_hours">
                {peakHours ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-xs text-emerald-600 font-semibold mb-2">Peak Hours</p>
                        {peakHours.peak_hours?.map((h, i) => (
                          <div key={i} className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{h.label}</span>
                            <span className="text-emerald-700 font-bold">{h.avg_orders_per_day} orders/day ({h.share_percent}%)</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-red-600 font-semibold mb-2">Slow Hours</p>
                        {peakHours.slow_hours?.map((h, i) => (
                          <div key={i} className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{h.label}</span>
                            <span className="text-red-700 font-bold">{h.avg_orders_per_day} orders/day</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {peakHours.recommendations?.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2"><Zap size={14} />Staffing Recommendations</p>
                        {peakHours.recommendations.map((r, i) => (
                          <p key={i} className="text-xs text-blue-600 mb-1">• {r}</p>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold mb-2">Hourly Order Distribution</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={peakHours.hourly_analysis?.filter(h => h.total_orders > 0)}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="avg_orders_per_day" name="Avg Orders/Day" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">{peakHours.total_transactions_analyzed} transactions analyzed • {peakHours.period}</p>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading peak hours analysis...</p>}
              </TabsContent>

              {/* Profit Decomposition */}
              <TabsContent value="profit_decomposition">
                {profitDecomp ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600">Avg Daily Profit</p>
                        <p className="text-lg font-bold font-outfit text-emerald-700" data-testid="profit-avg">{fmt(profitDecomp.summary?.avg_daily_profit)}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${profitDecomp.summary?.profit_trend === 'improving' ? 'bg-emerald-50' : profitDecomp.summary?.profit_trend === 'declining' ? 'bg-red-50' : 'bg-stone-50'}`}>
                        <p className="text-xs text-stone-600">Trend</p>
                        <p className={`text-lg font-bold font-outfit capitalize ${profitDecomp.summary?.profit_trend === 'improving' ? 'text-emerald-700' : profitDecomp.summary?.profit_trend === 'declining' ? 'text-red-700' : 'text-stone-700'}`} data-testid="profit-trend">{profitDecomp.summary?.profit_trend}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-blue-600">Best Day</p>
                        <p className="text-lg font-bold font-outfit text-blue-700">{profitDecomp.summary?.best_day}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600">Anomalies</p>
                        <p className="text-lg font-bold font-outfit text-amber-700">{profitDecomp.summary?.total_anomalies}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Daily Profit vs Trend</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={profitDecomp.daily?.slice(-60)}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Legend />
                          <Area type="monotone" dataKey="profit" name="Actual Profit" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} strokeWidth={1.5} />
                          <Line type="monotone" dataKey="trend" name="7-Day Trend" stroke="#F5841F" strokeWidth={2.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold mb-2">Day-of-Week Seasonality</p>
                        <div className="space-y-1">
                          {Object.entries(profitDecomp.seasonality || {}).map(([day, val]) => (
                            <div key={day} className="flex items-center gap-2 text-xs">
                              <span className="w-8 font-medium">{day}</span>
                              <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${val >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, Math.abs(val) / Math.max(...Object.values(profitDecomp.seasonality || {}).map(Math.abs), 1) * 100)}%` }} />
                              </div>
                              <span className={`font-bold w-20 text-right ${val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">Monthly P&L</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={profitDecomp.monthly}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Bar dataKey="profit" name="Profit" fill="#22C55E" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {profitDecomp.anomalies?.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Profit Anomalies Detected</p>
                        <div className="space-y-1">
                          {profitDecomp.anomalies.map((a, i) => (
                            <div key={i} className={`flex justify-between p-2 rounded-lg border text-xs ${a.type === 'spike' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                              <span className="font-medium">{a.date} — {a.type === 'spike' ? 'Unusual Spike' : 'Unusual Dip'}</span>
                              <span>Actual: <b>{fmt(a.actual_profit)}</b> vs Expected: <b>{fmt(a.expected)}</b></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Loading profit decomposition...</p>}
              </TabsContent>
            </Tabs>
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
