import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, Smartphone, MessageCircle, Moon, Save, Loader2, Shield, Clock, Volume2, VolumeX } from 'lucide-react';
import api from '@/lib/api';

const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${i.toString().padStart(2, '0')}:00` }));

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = async () => {
    try {
      const { data } = await api.get('/my/notification-preferences');
      setPrefs({
        channels: data.channels || {
          in_app: data.channel_in_app !== false,
          push: data.channel_push !== false,
          whatsapp: data.channel_whatsapp !== false,
        },
        quiet_hours_enabled: data.quiet_hours_enabled || false,
        quiet_hours_start: data.quiet_hours_start ?? 22,
        quiet_hours_end: data.quiet_hours_end ?? 7,
        task_reminders: data.task_reminders !== false,
        schedule_alerts: data.schedule_alerts !== false,
        system_alerts: data.system_alerts !== false,
      });
    } catch { toast.error('Failed to load preferences'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPrefs(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/my/notification-preferences', prefs);
      toast.success('Preferences saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const updateChannel = (key, val) => setPrefs(p => ({ ...p, channels: { ...p.channels, [key]: val } }));
  const update = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-orange-500" /></div></DashboardLayout>;
  if (!prefs) return null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="notification-prefs-page">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Notification Preferences</h1>
          <p className="text-muted-foreground text-sm">Control how and when you receive notifications</p>
        </div>

        {/* Channels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-outfit flex items-center gap-2"><Bell size={16} className="text-orange-500" />Notification Channels</CardTitle>
            <p className="text-xs text-muted-foreground">Choose how you want to receive duty reminders and alerts</p>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors" data-testid="channel-in-app">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bell size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm dark:text-white">In-App Notifications</p>
                  <p className="text-xs text-muted-foreground">See alerts in your Employee Portal</p>
                </div>
              </div>
              <Switch checked={prefs.channels.in_app} onCheckedChange={v => updateChannel('in_app', v)} data-testid="toggle-in-app" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors" data-testid="channel-push">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Smartphone size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm dark:text-white">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Browser push alerts on your device</p>
                </div>
              </div>
              <Switch checked={prefs.channels.push} onCheckedChange={v => updateChannel('push', v)} data-testid="toggle-push" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors" data-testid="channel-whatsapp">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageCircle size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-sm dark:text-white">WhatsApp Messages</p>
                  <p className="text-xs text-muted-foreground">Receive duty reminders via WhatsApp</p>
                </div>
              </div>
              <Switch checked={prefs.channels.whatsapp} onCheckedChange={v => updateChannel('whatsapp', v)} data-testid="toggle-whatsapp" />
            </div>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-outfit flex items-center gap-2"><Shield size={16} className="text-blue-500" />Notification Types</CardTitle>
            <p className="text-xs text-muted-foreground">Choose which types of notifications to receive</p>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid="type-task-reminders">
              <div>
                <p className="font-medium text-sm dark:text-white">Task & Duty Reminders</p>
                <p className="text-xs text-muted-foreground">Cleaning schedules, prep tasks, service checks</p>
              </div>
              <Switch checked={prefs.task_reminders} onCheckedChange={v => update('task_reminders', v)} data-testid="toggle-task-reminders" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid="type-schedule-alerts">
              <div>
                <p className="font-medium text-sm dark:text-white">Schedule Alerts</p>
                <p className="text-xs text-muted-foreground">Shift changes, upcoming shifts, swap requests</p>
              </div>
              <Switch checked={prefs.schedule_alerts} onCheckedChange={v => update('schedule_alerts', v)} data-testid="toggle-schedule-alerts" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid="type-system-alerts">
              <div>
                <p className="font-medium text-sm dark:text-white">System Alerts</p>
                <p className="text-xs text-muted-foreground">Leave approvals, salary updates, announcements</p>
              </div>
              <Switch checked={prefs.system_alerts} onCheckedChange={v => update('system_alerts', v)} data-testid="toggle-system-alerts" />
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-outfit flex items-center gap-2"><Moon size={16} className="text-indigo-500" />Quiet Hours</CardTitle>
            <p className="text-xs text-muted-foreground">Pause WhatsApp and push notifications during rest time. In-app notifications still arrive.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border" data-testid="quiet-hours-toggle">
              <div className="flex items-center gap-3">
                {prefs.quiet_hours_enabled ? (
                  <VolumeX size={18} className="text-indigo-500" />
                ) : (
                  <Volume2 size={18} className="text-stone-400" />
                )}
                <div>
                  <p className="font-medium text-sm dark:text-white">Enable Quiet Hours</p>
                  <p className="text-xs text-muted-foreground">No push or WhatsApp during these hours</p>
                </div>
              </div>
              <Switch checked={prefs.quiet_hours_enabled} onCheckedChange={v => update('quiet_hours_enabled', v)} data-testid="toggle-quiet-hours" />
            </div>

            {prefs.quiet_hours_enabled && (
              <div className="flex items-center gap-4 pl-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">From</Label>
                  <Select value={String(prefs.quiet_hours_start)} onValueChange={v => update('quiet_hours_start', parseInt(v))}>
                    <SelectTrigger className="w-28" data-testid="quiet-start"><SelectValue /></SelectTrigger>
                    <SelectContent>{HOURS.map(h => <SelectItem key={h.value} value={String(h.value)}>{h.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">To</Label>
                  <Select value={String(prefs.quiet_hours_end)} onValueChange={v => update('quiet_hours_end', parseInt(v))}>
                    <SelectTrigger className="w-28" data-testid="quiet-end"><SelectValue /></SelectTrigger>
                    <SelectContent>{HOURS.map(h => <SelectItem key={h.value} value={String(h.value)}>{h.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {prefs.quiet_hours_start > prefs.quiet_hours_end 
                    ? `${HOURS[prefs.quiet_hours_start]?.label} - ${HOURS[prefs.quiet_hours_end]?.label} (overnight)`
                    : `${HOURS[prefs.quiet_hours_start]?.label} - ${HOURS[prefs.quiet_hours_end]?.label}`}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 min-w-[140px]" data-testid="save-prefs-btn">
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Save Preferences
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
