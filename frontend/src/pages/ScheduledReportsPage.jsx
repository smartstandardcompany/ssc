import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { FileText, Plus, Trash2, Play, Clock, Calendar, Mail } from 'lucide-react';

const REPORT_TYPES = [
  { value: 'daily_summary', label: 'Daily Summary' },
  { value: 'sales_report', label: 'Sales Report' },
  { value: 'pnl', label: 'Profit & Loss' },
];

const SCHEDULES = [
  { value: 'daily', label: 'Daily (6 AM)' },
  { value: 'weekly', label: 'Weekly (Sunday)' },
  { value: 'monthly', label: 'Monthly (1st)' },
];

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', report_type: 'daily_summary', schedule: 'daily', recipients: '' });
  const [generating, setGenerating] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [r, h] = await Promise.all([
        api.get('/scheduled-reports'),
        api.get('/scheduled-reports/history'),
      ]);
      setReports(r.data);
      setHistory(h.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name) return toast.error('Name required');
    try {
      await api.post('/scheduled-reports', {
        ...form,
        recipients: form.recipients.split(',').map(e => e.trim()).filter(Boolean),
      });
      toast.success('Report scheduled!');
      setShowCreate(false);
      setForm({ name: '', report_type: 'daily_summary', schedule: 'daily', recipients: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await api.put(`/scheduled-reports/${id}`, { is_active: !isActive });
      toast.success(isActive ? 'Report paused' : 'Report activated');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduled report?')) return;
    try {
      await api.delete(`/scheduled-reports/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const handleGenerateNow = async (id) => {
    setGenerating(id);
    try {
      await api.post(`/scheduled-reports/generate-now/${id}`);
      toast.success('Report generated!');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setGenerating(null); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1" data-testid="scheduled-reports-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="reports-title">
              <FileText className="w-6 h-6 text-orange-500" /> Scheduled Reports
            </h1>
            <p className="text-sm text-stone-500 mt-1">Automate report generation on a schedule</p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 rounded-full" onClick={() => setShowCreate(true)} data-testid="create-report-btn">
            <Plus className="w-4 h-4 mr-1" /> New Schedule
          </Button>
        </div>

        {reports.length === 0 ? (
          <Card className="border-stone-100 border-dashed"><CardContent className="p-8 text-center text-stone-400" data-testid="no-reports">No scheduled reports yet. Create one to get started.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map(r => (
              <Card key={r.id} className="border-stone-100" data-testid={`report-card-${r.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-stone-800">{r.name}</h3>
                      <Badge className={r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}>{r.is_active ? 'Active' : 'Paused'}</Badge>
                    </div>
                    <Switch checked={r.is_active} onCheckedChange={() => handleToggle(r.id, r.is_active)} data-testid={`toggle-${r.id}`} />
                  </div>
                  <div className="space-y-1.5 text-xs text-stone-500">
                    <div className="flex items-center gap-2"><FileText className="w-3 h-3" />{REPORT_TYPES.find(t => t.value === r.report_type)?.label || r.report_type}</div>
                    <div className="flex items-center gap-2"><Clock className="w-3 h-3" />{SCHEDULES.find(s => s.value === r.schedule)?.label || r.schedule}</div>
                    <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />Next: {r.next_run ? new Date(r.next_run).toLocaleString() : 'N/A'}</div>
                    {r.recipients?.length > 0 && <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{r.recipients.join(', ')}</div>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleGenerateNow(r.id)} disabled={generating === r.id} data-testid={`generate-${r.id}`}>
                      <Play className="w-3 h-3 mr-1" />{generating === r.id ? 'Generating...' : 'Run Now'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => handleDelete(r.id)} data-testid={`delete-${r.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <Card className="border-stone-100" data-testid="report-history">
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Reports</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.slice(0, 10).map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-stone-50 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-100 text-emerald-700">{h.status}</Badge>
                      <span className="text-stone-700 font-medium">{h.report_name}</span>
                      <span className="text-stone-400 text-xs">{h.report_date}</span>
                    </div>
                    <span className="text-xs text-stone-500">{new Date(h.generated_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent data-testid="create-report-dialog">
            <DialogHeader><DialogTitle>New Scheduled Report</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1"><Label>Report Name *</Label><Input data-testid="report-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Sales Summary" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Report Type</Label>
                  <Select value={form.report_type} onValueChange={v => setForm(f => ({ ...f, report_type: v }))}>
                    <SelectTrigger data-testid="report-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Schedule</Label>
                  <Select value={form.schedule} onValueChange={v => setForm(f => ({ ...f, schedule: v }))}>
                    <SelectTrigger data-testid="report-schedule"><SelectValue /></SelectTrigger>
                    <SelectContent>{SCHEDULES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Recipients (comma-separated)</Label><Input data-testid="report-recipients" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} placeholder="admin@company.com" /></div>
              <p className="text-xs text-stone-400">Email delivery available once SMTP is configured. Reports stored for download.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleCreate} data-testid="submit-report">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
