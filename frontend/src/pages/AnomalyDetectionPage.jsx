import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, AlertOctagon, Info, Shield, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, CreditCard, Building2, BarChart3, Clock, Zap
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const SEV_CONFIG = {
  critical: { icon: AlertOctagon, color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', dot: 'bg-red-500', label: 'Critical' },
  warning: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', dot: 'bg-amber-500', label: 'Warning' },
  info: { icon: Info, color: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800', dot: 'bg-sky-500', label: 'Info' },
};

const CAT_CONFIG = {
  sales: { icon: DollarSign, label: 'Sales', color: 'text-emerald-600' },
  expenses: { icon: CreditCard, label: 'Expenses', color: 'text-red-500' },
  bank: { icon: Building2, label: 'Bank', color: 'text-blue-500' },
};

export default function AnomalyDetectionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState('90');
  const [filter, setFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');
  const [history, setHistory] = useState([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const { data: h } = await api.get('/anomaly-detection/history');
      setHistory(h);
    } catch {}
  };

  const runScan = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/anomaly-detection/scan?days=${days}`);
      setData(d);
      loadHistory();
      const { critical, warning } = d.scan;
      if (critical > 0) toast.error(`${critical} critical anomalies detected!`);
      else if (warning > 0) toast.warning(`${warning} warning anomalies found`);
      else toast.success('Scan complete — no major anomalies');
    } catch { toast.error('Scan failed'); }
    finally { setLoading(false); }
  };

  const anomalies = data?.anomalies || [];
  const filtered = anomalies
    .filter(a => filter === 'all' || a.category === filter)
    .filter(a => sevFilter === 'all' || a.severity === sevFilter);

  const scan = data?.scan;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="anomaly-detection-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="anomaly-page-title">Anomaly Detection</h1>
            <p className="text-sm text-muted-foreground">AI-powered detection of unusual patterns across sales, expenses, and bank data</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays} data-testid="scan-period">
              <SelectTrigger className="w-32 h-9" data-testid="scan-period-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runScan} disabled={loading} data-testid="run-scan-btn" className="bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning...' : 'Run Scan'}
            </Button>
          </div>
        </div>

        {/* No scan yet */}
        {!data && !loading && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardContent className="py-16 text-center">
              <Zap size={48} className="mx-auto text-orange-300 mb-4" />
              <h2 className="text-lg font-semibold mb-2">Run Your First Scan</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Anomaly detection analyzes your sales, expense, and bank data to identify unusual patterns, spikes, drops, and discrepancies.
              </p>
              <Button onClick={runScan} disabled={loading} data-testid="first-scan-btn" className="bg-orange-500 hover:bg-orange-600 text-white">
                <RefreshCw size={14} className="mr-1.5" /> Start Scan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scan Summary */}
        {scan && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="scan-summary">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{scan.total_anomalies}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-red-500">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{scan.critical}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-amber-500">Warning</p>
                  <p className="text-2xl font-bold text-amber-600">{scan.warning}</p>
                </CardContent>
              </Card>
              <Card className="border-sky-200 dark:border-sky-800">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-sky-500">Info</p>
                  <p className="text-2xl font-bold text-sky-600">{scan.info}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-emerald-500">Sales</p>
                  <p className="text-2xl font-bold">{scan.by_category?.sales || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-red-500">Expenses</p>
                  <p className="text-2xl font-bold">{scan.by_category?.expenses || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-blue-500">Bank</p>
                  <p className="text-2xl font-bold">{scan.by_category?.bank || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2" data-testid="anomaly-filters">
              <span className="text-xs text-muted-foreground font-medium">Filter:</span>
              {['all', 'sales', 'expenses', 'bank'].map(c => (
                <button key={c} onClick={() => setFilter(c)} data-testid={`filter-${c}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === c ? 'bg-stone-800 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200'}`}>
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)} {c !== 'all' ? `(${anomalies.filter(a => a.category === c).length})` : `(${anomalies.length})`}
                </button>
              ))}
              <span className="mx-1 text-stone-300">|</span>
              {['all', 'critical', 'warning', 'info'].map(s => (
                <button key={s} onClick={() => setSevFilter(s)} data-testid={`sev-filter-${s}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sevFilter === s ? 'bg-stone-800 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200'}`}>
                  {s === 'all' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Anomaly List */}
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-outfit flex items-center gap-2">
                  <BarChart3 size={14} /> Detected Anomalies ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center">
                    <Shield size={40} className="mx-auto text-emerald-300 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No anomalies detected</p>
                    <p className="text-xs text-stone-400">Your data looks normal for the selected period.</p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-stone-700" data-testid="anomaly-list">
                    {filtered.map((a, idx) => {
                      const sev = SEV_CONFIG[a.severity] || SEV_CONFIG.info;
                      const cat = CAT_CONFIG[a.category] || CAT_CONFIG.sales;
                      const SevIcon = sev.icon;
                      const CatIcon = cat.icon;
                      return (
                        <div key={a.id} className="p-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors" data-testid={`anomaly-row-${idx}`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-lg border ${sev.color}`}>
                              <SevIcon size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm">{a.title}</span>
                                <Badge variant="outline" className={`text-[9px] ${sev.color}`}>{sev.label}</Badge>
                                <Badge variant="outline" className="text-[9px]">
                                  <CatIcon size={10} className={`mr-0.5 ${cat.color}`} />
                                  {cat.label}
                                </Badge>
                                {a.date && <span className="text-[10px] text-muted-foreground font-mono">{a.date}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">{a.description}</p>
                              <div className="flex items-center gap-4 mt-1.5 text-[10px]">
                                <span className="text-muted-foreground">
                                  Actual: <strong className="text-foreground">SAR {typeof a.value === 'number' ? a.value.toLocaleString() : a.value}</strong>
                                </span>
                                <span className="text-muted-foreground">
                                  Expected: <strong className="text-foreground">SAR {typeof a.expected === 'number' ? a.expected.toLocaleString() : a.expected}</strong>
                                </span>
                                <span className="text-muted-foreground">
                                  Z-Score: <strong className={a.z_score > 0 ? 'text-red-500' : 'text-blue-500'}>{a.z_score > 0 ? '+' : ''}{a.z_score}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Scan History */}
        {history.length > 0 && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-outfit flex items-center gap-2">
                <Clock size={14} /> Scan History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y dark:divide-stone-700" data-testid="scan-history">
                {history.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50/50 dark:hover:bg-stone-800/50" data-testid={`scan-row-${idx}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${s.critical > 0 ? 'bg-red-500' : s.warning > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="text-xs">{new Date(s.scanned_at).toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">{s.period_days} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.critical > 0 && <Badge className="bg-red-100 text-red-700 text-[9px] dark:bg-red-900/30 dark:text-red-400">{s.critical} critical</Badge>}
                      {s.warning > 0 && <Badge className="bg-amber-100 text-amber-700 text-[9px] dark:bg-amber-900/30 dark:text-amber-400">{s.warning} warning</Badge>}
                      {s.info > 0 && <Badge className="bg-sky-100 text-sky-700 text-[9px] dark:bg-sky-900/30 dark:text-sky-400">{s.info} info</Badge>}
                      {s.total_anomalies === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Clean</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
