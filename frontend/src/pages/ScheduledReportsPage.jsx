import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Plus, Trash2, Send, Mail, FileText, RefreshCw, CalendarClock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Summary', icon: '💰' },
  { value: 'expenses', label: 'Expenses Summary', icon: '💸' },
  { value: 'pnl', label: 'Profit & Loss', icon: '📊' },
  { value: 'supplier_aging', label: 'Supplier Aging', icon: '📋' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    report_type: 'sales',
    frequency: 'daily',
    email_recipients: '',
    enabled: true,
    day_of_week: 0,
    day_of_month: 1,
    time_of_day: '08:00',
  });

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/pdf-exports/scheduled-reports');
      setReports(res.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emails = formData.email_recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) { toast.error('Add at least one email recipient'); return; }
    try {
      await api.post('/pdf-exports/scheduled-reports', {
        ...formData,
        email_recipients: emails,
        day_of_week: formData.frequency === 'weekly' ? parseInt(formData.day_of_week) : null,
        day_of_month: formData.frequency === 'monthly' ? parseInt(formData.day_of_month) : null,
      });
      toast.success('Scheduled report created');
      setShowForm(false);
      setFormData({ report_type: 'sales', frequency: 'daily', email_recipients: '', enabled: true, day_of_week: 0, day_of_month: 1, time_of_day: '08:00' });
      fetchReports();
    } catch { toast.error('Failed to create schedule'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this scheduled report?')) {
      await api.delete(`/pdf-exports/scheduled-reports/${id}`);
      toast.success('Deleted');
      fetchReports();
    }
  };

  const handleToggle = async (report) => {
    await api.put(`/pdf-exports/scheduled-reports/${report.id}`, {
      ...report,
      enabled: !report.enabled,
    });
    fetchReports();
  };

  const handleSendNow = async (id) => {
    try {
      await api.post(`/pdf-exports/scheduled-reports/${id}/send-now`);
      toast.success('Report sent!');
      fetchReports();
    } catch { toast.error('Failed to send'); }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-emerald-500" size={32} /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="scheduled-reports-title">
              <CalendarClock className="text-emerald-500" /> Scheduled Reports
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Auto-generate and email branded PDF reports on a schedule</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} data-testid="add-schedule-btn" className="rounded-full">
            <Plus size={16} className="mr-1" /> Add Schedule
          </Button>
        </div>

        {showForm && (
          <Card className="border-2 border-emerald-200" data-testid="schedule-form">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Clock size={18} /> New Report Schedule</CardTitle>
              <CardDescription>Configure automated branded PDF reports delivered to your email</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select value={formData.report_type} onValueChange={(v) => setFormData({ ...formData, report_type: v })}>
                      <SelectTrigger data-testid="schedule-report-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                      <SelectTrigger data-testid="schedule-frequency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={formData.time_of_day} onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })} />
                  </div>
                </div>

                {formData.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select value={String(formData.day_of_week)} onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.frequency === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <Input type="number" min={1} max={28} value={formData.day_of_month} onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Email Recipients (comma-separated)</Label>
                  <Input value={formData.email_recipients} data-testid="schedule-emails"
                    onChange={(e) => setFormData({ ...formData, email_recipients: e.target.value })}
                    placeholder="admin@company.com, manager@company.com" />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="save-schedule-btn">
                    <Clock size={14} className="mr-1" /> Create Schedule
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Scheduled Reports List */}
        <div className="space-y-3">
          {reports.length === 0 && !showForm && (
            <Card>
              <CardContent className="p-12 text-center">
                <CalendarClock size={48} className="mx-auto text-stone-300 mb-4" />
                <p className="text-muted-foreground mb-2">No scheduled reports yet</p>
                <p className="text-sm text-muted-foreground mb-4">Set up automated PDF reports to be emailed to you daily, weekly, or monthly</p>
                <Button onClick={() => setShowForm(true)} className="rounded-full">
                  <Plus size={14} className="mr-1" /> Create First Schedule
                </Button>
              </CardContent>
            </Card>
          )}

          {reports.map(report => {
            const rt = REPORT_TYPES.find(r => r.value === report.report_type);
            return (
              <Card key={report.id} className={`transition-all ${report.enabled ? 'border-emerald-200' : 'border-stone-200 opacity-60'}`} data-testid={`schedule-card-${report.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-3xl">{rt?.icon || '📄'}</div>
                      <div>
                        <h3 className="font-semibold">{rt?.label || report.report_type}</h3>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{report.frequency}</Badge>
                          <Badge variant="outline" className="text-xs"><Clock size={10} className="mr-0.5" />{report.time_of_day}</Badge>
                          {report.frequency === 'weekly' && <Badge variant="outline" className="text-xs">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][report.day_of_week]}</Badge>}
                          {report.frequency === 'monthly' && <Badge variant="outline" className="text-xs">Day {report.day_of_month}</Badge>}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Mail size={10} /> {(report.email_recipients || []).join(', ')}
                        </div>
                        {report.last_sent && <p className="text-[10px] text-muted-foreground mt-0.5">Last sent: {new Date(report.last_sent).toLocaleString()}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={report.enabled} onCheckedChange={() => handleToggle(report)} data-testid={`toggle-${report.id}`} />
                      <Button size="sm" variant="outline" onClick={() => handleSendNow(report.id)} className="h-8" data-testid={`send-now-${report.id}`}>
                        <Send size={12} className="mr-1" /> Send Now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(report.id)} className="h-8 text-red-500">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
