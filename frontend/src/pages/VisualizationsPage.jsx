import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Grid3X3, GitBranch, Gauge, Radar, Droplets,
  Network, LayoutGrid, Calendar, Download, TrendingUp, TrendingDown, ExternalLink
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Treemap, Tooltip, Legend, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, LineChart, Line, RadialBarChart, RadialBar
} from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
const fmt = (v) => `SAR ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Custom Gauge Component
const GaugeChart = ({ value, max, color, label, current, target, unit }) => {
  const clampedValue = Math.max(0, Math.min(value, max));
  const pct = clampedValue / max;
  const angle = pct * 180;
  const rad = (a) => (a * Math.PI) / 180;
  const cx = 100, cy = 90, r = 70;
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  // Calculate the active arc endpoint
  const endX = cx - r * Math.cos(rad(angle));
  const endY = cy - r * Math.sin(rad(angle));
  const large = angle > 180 ? 1 : 0;
  const activePath = pct > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${endX} ${endY}` : '';
  const displayVal = value > max ? `>${max}` : value < 0 ? '0' : value;
  return (
    <div className="text-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[180px] mx-auto">
        <path d={bgPath} fill="none" stroke="#e5e5e5" strokeWidth="12" strokeLinecap="round" />
        {pct > 0 && <path d={activePath} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />}
        <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">{displayVal}{unit}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#78716c" fontSize="10">{label}</text>
      </svg>
      <div className="text-[10px] text-muted-foreground mt-1">
        {typeof current === 'number' && typeof target === 'number' && (
          <span>{typeof current === 'number' && Math.abs(current) > 1000 ? fmt(current) : current} / {typeof target === 'number' && Math.abs(target) > 1000 ? fmt(target) : target}</span>
        )}
      </div>
    </div>
  );
};

// Custom Funnel Component
const FunnelChart = ({ data, onStageClick }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const widthPct = Math.max(20, (d.value / maxVal) * 100);
        return (
          <div key={d.stage} className="flex items-center gap-3 cursor-pointer group" data-testid={`funnel-stage-${i}`} onClick={() => onStageClick && onStageClick(d.stage, i)}>
            <div className="w-32 text-right text-xs font-medium text-stone-600 shrink-0 group-hover:text-orange-600 transition-colors">{d.stage}</div>
            <div className="flex-1 flex items-center">
              <div
                className="h-9 rounded-lg flex items-center justify-between px-3 text-white text-xs font-semibold transition-all duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: COLORS[i % COLORS.length], minWidth: 60 }}
              >
                <span>{d.value.toLocaleString()}</span>
                {d.amount > 0 && <span className="ml-2 opacity-80">{fmt(d.amount)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Custom Heatmap Calendar
const HeatmapCalendar = ({ data, metric = 'sales', onDayClick }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const dataMap = {};
  data.forEach(d => { dataMap[d.date] = d; });
  const values = data.map(d => d[metric]).filter(v => v > 0);
  const maxVal = Math.max(...values, 1);
  const getColor = (val) => {
    if (!val || val <= 0) return '#f5f5f4';
    const intensity = Math.min(val / maxVal, 1);
    if (metric === 'expenses') {
      const r = Math.round(254 * intensity);
      return `rgb(${r}, ${Math.round(68 * (1 - intensity) + 68)}, ${Math.round(68 * (1 - intensity) + 68)})`;
    }
    const g = Math.round(197 * intensity);
    return `rgb(${Math.round(34 * (1 - intensity) + 34)}, ${Math.round(g + 50)}, ${Math.round(94 * intensity)})`;
  };
  // Build weeks for the last 52 weeks
  const now = new Date();
  const weeks = [];
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 364);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // align to Sunday
  let current = new Date(startDate);
  let week = [];
  while (current <= now) {
    week.push(new Date(current));
    if (week.length === 7) { weeks.push(week); week = []; }
    current.setDate(current.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);
  const months = [];
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = w[0].getMonth();
    if (m !== lastMonth) { months.push({ month: w[0].toLocaleString('default', { month: 'short' }), col: i }); lastMonth = m; }
  });
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[700px]">
        <div className="flex gap-0.5 mb-1 ml-8">
          {months.map(m => (
            <div key={m.month + m.col} style={{ marginLeft: m.col * 13 - (months.indexOf(m) > 0 ? months[months.indexOf(m) - 1].col * 13 + 30 : 0) }} className="text-[9px] text-stone-400">{m.month}</div>
          ))}
        </div>
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1 text-[8px] text-stone-400 w-6">
            <span className="h-[11px]"></span><span className="h-[11px] flex items-center">Mon</span><span className="h-[11px]"></span><span className="h-[11px] flex items-center">Wed</span><span className="h-[11px]"></span><span className="h-[11px] flex items-center">Fri</span><span className="h-[11px]"></span>
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map(day => {
                const key = day.toISOString().slice(0, 10);
                const d = dataMap[key];
                const val = d ? d[metric] : 0;
                return (
                  <div
                    key={key}
                    className="w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-transform hover:scale-150"
                    style={{ backgroundColor: getColor(val) }}
                    onMouseEnter={() => setHoveredDay({ date: key, ...d })}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => onDayClick && onDayClick(key)}
                    data-testid={`heatmap-${key}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {hoveredDay && (
          <div className="mt-2 p-2 bg-white border rounded-lg shadow-sm text-xs inline-block">
            <span className="font-semibold">{hoveredDay.date}</span>
            {hoveredDay.sales !== undefined && <span className="ml-3 text-emerald-600">Sales: {fmt(hoveredDay.sales)}</span>}
            {hoveredDay.expenses !== undefined && <span className="ml-3 text-red-600">Exp: {fmt(hoveredDay.expenses)}</span>}
            {hoveredDay.count !== undefined && <span className="ml-3 text-stone-500">{hoveredDay.count} txn</span>}
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 text-[9px] text-stone-400">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map(i => (
            <div key={i} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: getColor(maxVal * i) }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

// Custom Waterfall Chart
const WaterfallChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(Math.abs(d.start), Math.abs(d.end))), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const isIncome = d.type === 'income';
        const isTotal = d.type === 'total';
        const barWidth = Math.abs(d.value) / maxVal * 60;
        return (
          <div key={d.name} className="flex items-center gap-2" data-testid={`waterfall-${i}`}>
            <div className="w-28 text-right text-xs font-medium text-stone-600 shrink-0 truncate">{d.name}</div>
            <div className="flex-1 relative h-7">
              <div
                className={`absolute h-full rounded-md flex items-center px-2 text-xs font-semibold text-white transition-all ${isTotal ? 'bg-stone-700' : isIncome ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(barWidth, 8)}%`, left: isIncome ? `${(d.start / maxVal) * 30}%` : `${(d.end / maxVal) * 30}%` }}
              >
                <span className="truncate">{fmt(Math.abs(d.value))}</span>
              </div>
            </div>
            <div className="w-20 text-right text-[10px] text-muted-foreground shrink-0">
              Running: {fmt(d.end)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Sankey-style Flow Visualization
const FlowChart = ({ data }) => {
  if (!data || !data.links || data.links.length === 0) return <p className="text-center text-muted-foreground py-8">No money flow data this month.</p>;
  const maxLink = Math.max(...data.links.map(l => l.value), 1);
  // Group by source
  const sourceGroups = {};
  data.links.forEach(l => {
    if (!sourceGroups[l.source]) sourceGroups[l.source] = [];
    sourceGroups[l.source].push(l);
  });
  return (
    <div className="space-y-4">
      {Object.entries(sourceGroups).map(([source, links]) => (
        <div key={source}>
          <div className="text-xs font-semibold text-stone-600 mb-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            {source}
          </div>
          <div className="space-y-1 ml-4">
            {links.sort((a, b) => b.value - a.value).map((l, i) => (
              <div key={`${l.source}-${l.target}-${i}`} className="flex items-center gap-2" data-testid={`flow-${l.source}-${l.target}`}>
                <div className="w-2 border-t-2 border-dashed border-stone-300" />
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="h-6 rounded flex items-center px-2 text-[10px] text-white font-medium"
                    style={{ width: `${Math.max(l.value / maxLink * 80, 10)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {l.target}
                  </div>
                  <span className="text-xs font-semibold text-stone-700 shrink-0">{fmt(l.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Treemap Custom Content
const TreemapContent = ({ x, y, width, height, name, value, depth, index }) => {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} fillOpacity={depth === 1 ? 0.85 : 0.65} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight="bold">{name?.slice(0, Math.floor(width / 7))}</text>
          {height > 38 && <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.8)" fontSize={9}>{fmt(value)}</text>}
        </>
      )}
    </g>
  );
};

export default function VisualizationsPage() {
  const navigate = useNavigate();
  const { t: tr } = useLanguage();
  const [tab, setTab] = useState('heatmap');
  const [heatmapData, setHeatmapData] = useState(null);
  const [heatmapMetric, setHeatmapMetric] = useState('sales');
  const [funnelData, setFunnelData] = useState(null);
  const [treemapData, setTreemapData] = useState(null);
  const [treemapMonths, setTreemapMonths] = useState('3');
  const [gaugeData, setGaugeData] = useState(null);
  const [radarData, setRadarData] = useState(null);
  const [waterfallData, setWaterfallData] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [timeCompare, setTimeCompare] = useState(null);
  const [comparePeriods, setComparePeriods] = useState('3');
  const chartRef = useRef(null);

  const loadTab = useCallback(async (t) => {
    setTab(t);
    try {
      if (t === 'heatmap' && !heatmapData) { const { data } = await api.get('/reports/heatmap-data'); setHeatmapData(data); }
      else if (t === 'funnel' && !funnelData) { const { data } = await api.get('/reports/sales-funnel'); setFunnelData(data); }
      else if (t === 'treemap' && !treemapData) { const { data } = await api.get(`/reports/expense-treemap?months=${treemapMonths}`); setTreemapData(data); }
      else if (t === 'gauges' && !gaugeData) { const { data } = await api.get('/reports/kpi-gauges'); setGaugeData(data); }
      else if (t === 'radar' && !radarData) { const { data } = await api.get('/reports/branch-radar'); setRadarData(data); }
      else if (t === 'waterfall' && !waterfallData) { const { data } = await api.get('/reports/cashflow-waterfall'); setWaterfallData(data); }
      else if (t === 'flow' && !flowData) { const { data } = await api.get('/reports/money-flow'); setFlowData(data); }
      else if (t === 'timeseries' && !timeCompare) { const { data } = await api.get(`/reports/time-series-compare?periods=${comparePeriods}`); setTimeCompare(data); }
    } catch { toast.error('Failed to load visualization data'); }
  }, [heatmapData, funnelData, treemapData, gaugeData, radarData, waterfallData, flowData, timeCompare, treemapMonths, comparePeriods]);

  useEffect(() => { loadTab('heatmap'); }, []);  // eslint-disable-line

  const exportChart = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.download = `ssc_chart_${tab}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Chart exported as PNG');
    } catch { toast.error('Export failed'); }
  };

  // Drill-down handlers
  const drillHeatmap = (date) => navigate(`/reports?tab=eod&date=${date}`);
  const drillFunnel = (stage, idx) => {
    if (idx <= 1) navigate('/customers');
    else if (idx === 2) navigate('/sales');
    else navigate('/sales?filter=credit');
  };
  const drillTreemap = (category) => navigate(`/expenses?category=${encodeURIComponent(category)}`);
  const drillWaterfall = (step) => {
    if (step.type === 'income') navigate('/sales');
    else if (step.type === 'expense') navigate('/expenses');
  };
  const drillRadar = (branchId) => navigate(`/?branch=${branchId}`);
  const drillChurn = (customerId) => navigate(`/customers?id=${customerId}`);

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="visualizations-page">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="viz-title">Visualizations</h1>
            <p className="text-sm text-muted-foreground">Advanced charts and data exploration</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={exportChart} data-testid="export-chart-btn">
            <Download size={14} className="mr-1" />Export as PNG
          </Button>
        </div>

        <Card className="border-stone-100">
          <CardContent className="pt-6">
            <Tabs value={tab} onValueChange={loadTab}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="heatmap" className="text-xs" data-testid="tab-heatmap"><Calendar size={12} className="mr-1" />Heatmap</TabsTrigger>
                <TabsTrigger value="funnel" className="text-xs" data-testid="tab-funnel"><GitBranch size={12} className="mr-1" />Funnel</TabsTrigger>
                <TabsTrigger value="treemap" className="text-xs" data-testid="tab-treemap"><Grid3X3 size={12} className="mr-1" />Treemap</TabsTrigger>
                <TabsTrigger value="gauges" className="text-xs" data-testid="tab-gauges"><Gauge size={12} className="mr-1" />Gauges</TabsTrigger>
                <TabsTrigger value="radar" className="text-xs" data-testid="tab-radar"><Radar size={12} className="mr-1" />Radar</TabsTrigger>
                <TabsTrigger value="waterfall" className="text-xs" data-testid="tab-waterfall"><Droplets size={12} className="mr-1" />Waterfall</TabsTrigger>
                <TabsTrigger value="flow" className="text-xs" data-testid="tab-flow"><Network size={12} className="mr-1" />Money Flow</TabsTrigger>
                <TabsTrigger value="timeseries" className="text-xs" data-testid="tab-timeseries"><TrendingUp size={12} className="mr-1" />Compare</TabsTrigger>
              </TabsList>

              <div ref={chartRef}>
                {/* HEATMAP */}
                <TabsContent value="heatmap" data-testid="heatmap-content">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Activity Heatmap — Last 12 Months</h3>
                      <Select value={heatmapMetric} onValueChange={setHeatmapMetric}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="expenses">Expenses</SelectItem>
                          <SelectItem value="profit">Profit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {heatmapData ? <HeatmapCalendar data={heatmapData} metric={heatmapMetric} /> : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* FUNNEL */}
                <TabsContent value="funnel" data-testid="funnel-content">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Sales Pipeline Funnel</h3>
                    {funnelData ? (
                      <>
                        <FunnelChart data={funnelData.funnel} />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                          <div className="bg-blue-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-blue-600">Total Customers</p>
                            <p className="text-lg font-bold text-blue-700" data-testid="funnel-total-customers">{funnelData.summary.total_customers}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-emerald-600">Active Customers</p>
                            <p className="text-lg font-bold text-emerald-700">{funnelData.summary.active_customers}</p>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-orange-600">Conversion Rate</p>
                            <p className="text-lg font-bold text-orange-700">{funnelData.summary.conversion_rate}%</p>
                          </div>
                          <div className="bg-purple-50 rounded-xl p-3 text-center">
                            <p className="text-xs text-purple-600">Collection Rate</p>
                            <p className="text-lg font-bold text-purple-700">{funnelData.summary.collection_rate}%</p>
                          </div>
                        </div>
                      </>
                    ) : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* TREEMAP */}
                <TabsContent value="treemap" data-testid="treemap-content">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Expense Breakdown Treemap</h3>
                      <div className="flex items-center gap-2">
                        <Select value={treemapMonths} onValueChange={async (v) => { setTreemapMonths(v); const { data } = await api.get(`/reports/expense-treemap?months=${v}`); setTreemapData(data); }}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Last Month</SelectItem>
                            <SelectItem value="3">Last 3 Months</SelectItem>
                            <SelectItem value="6">Last 6 Months</SelectItem>
                            <SelectItem value="12">Last Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {treemapData ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Total: {fmt(treemapData.total)}</Badge>
                          <Badge variant="outline" className="text-xs">{treemapData.tree.length} categories</Badge>
                        </div>
                        <ResponsiveContainer width="100%" height={350}>
                          <Treemap data={treemapData.tree} dataKey="value" nameKey="name" content={<TreemapContent />}>
                            <Tooltip formatter={(v) => fmt(v)} />
                          </Treemap>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          {treemapData.tree.slice(0, 8).map((t, i) => (
                            <div key={t.name} className="flex items-center gap-2 text-xs p-2 bg-stone-50 rounded-lg">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="truncate">{t.name}</span>
                              <span className="ml-auto font-semibold">{fmt(t.value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* GAUGES */}
                <TabsContent value="gauges" data-testid="gauges-content">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">KPI Gauges — {gaugeData?.month || 'Current Month'}</h3>
                    {gaugeData ? (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {gaugeData.gauges.map(g => (
                          <div key={g.name} className="bg-white border rounded-xl p-4" data-testid={`gauge-${g.name.toLowerCase().replace(/\s/g, '-')}`}>
                            <GaugeChart value={g.value} max={g.max} color={g.color} label={g.name} current={g.current} target={g.target} unit={g.unit} />
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* RADAR */}
                <TabsContent value="radar" data-testid="radar-content">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Branch Comparison Radar — {radarData?.month || 'Current Month'}</h3>
                    {radarData && radarData.branches.length > 0 ? (
                      <div className="grid lg:grid-cols-2 gap-4">
                        <ResponsiveContainer width="100%" height={350}>
                          <RadarChart data={radarData.radar}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                            <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                            {radarData.branches.map((b, i) => (
                              <RechartsRadar key={b.branch_id} name={b.name} dataKey={b.name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                            ))}
                            <Legend />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                          {radarData.branches.map((b, i) => (
                            <div key={b.branch_id} className="p-3 bg-stone-50 rounded-xl" data-testid={`radar-branch-${b.branch_id}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-sm font-semibold">{b.name}</span>
                                <Badge className="text-[9px] ml-auto">{b.margin}% margin</Badge>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div><span className="text-stone-400">Sales</span><p className="font-bold text-emerald-600">{fmt(b.sales)}</p></div>
                                <div><span className="text-stone-400">Expenses</span><p className="font-bold text-red-600">{fmt(b.expenses)}</p></div>
                                <div><span className="text-stone-400">Txns</span><p className="font-bold">{b.transactions}</p></div>
                                <div><span className="text-stone-400">Customers</span><p className="font-bold">{b.customers}</p></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-center text-muted-foreground py-8">{radarData ? 'No branches found.' : 'Loading...'}</p>}
                  </div>
                </TabsContent>

                {/* WATERFALL */}
                <TabsContent value="waterfall" data-testid="waterfall-content">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Cash Flow Waterfall — {waterfallData?.month || 'Current Month'}</h3>
                      {waterfallData && (
                        <Badge className={`${waterfallData.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} data-testid="waterfall-net">
                          Net: {fmt(waterfallData.net)}
                        </Badge>
                      )}
                    </div>
                    {waterfallData ? (
                      <>
                        <WaterfallChart data={waterfallData.waterfall} />
                        <div className="flex items-center gap-4 text-xs mt-3">
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500" /><span>Income</span></div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /><span>Expense</span></div>
                          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-stone-700" /><span>Net Balance</span></div>
                        </div>
                      </>
                    ) : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* MONEY FLOW */}
                <TabsContent value="flow" data-testid="flow-content">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Money Flow — {flowData?.month || 'Current Month'}</h3>
                      {flowData && (
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs text-emerald-600">Revenue: {fmt(flowData.total_revenue)}</Badge>
                          <Badge variant="outline" className="text-xs text-red-600">Expenses: {fmt(flowData.total_expenses)}</Badge>
                          <Badge variant="outline" className={`text-xs ${flowData.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Profit: {fmt(flowData.profit)}</Badge>
                        </div>
                      )}
                    </div>
                    {flowData ? <FlowChart data={flowData} /> : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>

                {/* TIME SERIES COMPARE */}
                <TabsContent value="timeseries" data-testid="timeseries-content">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Multi-Period Sales Comparison</h3>
                      <Select value={comparePeriods} onValueChange={async (v) => { setComparePeriods(v); const { data } = await api.get(`/reports/time-series-compare?periods=${v}`); setTimeCompare(data); }}>
                        <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Months</SelectItem>
                          <SelectItem value="3">3 Months</SelectItem>
                          <SelectItem value="4">4 Months</SelectItem>
                          <SelectItem value="6">6 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {timeCompare ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                          {timeCompare.periods?.map((p, i) => (
                            <div key={p.month} className="bg-stone-50 rounded-xl p-3 text-center" data-testid={`period-${p.month}`}>
                              <p className="text-xs text-stone-500">{p.month}</p>
                              <p className="text-base font-bold font-outfit" style={{ color: COLORS[i % COLORS.length] }}>{fmt(p.total)}</p>
                            </div>
                          ))}
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="day" type="number" domain={[1, 31]} tick={{ fontSize: 10 }} label={{ value: 'Day of Month', position: 'bottom', fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Legend />
                            {timeCompare.periods?.map((p, i) => (
                              <Line key={p.month} data={p.daily} dataKey="sales" name={p.month} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </>
                    ) : <p className="text-center text-muted-foreground py-8">Loading...</p>}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
