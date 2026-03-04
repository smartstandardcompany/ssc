import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Calendar, Building2, Tag, Truck, RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useBranchStore } from '@/stores';
import { ExportButtons } from '@/components/ExportButtons';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#22C55E', '#F5841F', '#0EA5E9', '#8B5CF6', '#EC4899', '#EAB308', '#14B8A6', '#6366F1'];

export default function EnhancedPnLPage() {
  const { branches, fetchBranches } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month'); // month, quarter, year
  const [branchFilter, setBranchFilter] = useState('');
  
  // Data states
  const [summary, setSummary] = useState({});
  const [branchBreakdown, setBranchBreakdown] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [supplierBreakdown, setSupplierBreakdown] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [itemPnL, setItemPnL] = useState({ rows: [], summary: {} });
  const [profitDecomp, setProfitDecomp] = useState({ daily: [], monthly: [], summary: {} });

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [period, branchFilter]);

  const getDateRange = () => {
    const now = new Date();
    let start, end;
    if (period === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (period === 'quarter') {
      start = subMonths(startOfMonth(now), 2);
      end = endOfMonth(now);
    } else {
      start = subMonths(startOfMonth(now), 11);
      end = endOfMonth(now);
    }
    return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const branchParam = branchFilter ? `&branch_id=${branchFilter}` : '';
      
      const [
        statsRes,
        branchCashBankRes,
        supplierBalanceRes,
        dailySummaryRes,
        itemPnLRes,
        profitRes,
      ] = await Promise.all([
        api.get(`/dashboard/stats?start_date=${start}&end_date=${end}${branchParam}`),
        api.get('/reports/branch-cashbank'),
        api.get(`/reports/supplier-balance?start_date=${start}&end_date=${end}`),
        api.get(`/reports/daily-summary?start_date=${start}&end_date=${end}${branchParam}`),
        api.get(`/reports/item-pnl${branchFilter ? `?branch_id=${branchFilter}` : ''}`),
        api.get('/predictions/profit-decomposition'),
      ]);

      // Process dashboard stats for summary
      const stats = statsRes.data;
      setSummary({
        totalSales: stats.total_sales || 0,
        totalExpenses: stats.total_expenses || 0,
        grossProfit: (stats.total_sales || 0) - (stats.total_expenses || 0),
        netProfit: (stats.total_sales || 0) - (stats.total_expenses || 0),
        grossMargin: stats.total_sales > 0 ? (((stats.total_sales - stats.total_expenses) / stats.total_sales) * 100).toFixed(1) : 0,
        cashSales: stats.cash_sales || 0,
        bankSales: stats.bank_sales || 0,
        creditSales: stats.credit_sales || 0,
        onlineSales: stats.online_sales || 0,
        transactionCount: stats.transaction_count || 0,
      });

      // Branch breakdown
      const branchData = branchCashBankRes.data.map(b => ({
        name: b.branch_name,
        sales: b.sales_total,
        expenses: b.expenses_total + b.supplier_total,
        profit: b.sales_total - b.expenses_total - b.supplier_total,
        margin: b.sales_total > 0 ? (((b.sales_total - b.expenses_total - b.supplier_total) / b.sales_total) * 100).toFixed(1) : 0,
      }));
      setBranchBreakdown(branchData);

      // Category breakdown from expenses
      const categoryData = {};
      dailySummaryRes.data.forEach(d => {
        // Group by payment mode for now
        if (d.cash > 0) categoryData['Cash Sales'] = (categoryData['Cash Sales'] || 0) + d.cash;
        if (d.bank > 0) categoryData['Bank Sales'] = (categoryData['Bank Sales'] || 0) + d.bank;
        if (d.online > 0) categoryData['Online Sales'] = (categoryData['Online Sales'] || 0) + d.online;
      });
      setCategoryBreakdown(Object.entries(categoryData).map(([name, value]) => ({ name, value })));

      // Supplier breakdown
      const supplierData = supplierBalanceRes.data
        .filter(s => s.total_expenses > 0 || s.total_paid > 0)
        .map(s => ({
          name: s.name,
          expenses: s.total_expenses,
          paid: s.total_paid,
          credit: s.current_credit,
        }))
        .slice(0, 10);
      setSupplierBreakdown(supplierData);

      // Monthly trend from daily summary
      const monthlyData = {};
      dailySummaryRes.data.forEach(d => {
        const month = d.date.substring(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { month, sales: 0, expenses: 0, profit: 0 };
        }
        monthlyData[month].sales += d.sales;
        monthlyData[month].expenses += d.expenses;
        monthlyData[month].profit += d.profit;
      });
      setMonthlyTrend(Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)));

      // Item P&L
      setItemPnL(itemPnLRes.data);

      // Profit decomposition
      setProfitDecomp(profitRes.data);

    } catch (error) {
      console.error('Failed to fetch P&L data:', error);
      toast.error('Failed to fetch P&L data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => `SAR ${value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin mr-2" />
          Loading P&L data...
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
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="pnl-page-title">
              <BarChart3 className="text-green-500" />
              Enhanced P&L Report
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Comprehensive profit and loss analysis with detailed breakdowns
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32" data-testid="period-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
                <SelectItem value="year">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter || "all"} onValueChange={(val) => setBranchFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-40" data-testid="branch-filter">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw size={14} className="mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700" data-testid="total-revenue">
                    {formatCurrency(summary.totalSales)}
                  </p>
                </div>
                <DollarSign className="text-green-500" size={32} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700" data-testid="total-expenses">
                    {formatCurrency(summary.totalExpenses)}
                  </p>
                </div>
                <TrendingDown className="text-red-500" size={32} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Net Profit</p>
                  <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} data-testid="net-profit">
                    {formatCurrency(summary.netProfit)}
                  </p>
                </div>
                {summary.netProfit >= 0 ? <TrendingUp className="text-green-500" size={32} /> : <TrendingDown className="text-red-500" size={32} />}
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Gross Margin</p>
                  <p className="text-2xl font-bold text-purple-700" data-testid="gross-margin">
                    {summary.grossMargin}%
                  </p>
                </div>
                <PieChart className="text-purple-500" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign size={18} /> Revenue by Channel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Cash Sales', value: summary.cashSales, color: 'bg-green-500' },
                  { label: 'Bank Sales', value: summary.bankSales, color: 'bg-blue-500' },
                  { label: 'Online Sales', value: summary.onlineSales, color: 'bg-purple-500' },
                  { label: 'Credit Sales', value: summary.creditSales, color: 'bg-amber-500' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${item.color}`}></div>
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between font-bold">
                <span>Total Transactions</span>
                <span>{summary.transactionCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart size={18} /> Revenue Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={[
                      { name: 'Cash', value: summary.cashSales || 0 },
                      { name: 'Bank', value: summary.bankSales || 0 },
                      { name: 'Online', value: summary.onlineSales || 0 },
                      { name: 'Credit', value: summary.creditSales || 0 },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={index} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed breakdowns */}
        <Tabs defaultValue="branch" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="branch" data-testid="tab-branch">
              <Building2 size={14} className="mr-1" /> By Branch
            </TabsTrigger>
            <TabsTrigger value="trend" data-testid="tab-trend">
              <TrendingUp size={14} className="mr-1" /> Monthly Trend
            </TabsTrigger>
            <TabsTrigger value="supplier" data-testid="tab-supplier">
              <Truck size={14} className="mr-1" /> By Supplier
            </TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">
              <Tag size={14} className="mr-1" /> By Item
            </TabsTrigger>
          </TabsList>

          {/* Branch Breakdown */}
          <TabsContent value="branch">
            <Card>
              <CardHeader>
                <CardTitle>Branch-wise P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="sales" fill="#22C55E" name="Sales" />
                      <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                      <Bar dataKey="profit" fill="#0EA5E9" name="Profit" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50">
                        <th className="px-3 py-2 text-left">Branch</th>
                        <th className="px-3 py-2 text-right">Sales</th>
                        <th className="px-3 py-2 text-right">Expenses</th>
                        <th className="px-3 py-2 text-right">Profit</th>
                        <th className="px-3 py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchBreakdown.map((b, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2 font-medium">{b.name}</td>
                          <td className="px-3 py-2 text-right text-green-600">{formatCurrency(b.sales)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(b.expenses)}</td>
                          <td className={`px-3 py-2 text-right font-bold ${b.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(b.profit)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={parseFloat(b.margin) >= 20 ? 'default' : 'secondary'}>
                              {b.margin}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Trend */}
          <TabsContent value="trend">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="sales" fill="#22C55E" fillOpacity={0.3} stroke="#22C55E" name="Sales" />
                    <Area type="monotone" dataKey="expenses" fill="#EF4444" fillOpacity={0.3} stroke="#EF4444" name="Expenses" />
                    <Area type="monotone" dataKey="profit" fill="#0EA5E9" fillOpacity={0.3} stroke="#0EA5E9" name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
                
                {/* Profit trend insights */}
                {profitDecomp.summary && (
                  <div className="mt-4 p-4 bg-stone-50 rounded-lg">
                    <h4 className="font-medium mb-2">Profit Analysis</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg Daily Profit</span>
                        <p className="font-bold">{formatCurrency(profitDecomp.summary.avg_daily_profit)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Trend</span>
                        <p className={`font-bold ${profitDecomp.summary.profit_trend === 'improving' ? 'text-green-600' : profitDecomp.summary.profit_trend === 'declining' ? 'text-red-600' : 'text-stone-600'}`}>
                          {profitDecomp.summary.profit_trend}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Best Day</span>
                        <p className="font-bold">{profitDecomp.summary.best_day}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Worst Day</span>
                        <p className="font-bold">{profitDecomp.summary.worst_day}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Supplier Breakdown */}
          <TabsContent value="supplier">
            <Card>
              <CardHeader>
                <CardTitle>Supplier-wise Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={supplierBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="expenses" fill="#EF4444" name="Total Expenses" />
                      <Bar dataKey="paid" fill="#22C55E" name="Paid" />
                      <Bar dataKey="credit" fill="#F5841F" name="Credit Balance" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50">
                        <th className="px-3 py-2 text-left">Supplier</th>
                        <th className="px-3 py-2 text-right">Total Expenses</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierBreakdown.map((s, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(s.expenses)}</td>
                          <td className="px-3 py-2 text-right text-green-600">{formatCurrency(s.paid)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{formatCurrency(s.credit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Item P&L */}
          <TabsContent value="items">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Item-wise Profit & Loss</CardTitle>
                <ExportButtons 
                  data={itemPnL.rows}
                  filename="item_pnl_report"
                  columns={['item_name', 'category', 'sold_qty', 'sold_revenue', 'cost_of_sold', 'profit', 'margin']}
                />
              </CardHeader>
              <CardContent>
                {/* Item P&L Summary */}
                {itemPnL.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-stone-50 rounded-lg">
                    <div>
                      <span className="text-sm text-muted-foreground">Total Items</span>
                      <p className="text-xl font-bold">{itemPnL.summary.total_items}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Revenue</span>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(itemPnL.summary.total_revenue)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Cost</span>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(itemPnL.summary.total_cost)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Overall Margin</span>
                      <p className="text-xl font-bold text-purple-600">{itemPnL.summary.overall_margin}%</p>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50">
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Qty Sold</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Profit</th>
                        <th className="px-3 py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemPnL.rows?.slice(0, 20).map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-stone-50">
                          <td className="px-3 py-2 font-medium">{item.item_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.sold_qty}</td>
                          <td className="px-3 py-2 text-right text-green-600">{formatCurrency(item.sold_revenue)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatCurrency(item.cost_of_sold)}</td>
                          <td className={`px-3 py-2 text-right font-bold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(item.profit)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={item.margin >= 30 ? 'default' : item.margin >= 15 ? 'secondary' : 'destructive'}>
                              {item.margin}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
