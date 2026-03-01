import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { CheckCircle, AlertTriangle, Users, TrendingUp, Award, Clock, Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function TaskCompliancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/task-reminders/compliance?days=${period}`);
      setData(d);
    } catch { toast.error('Failed to load compliance data'); }
    finally { setLoading(false); }
  };

  if (loading || !data) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64 text-muted-foreground">Loading compliance data...</div>
    </DashboardLayout>
  );

  const { overview, role_compliance, employee_leaderboard, heatmap, trend, flagged_employees } = data;

  const statusColor = (status) => {
    if (status === 'excellent') return 'bg-emerald-500';
    if (status === 'good') return 'bg-blue-500';
    if (status === 'needs_attention') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const complianceColor = (pct) => {
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-blue-600';
    if (pct >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const complianceBg = (pct) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-blue-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Build heatmap grid
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxHeatCount = Math.max(1, ...heatmap.map(h => h.count));
  const heatmapGrid = {};
  heatmap.forEach(h => { heatmapGrid[`${h.day_num}-${h.hour}`] = h.count; });

  // Find active hours range from heatmap
  const activeHours = [];
  for (let h = 6; h <= 23; h++) {
    const hasData = heatmap.some(x => x.hour === h);
    if (hasData || (h >= 8 && h <= 22)) activeHours.push(h);
  }
  if (activeHours.length === 0) for (let h = 8; h <= 22; h++) activeHours.push(h);

  // Radar chart data for roles
  const radarData = role_compliance.map(r => ({
    role: r.role, compliance: r.compliance, fullMark: 100
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="task-compliance-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="compliance-title">Task Compliance</h1>
            <p className="text-sm text-muted-foreground">Monitor staff task completion and identify gaps</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 h-9" data-testid="period-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => navigate('/task-reminders')} className="text-xs text-orange-600 hover:underline flex items-center gap-1" data-testid="manage-link">
              Manage Reminders <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Compliance</p>
              <p className={`text-3xl font-bold font-outfit ${complianceColor(overview.overall_compliance)}`} data-testid="overall-compliance">{overview.overall_compliance}%</p>
            </CardContent>
          </Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Alerts Sent</p>
            <p className="text-xl font-bold font-outfit" data-testid="alerts-sent">{overview.total_alerts_sent}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Acknowledged</p>
            <p className="text-xl font-bold font-outfit text-emerald-600" data-testid="total-acks">{overview.total_acknowledgements}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Active Reminders</p>
            <p className="text-xl font-bold font-outfit">{overview.active_reminders}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Best Role</p>
            <p className="text-sm font-bold font-outfit text-emerald-600 mt-1" data-testid="best-role">{overview.best_role}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Tracked</p>
            <p className="text-xl font-bold font-outfit">{overview.employees_tracked}</p>
          </CardContent></Card>
          <Card className={overview.flagged_count > 0 ? 'border-red-200 bg-red-50/30' : ''}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-red-600 uppercase">Flagged</p>
              <p className={`text-xl font-bold font-outfit ${overview.flagged_count > 0 ? 'text-red-600' : 'text-stone-400'}`} data-testid="flagged-count">{overview.flagged_count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Compliance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-outfit flex items-center gap-2"><Shield size={16} className="text-orange-500" />Compliance by Role</CardTitle>
            </CardHeader>
            <CardContent>
              {role_compliance.length > 0 ? (
                <div className="space-y-3">
                  {role_compliance.map(r => (
                    <div key={r.role} data-testid={`role-${r.role}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{r.role}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{r.acknowledged}/{r.alerts_sent} tasks</span>
                          <span className={`font-bold ${complianceColor(r.compliance)}`}>{r.compliance}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${complianceBg(r.compliance)}`} style={{ width: `${Math.min(r.compliance, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  {radarData.length >= 3 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#E7E5E4" />
                        <PolarAngleAxis dataKey="role" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar name="Compliance %" dataKey="compliance" stroke="#F5841F" fill="#F5841F" fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">No role data yet. Reminders need to trigger first.</p>}
            </CardContent>
          </Card>

          {/* Employee Leaderboard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-outfit flex items-center gap-2"><Award size={16} className="text-amber-500" />Employee Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              {employee_leaderboard.length > 0 ? (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {employee_leaderboard.map((e, i) => (
                    <div key={e.employee_id} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-amber-50 border border-amber-200' : i === 1 ? 'bg-stone-50' : i === 2 ? 'bg-orange-50/50' : 'hover:bg-stone-50'}`} data-testid={`emp-${e.employee_id}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-600'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{e.name}</p>
                          <Badge variant="outline" className="text-[9px]">{e.role}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${complianceBg(e.compliance)}`} style={{ width: `${Math.min(e.compliance, 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{e.acknowledged}/{e.alerts_received}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${complianceColor(e.compliance)}`}>{e.compliance}%</p>
                        <Badge className={`text-[8px] ${statusColor(e.status)}`}>{e.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-muted-foreground py-8">No employee data yet</p>}
            </CardContent>
          </Card>
        </div>

        {/* Compliance Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-outfit flex items-center gap-2"><TrendingUp size={16} className="text-blue-500" />{period}-Day Compliance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.some(t => t.alerts_sent > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v, name) => name === 'compliance' ? `${v}%` : v} />
                  <Legend />
                  <Line type="monotone" dataKey="compliance" name="Compliance %" stroke="#F5841F" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="alerts_sent" name="Alerts Sent" stroke="#94A3B8" strokeWidth={1} dot={false} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="acknowledged" name="Acknowledged" stroke="#22C55E" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No trend data yet. Compliance tracking begins after reminders start triggering.</p>}
          </CardContent>
        </Card>

        {/* Bottom Grid: Heatmap + Flagged */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-outfit flex items-center gap-2"><Clock size={16} className="text-purple-500" />Acknowledgement Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              {heatmap.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[400px]">
                    <div className="flex gap-0.5 mb-1">
                      <div className="w-10" />
                      {activeHours.map(h => (
                        <div key={h} className="flex-1 text-center text-[8px] text-stone-400">{h}:00</div>
                      ))}
                    </div>
                    {dayNames.map((day, dow) => (
                      <div key={dow} className="flex gap-0.5 mb-0.5">
                        <div className="w-10 text-[10px] text-stone-500 flex items-center">{day}</div>
                        {activeHours.map(h => {
                          const count = heatmapGrid[`${dow}-${h}`] || 0;
                          const intensity = count / maxHeatCount;
                          return (
                            <div key={h}
                              className="flex-1 h-6 rounded-sm transition-colors cursor-default flex items-center justify-center"
                              style={{ backgroundColor: count > 0 ? `rgba(34, 197, 94, ${0.15 + intensity * 0.85})` : '#F5F5F4' }}
                              title={`${day} ${h}:00 — ${count} acknowledgements`}
                              data-testid={`heat-${dow}-${h}`}
                            >
                              {count > 0 && <span className="text-[8px] font-bold text-white">{count}</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <span className="text-[9px] text-stone-400">Less</span>
                      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: v === 0 ? '#F5F5F4' : `rgba(34, 197, 94, ${0.15 + v * 0.85})` }} />
                      ))}
                      <span className="text-[9px] text-stone-400">More</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock size={32} className="mx-auto text-stone-300 mb-2" />
                  <p className="text-sm text-muted-foreground">No heatmap data yet</p>
                  <p className="text-xs text-stone-400 mt-1">Data populates as employees acknowledge tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flagged Employees */}
          <Card className={flagged_employees.length > 0 ? 'border-red-200' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-outfit flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                Needs Attention {flagged_employees.length > 0 && <Badge className="bg-red-500 text-[9px]">{flagged_employees.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {flagged_employees.length > 0 ? (
                <div className="space-y-2">
                  {flagged_employees.map(e => (
                    <div key={e.employee_id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200" data-testid={`flagged-${e.employee_id}`}>
                      <div>
                        <p className="text-sm font-medium text-red-800">{e.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] border-red-200 text-red-600">{e.role}</Badge>
                          <span className="text-[10px] text-red-500">{e.acknowledged}/{e.alerts_received} tasks completed</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{e.compliance}%</p>
                        <p className="text-[9px] text-red-400">Below threshold</p>
                      </div>
                    </div>
                  ))}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                    <p className="text-xs text-amber-700 font-medium">Recommended Actions:</p>
                    <ul className="text-[11px] text-amber-600 mt-1 space-y-0.5">
                      <li>Review task assignment workload for flagged employees</li>
                      <li>Schedule one-on-one feedback sessions</li>
                      <li>Consider adjusting reminder intervals or active hours</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-medium text-emerald-600">All Clear</p>
                  <p className="text-xs text-stone-400 mt-1">No employees below 50% compliance threshold</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
