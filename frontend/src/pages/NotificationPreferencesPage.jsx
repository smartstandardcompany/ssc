import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Package, Calendar, Wallet, AlertTriangle, FileWarning, BarChart3, Check, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const PREF_ITEMS = [
  { key: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Get notified when items run low', icon: Package, color: 'text-red-500' },
  { key: 'leave_requests', label: 'Leave Requests', desc: 'Notifications for new leave requests and approvals', icon: Calendar, color: 'text-blue-500' },
  { key: 'order_updates', label: 'Order Updates', desc: 'KDS and POS order status changes', icon: BarChart3, color: 'text-emerald-500' },
  { key: 'loan_installments', label: 'Loan Installments', desc: 'Upcoming loan installment due reminders', icon: Wallet, color: 'text-amber-500' },
  { key: 'expense_anomalies', label: 'Expense Anomalies', desc: 'Unusual spending pattern detection', icon: AlertTriangle, color: 'text-orange-500' },
  { key: 'document_expiry', label: 'Document Expiry', desc: 'Alerts for expiring documents and licenses', icon: FileWarning, color: 'text-purple-500' },
  { key: 'daily_summary', label: 'Daily Summary', desc: 'End-of-day business summary notification', icon: BarChart3, color: 'text-stone-500' },
];

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState({});
  const [pushStatus, setPushStatus] = useState({ subscribed: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [prefsRes, statusRes] = await Promise.all([
        api.get('/push/preferences'),
        api.get('/push/status')
      ]);
      setPrefs(prefsRes.data);
      setPushStatus(statusRes.data);
    } catch { toast.error('Failed to load preferences'); }
    finally { setLoading(false); }
  };

  const togglePref = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await api.put('/push/preferences', {
        low_stock_alerts: prefs.low_stock_alerts ?? true,
        leave_requests: prefs.leave_requests ?? true,
        order_updates: prefs.order_updates ?? true,
        loan_installments: prefs.loan_installments ?? true,
        expense_anomalies: prefs.expense_anomalies ?? true,
        document_expiry: prefs.document_expiry ?? true,
        daily_summary: prefs.daily_summary ?? false,
      });
      toast.success('Preferences saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const enablePush = async () => {
    if (!('Notification' in window)) {
      toast.error('Push notifications not supported in this browser');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.error('Notification permission denied');
      return;
    }

    try {
      const vapidRes = await api.get('/push/vapid-key');
      const publicKey = vapidRes.data.publicKey;

      if (!publicKey) {
        toast.error('Push not configured on server');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await api.post('/push/subscribe', {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
        }
      });

      setPushStatus({ subscribed: true, subscription_count: 1 });
      toast.success('Push notifications enabled!');
    } catch (err) {
      console.error('Push subscribe error:', err);
      toast.error('Failed to enable push notifications');
    }
  };

  const disablePush = async () => {
    try {
      await api.delete('/push/unsubscribe');
      setPushStatus({ subscribed: false, subscription_count: 0 });
      toast.success('Push notifications disabled');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl" data-testid="notification-preferences-page">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="notif-prefs-title">Notification Preferences</h1>
          <p className="text-sm text-muted-foreground">Choose which notifications you want to receive</p>
        </div>

        {/* Push Status */}
        <Card className="border-orange-200 bg-orange-50/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pushStatus.subscribed ? <Bell className="text-orange-500" size={24} /> : <BellOff className="text-stone-400" size={24} />}
                <div>
                  <p className="text-sm font-semibold">Browser Push Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {pushStatus.subscribed ? 'Enabled — you will receive browser push alerts' : 'Disabled — enable to get real-time browser alerts'}
                  </p>
                </div>
              </div>
              <Button
                onClick={pushStatus.subscribed ? disablePush : enablePush}
                variant={pushStatus.subscribed ? 'outline' : 'default'}
                className="rounded-xl"
                data-testid="toggle-push-btn"
              >
                {pushStatus.subscribed ? 'Disable' : 'Enable Push'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit text-base">Notification Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {PREF_ITEMS.map(item => {
              const Icon = item.icon;
              const enabled = prefs[item.key] ?? (item.key !== 'daily_summary');
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${enabled ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 opacity-60'}`}
                  onClick={() => togglePref(item.key)}
                  data-testid={`pref-${item.key}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={item.color} />
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${enabled ? 'bg-orange-500 justify-end' : 'bg-stone-300 justify-start'}`}>
                    <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5 flex items-center justify-center">
                      {enabled && <Check size={12} className="text-orange-500" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button onClick={savePrefs} className="w-full rounded-xl" disabled={saving} data-testid="save-prefs-btn">
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </DashboardLayout>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
