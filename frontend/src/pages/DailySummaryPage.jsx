import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarDays, TrendingUp, TrendingDown, DollarSign, ShoppingCart, 
  Receipt, Truck, RefreshCw, ArrowUpRight, ArrowDownRight, 
  CreditCard, Banknote, Clock, Package, CalendarRange, Table, BarChart3
} from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

export default function DailySummaryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [rangeData, setRangeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState('single'); // 'single' or 'range'
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rangeView, setRangeView] = useState('summary'); // 'summary' or 'daily'
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => { _fetchBr(); }, []);

  useEffect(() => {
    if (mode === 'single') fetchSummary();
  }, [selectedDate, selectedBranch]);

  useEffect(() => {
    if (mode === 'range') fetchRangeSummary();
  }, [startDate, endDate, selectedBranch]);

  useEffect(() => {
    if (mode === 'single') fetchSummary();
    else fetchRangeSummary();
  }, [mode]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedBranch) params.append('branch_id', selectedBranch);
      const res = await api.get(`/dashboard/daily-summary?${params.toString()}`);
      setData(res.data);
    } catch {
      toast.error('Failed to load daily summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchRangeSummary = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (selectedBranch) params.append('branch_id', selectedBranch);
      const res = await api.get(`/dashboard/daily-summary-range?${params.toString()}`);
      setRangeData(res.data);
    } catch {
      toast.error('Failed to load range summary');
    } finally {
      setLoading(false);
    }
  };

  const quickDateSelect = (days) => {
    setSelectedDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
  };

  const quickRangeSelect = (days) => {
    setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const formatCurrency = (val) => `SAR ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading && !data && !rangeData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="daily-summary-title">
              {mode === 'single' ? 'Daily Summary' : 'Range Summary'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'single' ? 'Quick overview of daily business activity' : `${startDate} to ${endDate}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            {/* Mode Toggle */}
            <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg">
              <Button size="sm" variant={mode === 'single' ? 'default' : 'ghost'} onClick={() => setMode('single')}
                className={`h-8 text-xs ${mode === 'single' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`} data-testid="mode-single">
                <CalendarDays size={13} className="mr-1" /> Single Day
              </Button>
              <Button size="sm" variant={mode === 'range' ? 'default' : 'ghost'} onClick={() => setMode('range')}
                className={`h-8 text-xs ${mode === 'range' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`} data-testid="mode-range">
                <CalendarRange size={13} className="mr-1" /> Date Range
              </Button>
            </div>

            {mode === 'single' ? (
              <>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[150px] h-9" data-testid="date-picker" />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    onClick={() => quickDateSelect(0)} className="h-9">Today</Button>
                  <Button size="sm" variant="outline" onClick={() => quickDateSelect(1)} className="h-9">Yesterday</Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-[140px] h-9" data-testid="start-date-picker" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-[140px] h-9" data-testid="end-date-picker" />
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => quickRangeSelect(7)} className="h-9 text-xs">7d</Button>
                  <Button size="sm" variant="outline" onClick={() => quickRangeSelect(30)} className="h-9 text-xs">30d</Button>
                  <Button size="sm" variant="outline" onClick={() => quickRangeSelect(90)} className="h-9 text-xs">90d</Button>
                </div>
              </>
            )}

            {branches.length > 1 && (
              <Select value={selectedBranch || 'all'} onValueChange={(v) => setSelectedBranch(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[140px] h-9" data-testid="branch-select">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={mode === 'single' ? fetchSummary : fetchRangeSummary}
              className="h-9" data-testid="refresh-btn">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* ============ SINGLE DAY MODE ============ */}
        {mode === 'single' && data && (
          <>
            {/* Net Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow card-enter" onClick={() => navigate(`/sales?date=${selectedDate}`)} data-testid="card-total-sales">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="text-emerald-600" size={18} />
                    <p className="text-xs text-emerald-700">Total Sales</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit text-emerald-700" data-testid="total-sales">
                    {formatCurrency(data.sales.total)}
                  </p>
                  <p className="text-xs text-emerald-600">{data.sales.count} transactions</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-shadow card-enter" onClick={() => navigate(`/expenses?date=${selectedDate}${selectedBranch ? `&branch=${selectedBranch}` : ''}`)} data-testid="card-total-expenses">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownRight className="text-red-600" size={18} />
                    <p className="text-xs text-red-700">Total Expenses</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit text-red-700" data-testid="total-expenses">
                    {formatCurrency(data.expenses.total)}
                  </p>
                  <p className="text-xs text-red-600">{data.expenses.count} entries</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50 card-enter">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="text-blue-600" size={18} />
                    <p className="text-xs text-blue-700">Net Cash Flow</p>
                  </div>
                  <p className={`text-2xl font-bold font-outfit ${data.summary.net_cash_flow >= 0 ? 'text-blue-700' : 'text-red-600'}`} data-testid="net-cash">
                    {formatCurrency(data.summary.net_cash_flow)}
                  </p>
                  <p className="text-xs text-blue-600">Cash in - Cash out</p>
                </CardContent>
              </Card>
              <Card className={`border-${data.summary.net_profit >= 0 ? 'emerald' : 'red'}-200 bg-${data.summary.net_profit >= 0 ? 'emerald' : 'red'}-50/50 card-enter`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className={data.summary.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'} size={18} />
                    <p className={`text-xs ${data.summary.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Profit</p>
                  </div>
                  <p className={`text-2xl font-bold font-outfit ${data.summary.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`} data-testid="net-profit">
                    {formatCurrency(data.summary.net_profit)}
                  </p>
                  <p className={`text-xs ${data.summary.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Sales - Expenses</p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Tabs */}
            <Tabs defaultValue="sales" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="sales" className="gap-1" data-testid="sales-tab"><ShoppingCart size={14} />Sales</TabsTrigger>
                <TabsTrigger value="expenses" className="gap-1" data-testid="expenses-tab"><Receipt size={14} />Expenses</TabsTrigger>
                <TabsTrigger value="suppliers" className="gap-1" data-testid="suppliers-tab"><Truck size={14} />Suppliers</TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><Banknote className="text-emerald-600" size={16} /><span className="text-xs text-muted-foreground">Cash</span></div>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(data.sales.cash)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><CreditCard className="text-blue-600" size={16} /><span className="text-xs text-muted-foreground">Bank</span></div>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(data.sales.bank)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><Clock className="text-amber-600" size={16} /><span className="text-xs text-muted-foreground">Credit</span></div>
                      <p className="text-lg font-bold text-amber-600">{formatCurrency(data.sales.credit)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><Package className="text-purple-600" size={16} /><span className="text-xs text-muted-foreground">Online</span></div>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(data.sales.online)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Top Selling Items</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {data.sales.top_items?.length > 0 ? (
                        <div className="divide-y">
                          {data.sales.top_items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.qty} sold</p></div>
                              <p className="font-bold text-emerald-600">{formatCurrency(item.revenue)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-center text-muted-foreground py-6">No sales data</p>}
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Recent Sales</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {data.sales.recent?.length > 0 ? (
                        <div className="divide-y max-h-[280px] overflow-y-auto">
                          {data.sales.recent.map((sale, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div><p className="text-sm font-medium">{sale.customer}</p><p className="text-xs text-muted-foreground">{sale.time} - {sale.branch}</p></div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">{formatCurrency(sale.amount)}</p>
                                <Badge variant="outline" className="text-[10px]">{sale.payment_mode}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-center text-muted-foreground py-6">No sales data</p>}
                    </CardContent>
                  </Card>
                </div>
                {Object.keys(data.sales.by_branch || {}).length > 0 && (
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Sales by Branch</CardTitle></CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(data.sales.by_branch).map(([branch, stats]) => (
                          <div key={branch} className="p-3 bg-stone-50 rounded-xl">
                            <p className="text-xs text-muted-foreground truncate">{branch}</p>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.amount)}</p>
                            <p className="text-xs text-muted-foreground">{stats.count} sales</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><Banknote className="text-red-600" size={16} /><span className="text-xs text-muted-foreground">Cash</span></div>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(data.expenses.cash)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><CreditCard className="text-red-600" size={16} /><span className="text-xs text-muted-foreground">Bank</span></div>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(data.expenses.bank)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2"><Clock className="text-amber-600" size={16} /><span className="text-xs text-muted-foreground">Credit</span></div>
                      <p className="text-lg font-bold text-amber-600">{formatCurrency(data.expenses.credit)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Expenses by Category</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {Object.keys(data.expenses.by_category || {}).length > 0 ? (
                        <div className="divide-y">
                          {Object.entries(data.expenses.by_category).sort((a, b) => b[1].amount - a[1].amount).map(([cat, stats]) => (
                            <div key={cat} className="flex justify-between items-center px-4 py-2.5">
                              <div><p className="text-sm font-medium capitalize">{cat}</p><p className="text-xs text-muted-foreground">{stats.count} entries</p></div>
                              <p className="font-bold text-red-600">{formatCurrency(stats.amount)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-center text-muted-foreground py-6">No expenses data</p>}
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Recent Expenses</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {data.expenses.recent?.length > 0 ? (
                        <div className="divide-y max-h-[280px] overflow-y-auto">
                          {data.expenses.recent.map((exp, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div><p className="text-sm font-medium truncate max-w-[150px]">{exp.description || exp.category}</p><p className="text-xs text-muted-foreground capitalize">{exp.category} - {exp.payment_mode}</p></div>
                              <p className="font-bold text-red-600">{formatCurrency(exp.amount)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-center text-muted-foreground py-6">No expenses data</p>}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="suppliers" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1"><TrendingUp className="text-emerald-600" size={18} /><p className="text-xs text-emerald-700">Payments Made</p></div>
                      <p className="text-2xl font-bold font-outfit text-emerald-700">{formatCurrency(data.suppliers.payments_total)}</p>
                      <p className="text-xs text-emerald-600">{data.suppliers.payments_count} payments</p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1"><TrendingDown className="text-amber-600" size={18} /><p className="text-xs text-amber-700">Credit Purchases</p></div>
                      <p className="text-2xl font-bold font-outfit text-amber-700">{formatCurrency(data.suppliers.credit_purchases)}</p>
                      <p className="text-xs text-amber-600">Added to supplier balance</p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="border-stone-100">
                  <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Recent Supplier Payments</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {data.suppliers.recent_payments?.length > 0 ? (
                      <div className="divide-y">
                        {data.suppliers.recent_payments.map((p, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-3">
                            <div><p className="text-sm font-medium">{p.supplier}</p><Badge variant="outline" className="text-[10px]">{p.payment_mode}</Badge></div>
                            <p className="font-bold text-emerald-600">{formatCurrency(p.amount)}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-muted-foreground py-6">No supplier payments</p>}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* ============ DATE RANGE MODE ============ */}
        {mode === 'range' && rangeData && (
          <>
            {/* Totals Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="range-summary-cards">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="text-emerald-600" size={18} /><p className="text-xs text-emerald-700">Total Sales</p></div>
                  <p className="text-2xl font-bold font-outfit text-emerald-700" data-testid="range-total-sales">{formatCurrency(rangeData.totals.sales)}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-emerald-600"><Banknote size={10} className="inline mr-0.5" />Cash: {formatCurrency(rangeData.totals.sales_cash)}</span>
                    <span className="text-[10px] text-blue-600"><CreditCard size={10} className="inline mr-0.5" />Bank: {formatCurrency(rangeData.totals.sales_bank)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{rangeData.totals.sales_count} transactions</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="text-red-600" size={18} /><p className="text-xs text-red-700">Total Expenses</p></div>
                  <p className="text-2xl font-bold font-outfit text-red-700" data-testid="range-total-expenses">{formatCurrency(rangeData.totals.expenses)}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-red-600"><Banknote size={10} className="inline mr-0.5" />Cash: {formatCurrency(rangeData.totals.exp_cash)}</span>
                    <span className="text-[10px] text-red-600"><CreditCard size={10} className="inline mr-0.5" />Bank: {formatCurrency(rangeData.totals.exp_bank)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{rangeData.totals.exp_count} entries</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1"><Banknote className="text-blue-600" size={18} /><p className="text-xs text-blue-700">Supplier Payments</p></div>
                  <p className="text-2xl font-bold font-outfit text-blue-700" data-testid="range-sp">{formatCurrency(rangeData.totals.supplier_payments)}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-blue-600"><Banknote size={10} className="inline mr-0.5" />Cash: {formatCurrency(rangeData.totals.sp_cash)}</span>
                    <span className="text-[10px] text-blue-600"><CreditCard size={10} className="inline mr-0.5" />Bank: {formatCurrency(rangeData.totals.sp_bank)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className={`${rangeData.totals.net_profit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className={rangeData.totals.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'} size={18} />
                    <p className={`text-xs ${rangeData.totals.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Profit</p>
                  </div>
                  <p className={`text-2xl font-bold font-outfit ${rangeData.totals.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`} data-testid="range-net-profit">
                    {formatCurrency(rangeData.totals.net_profit)}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-emerald-600">Net Cash: {formatCurrency(rangeData.totals.net_cash)}</span>
                    <span className="text-[10px] text-blue-600">Net Bank: {formatCurrency(rangeData.totals.net_bank)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{rangeData.days_count} days</p>
                </CardContent>
              </Card>
            </div>

            {/* Profit Trend Chart */}
            {rangeData.daily?.length > 1 && (
              <Card data-testid="profit-trend-card">
                <CardHeader className="py-3 pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-outfit flex items-center gap-2">
                      <TrendingUp size={16} className="text-orange-500" /> Profit Trend
                    </CardTitle>
                    <span className="text-[10px] text-muted-foreground">{rangeData.days_count} days</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={[...rangeData.daily].reverse().map(d => ({
                      date: d.date.slice(5),
                      Sales: d.sales,
                      Expenses: d.expenses,
                      Profit: +(d.sales - d.expenses).toFixed(2),
                    }))}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e5e7eb' }}
                        formatter={(v, name) => [`SAR ${v?.toLocaleString()}`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={1.5} fill="url(#salesGrad)" dot={false} />
                      <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={1.5} fill="none" strokeDasharray="4 2" dot={false} />
                      <Area type="monotone" dataKey="Profit" stroke="#f97316" strokeWidth={2.5} fill="url(#profitGrad)" dot={{ r: 2, fill: '#f97316' }} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg">
                <Button size="sm" variant={rangeView === 'summary' ? 'default' : 'ghost'} onClick={() => setRangeView('summary')}
                  className={`h-7 text-xs ${rangeView === 'summary' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`} data-testid="view-summary">
                  <BarChart3 size={12} className="mr-1" /> Summary
                </Button>
                <Button size="sm" variant={rangeView === 'daily' ? 'default' : 'ghost'} onClick={() => setRangeView('daily')}
                  className={`h-7 text-xs ${rangeView === 'daily' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`} data-testid="view-daily">
                  <Table size={12} className="mr-1" /> Day by Day
                </Button>
              </div>
            </div>

            {/* Summary View */}
            {rangeView === 'summary' && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Expense by Category */}
                <Card>
                  <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Expenses by Category</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {Object.keys(rangeData.expense_by_category || {}).length > 0 ? (
                      <div className="divide-y">
                        {Object.entries(rangeData.expense_by_category).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                          <div key={cat} className="flex justify-between items-center px-4 py-2.5">
                            <p className="text-sm font-medium capitalize">{cat}</p>
                            <p className="font-bold text-red-600">{formatCurrency(amount)}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-muted-foreground py-6">No expense data</p>}
                  </CardContent>
                </Card>

                {/* Cash/Bank Summary */}
                <Card>
                  <CardHeader className="py-3 border-b"><CardTitle className="text-sm font-outfit">Cash & Bank Summary</CardTitle></CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div></div>
                      <p className="text-[10px] font-semibold text-muted-foreground">CASH</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">BANK</p>
                    </div>
                    {[
                      { label: 'Sales In', cash: rangeData.totals.sales_cash, bank: rangeData.totals.sales_bank, color: 'text-emerald-600' },
                      { label: 'Expenses Out', cash: rangeData.totals.exp_cash, bank: rangeData.totals.exp_bank, color: 'text-red-600' },
                      { label: 'Supplier Pay', cash: rangeData.totals.sp_cash, bank: rangeData.totals.sp_bank, color: 'text-blue-600' },
                      { label: 'Net', cash: rangeData.totals.net_cash, bank: rangeData.totals.net_bank, color: 'font-bold' },
                    ].map((row, i) => (
                      <div key={i} className={`grid grid-cols-3 gap-2 text-center ${i === 3 ? 'border-t pt-2' : ''}`}>
                        <p className="text-xs text-left font-medium">{row.label}</p>
                        <p className={`text-xs font-semibold ${row.color}`}>{formatCurrency(row.cash)}</p>
                        <p className={`text-xs font-semibold ${row.color}`}>{formatCurrency(row.bank)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Day by Day View */}
            {rangeView === 'daily' && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" data-testid="daily-breakdown-table">
                      <thead className="bg-stone-50 dark:bg-stone-800 border-b sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Date</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-emerald-600">Sales</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-emerald-600">Cash</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-emerald-600">Bank</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-red-600">Expenses</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-red-600">Cash</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-red-600">Bank</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-blue-600">SP</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-teal-600 bg-teal-50/50">Net Cash</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-indigo-600 bg-indigo-50/50">Net Bank</th>
                          <th className="text-right px-3 py-2.5 font-semibold">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rangeData.daily.map((day, i) => {
                          const net = (day.sales || 0) - (day.expenses || 0);
                          const netCash = day.net_cash != null ? day.net_cash : ((day.sales_cash || 0) - (day.exp_cash || 0));
                          const netBank = day.net_bank != null ? day.net_bank : ((day.sales_bank || 0) - (day.exp_bank || 0));
                          return (
                            <tr key={i} className="hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid={`daily-row-${day.date}`}>
                              <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                                <button onClick={() => { setMode('single'); setSelectedDate(day.date); }}
                                  className="text-orange-600 hover:underline font-medium" data-testid={`click-date-${day.date}`}>
                                  {day.date}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {day.sales > 0 ? (
                                  <button onClick={() => navigate(`/sales?date=${day.date}`)}
                                    className="text-emerald-700 font-semibold hover:underline cursor-pointer" data-testid={`click-sales-${day.date}`}>
                                    {formatCurrency(day.sales)}
                                  </button>
                                ) : <span className="text-stone-400">{formatCurrency(0)}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(day.sales_cash)}</td>
                              <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(day.sales_bank)}</td>
                              <td className="px-3 py-2.5 text-right">
                                {day.expenses > 0 ? (
                                  <button onClick={() => navigate(`/expenses?date=${day.date}${selectedBranch ? `&branch=${selectedBranch}` : ''}`)}
                                    className="text-red-700 font-semibold hover:underline cursor-pointer" data-testid={`click-exp-${day.date}`}>
                                    {formatCurrency(day.expenses)}
                                  </button>
                                ) : <span className="text-stone-400">{formatCurrency(0)}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(day.exp_cash)}</td>
                              <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(day.exp_bank)}</td>
                              <td className="px-3 py-2.5 text-right">
                                {day.sp_total > 0 ? (
                                  <button onClick={() => navigate(`/suppliers?date=${day.date}`)}
                                    className="text-blue-600 hover:underline cursor-pointer">
                                    {formatCurrency(day.sp_total)}
                                  </button>
                                ) : <span className="text-stone-400">{formatCurrency(0)}</span>}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold bg-teal-50/30 ${netCash >= 0 ? 'text-teal-700' : 'text-red-600'}`} data-testid={`net-cash-${day.date}`}>
                                {formatCurrency(netCash)}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold bg-indigo-50/30 ${netBank >= 0 ? 'text-indigo-700' : 'text-red-600'}`} data-testid={`net-bank-${day.date}`}>
                                {formatCurrency(netBank)}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(net)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-stone-100 dark:bg-stone-800 border-t-2 font-bold">
                        <tr>
                          <td className="px-3 py-2.5">TOTAL</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(rangeData.totals.sales)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(rangeData.totals.sales_cash)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(rangeData.totals.sales_bank)}</td>
                          <td className="px-3 py-2.5 text-right text-red-700">{formatCurrency(rangeData.totals.expenses)}</td>
                          <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(rangeData.totals.exp_cash)}</td>
                          <td className="px-3 py-2.5 text-right text-red-600">{formatCurrency(rangeData.totals.exp_bank)}</td>
                          <td className="px-3 py-2.5 text-right text-blue-600">{formatCurrency(rangeData.totals.supplier_payments)}</td>
                          <td className={`px-3 py-2.5 text-right bg-teal-50/30 ${rangeData.totals.net_cash >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{formatCurrency(rangeData.totals.net_cash)}</td>
                          <td className={`px-3 py-2.5 text-right bg-indigo-50/30 ${rangeData.totals.net_bank >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{formatCurrency(rangeData.totals.net_bank)}</td>
                          <td className={`px-3 py-2.5 text-right ${rangeData.totals.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(rangeData.totals.net_profit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
