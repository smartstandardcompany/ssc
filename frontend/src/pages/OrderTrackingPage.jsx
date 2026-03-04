import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Truck, Package, CheckCircle, Clock, XCircle, Bell, Mail, MessageSquare,
  RefreshCw, ChevronRight, User, DollarSign, Calendar, Send
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ORDER_STATUSES = [
  { value: 'placed', label: 'Placed', icon: Package, color: 'bg-stone-100 text-stone-700' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'bg-blue-100 text-blue-700' },
  { value: 'preparing', label: 'Preparing', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  { value: 'ready', label: 'Ready', icon: Package, color: 'bg-green-100 text-green-700' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, color: 'bg-purple-100 text-purple-700' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-700' },
];

export default function OrderTrackingPage() {
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState({ enabled: true, channels: ['email', 'whatsapp'], notify_on_statuses: [] });
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updateData, setUpdateData] = useState({ status: '', notes: '', notify_customer: true });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, configRes] = await Promise.all([
        api.get('/order-tracking/recent?limit=50'),
        api.get('/order-tracking/config'),
      ]);
      setOrders(ordersRes.data);
      setConfig(configRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updateData.status) {
      toast.error('Please select a status');
      return;
    }
    
    setUpdating(true);
    try {
      await api.post('/order-tracking/update-status', {
        order_id: selectedOrder.id,
        status: updateData.status,
        notes: updateData.notes || null,
        notify_customer: updateData.notify_customer,
      });
      toast.success(`Order status updated to ${updateData.status}`);
      setShowUpdateDialog(false);
      setSelectedOrder(null);
      setUpdateData({ status: '', notes: '', notify_customer: true });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.post('/order-tracking/config', config);
      toast.success('Configuration saved');
      setShowConfigDialog(false);
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const getStatusInfo = (status) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

  const openUpdateDialog = (order) => {
    setSelectedOrder(order);
    setUpdateData({ status: order.order_status || 'placed', notes: '', notify_customer: true });
    setShowUpdateDialog(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="order-tracking-title">
              <Truck className="text-emerald-500" />
              Order Tracking
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage order statuses and send customer notifications
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConfigDialog(true)} data-testid="config-btn">
              <Bell size={14} className="mr-1" /> Notification Settings
            </Button>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw size={14} className="mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {ORDER_STATUSES.map((status) => {
            const count = orders.filter(o => (o.order_status || 'placed') === status.value).length;
            const StatusIcon = status.icon;
            return (
              <Card key={status.value} className={`${status.color} border-0`}>
                <CardContent className="p-3 text-center">
                  <StatusIcon className="mx-auto mb-1" size={20} />
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs">{status.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto mb-2 text-stone-300" size={48} />
                <p>No orders with customers found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const statusInfo = getStatusInfo(order.order_status || 'placed');
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div 
                      key={order.id}
                      className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                      onClick={() => openUpdateDialog(order)}
                      data-testid={`order-row-${order.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color}`}>
                          <StatusIcon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.id.slice(-6)}</span>
                            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <User size={12} /> {order.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign size={12} /> SAR {(order.amount || order.total || 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} /> {order.created_at ? format(new Date(order.created_at), 'dd MMM, h:mm a') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="text-stone-400" size={20} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update Status Dialog */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent className="max-w-md" data-testid="update-status-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="text-emerald-500" />
                Update Order Status
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="p-3 bg-stone-50 rounded-lg">
                  <p className="font-medium">Order #{selectedOrder.id.slice(-6)}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_name}</p>
                  <p className="text-sm font-bold text-emerald-600">SAR {(selectedOrder.amount || selectedOrder.total || 0).toLocaleString()}</p>
                </div>

                {/* Status Timeline */}
                <div className="flex items-center justify-between overflow-x-auto py-2">
                  {ORDER_STATUSES.filter(s => s.value !== 'cancelled').map((status, idx) => {
                    const isActive = status.value === updateData.status;
                    const isPast = ORDER_STATUSES.findIndex(s => s.value === updateData.status) > idx;
                    return (
                      <div key={status.value} className="flex flex-col items-center min-w-[60px]">
                        <button
                          onClick={() => setUpdateData({ ...updateData, status: status.value })}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            isActive ? 'bg-emerald-500 text-white' : 
                            isPast ? 'bg-emerald-200 text-emerald-700' : 
                            'bg-stone-200 text-stone-500'
                          }`}
                        >
                          <status.icon size={14} />
                        </button>
                        <span className={`text-xs mt-1 ${isActive ? 'font-bold text-emerald-600' : 'text-muted-foreground'}`}>
                          {status.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <Label>New Status</Label>
                  <Select value={updateData.status} onValueChange={(v) => setUpdateData({ ...updateData, status: v })}>
                    <SelectTrigger data-testid="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Add any notes for this status update..."
                    value={updateData.notes}
                    onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                    data-testid="status-notes"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Checkbox
                    id="notify"
                    checked={updateData.notify_customer}
                    onCheckedChange={(v) => setUpdateData({ ...updateData, notify_customer: v })}
                  />
                  <Label htmlFor="notify" className="text-sm cursor-pointer">
                    <Bell size={14} className="inline mr-1" />
                    Notify customer via {config.channels.join(' & ')}
                  </Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowUpdateDialog(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateStatus} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={updating}
                    data-testid="confirm-status-btn"
                  >
                    {updating ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Send size={14} className="mr-1" />}
                    Update Status
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Notification Config Dialog */}
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="max-w-md" data-testid="config-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="text-emerald-500" />
                Notification Settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Order Notifications</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  data-testid="enable-notifications"
                />
              </div>

              <div className="space-y-2">
                <Label>Notification Channels</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.channels.includes('email')}
                      onCheckedChange={(v) => {
                        const channels = v 
                          ? [...config.channels, 'email'] 
                          : config.channels.filter(c => c !== 'email');
                        setConfig({ ...config, channels });
                      }}
                    />
                    <Mail size={16} /> Email
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.channels.includes('whatsapp')}
                      onCheckedChange={(v) => {
                        const channels = v 
                          ? [...config.channels, 'whatsapp'] 
                          : config.channels.filter(c => c !== 'whatsapp');
                        setConfig({ ...config, channels });
                      }}
                    />
                    <MessageSquare size={16} /> WhatsApp
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notify on Status Changes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ORDER_STATUSES.filter(s => s.value !== 'placed' && s.value !== 'cancelled').map((status) => (
                    <label key={status.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={config.notify_on_statuses.includes(status.value)}
                        onCheckedChange={(v) => {
                          const statuses = v
                            ? [...config.notify_on_statuses, status.value]
                            : config.notify_on_statuses.filter(s => s !== status.value);
                          setConfig({ ...config, notify_on_statuses: statuses });
                        }}
                      />
                      {status.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowConfigDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveConfig} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="save-config-btn">
                  Save Settings
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
