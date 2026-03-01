import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Plus, Clock, Users, User, Trash2, Play, Pause, Wand2, ChefHat, History, CheckCircle, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';

const ROLE_ICONS = {
  cleaner: '🧹', waiter: '🍽', cashier: '💰', chef: '👨‍🍳',
  'sous chef': '👨‍🍳', 'line cook': '🍳', manager: '📋', driver: '🚗',
  supervisor: '👁', accountant: '📊',
};

export default function TaskRemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [presets, setPresets] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAcks, setShowAcks] = useState(null);
  const [acks, setAcks] = useState([]);
  const [form, setForm] = useState({
    name: '', message: '', target_type: 'role', target_value: '',
    interval_hours: 2, active_start_hour: 8, active_end_hour: 22,
    days_of_week: [0, 1, 2, 3, 4, 5, 6], channels: ['push', 'in_app'],
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [rem, jt, emp, pre, hist] = await Promise.all([
        api.get('/task-reminders'),
        api.get('/job-titles'),
        api.get('/employees'),
        api.get('/task-reminders/presets'),
        api.get('/task-reminders/history?limit=30'),
      ]);
      setReminders(rem.data);
      setJobTitles((jt.data || []).filter(t => t.active !== false));
      const empList = Array.isArray(emp.data) ? emp.data : emp.data?.employees || [];
      setEmployees(empList);
      setPresets(pre.data);
      setHistory(hist.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createReminder = async () => {
    if (!form.name || !form.message || !form.target_value) {
      return toast.error('Fill in name, message, and target');
    }
    try {
      await api.post('/task-reminders', form);
      toast.success('Reminder created');
      setShowCreate(false);
      resetForm();
      loadAll();
    } catch { toast.error('Failed to create'); }
  };

  const applyPresets = async (role) => {
    const jt = jobTitles.find(t => t.title?.toLowerCase() === role.toLowerCase());
    try {
      await api.post('/task-reminders/bulk', {
        role, target_type: 'role', target_value: jt?.title || role,
        active_start_hour: 8, active_end_hour: 22,
      });
      toast.success(`${role} presets created`);
      setShowPresets(false);
      loadAll();
    } catch { toast.error('Failed'); }
  };

  const toggleEnabled = async (r) => {
    try {
      await api.put(`/task-reminders/${r.id}`, { enabled: !r.enabled });
      setReminders(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
      toast.success(r.enabled ? 'Paused' : 'Activated');
    } catch { toast.error('Failed'); }
  };

  const deleteReminder = async (id) => {
    try {
      await api.delete(`/task-reminders/${id}`);
      setReminders(prev => prev.filter(x => x.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  const viewAcks = async (reminderId) => {
    try {
      const { data } = await api.get(`/task-reminders/acknowledgements/${reminderId}`);
      setAcks(data);
      setShowAcks(reminderId);
    } catch { toast.error('Failed to load'); }
  };

  const resetForm = () => setForm({
    name: '', message: '', target_type: 'role', target_value: '',
    interval_hours: 2, active_start_hour: 8, active_end_hour: 22,
    days_of_week: [0, 1, 2, 3, 4, 5, 6], channels: ['push', 'in_app'],
  });

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const activeCount = reminders.filter(r => r.enabled).length;
  const totalTriggers = reminders.reduce((s, r) => s + (r.trigger_count || 0), 0);
  const roleGroups = {};
  reminders.forEach(r => {
    const key = r.target_value || 'Other';
    if (!roleGroups[key]) roleGroups[key] = [];
    roleGroups[key].push(r);
  });

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="task-reminders-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="reminders-title">Task Reminders</h1>
            <p className="text-sm text-muted-foreground">Automated recurring alerts for your staff</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => navigate('/task-compliance')} data-testid="compliance-btn">
              <BarChart3 size={14} className="mr-1" />Compliance
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowHistory(true)} data-testid="history-btn">
              <History size={14} className="mr-1" />History
            </Button>
            <Button variant="outline" className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setShowPresets(true)} data-testid="presets-btn">
              <Wand2 size={14} className="mr-1" />Quick Setup
            </Button>
            <Button className="rounded-xl" onClick={() => { resetForm(); setShowCreate(true); }} data-testid="create-reminder-btn">
              <Plus size={14} className="mr-1" />New Reminder
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Reminders</p>
            <p className="text-2xl font-bold font-outfit" data-testid="stat-total">{reminders.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-emerald-600">Active</p>
            <p className="text-2xl font-bold font-outfit text-emerald-600" data-testid="stat-active">{activeCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Roles Covered</p>
            <p className="text-2xl font-bold font-outfit">{Object.keys(roleGroups).length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Triggers</p>
            <p className="text-2xl font-bold font-outfit">{totalTriggers}</p>
          </CardContent></Card>
        </div>

        {/* Reminders by Role */}
        {Object.keys(roleGroups).length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <Bell size={48} className="mx-auto text-stone-300 mb-3" />
            <p className="text-lg font-medium text-muted-foreground">No Reminders Yet</p>
            <p className="text-sm text-stone-400 mt-1">Use "Quick Setup" to add preset reminders for common roles, or create custom ones</p>
          </CardContent></Card>
        ) : (
          Object.entries(roleGroups).map(([role, items]) => (
            <Card key={role} className="overflow-hidden">
              <CardHeader className="py-3 bg-stone-50">
                <CardTitle className="text-sm font-outfit flex items-center gap-2">
                  <span className="text-lg">{ROLE_ICONS[role.toLowerCase()] || '📋'}</span>
                  {role} <Badge variant="outline" className="text-[9px]">{items.length} reminders</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(r => (
                    <div key={r.id} className={`p-3 flex items-center gap-3 ${!r.enabled ? 'opacity-50 bg-stone-50' : ''}`} data-testid={`reminder-${r.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <Badge className={`text-[9px] ${r.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`}>{r.enabled ? 'Active' : 'Paused'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-stone-400">
                          <span className="flex items-center gap-0.5"><Clock size={10} />Every {r.interval_hours}h</span>
                          <span>{r.active_start_hour}:00–{r.active_end_hour}:00</span>
                          <span>{r.trigger_count || 0} triggers</span>
                          {r.last_triggered && <span>Last: {new Date(r.last_triggered).toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => viewAcks(r.id)} title="View acknowledgements" data-testid={`ack-btn-${r.id}`}>
                          <CheckCircle size={14} className="text-blue-500" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleEnabled(r)} data-testid={`toggle-${r.id}`}>
                          {r.enabled ? <Pause size={14} className="text-amber-500" /> : <Play size={14} className="text-emerald-500" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => deleteReminder(r.id)} data-testid={`delete-${r.id}`}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Create Reminder Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md" data-testid="create-dialog">
            <DialogHeader><DialogTitle className="font-outfit">New Task Reminder</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Reminder Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kitchen Cleaning" className="h-9" data-testid="form-name" />
              </div>
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What the employee should do..." rows={2} data-testid="form-message" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Target Type</Label>
                  <Select value={form.target_type} onValueChange={v => setForm(f => ({ ...f, target_type: v, target_value: '' }))}>
                    <SelectTrigger className="h-9" data-testid="form-target-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">By Role</SelectItem>
                      <SelectItem value="employee">By Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{form.target_type === 'role' ? 'Role' : 'Employee'}</Label>
                  <Select value={form.target_value} onValueChange={v => setForm(f => ({ ...f, target_value: v }))}>
                    <SelectTrigger className="h-9" data-testid="form-target-value"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {form.target_type === 'role' ? (
                        jobTitles.map(jt => <SelectItem key={jt.id} value={jt.title}>{jt.title}</SelectItem>)
                      ) : (
                        employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Interval (hours)</Label>
                  <Input type="number" min={0.5} step={0.5} value={form.interval_hours} onChange={e => setForm(f => ({ ...f, interval_hours: parseFloat(e.target.value) || 1 }))} className="h-9" data-testid="form-interval" />
                </div>
                <div>
                  <Label className="text-xs">Start Hour</Label>
                  <Input type="number" min={0} max={23} value={form.active_start_hour} onChange={e => setForm(f => ({ ...f, active_start_hour: parseInt(e.target.value) || 0 }))} className="h-9" data-testid="form-start" />
                </div>
                <div>
                  <Label className="text-xs">End Hour</Label>
                  <Input type="number" min={0} max={23} value={form.active_end_hour} onChange={e => setForm(f => ({ ...f, active_end_hour: parseInt(e.target.value) || 22 }))} className="h-9" data-testid="form-end" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Active Days</Label>
                <div className="flex gap-1">
                  {dayLabels.map((d, i) => (
                    <Badge key={i} variant={form.days_of_week.includes(i) ? 'default' : 'outline'}
                      className={`text-[10px] cursor-pointer select-none ${form.days_of_week.includes(i) ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                      onClick={() => setForm(f => ({
                        ...f, days_of_week: f.days_of_week.includes(i) ? f.days_of_week.filter(x => x !== i) : [...f.days_of_week, i]
                      }))} data-testid={`day-${i}`}>
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createReminder} className="rounded-xl" data-testid="submit-reminder">Create Reminder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Setup Presets Dialog */}
        <Dialog open={showPresets} onOpenChange={setShowPresets}>
          <DialogContent className="max-w-lg" data-testid="presets-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Quick Setup — Preset Reminders</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Choose a role to auto-create recommended reminders</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {Object.entries(presets).map(([role, templates]) => (
                <Card key={role} className="cursor-pointer hover:border-orange-300 transition-colors" onClick={() => applyPresets(role)} data-testid={`preset-${role}`}>
                  <CardContent className="p-4 text-center">
                    <span className="text-3xl">{ROLE_ICONS[role] || '📋'}</span>
                    <p className="text-sm font-semibold capitalize mt-2">{role}</p>
                    <p className="text-[10px] text-muted-foreground">{templates.length} reminders</p>
                    <div className="mt-2 space-y-0.5">
                      {templates.map((t, i) => (
                        <p key={i} className="text-[10px] text-stone-500 truncate">{t.name} — every {t.interval_hours}h</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-lg" data-testid="history-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Alert History</DialogTitle></DialogHeader>
            {history.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No alerts sent yet</p>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={h.id || i} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border text-xs">
                    <div>
                      <p className="font-medium">{h.reminder_name}</p>
                      <p className="text-stone-400">{h.target_value} — {h.employees_notified} notified</p>
                    </div>
                    <span className="text-stone-400 text-[10px]">{new Date(h.sent_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Acknowledgements Dialog */}
        <Dialog open={!!showAcks} onOpenChange={() => setShowAcks(null)}>
          <DialogContent className="max-w-md" data-testid="acks-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Acknowledgements</DialogTitle></DialogHeader>
            {acks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No acknowledgements yet</p>
            ) : (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {acks.map((a, i) => (
                  <div key={a.id || i} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="font-medium">{a.employee_name}</span>
                    </div>
                    <span className="text-stone-400 text-[10px]">{new Date(a.acknowledged_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
