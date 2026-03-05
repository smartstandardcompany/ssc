import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Clock, CheckCircle, Truck, XCircle, UtensilsCrossed, ChefHat, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';

const STATUSES = [
  { key: 'placed', label: 'Order Placed', icon: Package, color: 'text-stone-500', bg: 'bg-stone-100' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100' },
  { key: 'preparing', label: 'Preparing', icon: ChefHat, color: 'text-amber-500', bg: 'bg-amber-100' },
  { key: 'ready', label: 'Ready', icon: UtensilsCrossed, color: 'text-green-500', bg: 'bg-green-100' },
  { key: 'out_for_delivery', label: 'On the Way', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-100' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
];

export default function PublicOrderTrackPage() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-track if order ID in URL params (from QR code)
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setOrderNumber(id);
      trackOrder(id);
    }
  }, [searchParams]);

  const trackOrder = async (id) => {
    if (!id?.trim()) return;
    setLoading(true); setError(''); setOrder(null);
    try {
      const { data } = await api.get(`/order-tracking/order/${id.trim()}`);
      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Order not found. Please check your order number.');
    } finally { setLoading(false); }
  };

  const handleTrack = async (e) => {
    e?.preventDefault();
    trackOrder(orderNumber);
  };

  const getStatusIdx = (status) => STATUSES.findIndex(s => s.key === status);
  const currentIdx = order ? getStatusIdx(order.status) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-stone-950 dark:to-stone-900" data-testid="public-order-track">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UtensilsCrossed size={32} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Track Your Order</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your order number to see real-time status</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleTrack} className="flex gap-2 mb-6">
          <Input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Enter order number..."
            className="h-12 text-base rounded-xl"
            data-testid="order-number-input"
          />
          <Button type="submit" disabled={loading} className="h-12 px-6 rounded-xl bg-orange-500 hover:bg-orange-600" data-testid="track-btn">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </Button>
        </form>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 mb-6">
            <CardContent className="p-4 text-center">
              <XCircle size={24} className="mx-auto mb-2 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6 animate-in fade-in" data-testid="order-result">
            {/* Order Info */}
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Order {order.order_number || order.order_id?.slice(-8)}</p>
                    <h2 className="text-lg font-bold dark:text-white">SAR {(order.total || 0).toFixed(2)}</h2>
                  </div>
                  <Badge className={`${STATUSES[currentIdx]?.bg || 'bg-stone-100'} ${STATUSES[currentIdx]?.color || 'text-stone-700'} font-medium`}>
                    {STATUSES[currentIdx]?.label || order.status}
                  </Badge>
                </div>
                {order.customer_name && <p className="text-sm text-muted-foreground">Customer: {order.customer_name}</p>}
                {order.table_number && <p className="text-sm text-muted-foreground">Table: {order.table_number}</p>}
                {order.created_at && <p className="text-xs text-muted-foreground mt-1">{format(new Date(order.created_at), 'MMM dd, yyyy h:mm a')}</p>}
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-4 dark:text-white">Order Status</h3>
                <div className="space-y-0">
                  {STATUSES.filter(s => s.key !== 'cancelled').map((step, idx) => {
                    const isActive = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex items-start gap-3" data-testid={`status-step-${step.key}`}>
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? `${step.bg} ${step.color}` : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600'} ${isCurrent ? 'ring-2 ring-offset-2 ring-orange-400' : ''}`}>
                            <Icon size={16} />
                          </div>
                          {idx < STATUSES.length - 2 && (
                            <div className={`w-0.5 h-8 ${isActive ? 'bg-orange-300' : 'bg-stone-200 dark:bg-stone-700'}`} />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className={`text-sm font-medium ${isActive ? 'dark:text-white' : 'text-muted-foreground'}`}>{step.label}</p>
                          {isCurrent && <p className="text-xs text-orange-500 font-medium">Current</p>}
                        </div>
                      </div>
                    );
                  })}
                  {order.status === 'cancelled' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-500 ring-2 ring-offset-2 ring-red-400">
                        <XCircle size={16} />
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-medium text-red-600">Cancelled</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            {order.items?.length > 0 && (
              <Card className="border-border shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 dark:text-white">Order Items</h3>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0 dark:border-stone-700">
                        <div>
                          <p className="text-sm dark:text-white">{item.name || item.item_name}</p>
                          <p className="text-xs text-muted-foreground">x{item.quantity || 1}</p>
                        </div>
                        <span className="text-sm font-medium dark:text-white">SAR {((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status History */}
            {order.status_history?.length > 0 && (
              <Card className="border-border shadow-sm">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 dark:text-white">Timeline</h3>
                  <div className="space-y-3">
                    {order.status_history.map((h, idx) => (
                      <div key={idx} className="flex gap-3 items-start text-xs">
                        <Clock size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium dark:text-white capitalize">{h.status?.replace('_', ' ')}</p>
                          {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                          {h.timestamp && <p className="text-muted-foreground">{format(new Date(h.timestamp), 'MMM dd, h:mm a')}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
