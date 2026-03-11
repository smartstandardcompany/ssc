import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, ChevronLeft, ChevronRight, UserCheck, AlertTriangle, Sparkles, Loader2, TrendingUp, Users, CalendarDays, Zap, ShieldAlert, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#F5841F', '#3B82F6', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getWeekDates(weekStart) {
  const dates = [];
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default function SchedulePage() {
  const { t } = useLanguage();
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [newShift, setNewShift] = useState({ name: '', start_time: '08:00', end_time: '16:00', break_minutes: 60, days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#F5841F' });
  const [assignData, setAssignData] = useState({ employee_id: '', shift_id: '', dates: [] });
  const [timeData, setTimeData] = useState({ actual_in: '', actual_out: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [, eR, sR] = await Promise.all([Promise.resolve({ data: [] }), api.get('/employees'), api.get('/shifts')]);
        setEmployees(eR.data); setShifts(sR.data);
        if (branches.length > 0) setBranchId(branches[0].id);
      } catch { toast.error('Failed to load'); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (branchId) { fetchAssignments(); fetchAttendance(); fetchInsights(); }
  }, [branchId, weekStart]);

  const fetchInsights = async () => {
    if (!branchId) return;
    setInsightsLoading(true);
    try {
      const { data } = await api.get(`/staffing-insights?branch_id=${branchId}&week_start=${weekStart}`);
      setInsights(data);
    } catch { }
    finally { setInsightsLoading(false); }
  };

  const fetchAssignments = async () => {
    try {
      const r = await api.get(`/shift-assignments?branch_id=${branchId}&week_start=${weekStart}`);
      setAssignments(r.data);
    } catch {}
  };

  const fetchAttendance = async () => {
    try {
      const month = weekStart.substring(0, 7);
      const r = await api.get(`/shift-assignments/attendance-summary?branch_id=${branchId}&month=${month}`);
      setAttendance(r.data);
    } catch {}
  };

  const weekDates = getWeekDates(weekStart);
  const branchEmployees = employees.filter(e => e.branch_id === branchId && e.active !== false);
  const branchShifts = shifts.filter(s => s.branch_id === branchId && s.active !== false);

  const handleCreateShift = async () => {
    if (!newShift.name || !branchId) { toast.error('Name and branch required'); return; }
    try {
      await api.post('/shifts', { ...newShift, branch_id: branchId });
      toast.success('Shift created');
      const r = await api.get('/shifts');
      setShifts(r.data);
      setShowShiftDialog(false);
      setNewShift({ name: '', start_time: '08:00', end_time: '16:00', break_minutes: 60, days: ['Mon','Tue','Wed','Thu','Fri','Sat'], color: '#F5841F' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAssign = async () => {
    if (!assignData.employee_id || !assignData.shift_id) { toast.error('Select employee and shift'); return; }
    const dates = assignData.dates.length > 0 ? assignData.dates : weekDates;
    try {
      await api.post('/shift-assignments/bulk', {
        assignments: dates.map(d => ({
          employee_id: assignData.employee_id,
          shift_id: assignData.shift_id,
          branch_id: branchId,
          date: d, week_start: weekStart
        }))
      });
      toast.success('Schedule assigned');
      setShowAssignDialog(false);
      setAssignData({ employee_id: '', shift_id: '', dates: [] });
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleUpdateTime = async () => {
    if (!selectedAssignment) return;
    try {
      await api.put(`/shift-assignments/${selectedAssignment.id}`, timeData);
      toast.success('Attendance updated');
      setShowTimeDialog(false);
      fetchAssignments(); fetchAttendance();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const navWeek = (dir) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + (dir * 7));
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const getAssignment = (empId, date) => assignments.find(a => a.employee_id === empId && a.date === date);

  const statusColor = (status) => {
    switch(status) {
      case 'present': return 'bg-success/20 text-success';
      case 'late': return 'bg-warning/20 text-warning';
      case 'absent': return 'bg-error/20 text-error';
      case 'day_off': return 'bg-stone-200 text-stone-500';
      default: return 'bg-stone-100 text-stone-500';
    }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="schedule-title">Staff Schedule</h1>
            <p className="text-muted-foreground text-sm">Manage shifts, schedules, and track attendance</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={branchId || "none"} onValueChange={(v) => setBranchId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-40" data-testid="schedule-branch-select"><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowShiftDialog(true)} data-testid="create-shift-btn">
              <Clock size={14} className="mr-1" />New Shift
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setShowAssignDialog(true)} data-testid="assign-schedule-btn">
              <Plus size={14} className="mr-1" />Assign Schedule
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:from-violet-600 hover:to-purple-700"
              disabled={aiLoading || !branchId} data-testid="ai-recommend-btn"
              onClick={async () => {
                if (!branchId) { toast.error('Select a branch first'); return; }
                setAiLoading(true);
                try {
                  const { data } = await api.post('/shifts/ai-recommend', { branch_id: branchId, week_start: weekStart });
                  setAiRecommendations(data.recommendations || []);
                  toast.success(`AI generated ${(data.recommendations || []).length} shift recommendations`);
                } catch (err) { toast.error(err.response?.data?.detail || 'AI recommendation failed'); }
                finally { setAiLoading(false); }
              }}>
              {aiLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
              {aiLoading ? 'Analyzing...' : 'AI Schedule'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="schedule">
          <TabsList>
            <TabsTrigger value="schedule">Weekly Schedule</TabsTrigger>
            <TabsTrigger value="insights" data-testid="insights-tab"><TrendingUp size={12} className="mr-1" />Staffing Insights</TabsTrigger>
            <TabsTrigger value="shifts">Shifts ({branchShifts.length})</TabsTrigger>
            <TabsTrigger value="attendance">Attendance Summary</TabsTrigger>
            {aiRecommendations && <TabsTrigger value="ai" data-testid="ai-tab"><Sparkles size={12} className="mr-1" />AI Suggestions ({aiRecommendations.length})</TabsTrigger>}
          </TabsList>

          {/* AI RECOMMENDATIONS */}
          {aiRecommendations && (
            <TabsContent value="ai" data-testid="ai-recommendations">
              <Card className="border-purple-100">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-outfit flex items-center gap-2"><Sparkles size={14} className="text-purple-500" />AI-Recommended Schedule</CardTitle>
                    <Button size="sm" className="rounded-xl" data-testid="apply-ai-btn" onClick={async () => {
                      const grouped = {};
                      for (const rec of aiRecommendations) {
                        if (!rec.shift_id || !rec.employee_id) continue;
                        const key = `${rec.employee_id}|${rec.shift_id}`;
                        if (!grouped[key]) grouped[key] = { employee_id: rec.employee_id, shift_id: rec.shift_id, dates: [] };
                        if (rec.date) grouped[key].dates.push(rec.date);
                      }
                      try {
                        for (const g of Object.values(grouped)) {
                          if (g.dates.length > 0) {
                            await api.post('/shift-assignments/bulk', {
                              assignments: g.dates.map(d => ({ employee_id: g.employee_id, shift_id: g.shift_id, branch_id: branchId, date: d, week_start: weekStart }))
                            });
                          }
                        }
                        toast.success('AI schedule applied');
                        fetchAssignments();
                        setAiRecommendations(null);
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to apply'); }
                    }}>Apply All</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-purple-50 border-y border-purple-100">
                        <th className="text-left p-2 text-xs font-medium">Employee</th>
                        <th className="text-left p-2 text-xs font-medium">Shift</th>
                        <th className="text-left p-2 text-xs font-medium hidden sm:table-cell">Day</th>
                        <th className="text-left p-2 text-xs font-medium">Date</th>
                        <th className="text-left p-2 text-xs font-medium hidden md:table-cell">Reason</th>
                      </tr></thead>
                      <tbody>
                        {aiRecommendations.map((rec, i) => (
                          <tr key={i} className="border-b border-stone-50 hover:bg-purple-50/30">
                            <td className="p-2 font-medium">{rec.employee_name}</td>
                            <td className="p-2"><Badge variant="outline" className="text-xs">{rec.shift_name}</Badge></td>
                            <td className="p-2 hidden sm:table-cell">{rec.day}</td>
                            <td className="p-2 font-mono text-xs">{rec.date}</td>
                            <td className="p-2 text-xs text-muted-foreground hidden md:table-cell">{rec.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* STAFFING INSIGHTS */}
          <TabsContent value="insights" data-testid="staffing-insights">
            {insightsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
            ) : !insights ? (
              <div className="text-center py-16 text-muted-foreground">Select a branch to see staffing insights</div>
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Staff</p>
                      <p className="text-2xl font-bold mt-1">{insights.total_employees}</p>
                      <p className="text-xs text-muted-foreground">active employees</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Peak Hour</p>
                      <p className="text-2xl font-bold mt-1 text-orange-600">{insights.peak_hours?.peak_hour?.hour || '--'}</p>
                      <p className="text-xs text-muted-foreground">{insights.peak_hours?.peak_hour ? `${insights.peak_hours.peak_hour.orders} orders` : 'no data'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Peak Day</p>
                      <p className="text-2xl font-bold mt-1 text-blue-600">{insights.peak_hours?.peak_day?.day || '--'}</p>
                      <p className="text-xs text-muted-foreground">{insights.peak_hours?.peak_day ? `${insights.peak_hours.peak_day.orders} orders` : 'no data'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Suggestions</p>
                      <p className="text-2xl font-bold mt-1">{insights.total_suggestions}</p>
                      <p className="text-xs text-muted-foreground">{insights.suggestions?.filter(s => s.priority === 'high').length || 0} high priority</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Peak Hours Chart */}
                {(insights.peak_hours?.hourly || []).some(h => h.orders > 0) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit">Order Volume by Hour (Last 60 Days)</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={insights.peak_hours?.hourly || []}>
                          <defs>
                            <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip formatter={(v) => [`${v} orders`, 'Orders']} />
                          <Area type="monotone" dataKey="orders" stroke="#f97316" fill="url(#insightGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Daily Coverage vs Demand */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit">Weekly Coverage vs Demand</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Day</th>
                            <th className="pb-2 font-medium text-center">Staff Scheduled</th>
                            <th className="pb-2 font-medium text-center">Avg Orders</th>
                            <th className="pb-2 font-medium text-center">Demand</th>
                            <th className="pb-2 font-medium">Shifts Coverage</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(insights.daily_coverage || []).map((dc, i) => {
                            const demandColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-emerald-100 text-emerald-700' };
                            const hasGap = dc.shifts?.some(s => s.assigned_count === 0);
                            return (
                              <tr key={i} className="border-b last:border-0 hover:bg-stone-50" data-testid={`coverage-row-${i}`}>
                                <td className="py-3 font-medium">{dc.day}<span className="text-xs text-muted-foreground ml-2">{dc.date}</span></td>
                                <td className="py-3 text-center">
                                  <span className="inline-flex items-center gap-1"><Users size={13} />{dc.staff_count}</span>
                                </td>
                                <td className="py-3 text-center font-medium">{dc.order_demand}</td>
                                <td className="py-3 text-center">
                                  <Badge className={`text-[10px] ${demandColors[dc.demand_level] || ''}`}>{dc.demand_level}</Badge>
                                </td>
                                <td className="py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {dc.shifts?.map((s, si) => (
                                      <Badge key={si} variant="outline" className={`text-[10px] ${s.assigned_count === 0 ? 'border-red-300 text-red-600 bg-red-50' : ''}`}>
                                        {s.shift_name}: {s.assigned_count}
                                      </Badge>
                                    ))}
                                    {(!dc.shifts || dc.shifts.length === 0) && <span className="text-xs text-muted-foreground">No shifts</span>}
                                  </div>
                                </td>
                                <td className="py-3">
                                  {hasGap ? (
                                    <Badge className="bg-red-50 text-red-600 text-[10px]"><ShieldAlert size={10} className="mr-0.5" />Gap</Badge>
                                  ) : dc.staff_count > 0 ? (
                                    <Badge className="bg-emerald-50 text-emerald-600 text-[10px]">Covered</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">Empty</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Shift Demand Analysis */}
                {(insights.shift_demand || []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit">Shift Demand Analysis</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {insights.shift_demand.map((sd, i) => (
                          <div key={i} className={`p-4 rounded-xl border-2 transition-all ${sd.demand_level === 'high' ? 'border-orange-300 bg-orange-50/50' : 'border-stone-200'}`}
                            data-testid={`shift-demand-${i}`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">{sd.shift_name}</h4>
                              <Badge className={sd.demand_level === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-600'} variant="outline">
                                {sd.demand_level === 'high' ? <Zap size={10} className="mr-0.5" /> : null}
                                {sd.demand_level}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{sd.start_time} - {sd.end_time}</p>
                            <p className="text-lg font-bold mt-1">{sd.orders_during_shift} <span className="text-xs font-normal text-muted-foreground">orders during shift</span></p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {(insights.suggestions || []).length > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" />Scheduling Suggestions ({insights.suggestions.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {insights.suggestions.map((s, i) => (
                          <div key={i} className={`p-3 rounded-lg border-l-4 ${
                            s.priority === 'high' ? 'border-l-red-500 bg-red-50/50' : 'border-l-amber-400 bg-amber-50/50'
                          }`} data-testid={`suggestion-${i}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[10px] ${s.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{s.priority}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{s.type.replace('_', ' ')}</Badge>
                                </div>
                                <p className="text-sm mt-1 font-medium">{s.message}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><ArrowRight size={10} />{s.action}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(insights.suggestions || []).length === 0 && insights.total_employees > 0 && (
                  <Card className="border-emerald-200">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                        <UserCheck size={24} className="text-emerald-600" />
                      </div>
                      <p className="font-medium text-emerald-700">All Good!</p>
                      <p className="text-sm text-muted-foreground">No staffing issues detected for this week.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* WEEKLY SCHEDULE */}
          <TabsContent value="schedule" data-testid="schedule-grid">
            <Card className="border-stone-100">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <Button size="sm" variant="ghost" onClick={() => navWeek(-1)}><ChevronLeft size={16} /></Button>
                  <h3 className="font-outfit font-medium">Week of {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weekDates[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setWeekStart(getWeekStart(new Date()))}>Today</Button>
                    <Button size="sm" variant="ghost" onClick={() => navWeek(1)}><ChevronRight size={16} /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead><tr className="border-b">
                      <th className="text-left p-2 text-sm font-medium w-36">Employee</th>
                      {weekDates.map((d, i) => {
                        const isToday = d === new Date().toISOString().split('T')[0];
                        return <th key={d} className={`text-center p-2 text-xs font-medium ${isToday ? 'bg-primary/10 rounded-t-lg' : ''}`}>
                          <div>{DAYS[i]}</div>
                          <div className="text-muted-foreground">{new Date(d + 'T12:00').getDate()}</div>
                        </th>;
                      })}
                    </tr></thead>
                    <tbody>
                      {branchEmployees.map(emp => (
                        <tr key={emp.id} className="border-b hover:bg-stone-50">
                          <td className="p-2 text-sm font-medium">{emp.name}</td>
                          {weekDates.map(date => {
                            const a = getAssignment(emp.id, date);
                            const isToday = date === new Date().toISOString().split('T')[0];
                            return (
                              <td key={date} className={`p-1 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                                {a ? (
                                  <button onClick={() => { setSelectedAssignment(a); setTimeData({ actual_in: a.actual_in || '', actual_out: a.actual_out || '' }); setShowTimeDialog(true); }}
                                    className={`w-full p-1 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${statusColor(a.status)}`}
                                    style={{ borderLeft: `3px solid ${branchShifts.find(s => s.id === a.shift_id)?.color || '#ccc'}` }}
                                    data-testid={`cell-${emp.id}-${date}`}>
                                    <div className="font-medium">{a.shift_name}</div>
                                    {a.actual_in && <div className="text-[10px]">{a.actual_in}-{a.actual_out || '?'}</div>}
                                    {a.overtime_hours > 0 && <div className="text-[10px] text-primary font-bold">+{a.overtime_hours}h OT</div>}
                                  </button>
                                ) : (
                                  <div className="w-full p-2 rounded-lg text-xs text-stone-300">—</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {branchEmployees.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No employees in this branch</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SHIFTS */}
          <TabsContent value="shifts">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branchShifts.map(s => (
                    <div key={s.id} className="p-4 rounded-xl border-2 border-stone-200 hover:border-stone-300 transition-all" style={{ borderLeftColor: s.color, borderLeftWidth: '4px' }} data-testid={`shift-card-${s.id}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{s.name}</h3>
                        <Button size="sm" variant="ghost" className="h-6 text-error text-xs" onClick={async () => {
                          if (window.confirm(`Delete "${s.name}"?`)) { await api.delete(`/shifts/${s.id}`); const r = await api.get('/shifts'); setShifts(r.data); toast.success('Deleted'); }
                        }}>Delete</Button>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Clock size={14} />{s.start_time} - {s.end_time}</div>
                        <div>Break: {s.break_minutes} min</div>
                        <div className="flex gap-1 flex-wrap mt-2">
                          {DAYS.map(d => <Badge key={d} variant="outline" className={`text-xs ${s.days?.includes(d) ? 'bg-primary/10 border-primary text-primary' : 'opacity-30'}`}>{d}</Badge>)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {branchShifts.length === 0 && <div className="col-span-3 py-8 text-center text-muted-foreground">No shifts created for this branch. Create one to get started.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATTENDANCE SUMMARY */}
          <TabsContent value="attendance">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                <table className="w-full" data-testid="attendance-table">
                  <thead><tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Employee</th>
                    <th className="text-right p-3 text-sm font-medium">Scheduled</th>
                    <th className="text-right p-3 text-sm font-medium">Present</th>
                    <th className="text-right p-3 text-sm font-medium hidden sm:table-cell">Late</th>
                    <th className="text-right p-3 text-sm font-medium hidden sm:table-cell">Absent</th>
                    <th className="text-right p-3 text-sm font-medium hidden md:table-cell">Overtime (h)</th>
                    <th className="text-right p-3 text-sm font-medium">Attendance %</th>
                  </tr></thead>
                  <tbody>
                    {attendance.map(a => {
                      const pct = a.scheduled > 0 ? Math.round(a.present / a.scheduled * 100) : 0;
                      return (
                        <tr key={a.employee_id} className="border-b hover:bg-stone-50">
                          <td className="p-3 text-sm font-medium">{a.employee_name}</td>
                          <td className="p-3 text-sm text-right">{a.scheduled}</td>
                          <td className="p-3 text-sm text-right text-success font-medium">{a.present}</td>
                          <td className="p-3 text-sm text-right text-warning font-medium hidden sm:table-cell">{a.late}</td>
                          <td className="p-3 text-sm text-right text-error font-medium hidden sm:table-cell">{a.absent}</td>
                          <td className="p-3 text-sm text-right text-primary font-bold hidden md:table-cell">{a.overtime_hours.toFixed(1)}</td>
                          <td className="p-3 text-right"><Badge className={pct >= 90 ? 'bg-success/20 text-success' : pct >= 70 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}>{pct}%</Badge></td>
                        </tr>
                      );
                    })}
                    {attendance.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No attendance data for this month</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CREATE SHIFT DIALOG */}
        <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
          <DialogContent data-testid="create-shift-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Create Shift</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Shift Name *</Label><Input value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} placeholder="e.g. Morning" data-testid="shift-name-input" /></div>
                <div><Label>Color</Label>
                  <div className="flex gap-1 mt-1">{COLORS.map(c => <button key={c} className={`w-6 h-6 rounded-full border-2 ${newShift.color === c ? 'border-stone-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setNewShift({ ...newShift, color: c })} />)}</div>
                </div>
                <div><Label>Start Time</Label><Input type="time" value={newShift.start_time} onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={newShift.end_time} onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })} /></div>
                <div><Label>Break (min)</Label><Input type="number" value={newShift.break_minutes} onChange={(e) => setNewShift({ ...newShift, break_minutes: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div>
                <Label>Working Days</Label>
                <div className="flex gap-2 mt-1">{DAYS.map(d => <Button key={d} size="sm" variant={newShift.days.includes(d) ? "default" : "outline"} className="h-8 w-10 text-xs" onClick={() => {
                  setNewShift({ ...newShift, days: newShift.days.includes(d) ? newShift.days.filter(x => x !== d) : [...newShift.days, d] });
                }}>{d}</Button>)}</div>
              </div>
              <Button className="rounded-xl w-full" onClick={handleCreateShift} data-testid="save-shift-btn">Create Shift</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ASSIGN SCHEDULE DIALOG */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent data-testid="assign-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Assign Schedule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Employee *</Label>
                <Select value={assignData.employee_id || "none"} onValueChange={(v) => setAssignData({ ...assignData, employee_id: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="assign-employee-select"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                  <SelectContent>{branchEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Shift *</Label>
                <Select value={assignData.shift_id || "none"} onValueChange={(v) => setAssignData({ ...assignData, shift_id: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="assign-shift-select"><SelectValue placeholder="Select Shift" /></SelectTrigger>
                  <SelectContent>{branchShifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Days to assign (click to toggle, empty = full week)</Label>
                <div className="flex gap-2 mt-1">{weekDates.map((d, i) => <Button key={d} size="sm" variant={assignData.dates.includes(d) ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => {
                  setAssignData({ ...assignData, dates: assignData.dates.includes(d) ? assignData.dates.filter(x => x !== d) : [...assignData.dates, d] });
                }}><div><div>{DAYS[i]}</div><div className="text-[10px]">{new Date(d + 'T12:00').getDate()}</div></div></Button>)}</div>
              </div>
              <Button className="rounded-xl w-full" onClick={handleAssign} data-testid="confirm-assign-btn">
                Assign {assignData.dates.length > 0 ? `${assignData.dates.length} days` : 'Full Week'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* TIME IN/OUT DIALOG */}
        <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
          <DialogContent data-testid="time-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Record Attendance</DialogTitle></DialogHeader>
            {selectedAssignment && (
              <div className="space-y-3">
                <div className="p-3 bg-stone-50 rounded-xl text-sm">
                  <p><strong>{selectedAssignment.employee_name}</strong></p>
                  <p className="text-muted-foreground">{selectedAssignment.shift_name} · {selectedAssignment.date}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Actual In</Label><Input type="time" value={timeData.actual_in} onChange={(e) => setTimeData({ ...timeData, actual_in: e.target.value })} data-testid="time-in-input" /></div>
                  <div><Label>Actual Out</Label><Input type="time" value={timeData.actual_out} onChange={(e) => setTimeData({ ...timeData, actual_out: e.target.value })} data-testid="time-out-input" /></div>
                </div>
                <div className="flex gap-2">
                  <Button className="rounded-xl flex-1" onClick={handleUpdateTime} data-testid="save-time-btn"><UserCheck size={14} className="mr-1" />Save</Button>
                  <Button variant="outline" className="rounded-xl" onClick={async () => {
                    await api.put(`/shift-assignments/${selectedAssignment.id}`, { status: 'absent' });
                    toast.success('Marked absent');
                    setShowTimeDialog(false); fetchAssignments(); fetchAttendance();
                  }} data-testid="mark-absent-btn"><AlertTriangle size={14} className="mr-1" />Absent</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
