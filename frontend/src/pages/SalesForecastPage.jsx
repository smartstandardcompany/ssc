import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, Minus, RefreshCw, Calendar, 
  DollarSign, BarChart3, Target, ArrowUpRight, ArrowDownRight, Sparkles 
} from 'lucide-react';
import api from '@/lib/api';

function SalesAIInsight() {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/ai-insights/sales-trends'); setInsight(data); } catch { setInsight({ insight: 'Unable to load.' }); }
    setLoading(false);
  };
  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-cyan-50/30" data-testid="sales-ai-insight">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Sparkles size={14} className="text-blue-500" /><span className="text-sm font-semibold">AI Sales Analysis</span></div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetch} disabled={loading}><RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />{insight ? 'Refresh' : 'Generate'}</Button>
        </div>
        {loading && <p className="text-xs text-muted-foreground animate-pulse">Analyzing 30-day sales data...</p>}
        {!loading && insight && <p className="text-sm leading-relaxed">{insight.insight}</p>}
        {!loading && !insight && <p className="text-xs text-muted-foreground">Click Generate to get AI-powered sales trend insights</p>}
      </CardContent>
    </Card>
  );
}
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SalesForecastPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    _fetchBr();
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [days, selectedBranch]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days });
      if (selectedBranch) params.append('branch_id', selectedBranch);
      const res = await api.get(`/predictions/sales-forecast?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load forecast');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => `SAR ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="text-emerald-500" size={18} />;
    if (trend === 'down') return <TrendingDown className="text-red-500" size={18} />;
    return <Minus className="text-stone-400" size={18} />;
  };

  const getTrendColor = (trend) => {
    if (trend === 'up') return 'text-emerald-600 bg-emerald-50';
    if (trend === 'down') return 'text-red-600 bg-red-50';
    return 'text-stone-600 bg-stone-50';
  };

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
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="forecast-title">
              Sales Forecast
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered predictions based on historical patterns
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px] h-9" data-testid="days-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Next 7 days</SelectItem>
                <SelectItem value="14">Next 14 days</SelectItem>
                <SelectItem value="30">Next 30 days</SelectItem>
                <SelectItem value="60">Next 60 days</SelectItem>
                <SelectItem value="90">Next 90 days</SelectItem>
              </SelectContent>
            </Select>
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
            <Button size="sm" variant="outline" onClick={fetchForecast} className="h-9" data-testid="refresh-btn">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {data?.message ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-center">
              <p className="text-amber-700">{data.message}</p>
              <p className="text-sm text-amber-600 mt-2">Add more sales data to enable forecasting</p>
            </CardContent>
          </Card>
        ) : data && (
          <>
            {/* AI Insight */}
            <SalesAIInsight />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="text-emerald-600" size={18} />
                    <p className="text-xs text-emerald-700">Next {days} Days</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit text-emerald-700" data-testid="total-forecast">
                    {formatCurrency(data.summary?.total_predicted)}
                  </p>
                  <p className="text-xs text-emerald-600">Total predicted sales</p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="text-blue-600" size={18} />
                    <p className="text-xs text-blue-700">Next Week</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit text-blue-700" data-testid="next-7-days">
                    {formatCurrency(data.summary?.next_7_days)}
                  </p>
                  <p className="text-xs text-blue-600">7-day forecast</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="text-purple-600" size={18} />
                    <p className="text-xs text-purple-700">Daily Average</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit text-purple-700" data-testid="daily-avg">
                    {formatCurrency(data.summary?.avg_daily_predicted)}
                  </p>
                  <p className="text-xs text-purple-600">Expected per day</p>
                </CardContent>
              </Card>

              <Card className={`border-stone-200 ${getTrendColor(data.summary?.trend)}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    {getTrendIcon(data.summary?.trend)}
                    <p className="text-xs">Sales Trend</p>
                  </div>
                  <p className="text-2xl font-bold font-outfit capitalize" data-testid="trend">
                    {data.summary?.trend}
                  </p>
                  <p className="text-xs">
                    {data.summary?.trend_percentage > 0 ? '+' : ''}{data.summary?.trend_percentage}% vs last period
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Day of Week Pattern */}
              <Card className="border-stone-100">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-sm font-outfit flex items-center gap-2">
                    <BarChart3 size={16} />
                    Day-of-Week Pattern
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {data.day_of_week_pattern && (
                    <div className="space-y-2">
                      {Object.entries(data.day_of_week_pattern).map(([day, avg]) => {
                        const maxVal = Math.max(...Object.values(data.day_of_week_pattern));
                        const pct = (avg / maxVal) * 100;
                        const isBest = day === data.summary?.best_day;
                        const isWorst = day === data.summary?.worst_day;
                        
                        return (
                          <div key={day} className="flex items-center gap-3">
                            <span className={`text-xs w-20 ${isBest ? 'font-bold text-emerald-600' : isWorst ? 'font-bold text-red-600' : ''}`}>
                              {day.slice(0, 3)}
                              {isBest && <ArrowUpRight size={12} className="inline ml-1" />}
                              {isWorst && <ArrowDownRight size={12} className="inline ml-1" />}
                            </span>
                            <div className="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isBest ? 'bg-emerald-500' : isWorst ? 'bg-red-400' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-24 text-right">
                              {formatCurrency(avg)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                    <span>Best: <strong className="text-emerald-600">{data.summary?.best_day}</strong></span>
                    <span>Slowest: <strong className="text-red-600">{data.summary?.worst_day}</strong></span>
                  </div>
                </CardContent>
              </Card>

              {/* Historical Comparison */}
              <Card className="border-stone-100">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-sm font-outfit">Historical Performance</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                      <div>
                        <p className="text-xs text-muted-foreground">Last 7 Days Avg</p>
                        <p className="text-lg font-bold">{formatCurrency(data.historical?.avg_last_7_days)}</p>
                      </div>
                      <Badge variant="outline">Weekly</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                      <div>
                        <p className="text-xs text-muted-foreground">Last 30 Days Avg</p>
                        <p className="text-lg font-bold">{formatCurrency(data.historical?.avg_last_30_days)}</p>
                      </div>
                      <Badge variant="outline">Monthly</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                      <div>
                        <p className="text-xs text-muted-foreground">Last 180 Days Avg</p>
                        <p className="text-lg font-bold">{formatCurrency(data.historical?.avg_last_180_days)}</p>
                      </div>
                      <Badge variant="outline">6 Months</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Forecast Table */}
            <Card className="border-stone-100">
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm font-outfit">Daily Forecast</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm" data-testid="forecast-table">
                    <thead className="sticky top-0 bg-stone-50">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Day</th>
                        <th className="text-right p-3 font-medium">Predicted</th>
                        <th className="text-right p-3 font-medium">Lower Bound</th>
                        <th className="text-right p-3 font-medium">Upper Bound</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.forecast?.slice(0, 30).map((f, i) => {
                        const isWeekend = f.day_name === 'Saturday' || f.day_name === 'Sunday';
                        const isBestDay = f.day_name === data.summary?.best_day;
                        
                        return (
                          <tr key={i} className={`border-b hover:bg-stone-50/50 ${isWeekend ? 'bg-amber-50/30' : ''} ${isBestDay ? 'bg-emerald-50/30' : ''}`}>
                            <td className="p-3">{format(new Date(f.date), 'MMM dd')}</td>
                            <td className="p-3">
                              <span className={isBestDay ? 'font-medium text-emerald-600' : ''}>
                                {f.day_name}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium text-emerald-600">
                              {formatCurrency(f.predicted)}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(f.lower_bound)}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(f.upper_bound)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Confidence Note */}
            <p className="text-xs text-muted-foreground text-center">
              Forecasts are based on historical patterns and may vary. Confidence level: {data.summary?.confidence_level}
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
