import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Download, FileSpreadsheet, FileText, ShoppingCart, Receipt, Truck,
  TrendingUp, CalendarDays, Users, UserCheck, Package, Clock, Loader2,
  ArrowRight, History, RefreshCw
} from 'lucide-react';

const ICON_MAP = {
  ShoppingCart, Receipt, Truck, TrendingUp, CalendarDays, Users, UserCheck, Package
};

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', badge: 'bg-teal-100 text-teal-700' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
};

function getDatePreset(preset) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  switch (preset) {
    case 'today': return { start: today, end: today, label: 'Today' };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      return { start: d, end: d, label: 'Yesterday' };
    }
    case 'this_week': {
      const day = now.getDay();
      const s = new Date(now); s.setDate(s.getDate() - (day === 0 ? 6 : day - 1));
      return { start: s.toISOString().split('T')[0], end: today, label: 'This Week' };
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s.toISOString().split('T')[0], end: today, label: 'This Month' };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0], label: 'Last Month' };
    }
    case 'last_30': {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      return { start: s.toISOString().split('T')[0], end: today, label: 'Last 30 Days' };
    }
    case 'this_year': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s.toISOString().split('T')[0], end: today, label: 'This Year' };
    }
    default: return { start: null, end: null, label: 'All Time' };
  }
}

export default function ExportCenterPage() {
  const [reportTypes, setReportTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedPreset, setSelectedPreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [typesRes, branchRes, histRes] = await Promise.all([
        api.get('/export-center/report-types'),
        api.get('/branches'),
        api.get('/export-center/history'),
      ]);
      setReportTypes(typesRes.data);
      setBranches(branchRes.data || []);
      setHistory(histRes.data || []);
    } catch {
      toast.error('Failed to load export center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDateRange = () => {
    if (selectedPreset === 'custom') {
      return { start: customStart || null, end: customEnd || null, label: `${customStart} to ${customEnd}` };
    }
    return getDatePreset(selectedPreset);
  };

  const handleExport = async (reportType, format) => {
    const key = `${reportType}_${format}`;
    setExporting(prev => ({ ...prev, [key]: true }));
    try {
      const { start, end } = getDateRange();
      const res = await api.post('/export-center/generate', {
        report_type: reportType,
        format,
        start_date: start,
        end_date: end,
        branch_id: selectedBranch === 'all' ? null : selectedBranch,
      }, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded successfully`);
      // Refresh history
      const histRes = await api.get('/export-center/history');
      setHistory(histRes.data || []);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(prev => ({ ...prev, [key]: false }));
    }
  };

  const presets = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_30', label: 'Last 30 Days' },
    { value: 'this_year', label: 'This Year' },
    { value: 'all', label: 'All Time' },
    { value: 'custom', label: 'Custom Range' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-52 bg-stone-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl border bg-stone-50 animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const dateRange = getDateRange();

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="export-center-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="export-center-title">
              Export Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Generate and download business reports in one click</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-lg" data-testid="export-refresh-btn">
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Filters Bar */}
        <Card className="border shadow-sm" data-testid="export-filters">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              {/* Period */}
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Period</label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedPreset(p.value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        selectedPreset === p.value
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300 hover:text-orange-600'
                      }`}
                      data-testid={`preset-${p.value}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {selectedPreset === 'custom' && (
                  <div className="flex gap-2 mt-2">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white" data-testid="custom-start" />
                    <span className="text-xs text-muted-foreground self-center">to</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white" data-testid="custom-end" />
                  </div>
                )}
              </div>
              {/* Branch */}
              <div className="min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-9 text-xs rounded-lg" data-testid="export-branch-select">
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
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                <CalendarDays size={10} className="mr-1" />
                {dateRange.label}
              </Badge>
              {selectedBranch !== 'all' && (
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  {branches.find(b => b.id === selectedBranch)?.name || 'Branch'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Report Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="report-cards-grid">
          {reportTypes.map((rt) => {
            const IconComp = ICON_MAP[rt.icon] || FileText;
            const colors = COLOR_MAP[rt.color] || COLOR_MAP.orange;
            const isExportingPDF = exporting[`${rt.id}_pdf`];
            const isExportingExcel = exporting[`${rt.id}_excel`];

            return (
              <Card
                key={rt.id}
                className={`border ${colors.border} ${colors.bg} hover:shadow-md transition-all group card-enter card-glow`}
                data-testid={`report-card-${rt.id}`}
              >
                <CardContent className="pt-5 pb-4 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} border ${colors.border}`}>
                      <IconComp size={20} className={colors.icon} />
                    </div>
                    <Badge className={`text-[9px] ${colors.badge} border-0`}>{rt.id.replace('_', ' ')}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm text-stone-800 mb-1">{rt.name}</h3>
                  <p className="text-[11px] text-muted-foreground mb-4 flex-1">{rt.description}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(rt.id, 'excel')}
                      disabled={isExportingExcel}
                      className="flex-1 h-8 text-xs rounded-lg border-stone-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                      data-testid={`export-${rt.id}-excel`}
                    >
                      {isExportingExcel ? <Loader2 size={12} className="animate-spin mr-1" /> : <FileSpreadsheet size={12} className="mr-1" />}
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(rt.id, 'pdf')}
                      disabled={isExportingPDF}
                      className="flex-1 h-8 text-xs rounded-lg border-stone-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                      data-testid={`export-${rt.id}-pdf`}
                    >
                      {isExportingPDF ? <Loader2 size={12} className="animate-spin mr-1" /> : <FileText size={12} className="mr-1" />}
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Export History */}
        <Card className="border shadow-sm" data-testid="export-history">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History size={16} className="text-orange-500" />
              Recent Exports
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Download size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No exports yet. Generate your first report above!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs table-striped" data-testid="export-history-table">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Report</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Format</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Period</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Branch</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Rows</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">By</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((h, idx) => (
                      <tr key={h.id || idx} className="border-b border-stone-50 last:border-0">
                        <td className="py-2 px-3 font-medium text-stone-700">{h.title}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={`text-[9px] ${h.format === 'excel' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {h.format === 'excel' ? <FileSpreadsheet size={8} className="mr-0.5" /> : <FileText size={8} className="mr-0.5" />}
                            {h.format?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{h.date_range}</td>
                        <td className="py-2 px-3 text-muted-foreground">{h.branch}</td>
                        <td className="py-2 px-3 text-right text-stone-600 tabular-nums">{h.row_count?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-muted-foreground">{h.user_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {h.created_at ? new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
