import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Users, TrendingUp, Clock, Award, AlertTriangle, Loader2, Search,
  Sparkles, Plus, CheckCircle, Timer, UserCheck, BarChart3, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';

const TIER_CONFIG = {
  excellent: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Excellent' },
  good: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Good' },
  average: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Average' },
  needs_improvement: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Needs Improvement' },
};

const ROLES = ['cleaner', 'waiter', 'cashier', 'chef'];

function ScoreRing({ score, size = 56 }) {
  const circumference = 2 * Math.PI * 22;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="22" fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle cx="25" cy="25" r="22" fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 25 25)" className="transition-all duration-700" />
      <text x="25" y="27" textAnchor="middle" fontSize="11" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export default function StaffPerformancePage() {
  const { branches, fetchBranches } = useBranchStore();
  const [branchId, setBranchId] = useState('all');
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // AI Duty state
  const [showAiDuty, setShowAiDuty] = useState(false);
  const [aiRole, setAiRole] = useState('cleaner');
  const [aiContext, setAiContext] = useState('');
  const [aiShift, setAiShift] = useState('08:00 - 22:00');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTasks, setAiTasks] = useState(null);
  const [creatingReminders, setCreatingReminders] = useState(false);

  useEffect(() => { fetchBranches(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = `period_days=${period}${branchId !== 'all' ? `&branch_id=${branchId}` : ''}`;
      const { data: d } = await api.get(`/staff-performance?${params}`);
      setData(d);
    } catch { toast.error('Failed to load performance data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [branchId, period]);

  const filtered = (data?.employees || []).filter(e => {
    if (!search) return true;
    return e.name.toLowerCase().includes(search.toLowerCase()) || (e.role || '').toLowerCase().includes(search.toLowerCase());
  });

  const tierData = Object.entries(data?.summary?.tier_breakdown || {}).map(([tier, count]) => ({
    name: TIER_CONFIG[tier]?.label || tier, value: count,
    fill: tier === 'excellent' ? '#10b981' : tier === 'good' ? '#3b82f6' : tier === 'average' ? '#f59e0b' : '#ef4444',
  }));

  // AI Duty generation
  const handleAiGenerate = async () => {
    setAiLoading(true);
    setAiTasks(null);
    try {
      const { data: d } = await api.post('/task-reminders/ai-generate', {
        role: aiRole, shift_hours: aiShift, context: aiContext,
      });
      setAiTasks(d.tasks);
      toast.success(`Generated ${d.total} duties for ${aiRole}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI generation failed');
    } finally { setAiLoading(false); }
  };

  const handleCreateReminders = async () => {
    if (!aiTasks || aiTasks.length === 0) return;
    setCreatingReminders(true);
    try {
      let created = 0;
      for (const task of aiTasks) {
        await api.post('/task-reminders', {
          name: task.name,
          message: task.message,
          target_type: 'role',
          target_value: aiRole,
          interval_hours: task.interval_hours || 2,
          active_start_hour: parseInt(aiShift.split('-')[0]) || 8,
          active_end_hour: parseInt(aiShift.split('-')[1]) || 22,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          channels: ['push', 'in_app', 'whatsapp'],
          enabled: true,
        });
        created++;
      }
      toast.success(`Created ${created} reminders for ${aiRole}`);
      setShowAiDuty(false);
      setAiTasks(null);
    } catch (err) {
      toast.error('Failed to create reminders');
    } finally { setCreatingReminders(false); }
  };

  // Quick preset duty creation
  const handleQuickPreset = async (role) => {
    try {
      const { data: d } = await api.post('/task-reminders/bulk', {
        role, target_type: 'role', target_value: role,
      });
      toast.success(`Created ${d.created} preset reminders for ${role}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create presets');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="staff-performance-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Staff Performance</h1>
            <p className="text-muted-foreground text-sm">Track reliability, attendance & assign AI-powered duties</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAiDuty(true)} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600" data-testid="ai-duty-btn">
              <Sparkles size={16} className="mr-1" />AI Duty Planner
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-stone-400" />
            <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="perf-search" />
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36" data-testid="period-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-40" data-testid="branch-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-orange-500" /></div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 size={14} className="mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="employees" data-testid="tab-employees"><Users size={14} className="mr-1" />Employee Scores</TabsTrigger>
              <TabsTrigger value="duties" data-testid="tab-duties"><Timer size={14} className="mr-1" />Duty Assignment</TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold mt-1">{data?.summary?.total_employees || 0}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Avg Attendance</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{data?.summary?.avg_attendance_rate || 0}%</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Avg Punctuality</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600">{data?.summary?.avg_punctuality_rate || 0}%</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Overtime</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">{data?.summary?.total_overtime_hours || 0}h</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Shifts Tracked</p>
                  <p className="text-2xl font-bold mt-1">{data?.summary?.total_shifts_tracked || 0}</p>
                </CardContent></Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit">Performance Tier Distribution</CardTitle></CardHeader>
                  <CardContent>
                    {tierData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={tierData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Employees" radius={[6, 6, 0, 0]}>
                            {tierData.map((entry, i) => (
                              <Bar key={i} dataKey="value" fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit">Weekly Attendance Trend</CardTitle></CardHeader>
                  <CardContent>
                    {(data?.weekly_trends || []).some(w => w.total_shifts > 0) ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={data?.weekly_trends || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                          <Line type="monotone" dataKey="attendance_rate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-muted-foreground text-center py-8">No weekly data yet</p>}
                  </CardContent>
                </Card>
              </div>

              {/* Top Performers */}
              {filtered.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-outfit flex items-center gap-2"><Award size={16} className="text-amber-500" />Top Performers</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.slice(0, 6).map((emp, i) => {
                        const tier = TIER_CONFIG[emp.tier] || TIER_CONFIG.average;
                        return (
                          <div key={emp.employee_id} className="flex items-center gap-3 p-3 border rounded-xl hover:shadow-sm transition-all" data-testid={`performer-${i}`}>
                            <ScoreRing score={emp.reliability_score} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate dark:text-white">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">{emp.role || 'N/A'}</p>
                              <Badge className={`text-[10px] mt-0.5 ${tier.color}`}>{tier.label}</Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-emerald-600">{emp.attendance_rate}% attend</p>
                              <p className="text-xs text-blue-600">{emp.punctuality_rate}% on time</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* EMPLOYEE SCORES TAB */}
            <TabsContent value="employees" className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="employee-scores-table">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium text-center">Score</th>
                      <th className="pb-2 font-medium text-center">Attendance</th>
                      <th className="pb-2 font-medium text-center">Punctuality</th>
                      <th className="pb-2 font-medium text-center">Shifts</th>
                      <th className="pb-2 font-medium text-center">Late</th>
                      <th className="pb-2 font-medium text-center">Absent</th>
                      <th className="pb-2 font-medium text-center">OT</th>
                      <th className="pb-2 font-medium text-center">Tasks</th>
                      <th className="pb-2 font-medium">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp, i) => {
                      const tier = TIER_CONFIG[emp.tier] || TIER_CONFIG.average;
                      return (
                        <tr key={emp.employee_id} className="border-b last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid={`emp-row-${i}`}>
                          <td className="py-3 text-muted-foreground font-semibold">{i + 1}</td>
                          <td className="py-3">
                            <p className="font-medium dark:text-white">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.role || 'N/A'}</p>
                          </td>
                          <td className="py-3 text-center"><ScoreRing score={emp.reliability_score} size={40} /></td>
                          <td className="py-3 text-center font-medium text-emerald-600">{emp.attendance_rate}%</td>
                          <td className="py-3 text-center font-medium text-blue-600">{emp.punctuality_rate}%</td>
                          <td className="py-3 text-center">{emp.scheduled_shifts}</td>
                          <td className="py-3 text-center">{emp.late > 0 ? <span className="text-amber-600 font-medium">{emp.late}</span> : '-'}</td>
                          <td className="py-3 text-center">{emp.absent > 0 ? <span className="text-red-600 font-medium">{emp.absent}</span> : '-'}</td>
                          <td className="py-3 text-center">{emp.overtime_hours > 0 ? `${emp.overtime_hours}h` : '-'}</td>
                          <td className="py-3 text-center">{emp.task_completions > 0 ? <span className="text-purple-600">{emp.task_completions}</span> : '-'}</td>
                          <td className="py-3"><Badge className={`text-[10px] ${tier.color}`}>{tier.label}</Badge></td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan="11" className="text-center py-12 text-muted-foreground">No employee data for this period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* DUTY ASSIGNMENT TAB */}
            <TabsContent value="duties" className="space-y-6">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-xl">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-purple-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm dark:text-white">AI-Powered Duty Planner</h3>
                    <p className="text-xs text-muted-foreground mt-1">Generate smart duty schedules with reminders for any role. AI considers food safety, customer experience, and peak hours.</p>
                    <Button size="sm" className="mt-2 bg-purple-500 hover:bg-purple-600" onClick={() => setShowAiDuty(true)} data-testid="open-ai-duty-btn">
                      <Sparkles size={14} className="mr-1" />Generate AI Duty Plan
                    </Button>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-sm dark:text-white">Quick Preset Duties by Role</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROLES.map(role => {
                  const icons = { cleaner: '🧹', waiter: '🍽', cashier: '💰', chef: '👨‍🍳' };
                  const descs = {
                    cleaner: 'Floor cleaning, bathroom checks, dish station, trash disposal',
                    waiter: 'Table checks, station setup, menu specials, side work',
                    cashier: 'Cash drawer, receipt paper, queue management, end-of-shift',
                    chef: 'Food temp, prep station, order queue, kitchen safety, inventory',
                  };
                  return (
                    <Card key={role} className="group hover:shadow-md transition-all cursor-pointer" data-testid={`role-card-${role}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{icons[role]}</span>
                          <h4 className="font-semibold text-sm capitalize dark:text-white">{role}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{descs[role]}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleQuickPreset(role)} data-testid={`preset-${role}`}>
                            <Plus size={12} className="mr-1" />Use Preset
                          </Button>
                          <Button size="sm" className="flex-1 text-xs bg-purple-500 hover:bg-purple-600" onClick={() => { setAiRole(role); setShowAiDuty(true); }} data-testid={`ai-${role}`}>
                            <Sparkles size={12} className="mr-1" />AI Plan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Manage all created reminders in <a href="/task-reminders" className="text-orange-500 underline font-medium">Task Reminders</a></p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* AI Duty Planner Dialog */}
      <Dialog open={showAiDuty} onOpenChange={setShowAiDuty}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit flex items-center gap-2"><Sparkles size={18} className="text-purple-500" />AI Duty Planner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role *</Label>
              <Select value={aiRole} onValueChange={setAiRole}>
                <SelectTrigger data-testid="ai-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shift Hours</Label>
              <Input value={aiShift} onChange={e => setAiShift(e.target.value)} placeholder="08:00 - 22:00" data-testid="ai-shift-input" />
            </div>
            <div>
              <Label>Additional Context (optional)</Label>
              <Textarea value={aiContext} onChange={e => setAiContext(e.target.value)} placeholder="e.g., Small branch, 20 tables, focus on hygiene..." rows={2} data-testid="ai-context-input" />
            </div>
            <Button onClick={handleAiGenerate} disabled={aiLoading} className="w-full bg-purple-500 hover:bg-purple-600" data-testid="generate-ai-btn">
              {aiLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
              {aiLoading ? 'Generating...' : 'Generate Duty Plan'}
            </Button>

            {aiTasks && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Generated {aiTasks.length} Tasks</h4>
                  <Badge variant="outline">{aiRole}</Badge>
                </div>
                {aiTasks.map((task, i) => {
                  const prioColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-emerald-100 text-emerald-700' };
                  return (
                    <div key={i} className="p-3 border rounded-lg space-y-1" data-testid={`ai-task-${i}`}>
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-sm">{task.name}</h5>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${prioColors[task.priority] || prioColors.medium}`}>{task.priority}</Badge>
                          <Badge variant="outline" className="text-[10px]"><Timer size={10} className="mr-0.5" />Every {task.interval_hours}h</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{task.message}</p>
                    </div>
                  );
                })}
                <Button onClick={handleCreateReminders} disabled={creatingReminders} className="w-full bg-orange-500 hover:bg-orange-600" data-testid="create-reminders-btn">
                  {creatingReminders ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                  Create All as Reminders
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
