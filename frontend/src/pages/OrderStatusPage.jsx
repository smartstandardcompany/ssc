import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, CheckCircle2, Bell, UtensilsCrossed } from 'lucide-react';
import api from '@/lib/api';

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch');
  const [orders, setOrders] = useState({ preparing: [], ready: [] });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const params = branchId ? `?branch_id=${branchId}` : '';
      const { data } = await api.get(`/order-status/active${params}`);
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, [branchId]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Play sound when order is ready
  useEffect(() => {
    if (orders.ready.length > 0) {
      // Could add sound here
    }
  }, [orders.ready.length]);

  return (
    <div className="min-h-screen bg-stone-900 text-white" data-testid="order-status-display">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <UtensilsCrossed size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-outfit">Order Status</h1>
              <p className="text-white/80 text-sm">Your order will appear here</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold font-mono">{currentTime.toLocaleTimeString()}</p>
            <p className="text-white/70">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-2 gap-8">
          
          {/* Preparing Column */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <ChefHat size={24} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-amber-400">Preparing</h2>
                <p className="text-stone-400 text-sm">{orders.total_preparing || 0} orders in kitchen</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {orders.preparing.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Clock size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No orders preparing</p>
                </div>
              ) : (
                orders.preparing.map(order => (
                  <Card 
                    key={order.id}
                    className="bg-stone-800 border-amber-500/30 border-2 p-4"
                    data-testid={`preparing-${order.order_number}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-5xl font-bold font-outfit text-amber-400">
                          #{order.order_number}
                        </span>
                        <div>
                          {order.customer_name && (
                            <p className="text-white font-medium">{order.customer_name}</p>
                          )}
                          <Badge variant="outline" className="text-xs text-stone-400 border-stone-600 capitalize">
                            {order.order_type?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-amber-400">
                        <Clock size={20} className="animate-pulse" />
                        <span className="text-lg font-medium">Preparing...</span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center animate-pulse">
                <Bell size={24} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-emerald-400">Ready for Pickup</h2>
                <p className="text-stone-400 text-sm">{orders.total_ready || 0} orders ready</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {orders.ready.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No orders ready</p>
                </div>
              ) : (
                orders.ready.map(order => (
                  <Card 
                    key={order.id}
                    className="bg-emerald-900/50 border-emerald-400 border-2 p-4 animate-pulse"
                    data-testid={`ready-${order.order_number}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-5xl font-bold font-outfit text-emerald-400">
                          #{order.order_number}
                        </span>
                        <div>
                          {order.customer_name && (
                            <p className="text-white font-medium">{order.customer_name}</p>
                          )}
                          <Badge variant="outline" className="text-xs text-stone-400 border-stone-600 capitalize">
                            {order.order_type?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={24} />
                        <span className="text-xl font-bold">READY!</span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-800 border-t border-stone-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-stone-400">
          <p>Please wait for your order number to appear in the "Ready" column</p>
          <p>Auto-updates every 3 seconds</p>
        </div>
      </div>
    </div>
  );
}
