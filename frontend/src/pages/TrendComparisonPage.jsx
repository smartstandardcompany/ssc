import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function TrendComparisonPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/trend-comparison')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load trends'))
      .finally(() => setLoading(false));
  }, []);

  const TrendIcon = ({ value }) => {
    if (value > 5) return <TrendingUp size={16} className="text-emerald-500" />;
    if (value < -5) return <TrendingDown size={16} className="text-red-500" />;
    return <Minus size={16} className="text-stone-400" />;
  };

  const ChangeBadge = ({ value, invert = false }) => {
    const positive = invert ? value < 0 : value > 0;
    return (
      <Badge variant="outline" className={`text-xs ${positive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : value === 0 ? 'bg-stone-50 text-stone-500' : 'bg-red-50 text-red-700 border-red-300'}`}>
        {value > 0 ? '+' : ''}{value}%
      </Badge>
    );
  };

  const ComparisonCard = ({ title, current, previous, change, metric = 'SAR', invertExpenses = false }) => (
    <div className="p-4 bg-white rounded-xl border hover:shadow-md transition-shadow">
      <p className="text-xs text-muted-foreground font-medium mb-2">{title}</p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <p className="text-2xl font-bold">{metric} {current.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendIcon value={invertExpenses ? -change : change} />
            <ChangeBadge value={change} invert={invertExpenses} />
            <span className="text-[10px] text-muted-foreground">vs {metric} {previous.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading trends...</div></DashboardLayout>);
  }

  const maxDailySales = data ? Math.max(...data.daily_trend.map(d => d.sales), 1) : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="trend-comparison-title">Trend Comparison</h1>
          <p className="text-muted-foreground text-sm">This week vs last week, this month vs last month</p>
        </div>

        {data && (
          <>
            {/* Weekly Comparison */}
            <Card data-testid="weekly-comparison">
              <CardHeader>
                <CardTitle className="font-outfit text-lg flex items-center gap-2">
                  Weekly Comparison
                  <Badge variant="outline" className="text-xs">This Week vs Last Week</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ComparisonCard title="Sales" current={data.weekly.this_week.sales} previous={data.weekly.last_week.sales} change={data.weekly.sales_change} />
                  <ComparisonCard title="Expenses" current={data.weekly.this_week.expenses} previous={data.weekly.last_week.expenses} change={data.weekly.expenses_change} invertExpenses />
                  <ComparisonCard title="Profit" current={data.weekly.this_week.profit} previous={data.weekly.last_week.profit} change={data.weekly.profit_change} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Transactions: {data.weekly.this_week.sales_count + data.weekly.this_week.expenses_count} this week</span>
                  <span className="flex items-center gap-1"><ArrowRight size={12} /> {data.weekly.last_week.sales_count + data.weekly.last_week.expenses_count} last week</span>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Comparison */}
            <Card data-testid="monthly-comparison">
              <CardHeader>
                <CardTitle className="font-outfit text-lg flex items-center gap-2">
                  Monthly Comparison
                  <Badge variant="outline" className="text-xs">This Month vs Last Month</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ComparisonCard title="Sales" current={data.monthly.this_month.sales} previous={data.monthly.last_month.sales} change={data.monthly.sales_change} />
                  <ComparisonCard title="Expenses" current={data.monthly.this_month.expenses} previous={data.monthly.last_month.expenses} change={data.monthly.expenses_change} invertExpenses />
                  <ComparisonCard title="Profit" current={data.monthly.this_month.profit} previous={data.monthly.last_month.profit} change={data.monthly.profit_change} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Transactions: {data.monthly.this_month.sales_count + data.monthly.this_month.expenses_count} this month</span>
                  <span className="flex items-center gap-1"><ArrowRight size={12} /> {data.monthly.last_month.sales_count + data.monthly.last_month.expenses_count} last month</span>
                </div>
              </CardContent>
            </Card>

            {/* 14-Day Daily Trend Chart */}
            <Card data-testid="daily-trend-chart">
              <CardHeader>
                <CardTitle className="font-outfit text-lg">14-Day Daily Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-48" data-testid="trend-bars">
                  {data.daily_trend.map((day, i) => {
                    const salesH = (day.sales / maxDailySales) * 100;
                    const isToday = i === data.daily_trend.length - 1;
                    const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group" data-testid={`trend-day-${day.date}`}>
                        <div className="relative w-full flex justify-center" style={{ height: '160px' }}>
                          {/* Sales bar */}
                          <div className={`w-full max-w-[32px] rounded-t transition-all ${
                            isToday ? 'bg-blue-500' : isWeekend ? 'bg-stone-300' : 'bg-emerald-400'
                          } group-hover:opacity-80`}
                            style={{ height: `${Math.max(salesH, 2)}%`, position: 'absolute', bottom: 0 }}
                            title={`${day.label}: SAR ${day.sales.toLocaleString()}`} />
                          {/* Expense line marker */}
                          {day.expenses > 0 && (
                            <div className="absolute w-full flex justify-center" style={{ bottom: `${(day.expenses / maxDailySales) * 100}%` }}>
                              <div className="w-4 h-0.5 bg-red-400 rounded" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] ${isToday ? 'font-bold text-blue-600' : 'text-muted-foreground'}`}>
                          {day.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground justify-center">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400" /> Sales</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 rounded" /> Expenses</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Today</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
