import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, CheckCircle2, Bell, UtensilsCrossed, Armchair, Timer, Flame } from 'lucide-react';
import api from '@/lib/api';

function OrderCard({ order, type }) {
  const isReady = type === 'ready';
  const createdAt = order.created_at ? new Date(order.created_at) : null;
  const minutesAgo = createdAt ? Math.round((Date.now() - createdAt.getTime()) / 60000) : 0;

  return (
    <Card
      className={`border-2 p-4 sm:p-5 transition-all ${
        isReady
          ? 'bg-emerald-900/60 border-emerald-400 animate-[glow_2s_ease-in-out_infinite]'
          : minutesAgo > 15
          ? 'bg-red-900/40 border-red-500'
          : 'bg-stone-800 border-amber-500/40'
      }`}
      data-testid={`${type}-${order.order_number}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className={`text-4xl sm:text-5xl font-black font-outfit ${isReady ? 'text-emerald-400' : minutesAgo > 15 ? 'text-red-400' : 'text-amber-400'}`}>
            #{order.order_number}
          </span>
          <div>
            {order.customer_name && (
              <p className="text-white font-medium text-sm sm:text-base">{order.customer_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {order.table_number && (
                <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs">
                  <Armchair size={11} className="mr-1" />Table {order.table_number}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] text-stone-400 border-stone-600 capitalize">
                {order.order_type?.replace('_', ' ') || 'Dine In'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {isReady ? (
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold text-sm sm:text-base">READY!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {minutesAgo > 15 ? <Flame size={20} className="text-red-400 animate-pulse" /> : <Clock size={20} className="text-amber-400 animate-spin-slow" />}
              <span className={`text-sm font-medium ${minutesAgo > 15 ? 'text-red-400' : 'text-amber-400'}`}>{minutesAgo}m</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar for preparing orders */}
      {!isReady && (
        <div className="mt-3">
          <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${minutesAgo > 15 ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, (minutesAgo / 20) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-stone-500 mt-1 text-right">~{Math.max(1, 15 - minutesAgo)}m remaining</p>
        </div>
      )}
    </Card>
  );
}

export default function OrderStatusPage() {
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch');
  const [orders, setOrders] = useState({ preparing: [], ready: [] });
  const [currentTime, setCurrentTime] = useState(new Date());
  const prevReadyCount = useRef(0);
  const audioRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = branchId ? `?branch_id=${branchId}` : '';
      const { data } = await api.get(`/order-status/active${params}`);
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, [branchId]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Play bell sound when a new order is ready
  useEffect(() => {
    if (orders.ready.length > prevReadyCount.current && prevReadyCount.current > 0) {
      try { audioRef.current?.play(); } catch {}
    }
    prevReadyCount.current = orders.ready.length;
  }, [orders.ready.length]);

  const totalOrders = (orders.preparing?.length || 0) + (orders.ready?.length || 0);

  return (
    <div className="min-h-screen bg-stone-900 text-white" data-testid="order-status-display">
      {/* Hidden audio for notification */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19teleGlzdExBVl9EQVRAAAAAA" type="audio/wav" />
      </audio>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes glow { 0%, 100% { box-shadow: 0 0 8px rgba(52, 211, 153, 0.3); } 50% { box-shadow: 0 0 20px rgba(52, 211, 153, 0.6); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 sm:px-6 py-4 sm:py-6" data-testid="order-display-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <UtensilsCrossed size={24} className="text-white sm:hidden" />
              <UtensilsCrossed size={28} className="text-white hidden sm:block" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold font-outfit">Order Status</h1>
              <p className="text-white/80 text-xs sm:text-sm">
                {totalOrders === 0 ? 'No active orders' : `${totalOrders} active order${totalOrders !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-4xl font-bold font-mono" data-testid="display-clock">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-white/70 text-xs sm:text-sm hidden sm:block">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="bg-stone-800 border-b border-stone-700 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-stone-300"><strong className="text-amber-400">{orders.preparing?.length || 0}</strong> Preparing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-stone-300"><strong className="text-emerald-400">{orders.ready?.length || 0}</strong> Ready</span>
          </div>
          {orders.preparing?.some(o => {
            const m = o.created_at ? Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) : 0;
            return m > 15;
          }) && (
            <div className="flex items-center gap-2 ml-auto">
              <Flame size={14} className="text-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-medium">Delayed orders</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Responsive: stack on mobile, side-by-side on desktop */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {totalOrders === 0 ? (
          <div className="text-center py-20 sm:py-32" data-testid="no-orders-message">
            <UtensilsCrossed size={64} className="mx-auto mb-4 text-stone-700" />
            <h2 className="text-xl sm:text-2xl font-outfit font-bold text-stone-500">No Active Orders</h2>
            <p className="text-stone-600 text-sm mt-2">Place an order and your status will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            {/* Preparing Column */}
            <div>
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <ChefHat size={22} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-amber-400">Preparing</h2>
                  <p className="text-stone-400 text-xs sm:text-sm">{orders.preparing?.length || 0} orders in kitchen</p>
                </div>
              </div>
              <div className="space-y-3">
                {(orders.preparing || []).length === 0 ? (
                  <div className="text-center py-12 text-stone-600">
                    <Clock size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No orders preparing</p>
                  </div>
                ) : (
                  (orders.preparing || []).map(order => (
                    <OrderCard key={order.id} order={order} type="preparing" />
                  ))
                )}
              </div>
            </div>

            {/* Ready Column */}
            <div>
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center ${(orders.ready || []).length > 0 ? 'animate-pulse' : ''}`}>
                  <Bell size={22} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-emerald-400">Ready for Pickup</h2>
                  <p className="text-stone-400 text-xs sm:text-sm">{orders.ready?.length || 0} orders ready</p>
                </div>
              </div>
              <div className="space-y-3">
                {(orders.ready || []).length === 0 ? (
                  <div className="text-center py-12 text-stone-600">
                    <CheckCircle2 size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No orders ready yet</p>
                  </div>
                ) : (
                  (orders.ready || []).map(order => (
                    <OrderCard key={order.id} order={order} type="ready" />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-800 border-t border-stone-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-stone-500">
          <p className="hidden sm:block">Please wait for your order number to appear in "Ready"</p>
          <p className="sm:hidden">Wait for your number in "Ready"</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
