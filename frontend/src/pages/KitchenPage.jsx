import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, ChefHat, Send, Package } from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export default function KitchenPage() {
  const { t } = useLanguage();
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [balance, setBalance] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [chefName, setChefName] = useState('');
  const [cart, setCart] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const init = async () => {
      try {
        const bRes = await Promise.resolve({ data: [] });
        // branches from store
        if (user.branch_id) {
          setBranchId(user.branch_id);
        }
        setChefName(user.name || '');
      } catch { toast.error('Failed to load'); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchStock();
      fetchUsage();
    }
  }, [branchId]);

  const fetchStock = async () => {
    try {
      const res = await api.get(`/stock/balance?branch_id=${branchId}`);
      setBalance(res.data);
    } catch {}
  };

  const fetchUsage = async () => {
    try {
      const res = await api.get(`/stock/usage?branch_id=${branchId}`);
      setUsage(res.data.slice(0, 20));
    } catch {}
  };

  const updateCart = (itemId, delta) => {
    setCart(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const setCartQty = (itemId, qty) => {
    const val = parseFloat(qty) || 0;
    if (val <= 0) {
      const { [itemId]: _, ...rest } = cart;
      setCart(rest);
    } else {
      setCart({ ...cart, [itemId]: val });
    }
  };

  const handleSubmitUsage = async () => {
    const items = Object.entries(cart).map(([item_id, quantity]) => ({ item_id, quantity }));
    if (items.length === 0) { toast.error('Select items first'); return; }
    if (!branchId) { toast.error('Select a branch'); return; }
    setSubmitting(true);
    try {
      await api.post('/stock/usage/bulk', {
        branch_id: branchId,
        used_by: chefName || 'Kitchen',
        date: new Date().toISOString(),
        items
      });
      toast.success(`${items.length} items recorded`);
      setCart({});
      fetchStock();
      fetchUsage();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const cartCount = Object.keys(cart).length;
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = balance.find(b => b.item_id === id);
    return { id, qty, name: item?.item_name || '?', unit: item?.unit || '' };
  });

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="kitchen-title">Kitchen</h1>
            <p className="text-muted-foreground">Pick items used today — stock will be updated automatically</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={branchId || "none"} onValueChange={(v) => setBranchId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-40" data-testid="kitchen-branch-select"><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={chefName} onChange={(e) => setChefName(e.target.value)} placeholder="Your name" className="w-36" data-testid="chef-name-input" />
          </div>
        </div>

        {!branchId ? (
          <Card className="border-stone-100">
            <CardContent className="py-12 text-center">
              <Package size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Select your branch to see available items</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AVAILABLE ITEMS */}
            <div className="lg:col-span-2">
              <Card className="border-stone-100">
                <CardHeader>
                  <CardTitle className="font-outfit text-base">Available Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {balance.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No stock items available for this branch</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {balance.filter(b => b.balance > 0).map(item => {
                        const inCart = cart[item.item_id] || 0;
                        return (
                          <div key={item.item_id}
                            className={`p-4 rounded-xl border-2 transition-all ${inCart > 0 ? 'border-primary bg-primary/5 shadow-sm' : 'border-stone-200 hover:border-stone-300'}`}
                            data-testid={`kitchen-item-${item.item_id}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-sm">{item.item_name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{item.category || 'General'} · {item.unit}</p>
                              </div>
                              <Badge variant="outline" className={item.low_stock ? 'border-error text-error' : 'border-success text-success'}>
                                {item.balance} left
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => updateCart(item.item_id, -1)} disabled={!inCart}>
                                <Minus size={14} />
                              </Button>
                              <Input type="number" value={inCart || ''} onChange={(e) => setCartQty(item.item_id, e.target.value)}
                                className="h-8 w-16 text-center" min="0" max={item.balance} step="0.5"
                                data-testid={`qty-input-${item.item_id}`} />
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => updateCart(item.item_id, 1)} disabled={inCart >= item.balance}>
                                <Plus size={14} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* CART & RECENT */}
            <div className="space-y-4">
              {/* CART */}
              <Card className={`border-2 ${cartCount > 0 ? 'border-primary' : 'border-stone-100'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="font-outfit text-base flex items-center gap-2">
                    <ChefHat size={18} /> Today's Usage {cartCount > 0 && <Badge className="bg-primary">{cartCount}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cartCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Pick items from the left to record usage</p>
                  ) : (
                    <div className="space-y-2">
                      {cartItems.map(ci => (
                        <div key={ci.id} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg text-sm">
                          <span className="font-medium">{ci.name}</span>
                          <span className="text-primary font-bold">{ci.qty} {ci.unit}</span>
                        </div>
                      ))}
                      <Button className="rounded-xl w-full mt-3" onClick={handleSubmitUsage} disabled={submitting} data-testid="submit-usage-btn">
                        <Send size={14} className="mr-2" />{submitting ? 'Recording...' : 'Record Usage'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RECENT USAGE */}
              <Card className="border-stone-100">
                <CardHeader className="pb-2">
                  <CardTitle className="font-outfit text-base">Recent Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  {usage.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">No usage recorded yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {usage.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-2 border-b text-xs">
                          <div>
                            <span className="font-medium">{u.item_name}</span>
                            <span className="text-muted-foreground ml-1">by {u.used_by}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-error">{u.quantity}</span>
                            <span className="text-muted-foreground ml-1">{format(new Date(u.date), 'MMM dd')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
