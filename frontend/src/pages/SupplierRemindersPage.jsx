import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, MessageSquare, Plus, X, Send, Clock, AlertTriangle, CheckCircle, Loader2, History } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SupplierRemindersPage() {
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [configRes, historyRes] = await Promise.all([
        api.get('/supplier-reminders/config'),
        api.get('/supplier-reminders/history'),
      ]);
      setConfig(configRes.data);
      setHistory(historyRes.data);
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.post('/supplier-reminders/config', config);
      toast.success('Reminder settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const testReminder = async () => {
    setTesting(true);
    try {
      const res = await api.post('/supplier-reminders/test');
      if (res.data.sent) {
        toast.success(res.data.message);
      } else {
        toast.info(res.data.message);
      }
      fetchData(); // Refresh history
    } catch (error) { toast.error(error.response?.data?.detail || 'Test failed'); }
    finally { setTesting(false); }
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@')) return;
    setConfig(prev => ({ ...prev, recipients_email: [...(prev.recipients_email || []), newEmail] }));
    setNewEmail('');
  };

  const removeEmail = (idx) => {
    setConfig(prev => ({ ...prev, recipients_email: prev.recipients_email.filter((_, i) => i !== idx) }));
  };

  const addPhone = () => {
    if (!newPhone || newPhone.length < 8) return;
    setConfig(prev => ({ ...prev, recipients_phone: [...(prev.recipients_phone || []), newPhone] }));
    setNewPhone('');
  };

  const removePhone = (idx) => {
    setConfig(prev => ({ ...prev, recipients_phone: prev.recipients_phone.filter((_, i) => i !== idx) }));
  };

  const toggleThreshold = (val) => {
    setConfig(prev => {
      const thresholds = prev.thresholds || [];
      return { ...prev, thresholds: thresholds.includes(val) ? thresholds.filter(t => t !== val) : [...thresholds, val].sort((a, b) => a - b) };
    });
  };

  if (loading) return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="reminders-page-title">Payment Reminders</h1>
            <p className="text-muted-foreground text-sm">Auto-notify when supplier invoices become overdue</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={testReminder} disabled={testing}
              data-testid="test-reminder-btn" className="text-amber-600 border-amber-300">
              {testing ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
              Test Now
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={saving} data-testid="save-config-btn">
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CheckCircle size={14} className="mr-1" />}
              Save Settings
            </Button>
          </div>
        </div>

        {config && (
          <>
            {/* Enable/Disable */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} className={config.enabled ? 'text-emerald-500' : 'text-stone-400'} />
                  <div>
                    <p className="font-medium text-sm">Automated Reminders</p>
                    <p className="text-xs text-muted-foreground">Runs daily at {config.alert_time || '09:00'}</p>
                  </div>
                </div>
                <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  data-testid="enable-reminders-toggle" />
              </CardContent>
            </Card>

            {/* Thresholds */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Age Thresholds (days)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Send reminders when invoices reach these ages. Select all that apply.
                </p>
                <div className="flex gap-2 flex-wrap" data-testid="thresholds-group">
                  {[30, 60, 90, 120, 150, 180].map(days => {
                    const active = (config.thresholds || []).includes(days);
                    const colors = days <= 30 ? 'bg-emerald-100 border-emerald-400 text-emerald-700' :
                                   days <= 60 ? 'bg-amber-100 border-amber-400 text-amber-700' :
                                   days <= 90 ? 'bg-orange-100 border-orange-400 text-orange-700' :
                                   'bg-red-100 border-red-400 text-red-700';
                    return (
                      <button key={days} type="button" onClick={() => toggleThreshold(days)}
                        data-testid={`threshold-${days}`}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                          active ? `${colors} ring-2 ring-offset-1` : 'bg-stone-50 border-stone-200 text-stone-400 hover:bg-stone-100'
                        }`}>
                        {days}+ days
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Alert Time */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" /> Alert Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Daily at</Label>
                  <Input type="time" value={config.alert_time || '09:00'}
                    onChange={e => setConfig({ ...config, alert_time: e.target.value })}
                    className="w-32" data-testid="alert-time-input" />
                  <span className="text-xs text-muted-foreground">(server time)</span>
                </div>
              </CardContent>
            </Card>

            {/* Channels & Recipients */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Notification Channels</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Email */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className={config.email_enabled ? 'text-blue-500' : 'text-stone-400'} />
                      <span className="text-sm font-medium">Email Notifications</span>
                      <Badge variant="outline" className="text-[10px]">PDF summary attached</Badge>
                    </div>
                    <Switch checked={config.email_enabled}
                      onCheckedChange={v => setConfig({ ...config, email_enabled: v })}
                      data-testid="enable-email-toggle" />
                  </div>
                  {config.email_enabled && (
                    <div>
                      <div className="flex gap-2">
                        <Input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                          placeholder="email@example.com" type="email" className="text-sm"
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                          data-testid="email-recipient-input" />
                        <Button size="sm" variant="outline" onClick={addEmail} data-testid="add-email-btn">
                          <Plus size={14} />
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {(config.recipients_email || []).map((email, i) => (
                          <Badge key={i} variant="outline" className="text-xs flex items-center gap-1 bg-blue-50">
                            {email}
                            <button onClick={() => removeEmail(i)} className="ml-1 hover:text-red-500"><X size={12} /></button>
                          </Badge>
                        ))}
                        {(config.recipients_email || []).length === 0 && (
                          <span className="text-xs text-muted-foreground">No email recipients added</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* WhatsApp */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className={config.whatsapp_enabled ? 'text-green-500' : 'text-stone-400'} />
                      <span className="text-sm font-medium">WhatsApp Notifications</span>
                      <Badge variant="outline" className="text-[10px]">Text summary</Badge>
                    </div>
                    <Switch checked={config.whatsapp_enabled}
                      onCheckedChange={v => setConfig({ ...config, whatsapp_enabled: v })}
                      data-testid="enable-whatsapp-toggle" />
                  </div>
                  {config.whatsapp_enabled && (
                    <div>
                      <div className="flex gap-2">
                        <Input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                          placeholder="+966512345678" className="text-sm"
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                          data-testid="phone-recipient-input" />
                        <Button size="sm" variant="outline" onClick={addPhone} data-testid="add-phone-btn">
                          <Plus size={14} />
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {(config.recipients_phone || []).map((phone, i) => (
                          <Badge key={i} variant="outline" className="text-xs flex items-center gap-1 bg-green-50">
                            {phone}
                            <button onClick={() => removePhone(i)} className="ml-1 hover:text-red-500"><X size={12} /></button>
                          </Badge>
                        ))}
                        {(config.recipients_phone || []).length === 0 && (
                          <span className="text-xs text-muted-foreground">No WhatsApp recipients added</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Last Sent Info */}
            {config.last_sent && (
              <div className="p-3 bg-stone-50 rounded-lg border text-xs text-muted-foreground flex items-center gap-2">
                <Clock size={12} />
                Last sent: {new Date(config.last_sent).toLocaleString()}
              </div>
            )}

            {/* History */}
            <Card data-testid="reminder-history">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History size={16} /> Reminder History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">No reminders sent yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <div key={h.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(h.sent_at).toLocaleString()}
                            </span>
                            {h.is_test && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600">Test</Badge>}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {h.suppliers_count} suppliers / {h.alerts_count} invoices
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(h.supplier_summary || []).map((s, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded border ${
                              s.severity === 'critical' ? 'bg-red-50 text-red-600 border-red-200' :
                              s.severity === 'high' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                              'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                              {s.name}: SAR {s.outstanding.toLocaleString()}
                            </span>
                          ))}
                        </div>
                        {h.results && (
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            {h.results.email && (
                              <span className={h.results.email.success ? 'text-blue-600' : 'text-red-500'}>
                                <Mail size={11} className="inline mr-0.5" />
                                {h.results.email.success ? 'Email sent' : h.results.email.error}
                              </span>
                            )}
                            {h.results.whatsapp && (
                              <span className={h.results.whatsapp.success ? 'text-green-600' : 'text-red-500'}>
                                <MessageSquare size={11} className="inline mr-0.5" />
                                {h.results.whatsapp.success ? 'WhatsApp sent' : h.results.whatsapp.error}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
