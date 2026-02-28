import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, DollarSign, Users, TrendingUp, TrendingDown, ArrowUpDown, FileText, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const CHART_COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ShiftReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [rangeReport, setRangeReport] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBranch, setSelectedBranch] = useState('');
  const [activeTab, setActiveTab] = useState('daily');
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { t } = useLanguage();

  useEffect(() => {
    fetchBranches();
    fetchDailyReport();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data);
    } catch { }
  };

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      if (selectedBranch) params.set('branch_id', selectedBranch);
      const res = await api.get(`/cashier/shift-report?${params.toString()}`);
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to fetch shift report');
    } finally {
      setLoading(false);
    }
  };

  const fetchRangeReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (selectedBranch) params.set('branch_id', selectedBranch);
      const res = await api.get(`/cashier/shift-report/range?${params.toString()}`);
      setRangeReport(res.data);
    } catch (err) {
      toast.error('Failed to fetch range report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyReport();
    } else {
      fetchRangeReport();
    }
  }, [selectedDate, selectedBranch, activeTab, startDate, endDate]);

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return format(new Date(isoString), 'hh:mm a');
  };

  const formatDuration = (hours) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (loading && !report && !rangeReport) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const paymentData = report?.summary?.payment_breakdown 
    ? Object.entries(report.summary.payment_breakdown).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    : [];

  const branchData = report?.branch_summary 
    ? Object.entries(report.branch_summary).map(([name, data]) => ({ name, sales: data.sales, orders: data.orders }))
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="shift-report-title">
              {t('shift_report_title')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('shift_report_subtitle')}</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => activeTab === 'daily' ? fetchDailyReport() : fetchRangeReport()}>
            <RefreshCw size={14} className="mr-1" /> {t('refresh')}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="daily" data-testid="daily-tab">{t('daily_report')}</TabsTrigger>
            <TabsTrigger value="range" data-testid="range-tab">{t('date_range')}</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap mt-4">
            {activeTab === 'daily' ? (
              <div>
                <Label className="text-xs">Date</Label>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                  data-testid="date-filter"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={selectedBranch || "all"} onValueChange={(v) => setSelectedBranch(v === "all" ? "" : v)}>
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
            </div>
          </div>

          {/* Daily Report Content */}
          <TabsContent value="daily" className="space-y-6 mt-4">
            {report && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Card className="border-border" data-testid="total-shifts-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users size={12} /> Total Shifts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-primary">{report.summary?.total_shifts || 0}</div>
                      <div className="text-xs text-muted-foreground">
                        {report.summary?.closed_shifts || 0} closed, {report.summary?.open_shifts || 0} open
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border" data-testid="total-sales-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign size={12} /> Total Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-success">SAR {(report.summary?.total_sales || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{report.summary?.total_orders || 0} orders</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp size={12} /> Opening Cash
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit">SAR {(report.summary?.total_opening_cash || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingDown size={12} /> Closing Cash
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit">SAR {(report.summary?.total_closing_cash || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Expected Cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-info">SAR {(report.summary?.total_expected_cash || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card className={`border-border ${(report.summary?.total_cash_difference || 0) < 0 ? 'bg-error/5 border-error/30' : (report.summary?.total_cash_difference || 0) > 0 ? 'bg-success/5 border-success/30' : ''}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <ArrowUpDown size={12} /> Cash Difference
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold font-outfit ${(report.summary?.total_cash_difference || 0) < 0 ? 'text-error' : (report.summary?.total_cash_difference || 0) > 0 ? 'text-success' : ''}`}>
                        {(report.summary?.total_cash_difference || 0) > 0 ? '+' : ''}SAR {(report.summary?.total_cash_difference || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(report.summary?.total_cash_difference || 0) < 0 ? 'Shortage' : (report.summary?.total_cash_difference || 0) > 0 ? 'Overage' : 'Balanced'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Breakdown */}
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="font-outfit text-base">Payment Method Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {paymentData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie 
                              data={paymentData.filter(d => d.value > 0)} 
                              cx="50%" 
                              cy="50%" 
                              outerRadius={70} 
                              innerRadius={40}
                              dataKey="value" 
                              label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}
                            >
                              {paymentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => `SAR ${v.toFixed(2)}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">No payment data</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {paymentData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-muted-foreground">{d.name}:</span>
                            <span className="font-medium">SAR {d.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Branch Summary */}
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="font-outfit text-base">Sales by Branch</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {branchData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={branchData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="name" tick={{fontSize: 11}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip formatter={(v) => `SAR ${v.toFixed(2)}`} />
                            <Bar dataKey="sales" fill="#F5841F" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">No branch data</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Shift Details Table */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-outfit">Shift Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="shifts-table">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium">Cashier</th>
                            <th className="text-left p-3 font-medium">Branch</th>
                            <th className="text-center p-3 font-medium">Time</th>
                            <th className="text-center p-3 font-medium">Duration</th>
                            <th className="text-right p-3 font-medium">Opening</th>
                            <th className="text-right p-3 font-medium">Expected</th>
                            <th className="text-right p-3 font-medium">Closing</th>
                            <th className="text-right p-3 font-medium">Difference</th>
                            <th className="text-right p-3 font-medium">Sales</th>
                            <th className="text-center p-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report.shifts || []).map((shift) => (
                            <tr key={shift.id} className="border-b border-border hover:bg-secondary/50" data-testid="shift-row">
                              <td className="p-3 font-medium">{shift.cashier_name}</td>
                              <td className="p-3">{shift.branch_name}</td>
                              <td className="p-3 text-center text-xs">
                                {formatTime(shift.started_at)} - {formatTime(shift.ended_at)}
                              </td>
                              <td className="p-3 text-center">{formatDuration(shift.duration_hours)}</td>
                              <td className="p-3 text-right">SAR {(shift.opening_cash || 0).toFixed(2)}</td>
                              <td className="p-3 text-right text-info">SAR {(shift.expected_cash || 0).toFixed(2)}</td>
                              <td className="p-3 text-right">SAR {(shift.closing_cash || 0).toFixed(2)}</td>
                              <td className={`p-3 text-right font-medium ${(shift.cash_difference || 0) < 0 ? 'text-error' : (shift.cash_difference || 0) > 0 ? 'text-success' : ''}`}>
                                {(shift.cash_difference || 0) > 0 ? '+' : ''}SAR {(shift.cash_difference || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-bold">SAR {(shift.total_sales || 0).toFixed(2)}</td>
                              <td className="p-3 text-center">
                                <Badge className={shift.status === 'closed' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}>
                                  {shift.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {(!report.shifts || report.shifts.length === 0) && (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-muted-foreground">
                                No shifts found for this date
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Selling Items */}
                {report.top_items && report.top_items.length > 0 && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="font-outfit">Top Selling Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {report.top_items.map((item, idx) => (
                          <div key={idx} className="p-3 bg-secondary/50 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-primary">#{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.quantity} sold</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold mt-1 text-right">SAR {item.revenue.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Range Report Content */}
          <TabsContent value="range" className="space-y-6 mt-4">
            {rangeReport && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-primary">{rangeReport.summary?.total_days || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Total Shifts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit">{rangeReport.summary?.total_shifts || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Total Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-success">SAR {(rangeReport.summary?.total_sales || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Total Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit">{rangeReport.summary?.total_orders || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground">Avg Sales/Day</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-outfit text-info">SAR {(rangeReport.summary?.avg_sales_per_day || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Trend Chart */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-outfit">Daily Sales Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rangeReport.daily_breakdown && rangeReport.daily_breakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={rangeReport.daily_breakdown}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="date" tick={{fontSize: 10}} />
                          <YAxis tick={{fontSize: 10}} />
                          <Tooltip formatter={(v) => typeof v === 'number' ? `SAR ${v.toFixed(2)}` : v} />
                          <Line type="monotone" dataKey="sales" stroke="#F5841F" strokeWidth={2} dot={{ fill: '#F5841F' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No data for selected range</div>
                    )}
                  </CardContent>
                </Card>

                {/* Daily Breakdown Table */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-outfit">Daily Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-center p-3 font-medium">Shifts</th>
                            <th className="text-right p-3 font-medium">Sales</th>
                            <th className="text-center p-3 font-medium">Orders</th>
                            <th className="text-right p-3 font-medium">Cash Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rangeReport.daily_breakdown || []).map((day) => (
                            <tr key={day.date} className="border-b border-border hover:bg-secondary/50">
                              <td className="p-3 font-medium">{format(new Date(day.date), 'EEE, MMM dd')}</td>
                              <td className="p-3 text-center">{day.shifts}</td>
                              <td className="p-3 text-right font-bold text-success">SAR {day.sales.toFixed(2)}</td>
                              <td className="p-3 text-center">{day.orders}</td>
                              <td className={`p-3 text-right ${day.cash_difference < 0 ? 'text-error' : day.cash_difference > 0 ? 'text-success' : ''}`}>
                                {day.cash_difference > 0 ? '+' : ''}SAR {day.cash_difference.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          {(!rangeReport.daily_breakdown || rangeReport.daily_breakdown.length === 0) && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                No data for selected range
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
