import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Users,
  ChefHat, X, Check, UtensilsCrossed, Grid, Star, LogOut, Coffee, Cake,
  Pizza, Salad, Armchair, ArrowLeft, RefreshCw, CircleDot, Clock, DollarSign
} from 'lucide-react';
import api from '@/lib/api';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORY_ICONS = {
  all: Grid, popular: Star, main: UtensilsCrossed, appetizer: Salad,
  beverage: Coffee, dessert: Cake, sides: Pizza,
};

const STATUS_COLORS = {
  available: { bg: 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  occupied: { bg: 'bg-red-50 border-red-400 hover:bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  reserved: { bg: 'bg-amber-50 border-amber-400 hover:bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  cleaning: { bg: 'bg-blue-50 border-blue-400 hover:bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export default function WaiterPage() {
  const navigate = useNavigate();
  const [waiter, setWaiter] = useState(null);
  const [pin, setPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Views: 'login' | 'tables' | 'order'
  const [view, setView] = useState('login');

  // Table data
  const [sections, setSections] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeSection, setActiveSection] = useState('all');
  const [selectedTable, setSelectedTable] = useState(null);

  // Order data
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Dialogs
  const [showModifiers, setShowModifiers] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Check stored auth
  useEffect(() => {
    const waiterData = localStorage.getItem('waiter_user');
    const waiterToken = localStorage.getItem('waiter_token');
    if (waiterData && waiterToken) {
      setWaiter(JSON.parse(waiterData));
      setView('tables');
    }
  }, []);

  // Fetch tables
  const fetchTables = useCallback(async () => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [secRes, tabRes] = await Promise.all([
        api.get('/tables/sections', { headers }),
        api.get('/tables', { headers }),
      ]);
      setSections(secRes.data);
      setTables(tabRes.data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  }, []);

  // Fetch menu
  const fetchMenu = useCallback(async () => {
    const token = localStorage.getItem('waiter_token');
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [catRes, menuRes, custRes] = await Promise.all([
        api.get('/cashier/categories', { headers }),
        api.get('/cashier/menu', { headers }),
        api.get('/cashier/customers', { headers }),
      ]);
      setCategories(catRes.data);
      setMenuItems(menuRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }, []);

  useEffect(() => {
    if (view === 'tables') fetchTables();
    if (view === 'order') fetchMenu();
  }, [view, fetchTables, fetchMenu]);

  // Auto-refresh tables every 10s
  useEffect(() => {
    if (view !== 'tables') return;
    const interval = setInterval(fetchTables, 10000);
    return () => clearInterval(interval);
  }, [view, fetchTables]);

  // PIN Login
  const handleLogin = async () => {
    if (pin.length < 4) { toast.error('Enter your 4-digit PIN'); return; }
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/cashier/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Invalid PIN');
      }
      const data = await res.json();
      const posRole = data.user?.pos_role || 'both';
      
      // Check if user has waiter access
      if (posRole === 'cashier') {
        toast.error('This PIN is for cashier access only. Please use Cashier POS.');
        setPin('');
        setLoginLoading(false);
        return;
      }
      
      localStorage.setItem('waiter_token', data.access_token);
      localStorage.setItem('waiter_user', JSON.stringify(data.user));
      setWaiter(data.user);
      setView('tables');
      toast.success(`Welcome, ${data.user.name}!`);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    setWaiter(null);
    setView('login');
    setPin('');
  };

  // Select table and start/resume order
  const handleSelectTable = async (table) => {
    const token = localStorage.getItem('waiter_token');
    const headers = { Authorization: `Bearer ${token}` };

    if (table.status === 'occupied' && table.current_order_id) {
      // Resume existing order
      try {
        const res = await api.post(`/tables/${table.id}/start-order`, { waiter_id: waiter?.id }, { headers });
        setSelectedTable(table);
        setCurrentOrder(res.data.order);
        setCart(mapOrderItemsToCart(res.data.order?.items || []));
        setView('order');
      } catch (err) {
        toast.error('Failed to load order');
      }
    } else if (table.status === 'available') {
      // Start new order
      try {
        const res = await api.post(`/tables/${table.id}/start-order`, {
          waiter_id: waiter?.id,
          customer_count: 1,
        }, { headers });
        setSelectedTable(table);
        setCurrentOrder(res.data.order);
        setCart([]);
        setView('order');
        toast.success(`Order started for table ${table.table_number}`);
      } catch (err) {
        toast.error('Failed to start order');
      }
    } else if (table.status === 'cleaning') {
      // Mark as available
      try {
        await api.post(`/tables/${table.id}/mark-available`, {}, { headers });
        toast.success('Table marked as available');
        fetchTables();
      } catch (err) {
        toast.error('Failed to update table');
      }
    } else {
      toast.info(`Table ${table.table_number} is ${table.status}`);
    }
  };

  const mapOrderItemsToCart = (items) => {
    return items.map(item => ({
      item_id: item.item_id || item.id,
      name: item.name,
      name_ar: item.name_ar,
      unit_price: item.price || item.unit_price || 0,
      modifiers: item.modifiers || [],
      modifier_total: (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0),
      quantity: item.quantity || 1,
      subtotal: (item.price || item.unit_price || 0) * (item.quantity || 1),
      existing: true,
    }));
  };

  // Menu filtering
  const filteredItems = menuItems.filter(item => {
    if (selectedCategory !== 'all' && selectedCategory !== 'popular') {
      if (item.category !== selectedCategory) return false;
    }
    if (selectedCategory === 'popular' && !item.tags?.includes('popular')) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.name_ar?.includes(q);
    }
    return true;
  });

  // Cart calculations
  const newItems = cart.filter(c => !c.existing);
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  // Add item
  const handleAddItem = (item) => {
    if (item.modifiers?.length > 0) {
      setSelectedItem(item);
      setSelectedModifiers({});
      setShowModifiers(true);
    } else {
      addToCart(item, []);
    }
  };

  const addToCart = (item, modifiers) => {
    const modifierTotal = modifiers.reduce((sum, m) => sum + (m.price || 0), 0);
    const itemTotal = item.price + modifierTotal;
    const existingIndex = cart.findIndex(c =>
      c.item_id === item.id && !c.existing &&
      JSON.stringify(c.modifiers) === JSON.stringify(modifiers)
    );
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal = updated[existingIndex].quantity * itemTotal;
      setCart(updated);
    } else {
      setCart([...cart, {
        item_id: item.id, name: item.name, name_ar: item.name_ar,
        unit_price: item.price, modifiers, modifier_total: modifierTotal,
        quantity: 1, subtotal: itemTotal, existing: false,
      }]);
    }
    toast.success(`${item.name} added`);
  };

  const confirmModifiers = () => {
    const modifiers = [];
    for (const [groupName, selection] of Object.entries(selectedModifiers)) {
      if (Array.isArray(selection)) {
        selection.forEach(s => modifiers.push({ group: groupName, ...s }));
      } else if (selection) {
        modifiers.push({ group: groupName, ...selection });
      }
    }
    addToCart(selectedItem, modifiers);
    setShowModifiers(false);
  };

  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    } else {
      const itemTotal = updated[index].unit_price + updated[index].modifier_total;
      updated[index].subtotal = updated[index].quantity * itemTotal;
    }
    setCart(updated);
  };

  // Send new items to kitchen
  const handleSendToKitchen = async () => {
    if (newItems.length === 0) { toast.info('No new items to send'); return; }
    const token = localStorage.getItem('waiter_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const items = newItems.map(c => ({
        item_id: c.item_id, name: c.name, name_ar: c.name_ar,
        price: c.unit_price, quantity: c.quantity,
        modifiers: c.modifiers, notes: '',
      }));
      await api.post(`/tables/${selectedTable.id}/add-items`, { items }, { headers });
      toast.success('Items sent to kitchen!');
      // Mark all items as existing
      setCart(cart.map(c => ({ ...c, existing: true })));
      // Refresh order
      const orderRes = await api.post(`/tables/${selectedTable.id}/start-order`, { waiter_id: waiter?.id }, { headers });
      setCurrentOrder(orderRes.data.order);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send items');
    }
  };

  // Close order / payment
  const handleCloseOrder = async () => {
    if (!selectedTable) return;
    const token = localStorage.getItem('waiter_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await api.post(`/tables/${selectedTable.id}/close-order`, {
        payment_mode: paymentMethod,
        amount_paid: total,
      }, { headers });
      toast.success(`Order closed! Total: SAR ${res.data.total?.toFixed(2)}`);
      setShowPayment(false);
      setCart([]);
      setCurrentOrder(null);
      setSelectedTable(null);
      setView('tables');
      fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to close order');
    }
  };

  const goBackToTables = () => {
    setView('tables');
    setSelectedTable(null);
    setCurrentOrder(null);
    setCart([]);
    setSearchQuery('');
    setSelectedCategory('all');
    fetchTables();
  };

  // ============ LOGIN VIEW ============
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 to-orange-50 flex items-center justify-center p-4" data-testid="waiter-login">
        <Card className="w-full max-w-sm shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Armchair size={32} className="text-orange-600" />
              </div>
              <h1 className="text-2xl font-bold font-outfit">Waiter Mode</h1>
              <p className="text-muted-foreground text-sm mt-1">Enter your PIN to start</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className={`h-14 text-xl font-bold rounded-xl ${key === null ? 'invisible' : ''} ${typeof key === 'number' ? 'hover:bg-orange-50' : ''}`}
                    onClick={() => {
                      if (key === 'del') setPin(p => p.slice(0, -1));
                      else if (typeof key === 'number' && pin.length < 4) setPin(p => p + key);
                    }}
                    data-testid={`pin-key-${key}`}
                  >
                    {key === 'del' ? <X size={20} /> : key}
                  </Button>
                ))}
              </div>
              <div className="flex justify-center gap-3 my-4">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-orange-500 scale-110' : 'bg-stone-200'}`}
                  />
                ))}
              </div>
              <Button
                className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600"
                onClick={handleLogin}
                disabled={pin.length < 4 || loginLoading}
                data-testid="waiter-login-btn"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/cashier')}>
                Switch to Cashier
              </Button>
              <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => navigate('/kds')}>
                Kitchen Display
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ TABLES VIEW ============
  if (view === 'tables') {
    const filteredTables = activeSection === 'all' ? tables : tables.filter(t => t.section === activeSection);
    return (
      <div className="min-h-screen bg-stone-50" data-testid="waiter-tables">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Armchair size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-outfit">Select Table</h1>
              <p className="text-xs text-muted-foreground">{waiter?.name} &middot; Waiter Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchTables} data-testid="refresh-waiter-tables">
              <RefreshCw size={16} />
            </Button>
            <Button size="sm" variant="outline" onClick={handleLogout} data-testid="waiter-logout-btn">
              <LogOut size={16} className="mr-1" /> Logout
            </Button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="bg-white border-b px-4 py-2 overflow-x-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSection('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeSection === 'all' ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              All
            </button>
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap`}
                style={{
                  backgroundColor: activeSection === sec.name ? sec.color : `${sec.color}20`,
                  color: activeSection === sec.name ? 'white' : sec.color,
                }}
              >
                {sec.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tables Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredTables.map(table => {
              const s = STATUS_COLORS[table.status] || STATUS_COLORS.available;
              return (
                <button
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
                  className={`relative border-2 rounded-2xl p-5 transition-all ${s.bg} text-left`}
                  data-testid={`waiter-table-${table.table_number}`}
                >
                  <div className="text-center">
                    <span className="text-2xl font-bold font-outfit block">{table.table_number}</span>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Users size={14} className={s.text} />
                      <span className={`text-sm font-medium ${s.text}`}>{table.customer_count || 0}/{table.capacity}</span>
                    </div>
                    <Badge variant="outline" className={`mt-2 text-xs capitalize ${s.text} border-current`}>
                      <CircleDot size={8} className="mr-1" />{table.status}
                    </Badge>
                    {table.current_order && (
                      <p className="mt-2 text-sm font-bold text-red-600">SAR {table.current_order.total?.toFixed(2)}</p>
                    )}
                    {table.status === 'occupied' && (
                      <p className="text-xs text-muted-foreground mt-1">Tap to manage</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredTables.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Armchair size={48} className="mx-auto mb-3 opacity-30" />
              <p>No tables found</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex justify-center gap-6 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============ ORDER VIEW ============
  return (
    <div className="h-screen flex bg-stone-100 overflow-hidden" data-testid="waiter-order">
      {/* Left: Menu Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={goBackToTables} data-testid="back-to-tables">
              <ArrowLeft size={18} />
            </Button>
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Armchair size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-outfit" data-testid="order-table-title">Table {selectedTable?.table_number}</h1>
              <p className="text-xs text-muted-foreground">{waiter?.name} &middot; {currentOrder?.order_number || 'New Order'}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Clock size={14} className="mr-1" />
            {currentOrder?.created_at ? new Date(currentOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </Badge>
        </div>

        {/* Search */}
        <div className="p-3 bg-white border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-stone-400" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl"
              data-testid="waiter-menu-search"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-3 bg-white border-b overflow-x-auto">
          <div className="flex gap-2">
            {categories.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id] || Grid;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[72px] ${
                    selectedCategory === cat.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  data-testid={`waiter-cat-${cat.id}`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium whitespace-nowrap">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredItems.map(item => (
              <Card
                key={item.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-orange-200"
                onClick={() => handleAddItem(item)}
                data-testid={`waiter-menu-item-${item.id}`}
              >
                <CardContent className="p-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg mb-2 flex items-center justify-center">
                      <UtensilsCrossed size={28} className="text-orange-400" />
                    </div>
                  )}
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-orange-600 text-sm">SAR {item.price}</span>
                    {item.tags?.includes('popular') && <Star size={12} className="text-amber-500 fill-amber-500" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart / Order Panel */}
      <div className="w-80 lg:w-96 bg-white border-l flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-orange-600" />
              <h2 className="font-bold font-outfit text-sm">Table {selectedTable?.table_number} Order</h2>
            </div>
            <Badge className="bg-orange-100 text-orange-700 text-xs">{cart.length} items</Badge>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Add items from the menu</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={index}
                className={`rounded-xl p-3 ${item.existing ? 'bg-stone-50 opacity-70' : 'bg-orange-50 border border-orange-200'}`}
                data-testid={`waiter-cart-item-${index}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-medium text-sm">{item.name}</h4>
                      {item.existing && <Badge variant="outline" className="text-[9px] h-4">Sent</Badge>}
                    </div>
                    {item.modifiers?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.modifiers.map((m, i) => <span key={i} className="mr-1">+{m.name}</span>)}
                      </div>
                    )}
                  </div>
                  {!item.existing && (
                    <button onClick={() => { const c = [...cart]; c.splice(index, 1); setCart(c); }} className="p-1">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {!item.existing && (
                      <>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(index, -1)}>
                          <Minus size={12} />
                        </Button>
                        <span className="font-bold w-6 text-center text-sm">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(index, 1)}>
                          <Plus size={12} />
                        </Button>
                      </>
                    )}
                    {item.existing && <span className="text-sm text-muted-foreground">x{item.quantity}</span>}
                  </div>
                  <span className="font-bold text-sm">SAR {item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t p-4 space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>SAR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT (15%)</span>
              <span>SAR {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-orange-600" data-testid="waiter-cart-total">SAR {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-12 bg-amber-500 hover:bg-amber-600"
              onClick={handleSendToKitchen}
              disabled={newItems.length === 0}
              data-testid="send-to-kitchen-btn"
            >
              <ChefHat size={18} className="mr-1.5" />
              Kitchen ({newItems.length})
            </Button>
            <Button
              className="h-12 bg-emerald-500 hover:bg-emerald-600"
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              data-testid="close-order-btn"
            >
              <DollarSign size={18} className="mr-1.5" />
              Pay
            </Button>
          </div>
        </div>
      </div>

      {/* Modifiers Dialog */}
      <Dialog open={showModifiers} onOpenChange={setShowModifiers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedItem?.modifiers?.map((group, gi) => (
              <div key={gi} className="space-y-2">
                <Label className="font-semibold">{group.name} {group.required && <span className="text-red-500">*</span>}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {group.options?.map((opt, oi) => {
                    const isSelected = group.multiple
                      ? selectedModifiers[group.name]?.some(s => s.name === opt.name)
                      : selectedModifiers[group.name]?.name === opt.name;
                    return (
                      <Button
                        key={oi}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`justify-start h-auto py-2 ${isSelected ? 'bg-orange-500' : ''}`}
                        onClick={() => {
                          if (group.multiple) {
                            const current = selectedModifiers[group.name] || [];
                            const idx = current.findIndex(s => s.name === opt.name);
                            if (idx >= 0) current.splice(idx, 1);
                            else current.push(opt);
                            setSelectedModifiers({ ...selectedModifiers, [group.name]: [...current] });
                          } else {
                            setSelectedModifiers({ ...selectedModifiers, [group.name]: opt });
                          }
                        }}
                      >
                        <div className="text-left">
                          <p className="text-sm">{opt.name}</p>
                          {opt.price > 0 && <p className="text-xs opacity-70">+SAR {opt.price}</p>}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModifiers(false)}>Cancel</Button>
            <Button onClick={confirmModifiers} className="bg-orange-500 hover:bg-orange-600">Add to Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Order - Table {selectedTable?.table_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items</span>
                <span>{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>SAR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>VAT (15%)</span>
                <span>SAR {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-orange-600">SAR {total.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote, color: 'emerald' },
                  { id: 'bank', label: 'Bank', icon: CreditCard, color: 'blue' },
                  { id: 'credit', label: 'Credit', icon: Users, color: 'amber' },
                ].map(m => (
                  <Button
                    key={m.id}
                    variant={paymentMethod === m.id ? 'default' : 'outline'}
                    className={`h-14 flex-col gap-1 ${paymentMethod === m.id ? `bg-${m.color}-500 hover:bg-${m.color}-600` : ''}`}
                    onClick={() => setPaymentMethod(m.id)}
                    data-testid={`waiter-pay-${m.id}`}
                  >
                    <m.icon size={20} />
                    <span className="text-xs">{m.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handleCloseOrder} className="bg-emerald-500 hover:bg-emerald-600" data-testid="confirm-close-order">
              <Check size={18} className="mr-2" />
              Complete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
