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
  CreditCard, Banknote, Clock, Package
} from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

export default function DailySummaryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    _fetchBr();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [selectedDate, selectedBranch]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedBranch) params.append('branch_id', selectedBranch);
      const res = await api.get(`/dashboard/daily-summary?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load daily summary');
    } finally {
      setLoading(false);
    }
  };

  const quickDateSelect = (days) => {
    setSelectedDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
  };

  const formatCurrency = (val) => `SAR ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading && !data) {
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
              Daily Summary
            </h1>
            <p className="text-sm text-muted-foreground">
              Quick overview of today's business activity
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs">Date</Label>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[150px] h-9"
                data-testid="date-picker"
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'} 
                onClick={() => quickDateSelect(0)} className="h-9">Today</Button>
              <Button size="sm" variant="outline" onClick={() => quickDateSelect(1)} className="h-9">Yesterday</Button>
            </div>
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
            <Button size="sm" variant="outline" onClick={fetchSummary} className="h-9" data-testid="refresh-btn">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {data && (
          <>
            {/* Net Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50">
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
              
              <Card className="border-red-200 bg-red-50/50">
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
              
              <Card className="border-blue-200 bg-blue-50/50">
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
              
              <Card className={`border-${data.summary.net_profit >= 0 ? 'emerald' : 'red'}-200 bg-${data.summary.net_profit >= 0 ? 'emerald' : 'red'}-50/50`}>
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
                <TabsTrigger value="sales" className="gap-1" data-testid="sales-tab">
                  <ShoppingCart size={14} />Sales
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-1" data-testid="expenses-tab">
                  <Receipt size={14} />Expenses
                </TabsTrigger>
                <TabsTrigger value="suppliers" className="gap-1" data-testid="suppliers-tab">
                  <Truck size={14} />Suppliers
                </TabsTrigger>
              </TabsList>

              {/* Sales Tab */}
              <TabsContent value="sales" className="space-y-4">
                {/* Payment Mode Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <Banknote className="text-emerald-600" size={16} />
                        <span className="text-xs text-muted-foreground">Cash</span>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(data.sales.cash)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="text-blue-600" size={16} />
                        <span className="text-xs text-muted-foreground">Bank</span>
                      </div>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(data.sales.bank)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="text-amber-600" size={16} />
                        <span className="text-xs text-muted-foreground">Credit</span>
                      </div>
                      <p className="text-lg font-bold text-amber-600">{formatCurrency(data.sales.credit)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <Package className="text-purple-600" size={16} />
                        <span className="text-xs text-muted-foreground">Online</span>
                      </div>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(data.sales.online)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top Items */}
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-sm font-outfit">Top Selling Items</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {data.sales.top_items?.length > 0 ? (
                        <div className="divide-y">
                          {data.sales.top_items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div>
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                              </div>
                              <p className="font-bold text-emerald-600">{formatCurrency(item.revenue)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-6">No sales today</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Sales */}
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-sm font-outfit">Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {data.sales.recent?.length > 0 ? (
                        <div className="divide-y max-h-[280px] overflow-y-auto">
                          {data.sales.recent.map((sale, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div>
                                <p className="text-sm font-medium">{sale.customer}</p>
                                <p className="text-xs text-muted-foreground">{sale.time} • {sale.branch}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">{formatCurrency(sale.amount)}</p>
                                <Badge variant="outline" className="text-[10px]">{sale.payment_mode}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-6">No sales today</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sales by Branch */}
                {Object.keys(data.sales.by_branch || {}).length > 0 && (
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-sm font-outfit">Sales by Branch</CardTitle>
                    </CardHeader>
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

              {/* Expenses Tab */}
              <TabsContent value="expenses" className="space-y-4">
                {/* Payment Mode Breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <Banknote className="text-red-600" size={16} />
                        <span className="text-xs text-muted-foreground">Cash</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(data.expenses.cash)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="text-red-600" size={16} />
                        <span className="text-xs text-muted-foreground">Bank</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(data.expenses.bank)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-stone-100">
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="text-amber-600" size={16} />
                        <span className="text-xs text-muted-foreground">Credit</span>
                      </div>
                      <p className="text-lg font-bold text-amber-600">{formatCurrency(data.expenses.credit)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* By Category */}
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-sm font-outfit">Expenses by Category</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {Object.keys(data.expenses.by_category || {}).length > 0 ? (
                        <div className="divide-y">
                          {Object.entries(data.expenses.by_category)
                            .sort((a, b) => b[1].amount - a[1].amount)
                            .map(([cat, stats]) => (
                            <div key={cat} className="flex justify-between items-center px-4 py-2.5">
                              <div>
                                <p className="text-sm font-medium capitalize">{cat}</p>
                                <p className="text-xs text-muted-foreground">{stats.count} entries</p>
                              </div>
                              <p className="font-bold text-red-600">{formatCurrency(stats.amount)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-6">No expenses today</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Expenses */}
                  <Card className="border-stone-100">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-sm font-outfit">Recent Expenses</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {data.expenses.recent?.length > 0 ? (
                        <div className="divide-y max-h-[280px] overflow-y-auto">
                          {data.expenses.recent.map((exp, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-2.5">
                              <div>
                                <p className="text-sm font-medium truncate max-w-[150px]">{exp.description || exp.category}</p>
                                <p className="text-xs text-muted-foreground capitalize">{exp.category} • {exp.payment_mode}</p>
                              </div>
                              <p className="font-bold text-red-600">{formatCurrency(exp.amount)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-6">No expenses today</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Suppliers Tab */}
              <TabsContent value="suppliers" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="text-emerald-600" size={18} />
                        <p className="text-xs text-emerald-700">Payments Made</p>
                      </div>
                      <p className="text-2xl font-bold font-outfit text-emerald-700">
                        {formatCurrency(data.suppliers.payments_total)}
                      </p>
                      <p className="text-xs text-emerald-600">{data.suppliers.payments_count} payments</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="text-amber-600" size={18} />
                        <p className="text-xs text-amber-700">Credit Purchases</p>
                      </div>
                      <p className="text-2xl font-bold font-outfit text-amber-700">
                        {formatCurrency(data.suppliers.credit_purchases)}
                      </p>
                      <p className="text-xs text-amber-600">Added to supplier balance</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-stone-100">
                  <CardHeader className="py-3 border-b">
                    <CardTitle className="text-sm font-outfit">Recent Supplier Payments</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {data.suppliers.recent_payments?.length > 0 ? (
                      <div className="divide-y">
                        {data.suppliers.recent_payments.map((p, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{p.supplier}</p>
                              <Badge variant="outline" className="text-[10px]">{p.payment_mode}</Badge>
                            </div>
                            <p className="font-bold text-emerald-600">{formatCurrency(p.amount)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-6">No supplier payments today</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
