import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, ShoppingCart, Users, Clock, Trophy, BarChart3, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b'];

export default function POSAnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const { data: d } = await api.get('/dashboard/live-analytics');
      setData(d);
      setLastUpdate(new Date());
    } catch {}
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 12000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const modeData = data ? Object.entries(data.payment_modes || {}).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: Math.round(v) })) : [];

  return (
    <DashboardLayout>
      <div className="space-y-4" data-testid="pos-analytics-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-outfit" data-testid="analytics-title">Live POS Analytics</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Auto-refreshing every 12s {lastUpdate && `| Last: ${lastUpdate.toLocaleTimeString()}`}
            </p>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-stone-100 transition-colors" data-testid="refresh-btn">
            <RefreshCw size={16} className="text-stone-500" />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-3" data-testid="kpi-cards">
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Total Sales</span></div>
            <p className="text-xl font-bold font-outfit text-emerald-700" data-testid="kpi-total-sales">SAR {(data?.total_sales || 0).toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-red-100 bg-gradient-to-br from-red-50 to-white"><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-red-500" /><span className="text-[10px] text-red-600 font-medium uppercase tracking-wider">Expenses</span></div>
            <p className="text-xl font-bold font-outfit text-red-700">SAR {(data?.total_expenses || 0).toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white"><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><BarChart3 size={14} className="text-blue-500" /><span className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Net</span></div>
            <p className={`text-xl font-bold font-outfit ${(data?.net || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>SAR {(data?.net || 0).toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white"><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><ShoppingCart size={14} className="text-purple-500" /><span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Transactions</span></div>
            <p className="text-xl font-bold font-outfit text-purple-700" data-testid="kpi-count">{data?.sales_count || 0}</p>
          </CardContent></Card>
          <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white"><CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-amber-500" /><span className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Avg Ticket</span></div>
            <p className="text-xl font-bold font-outfit text-amber-700">SAR {data?.avg_ticket || 0}</p>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Branch Leaderboard */}
          <Card className="border-stone-100 col-span-1">
            <CardHeader className="py-3"><CardTitle className="text-sm font-outfit flex items-center gap-2"><Trophy size={14} className="text-amber-500" />Branch Leaderboard</CardTitle></CardHeader>
            <CardContent className="pt-0" data-testid="branch-leaderboard">
              {(data?.branch_leaderboard || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No sales today yet</p>}
              {(data?.branch_leaderboard || []).map((b, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-stone-100 text-stone-600' : 'bg-stone-50 text-stone-400'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{b.count} sales</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-emerald-600">SAR {b.total.toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Hourly Sales Chart */}
          <Card className="border-stone-100 col-span-1">
            <CardHeader className="py-3"><CardTitle className="text-sm font-outfit flex items-center gap-2"><Clock size={14} className="text-blue-500" />Hourly Breakdown</CardTitle></CardHeader>
            <CardContent>
              {(data?.hourly_chart || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.hourly_chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => [`SAR ${v}`, 'Sales']} />
                    <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-muted-foreground text-center py-12">No hourly data yet</p>}
            </CardContent>
          </Card>

          {/* Payment Mode Pie + Top Cashiers */}
          <Card className="border-stone-100 col-span-1">
            <CardHeader className="py-3"><CardTitle className="text-sm font-outfit flex items-center gap-2"><Users size={14} className="text-purple-500" />Top Cashiers</CardTitle></CardHeader>
            <CardContent className="pt-0" data-testid="top-cashiers">
              {modeData.length > 0 && (
                <div className="flex justify-center mb-2">
                  <ResponsiveContainer width={120} height={100}>
                    <PieChart>
                      <Pie data={modeData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2}>
                        {modeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`SAR ${v}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center gap-1">
                    {modeData.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                        <span>{m.name}: SAR {m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(data?.top_cashiers || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No cashier data yet</p>}
              {(data?.top_cashiers || []).map((c, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-stone-50 last:border-0">
                  <Badge variant="outline" className="text-[10px] w-5 h-5 p-0 flex items-center justify-center">{i + 1}</Badge>
                  <span className="text-xs flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-mono font-medium">{c.count}x</span>
                  <span className="text-xs font-mono font-bold text-emerald-600">SAR {c.total.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Live Sales Ticker */}
        <Card className="border-stone-100">
          <CardHeader className="py-3"><CardTitle className="text-sm font-outfit flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>Live Sales Feed
          </CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto" data-testid="live-feed">
              {(data?.recent_sales || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No sales recorded today</p>}
              {(data?.recent_sales || []).map((s, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-stone-50 ${i === 0 ? 'bg-emerald-50/40' : 'hover:bg-stone-50/50'} transition-colors`} data-testid={`sale-row-${i}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.mode.includes('cash') ? 'bg-emerald-100 text-emerald-600' : s.mode.includes('bank') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                    <DollarSign size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.description || 'Sale'} <Badge variant="outline" className="text-[10px] ml-1">{s.mode}</Badge></p>
                    <p className="text-[10px] text-muted-foreground">{s.branch} | {s.cashier}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-emerald-600">SAR {s.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{s.time ? new Date(s.time).toLocaleTimeString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
