import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, TrendingUp, Package, BarChart3 } from 'lucide-react';
import api from '@/lib/api';

const INSIGHT_TYPES = [
  { key: 'dashboard', label: 'Business Health', icon: TrendingUp, endpoint: '/ai-insights/dashboard' },
  { key: 'stock', label: 'Stock Alerts', icon: Package, endpoint: '/ai-insights/stock' },
  { key: 'sales-trends', label: 'Sales Trends', icon: BarChart3, endpoint: '/ai-insights/sales-trends' },
];

export default function AIInsightsWidget() {
  const [activeType, setActiveType] = useState('dashboard');
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchInsight = async (type) => {
    const config = INSIGHT_TYPES.find(t => t.key === type);
    if (!config) return;
    setLoading(true);
    setActiveType(type);
    try {
      const { data } = await api.get(config.endpoint);
      setInsight(data);
    } catch {
      setInsight({ insight: 'Unable to generate insights at this time.' });
    }
    setLoading(false);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-stone-900 dark:to-stone-900" data-testid="ai-insights-widget">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold font-outfit">AI Insights</h3>
          </div>
          {insight && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fetchInsight(activeType)} disabled={loading} data-testid="refresh-insight">
              <RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          )}
        </div>

        <div className="flex gap-1.5">
          {INSIGHT_TYPES.map(t => (
            <Button
              key={t.key}
              size="sm"
              variant={activeType === t.key && insight ? 'default' : 'outline'}
              className="h-7 text-[10px] rounded-full flex-1"
              onClick={() => fetchInsight(t.key)}
              disabled={loading}
              data-testid={`insight-btn-${t.key}`}
            >
              <t.icon size={10} className="mr-1" />{t.label}
            </Button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-white/60 dark:bg-stone-800/60 rounded-xl animate-pulse" data-testid="insight-loading">
            <Sparkles size={14} className="text-primary animate-bounce" />
            <span className="text-xs text-muted-foreground">Analyzing your business data...</span>
          </div>
        )}

        {!loading && insight && (
          <div className="p-3 bg-white/80 dark:bg-stone-800/80 rounded-xl border border-primary/10 text-sm leading-relaxed" data-testid="insight-result">
            {insight.insight}
          </div>
        )}

        {!loading && !insight && (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">Click a category above to generate AI-powered insights</p>
          </div>
        )}

        {!loading && insight?.metrics && (
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            {insight.metrics.growth_pct !== undefined && (
              <div className="p-1.5 bg-white/60 dark:bg-stone-800/60 rounded-lg">
                <p className="text-muted-foreground">Growth</p>
                <p className={`font-bold ${insight.metrics.growth_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{insight.metrics.growth_pct >= 0 ? '+' : ''}{insight.metrics.growth_pct}%</p>
              </div>
            )}
            {insight.metrics.profit !== undefined && (
              <div className="p-1.5 bg-white/60 dark:bg-stone-800/60 rounded-lg">
                <p className="text-muted-foreground">Profit</p>
                <p className={`font-bold ${insight.metrics.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>SAR {insight.metrics.profit?.toLocaleString()}</p>
              </div>
            )}
            {insight.metrics.outstanding_credit !== undefined && (
              <div className="p-1.5 bg-white/60 dark:bg-stone-800/60 rounded-lg">
                <p className="text-muted-foreground">Credit Due</p>
                <p className="font-bold text-amber-600">SAR {insight.metrics.outstanding_credit?.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {!loading && insight?.critical_count !== undefined && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className={`px-2 py-0.5 rounded-full font-bold ${insight.critical_count > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {insight.critical_count} critical items
            </span>
            <span className="text-muted-foreground">out of {insight.total_items} total</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
