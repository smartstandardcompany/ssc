import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, XCircle, DollarSign, Calendar, FileWarning } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const NOTIF_ICONS = {
  leave_approved: { icon: CheckCircle, color: 'text-success' },
  leave_rejected: { icon: XCircle, color: 'text-error' },
  leave_request: { icon: Calendar, color: 'text-warning' },
  salary_paid: { icon: DollarSign, color: 'text-success' },
  document_expiry: { icon: FileWarning, color: 'text-warning' },
};

export default function NotificationsPage() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      await api.post('/notifications/mark-read');
    } catch { toast.error('Failed to fetch notifications'); }
    finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="notifications-title">Notifications</h1>
          <p className="text-muted-foreground">{notifications.filter(n => !n.read).length} unread</p>
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {notifications.map(n => {
                const config = NOTIF_ICONS[n.type] || { icon: Bell, color: 'text-primary' };
                const Icon = config.icon;
                return (
                  <div key={n.id} className={`flex gap-4 p-4 rounded-lg border ${!n.read ? 'bg-primary/5 border-primary/20' : 'bg-background'}`} data-testid="notification-item">
                    <div className={`mt-1 ${config.color}`}><Icon size={20} /></div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{n.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{n.message}</div>
                      <div className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), 'MMM dd, yyyy hh:mm a')}</div>
                    </div>
                    {!n.read && <Badge className="bg-primary/20 text-primary h-5">New</Badge>}
                  </div>
                );
              })}
              {notifications.length === 0 && <p className="text-center text-muted-foreground py-8">No notifications</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
