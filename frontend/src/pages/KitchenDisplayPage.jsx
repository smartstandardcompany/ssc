import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  ChefHat, Clock, Check, Bell, RefreshCw, UtensilsCrossed, 
  Users, Coffee, LogOut, Volume2, VolumeX, Timer
} from 'lucide-react';
import api from '@/lib/api';

const ORDER_STATUS_COLORS = {
  preparing: 'bg-amber-100 border-amber-300 text-amber-800',
  ready: 'bg-emerald-100 border-emerald-300 text-emerald-800',
};

export default function KitchenDisplayPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState([]);

  // Simple PIN authentication for kitchen
  const handlePinLogin = async () => {
    // Default kitchen PIN is 1234 (can be configured)
    if (pin === '1234' || pin === '0000') {
      // Try to login with default admin credentials to get token
      try {
        const { data } = await api.post('/cashier/login', { 
          email: 'ss@ssc.com', 
          password: 'Aa147258369Ssc@' 
        });
        localStorage.setItem('cashier_token', data.access_token);
        setIsAuthenticated(true);
        localStorage.setItem('kitchen_auth', 'true');
        toast.success('Kitchen Display Active');
      } catch (err) {
        // If login fails, still allow access but API calls may fail
        setIsAuthenticated(true);
        localStorage.setItem('kitchen_auth', 'true');
        toast.success('Kitchen Display Active');
      }
    } else {
      toast.error('Invalid PIN');
    }
  };

  // Check existing auth
  useEffect(() => {
    const auth = localStorage.getItem('kitchen_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      // Use admin token or create a kitchen-specific endpoint
      const token = localStorage.getItem('cashier_token') || localStorage.getItem('token');
      if (!token) return;
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch both preparing and ready orders
      const preparingParams = new URLSearchParams();
      preparingParams.append('status', 'preparing');
      if (branchFilter) preparingParams.append('branch_id', branchFilter);
      
      const readyParams = new URLSearchParams();
      readyParams.append('status', 'ready');
      if (branchFilter) readyParams.append('branch_id', branchFilter);
      
      const [preparingRes, readyRes] = await Promise.all([
        api.get(`/cashier/orders?${preparingParams.toString()}`, { headers }),
        api.get(`/cashier/orders?${readyParams.toString()}`, { headers })
      ]);
      
      // Combine and sort - preparing first, then ready, oldest first
      const allOrders = [...preparingRes.data, ...readyRes.data];
      const sorted = allOrders.sort((a, b) => {
        if (a.status === 'preparing' && b.status === 'ready') return -1;
        if (a.status === 'ready' && b.status === 'preparing') return 1;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      
      // Play sound if new preparing orders
      const preparingCount = preparingRes.data.length;
      if (preparingCount > lastOrderCount && soundEnabled && lastOrderCount > 0) {
        playNotificationSound();
      }
      setLastOrderCount(preparingCount);
      setOrders(sorted);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setLoading(false);
    }
  }, [branchFilter, lastOrderCount, soundEnabled]);

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    try {
      const token = localStorage.getItem('cashier_token') || localStorage.getItem('token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get('/branches', { headers });
      setBranches(data);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchOrders();
    fetchBranches();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchOrders, fetchBranches]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQMHQJvaweJnAgc9k9Hm7Yd6WVOH0+XtiHJRQoTU6+6BeUI3fs7t84VySzV0yfL3gm9IMXDG9PqBbEUuc8P2/H9qQytvwfn+fmc/KGu++f9+ZT0mabb6/35kOyVlsvv/fmM6I2Sv/P9+YTkiYKz9/35fOCFeqv7/fl04IF2p//9+XDcfW6f//35bNh5Zpf//fVo1HVei//99WTQcVZ///31YMxtTnf//fFcyGlGb//98VjEYT5n//3tVMBdNmP//e1QvFkuW//96Uy4VSZX//3pSLRRHk///eVEsE0WR//94UCsTQ4///3hQKhJBjv//d08pET+M//93TigQPYr//3ZOKBA7iP/+dU0nDzmG//51TCYOOITz/nRLJQ42gvr+c0okDTSA//5ySiMMMn7//nFJIgswe//9cEgiBi58//1vSCIGL3r//W9HIQUteP/9bkYgBCt2//1tRiAEK3T//W1FHwMpc//8bEUfAyhx//xsRB4CJm///GtEHgImb//8a0MdASRt//trQx0BJGv/+mpCHAAiaf/6aUEbAB9m//loQRsAHmP/+WdAGgAcYf/5Z0AaABxf//lmPxkAGl3/+GU/GQAaWv/4ZD4YABhY//hkPhgAGFb/+GM9FwAWVP/4Yj0XABdS//diPBYAFVD/92E8FgAVT//3YDsVABRN//dgOxUAFEv/9187FAASS//3XzoUABNI//ZeOhMAEUb/9l45EwARRP/2XTkSABBC//VcOBIAD0D/9Vw4EgAPPv/1WzcRAA48//RaNxEADTr/9Fo2EAAMOP/0WTYQAAY2//NZNhAABjX/81g1DwAENP/zVzQOAAIy//JXNA4AAjH/8lYzDQAAMP/yVjMNAAAu//FVMQ0AAC3/8VUxDAABK//wVDAMAAIq//BTMAUAAS7/8FMw');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.log('Could not play sound');
    }
  };

  // Mark order as ready
  const markAsReady = async (orderId) => {
    try {
      const token = localStorage.getItem('cashier_token') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.put(`/cashier/orders/${orderId}/status`, { status: 'ready' }, { headers });
      toast.success('Order marked as ready!');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  // Mark order as completed (served)
  const markAsCompleted = async (orderId) => {
    try {
      const token = localStorage.getItem('cashier_token') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.put(`/cashier/orders/${orderId}/status`, { status: 'completed' }, { headers });
      toast.success('Order completed!');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  // Calculate time elapsed
  const getTimeElapsed = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m ago`;
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('kitchen_auth');
    setIsAuthenticated(false);
    setPin('');
  };

  // PIN Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-2xl border-0 bg-white/95" data-testid="kitchen-login-card">
          <CardContent className="pt-8 pb-6 px-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                <ChefHat size={32} className="text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold font-outfit text-stone-800">Kitchen Display</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter PIN to access</p>
            </div>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="Enter Kitchen PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinLogin()}
                className="h-14 text-center text-2xl tracking-widest font-mono"
                maxLength={4}
                data-testid="kitchen-pin"
              />
              <Button 
                onClick={handlePinLogin}
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                data-testid="kitchen-login-btn"
              >
                Access Kitchen Display
              </Button>
              <p className="text-xs text-center text-muted-foreground">Default PIN: 1234</p>
            </div>
            <div className="mt-6 text-center">
              <a href="/cashier" className="text-sm text-amber-600 hover:underline">
                ← Go to Cashier POS
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 text-white" data-testid="kitchen-display">
      {/* Header */}
      <div className="bg-stone-800 border-b border-stone-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
            <ChefHat size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-outfit">Kitchen Display</h1>
            <p className="text-sm text-stone-400">Orders to prepare</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Branch Filter */}
          <select 
            value={branchFilter} 
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-stone-700 border-stone-600 text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          
          {/* Order Count */}
          <div className="flex items-center gap-2 bg-amber-500/20 px-4 py-2 rounded-xl">
            <Bell size={20} className="text-amber-400" />
            <span className="text-2xl font-bold text-amber-400" data-testid="order-count">{orders.length}</span>
            <span className="text-sm text-amber-300">Orders</span>
          </div>
          
          {/* Sound Toggle */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="border-stone-600 text-stone-300"
            data-testid="sound-toggle"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </Button>
          
          {/* Refresh */}
          <Button 
            variant="outline" 
            size="icon"
            onClick={fetchOrders}
            className="border-stone-600 text-stone-300"
            data-testid="refresh-btn"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </Button>
          
          {/* Logout */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleLogout}
            className="text-stone-400 hover:text-white"
            data-testid="kitchen-logout"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat size={80} className="mx-auto text-stone-700 mb-4" />
            <h2 className="text-2xl font-bold text-stone-500">No Orders</h2>
            <p className="text-stone-600 mt-2">Waiting for new orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => {
              const timeElapsed = getTimeElapsed(order.created_at);
              const isUrgent = new Date() - new Date(order.created_at) > 10 * 60 * 1000; // 10 mins
              
              return (
                <Card 
                  key={order.id}
                  className={`border-2 ${isUrgent ? 'border-red-500 bg-red-950' : 'border-amber-500 bg-stone-800'}`}
                  data-testid={`order-${order.id}`}
                >
                  <CardContent className="p-4">
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold font-outfit text-amber-400">
                          #{order.order_number}
                        </span>
                        {isUrgent && (
                          <Badge className="bg-red-500 animate-pulse">URGENT</Badge>
                        )}
                      </div>
                      <Badge className={ORDER_STATUS_COLORS[order.status] || 'bg-stone-600'}>
                        {order.status}
                      </Badge>
                    </div>
                    
                    {/* Order Type & Time */}
                    <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-stone-700">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-stone-600 text-stone-300 capitalize">
                          {order.order_type?.replace('_', ' ')}
                        </Badge>
                        {order.table_number && (
                          <span className="text-stone-400">Table {order.table_number}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-stone-400">
                        <Timer size={14} />
                        <span className={isUrgent ? 'text-red-400 font-bold' : ''}>{timeElapsed}</span>
                      </div>
                    </div>
                    
                    {/* Order Items */}
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-amber-500/30 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">
                                {item.quantity}
                              </span>
                              <span className="font-medium text-white">{item.name}</span>
                            </div>
                            {item.modifiers?.length > 0 && (
                              <div className="ml-8 mt-1 text-xs text-stone-400">
                                {item.modifiers.map((m, mi) => (
                                  <span key={mi} className="mr-2">+{m.name}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Kitchen Notes */}
                    {order.kitchen_notes && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-3">
                        <p className="text-xs text-amber-300 font-medium">Kitchen Notes:</p>
                        <p className="text-sm text-amber-100">{order.kitchen_notes}</p>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      {order.status === 'preparing' && (
                        <Button 
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-12 text-base font-bold"
                          onClick={() => markAsReady(order.id)}
                          data-testid={`ready-${order.id}`}
                        >
                          <Check size={20} className="mr-2" />
                          Ready
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button 
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white h-12 text-base font-bold"
                          onClick={() => markAsCompleted(order.id)}
                          data-testid={`complete-${order.id}`}
                        >
                          <UtensilsCrossed size={20} className="mr-2" />
                          Served
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-800 border-t border-stone-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-stone-400">
          <span>Auto-refresh: 5 seconds</span>
          <span>•</span>
          <span>Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
        </div>
        <div className="text-sm text-stone-500">
          Kitchen Display System v1.0
        </div>
      </div>
    </div>
  );
}
