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
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote,
  Users, Printer, ChefHat, X, Check, Clock, Coffee, UtensilsCrossed, Cake,
  Pizza, Salad, Grid, Star, LogOut, Receipt, Percent, DollarSign, User, Building2, PlayCircle,
  Edit, Save, ChevronLeft, Tag, Settings, Wifi, WifiOff
} from 'lucide-react';
import api from '@/lib/api';
import CashierShiftModal from '@/components/CashierShiftModal';
import { QRCodeSVG } from 'qrcode.react';
import { Switch } from '@/components/ui/switch';

const CATEGORY_ICONS = {
  all: Grid,
  popular: Star,
  main: UtensilsCrossed,
  appetizer: Salad,
  beverage: Coffee,
  dessert: Cake,
  sides: Pizza,
  _default: Tag,
};

export default function CashierPOSPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Dialogs
  const [showModifiers, setShowModifiers] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [splitPayments, setSplitPayments] = useState([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);

  // Order History
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);

  // Printer
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [printerForm, setPrinterForm] = useState({ name: '', type: 'receipt', ip_address: '', port: 9100, paper_width: '80mm', is_default: false, auto_print: false, copies: 1 });
  const [editingPrinter, setEditingPrinter] = useState(null);

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem('cashier_token');
    const userData = localStorage.getItem('cashier_user');
    if (!token || !userData) {
      navigate('/cashier');
      return;
    }
    setUser(JSON.parse(userData));
  }, [navigate]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      const [catRes, menuRes, custRes, statsRes, shiftRes] = await Promise.all([
        api.get('/cashier/categories', { headers }),
        api.get('/cashier/menu', { headers }),
        api.get('/cashier/customers', { headers }),
        api.get('/cashier/stats', { headers }),
        api.get('/cashier/shift/current', { headers }).catch(() => ({ data: null })),
      ]);
      setCategories(catRes.data);
      setMenuItems(menuRes.data);
      setCustomers(custRes.data);
      setStats(statsRes.data);
      setCurrentShift(shiftRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get('/cashier/orders', { headers });
      setOrders(data || []);
    } catch { setOrders([]); }
    finally { setLoadingOrders(false); }
  };

  // Printer management
  const fetchPrinters = async () => {
    try {
      const token = localStorage.getItem('cashier_token');
      const { data } = await api.get('/cashier/printers', { headers: { Authorization: `Bearer ${token}` } });
      setPrinters(data || []);
    } catch {}
  };
  const savePrinter = async () => {
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      if (editingPrinter) {
        await api.put(`/cashier/printers/${editingPrinter.id}`, printerForm, { headers });
        toast.success('Printer updated');
      } else {
        await api.post('/cashier/printers', printerForm, { headers });
        toast.success('Printer added');
      }
      fetchPrinters();
      setEditingPrinter(null);
      setPrinterForm({ name: '', type: 'receipt', ip_address: '', port: 9100, paper_width: '80mm', is_default: false, auto_print: false, copies: 1 });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  const deletePrinter = async (id) => {
    if (!window.confirm('Delete this printer?')) return;
    try {
      const token = localStorage.getItem('cashier_token');
      await api.delete(`/cashier/printers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Printer removed');
      fetchPrinters();
    } catch { toast.error('Failed to delete'); }
  };
  const testPrinter = async (id) => {
    try {
      const token = localStorage.getItem('cashier_token');
      const { data } = await api.post(`/cashier/printers/${id}/test`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(data.message);
    } catch { toast.error('Test failed'); }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to void this order?')) return;
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.delete(`/cashier/orders/${orderId}`, { headers });
      toast.success('Order voided');
      fetchOrders();
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to void order'); }
  };

  const handleEditOrder = (order) => {
    // Load order items into cart for editing
    setEditingOrder(order);
    setCart(order.items.map(item => ({
      item_id: item.item_id, name: item.name, name_ar: item.name_ar,
      unit_price: item.unit_price, modifiers: item.modifiers || [],
      modifier_total: item.modifier_total || 0,
      quantity: item.quantity, subtotal: item.subtotal
    })));
    setPaymentMethod(order.payment_method || 'cash');
    setDiscount(order.discount || 0);
    setOrderType(order.order_type || 'dine_in');
    setTableNumber(order.table_number || '');
    setNotes(order.notes || '');
    setShowOrderHistory(false);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder || cart.length === 0) return;
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.put(`/cashier/orders/${editingOrder.id}`, {
        items: cart.map(c => ({ item_id: c.item_id, quantity: c.quantity, modifiers: c.modifiers })),
        discount, discount_type: discountType,
        payment_method: paymentMethod,
        payment_details: [{ mode: paymentMethod, amount: total }],
        order_type: orderType, table_number: tableNumber || null, notes
      }, { headers });
      toast.success(`Order #${editingOrder.order_number} updated!`);
      setEditingOrder(null);
      setCart([]);
      setDiscount(0);
      setNotes('');
      setTableNumber('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update order'); }
  };

  // Filter menu items
  // Check if menu item is within its schedule
  const isItemScheduleActive = (item) => {
    if (!item.schedule?.enabled) return true;
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (!(item.schedule.available_days || []).includes(dayOfWeek)) return false;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const start = item.schedule.start_time || '00:00';
    const end = item.schedule.end_time || '23:59';
    return timeStr >= start && timeStr <= end;
  };

  const filteredItems = menuItems.filter(item => {
    // Schedule-based filtering
    if (item.schedule?.enabled) {
      const active = isItemScheduleActive(item);
      if (!active && item.schedule.unavailable_behavior === 'hide') return false;
    }
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
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = discountType === 'percent' ? subtotal * (discount / 100) : discount;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * 0.15;
  const total = taxableAmount + tax;

  // Add item to cart
  const handleAddItem = (item) => {
    // Use V2 resolved modifiers (includes branch filtering) or fall back to legacy modifiers
    const allModifiers = item._resolved_modifiers || item.modifiers || [];
    // Filter by branch availability
    const branchId = user?.branch_id;
    const visibleModifiers = allModifiers.filter(group => {
      const ba = group.branch_availability || {};
      const branchKeys = Object.keys(ba);
      // If no branch_availability defined, show everywhere
      if (branchKeys.length === 0) return true;
      if (!branchId) return true;
      // For addon type: ba = {branch_id: [addon_id, ...]}
      // For size type: ba = {branch_id: [size_name, ...]}
      // For option type: ba = {branch_id: true/false}
      if (group.type === 'option') return ba[branchId] === true || ba[branchId] === undefined;
      if (group.type === 'size' || group.type === 'addon') {
        const allowed = ba[branchId];
        if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return false;
        return true;
      }
      return true;
    }).map(group => {
      // For size/addon types, filter options to only those available at this branch
      const ba = group.branch_availability || {};
      if (branchId && ba[branchId] && Array.isArray(ba[branchId])) {
        const allowed = ba[branchId];
        if (group.type === 'size') {
          return { ...group, options: (group.options || []).filter(o => allowed.includes(o.name)) };
        }
        if (group.type === 'addon') {
          return { ...group, options: (group.options || []).filter(o => allowed.includes(o.addon_id || o.name)) };
        }
      }
      return group;
    }).filter(group => (group.options || []).length > 0);

    if (visibleModifiers.length > 0) {
      setSelectedItem({ ...item, _filteredModifiers: visibleModifiers });
      setSelectedModifiers({});
      setShowModifiers(true);
    } else {
      addToCart(item, []);
    }
  };

  const addToCart = (item, modifiers) => {
    const modifierTotal = modifiers.reduce((sum, m) => sum + (m.price || 0), 0);
    // Use branch-specific price if available
    const basePrice = (item.branch_prices && user?.branch_id && item.branch_prices[user.branch_id])
      ? item.branch_prices[user.branch_id]
      : item.price;
    const itemTotal = (basePrice + modifierTotal);
    
    // Check if same item with same modifiers exists
    const existingIndex = cart.findIndex(c => 
      c.item_id === item.id && 
      JSON.stringify(c.modifiers) === JSON.stringify(modifiers)
    );
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].subtotal = newCart[existingIndex].quantity * itemTotal;
      setCart(newCart);
    } else {
      setCart([...cart, {
        item_id: item.id,
        name: item.name,
        name_ar: item.name_ar,
        unit_price: basePrice,
        modifiers,
        modifier_total: modifierTotal,
        quantity: 1,
        subtotal: itemTotal
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
    setSelectedItem(null);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    } else {
      const itemTotal = newCart[index].unit_price + newCart[index].modifier_total;
      newCart[index].subtotal = newCart[index].quantity * itemTotal;
    }
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Handle payment
  const handlePayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    if (paymentMethod === 'credit' && !selectedCustomer) {
      toast.error('Please select a customer for credit payment');
      setShowCustomerSelect(true);
      return;
    }

    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      const orderData = {
        branch_id: user.branch_id || 'default',
        customer_id: selectedCustomer?.id || null,
        items: cart.map(c => ({
          item_id: c.item_id,
          quantity: c.quantity,
          modifiers: c.modifiers
        })),
        discount,
        discount_type: discountType,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'split' ? splitPayments : [{ mode: paymentMethod, amount: total }],
        order_type: orderType,
        table_number: tableNumber || null,
        notes
      };

      const { data } = await api.post('/cashier/orders', orderData, { headers });
      setLastOrder(data);
      toast.success(`Order #${data.order_number} created!`);
      
      // Reset cart
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setNotes('');
      setTableNumber('');
      setShowPayment(false);
      setShowReceipt(true);
      
      // Refresh stats
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create order');
    }
  };

  // Send to kitchen
  const sendToKitchen = async () => {
    if (!lastOrder) return;
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.post(`/cashier/orders/${lastOrder.id}/send-kitchen`, {}, { headers });
      toast.success('Order sent to kitchen!');
    } catch (err) {
      toast.error('Failed to send to kitchen');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('cashier_token');
    localStorage.removeItem('cashier_user');
    navigate('/cashier');
  };

  const [showMobilePosCart, setShowMobilePosCart] = useState(false);

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#f5f5f5] overflow-hidden" data-testid="cashier-pos">
      {/* Left: Menu Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Foodics style: clean white, no heavy borders */}
        <div className="bg-white shadow-sm p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base font-outfit text-stone-800" data-testid="pos-title">Restaurant POS</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <Building2 size={11} />
                <span className="font-medium text-primary">{user.branch_name || 'Main Branch'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {stats && (
              <div className="hidden sm:flex gap-3">
                <div className="text-center px-4 py-1.5 bg-emerald-50 rounded-xl">
                  <p className="text-[10px] text-emerald-500 font-medium">Today Sales</p>
                  <p className="font-bold text-sm text-emerald-700" data-testid="today-sales">SAR {stats.today?.total_sales?.toLocaleString()}</p>
                </div>
                <div className="text-center px-4 py-1.5 bg-blue-50 rounded-xl">
                  <p className="text-[10px] text-blue-500 font-medium">Orders</p>
                  <p className="font-bold text-sm text-blue-700">{stats.today?.total_orders}</p>
                </div>
              </div>
            )}
            <Button size="sm" className="md:hidden bg-primary hover:bg-primary/90 relative h-8 w-8 p-0 rounded-xl" onClick={() => setShowMobilePosCart(true)} data-testid="pos-mobile-cart-toggle">
              <ShoppingCart size={16} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">{cart.length}</span>}
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-xl border-stone-200 text-stone-600"
              onClick={() => { setShowOrderHistory(true); fetchOrders(); }} data-testid="orders-history-btn">
              <Receipt size={15} className="mr-1.5" />Orders
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-xl border-stone-200 text-stone-600"
              onClick={() => { setShowPrinterSettings(true); fetchPrinters(); }} data-testid="printer-settings-btn">
              <Printer size={15} className="mr-1.5" />Printers
            </Button>
            <Button size="sm"
              variant={currentShift ? 'default' : 'outline'}
              className={`h-9 rounded-xl ${currentShift ? 'bg-emerald-500 hover:bg-emerald-600' : 'border-stone-200 text-stone-600'}`}
              onClick={() => setShowShiftModal(true)} data-testid="shift-btn">
              <PlayCircle size={15} className="mr-1.5" />{currentShift ? 'Shift Active' : 'Start Shift'}
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 rounded-xl text-xs font-medium text-stone-600">
              <User size={13} />{user.name}
            </div>
            <Button size="sm" variant="ghost" onClick={handleLogout} data-testid="logout-btn" className="h-9 w-9 p-0 rounded-xl text-stone-400 hover:text-red-500">
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        {/* Search - cleaner, no border, integrated */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-stone-400" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl border-stone-200 bg-white shadow-sm focus:shadow-md transition-shadow"
              data-testid="menu-search"
            />
          </div>
        </div>

        {/* Categories - Foodics-style pill tabs */}
        <div className="px-4 py-3 overflow-x-auto">
          <div className="flex gap-2">
            {categories.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id] || CATEGORY_ICONS._default;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap text-xs font-semibold ${
                    isActive 
                      ? 'bg-primary text-white shadow-md shadow-primary/20' 
                      : 'bg-white text-stone-500 shadow-sm hover:shadow-md hover:text-stone-700'
                  }`}
                  data-testid={`cat-${cat.id}`}
                >
                  <Icon size={16} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Grid - Foodics-style cards: no borders, subtle shadows */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto pb-20 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map(item => {
              const scheduleInactive = item.schedule?.enabled && !isItemScheduleActive(item);
              const isDisabled = !item.is_available || scheduleInactive;
              return (
              <div 
                key={item.id}
                className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ${
                  scheduleInactive ? 'opacity-40 grayscale' :
                  !item.is_available ? 'opacity-50' : 'hover:shadow-lg hover:-translate-y-0.5'
                } shadow-sm`}
                onClick={() => !isDisabled && handleAddItem(item)}
                data-testid={`menu-item-${item.id}`}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
                    <UtensilsCrossed size={28} className="text-stone-300" />
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-semibold text-[13px] text-stone-800 truncate">{item.name}</h3>
                  {item.name_ar && <p className="text-[11px] text-stone-400 truncate mt-0.5" dir="rtl">{item.name_ar}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-sm text-primary">SAR {item.price}</span>
                    {item.tags?.includes('popular') && <Star size={13} className="text-amber-400 fill-amber-400" />}
                  </div>
                  {item.modifiers?.length > 0 && (
                    <span className="inline-block text-[10px] mt-1.5 px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full">Has options</span>
                  )}
                  {scheduleInactive && (
                    <span className="inline-block text-[10px] mt-1 px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full">Not available now</span>
                  )}
                </div>
              </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-stone-400">
                No items found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart Section */}
      <div className={`${showMobilePosCart ? 'fixed inset-0 z-50 bg-black/50 md:relative md:inset-auto md:bg-transparent' : 'hidden md:flex'} md:w-80 lg:w-96`}>
        <div className={`${showMobilePosCart ? 'absolute right-0 top-0 bottom-0 w-[85vw] max-w-96' : 'w-full'} bg-white shadow-lg flex flex-col h-full`}>
        {/* Cart Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingCart size={16} className="text-primary" />
            </div>
            <h2 className="font-bold text-sm">
              {editingOrder ? `Editing #${editingOrder.order_number}` : 'Current Order'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {editingOrder && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-stone-400 rounded-lg" onClick={() => { setEditingOrder(null); setCart([]); setDiscount(0); setNotes(''); }}>Cancel</Button>
            )}
            <Button size="sm" variant="ghost" className="md:hidden h-7 w-7 p-0 rounded-lg" onClick={() => setShowMobilePosCart(false)}>
              <X size={16} />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex gap-2">
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="w-28 h-8 text-xs rounded-lg border-stone-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">Dine In</SelectItem>
                <SelectItem value="takeaway">Takeaway</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
            {orderType === 'dine_in' && (
              <Input 
                placeholder="Table #" 
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-20 h-8 text-xs rounded-lg border-stone-200"
              />
            )}
          </div>
        </div>

        {/* Cart Items - cleaner cards */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2 border-t border-stone-100 pt-3">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-stone-300">
              <ShoppingCart size={40} className="mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-400">Cart is empty</p>
              <p className="text-xs text-stone-300">Tap items to add</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="bg-stone-50/80 rounded-xl p-3" data-testid={`cart-item-${index}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-[13px] text-stone-700">{item.name}</h4>
                    {item.modifiers?.length > 0 && (
                      <div className="text-[11px] text-stone-400 mt-0.5">
                        {item.modifiers.map((m, i) => (
                          <span key={i} className="mr-1.5">+{m.name}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-primary mt-0.5">SAR {item.unit_price + item.modifier_total} each</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 rounded-lg hover:bg-red-50" onClick={() => removeFromCart(index)}>
                    <Trash2 size={13} className="text-red-400" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg border-stone-200" onClick={() => updateQuantity(index, -1)}>
                      <Minus size={12} />
                    </Button>
                    <span className="font-bold text-sm w-7 text-center">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg border-stone-200" onClick={() => updateQuantity(index, 1)}>
                      <Plus size={12} />
                    </Button>
                  </div>
                  <span className="font-bold text-sm text-stone-700">SAR {item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer - polished totals and buttons */}
        {cart.length > 0 && (
          <div className="border-t border-stone-100 p-4 space-y-3 bg-white">
            {/* Discount */}
            <div className="flex gap-2">
              <div className="flex-1 flex gap-1">
                <Input 
                  type="number"
                  placeholder="Discount"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm rounded-lg border-stone-200"
                />
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="w-20 h-9 rounded-lg border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount"><DollarSign size={14} /></SelectItem>
                    <SelectItem value="percent"><Percent size={14} /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Totals - cleaner spacing */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal</span>
                <span className="text-stone-600">SAR {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Discount</span>
                  <span>-SAR {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-400">
                <span>VAT (15%)</span>
                <span className="text-stone-600">SAR {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2.5 border-t border-stone-100">
                <span className="text-stone-800">Total</span>
                <span className="text-primary" data-testid="cart-total">SAR {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Buttons - rounded, modern */}
            {editingOrder ? (
              <Button 
                className="h-12 w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
                onClick={handleSaveEdit}
                disabled={cart.length === 0}
                data-testid="save-edit-btn"
              >
                <Save size={18} className="mr-2" />
                Save Changes to #{editingOrder.order_number}
              </Button>
            ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className={`h-12 flex-col gap-1 rounded-xl ${paymentMethod === 'cash' ? 'bg-emerald-500 hover:bg-emerald-600' : 'border-stone-200 text-stone-600'}`}
                onClick={() => { setPaymentMethod('cash'); setShowPayment(true); }}
                data-testid="pay-cash"
              >
                <Banknote size={20} />
                <span className="text-[10px] font-semibold">Cash</span>
              </Button>
              <Button 
                variant={paymentMethod === 'bank' ? 'default' : 'outline'}
                className={`h-12 flex-col gap-1 rounded-xl ${paymentMethod === 'bank' ? 'bg-blue-500 hover:bg-blue-600' : 'border-stone-200 text-stone-600'}`}
                onClick={() => { setPaymentMethod('bank'); setShowPayment(true); }}
                data-testid="pay-bank"
              >
                <CreditCard size={20} />
                <span className="text-[10px] font-semibold">Bank</span>
              </Button>
              <Button 
                variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                className={`h-14 flex-col gap-1 ${paymentMethod === 'credit' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                onClick={() => { setPaymentMethod('credit'); setShowCustomerSelect(true); }}
                data-testid="pay-credit"
              >
                <Users size={22} />
                <span className="text-xs font-medium">Credit</span>
              </Button>
            </div>
            )}

            {selectedCustomer && (
              <div className="bg-amber-50 rounded-lg p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-amber-600" />
                  <span className="text-sm font-medium">{selectedCustomer.name}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(null)}>
                  <X size={14} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Mobile floating cart button */}
      {cart.length > 0 && !showMobilePosCart && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-40" data-testid="pos-mobile-cart-bar">
          <Button className="w-full h-12 bg-primary hover:bg-primary/90 rounded-2xl shadow-lg shadow-primary/20" onClick={() => setShowMobilePosCart(true)}>
            <ShoppingCart size={18} className="mr-2" />
            <span className="font-bold text-sm">{cart.length} items</span>
            <span className="mx-2 opacity-50">|</span>
            <span className="font-bold text-sm">SAR {(cart.reduce((sum, item) => sum + item.subtotal, 0) * 1.15).toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Modifiers Dialog */}
      <Dialog open={showModifiers} onOpenChange={setShowModifiers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {(selectedItem?._filteredModifiers || selectedItem?.modifiers || []).map((group, gi) => (
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
                            const exists = current.findIndex(s => s.name === opt.name);
                            if (exists >= 0) {
                              current.splice(exists, 1);
                            } else {
                              current.push(opt);
                            }
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
            <Button onClick={confirmModifiers} className="bg-orange-500 hover:bg-orange-600" data-testid="confirm-modifiers-btn">Add to Cart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span>Items</span>
                <span>{cart.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>SAR {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-SAR {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT (15%)</span>
                <span>SAR {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-orange-600">SAR {total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
              {paymentMethod === 'cash' && <Banknote size={24} className="text-emerald-600" />}
              {paymentMethod === 'card' && <CreditCard size={24} className="text-blue-600" />}
              {paymentMethod === 'online' && <Smartphone size={24} className="text-purple-600" />}
              {paymentMethod === 'credit' && <Users size={24} className="text-amber-600" />}
              <span className="font-medium capitalize">{paymentMethod} Payment</span>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handlePayment} className="bg-orange-500 hover:bg-orange-600" data-testid="confirm-payment">
              <Check size={18} className="mr-2" />
              Complete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Select Dialog */}
      <Dialog open={showCustomerSelect} onOpenChange={setShowCustomerSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Customer for Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Search customers..." className="h-10" />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {customers.map(c => (
                <Button
                  key={c.id}
                  variant={selectedCustomer?.id === c.id ? 'default' : 'outline'}
                  className={`w-full justify-start h-auto py-3 ${selectedCustomer?.id === c.id ? 'bg-orange-500' : ''}`}
                  onClick={() => setSelectedCustomer(c)}
                  data-testid={`customer-${c.id}`}
                >
                  <User size={18} className="mr-3" />
                  <div className="text-left">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs opacity-70">{c.phone || 'No phone'}</p>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerSelect(false)}>Cancel</Button>
            <Button 
              onClick={() => { setShowCustomerSelect(false); setShowPayment(true); }}
              disabled={!selectedCustomer}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check size={24} className="text-emerald-500" />
              Order Complete!
            </DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div className="space-y-4">
              <div className="text-center py-4 bg-stone-50 rounded-xl">
                <p className="text-4xl font-bold font-outfit text-orange-600" data-testid="order-number">#{lastOrder.order_number}</p>
                <p className="text-muted-foreground">Order Number</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-bold">SAR {lastOrder.total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span className="capitalize">{lastOrder.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="capitalize">{lastOrder.order_type?.replace('_', ' ')}</span>
                </div>
              </div>
              {/* QR Code for Order Tracking */}
              <div className="text-center py-3 border-t border-dashed dark:border-stone-700">
                <QRCodeSVG 
                  value={`${window.location.origin}/track-order?id=${lastOrder.id || lastOrder.order_number}`}
                  size={100}
                  className="mx-auto"
                  data-testid="receipt-qr-code"
                />
                <p className="text-[10px] text-muted-foreground mt-2">Scan to track your order</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer size={16} className="mr-2" />Print
                </Button>
                <Button 
                  className="flex-1 bg-amber-500 hover:bg-amber-600" 
                  onClick={sendToKitchen}
                  data-testid="send-kitchen"
                >
                  <ChefHat size={16} className="mr-2" />Kitchen
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowReceipt(false)} className="w-full bg-orange-500 hover:bg-orange-600">
              New Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Management Modal */}
      <CashierShiftModal 
        open={showShiftModal} 
        onClose={() => setShowShiftModal(false)}
        onShiftChange={(shift) => {
          setCurrentShift(shift);
          fetchData();
        }}
      />

      {/* Order History Dialog */}
      <Dialog open={showOrderHistory} onOpenChange={setShowOrderHistory}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit flex items-center gap-2">
              <Receipt size={20} /> Today's Orders
            </DialogTitle>
          </DialogHeader>
          
          {viewingOrder ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setViewingOrder(null)} className="mb-2">
                <ChevronLeft size={16} className="mr-1" /> Back to list
              </Button>
              <div className="bg-stone-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Order #{viewingOrder.order_number}</h3>
                  <Badge className={viewingOrder.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : viewingOrder.status === 'preparing' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100'}>
                    {viewingOrder.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                  <span>Type: {viewingOrder.order_type?.replace('_', ' ')}</span>
                  <span>Payment: {viewingOrder.payment_method}</span>
                  {viewingOrder.table_number && <span>Table: {viewingOrder.table_number}</span>}
                  {viewingOrder.customer_name && <span>Customer: {viewingOrder.customer_name}</span>}
                  <span>Cashier: {viewingOrder.cashier_name}</span>
                  <span>Time: {viewingOrder.created_at ? new Date(viewingOrder.created_at).toLocaleTimeString() : '-'}</span>
                </div>
                
                <div className="border rounded-lg overflow-hidden mt-3">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-100">
                      <tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      {(viewingOrder.items || []).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">SAR {item.unit_price?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">SAR {item.subtotal?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="text-sm space-y-1 pt-2 border-t">
                  <div className="flex justify-between"><span>Subtotal</span><span>SAR {viewingOrder.subtotal?.toFixed(2)}</span></div>
                  {viewingOrder.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-SAR {viewingOrder.discount?.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span>Tax (15%)</span><span>SAR {viewingOrder.tax?.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span>SAR {viewingOrder.total?.toFixed(2)}</span></div>
                </div>
                {viewingOrder.notes && <div className="text-sm text-muted-foreground mt-2">Notes: {viewingOrder.notes}</div>}
              </div>
              
              <div className="flex gap-2">
                <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => { handleEditOrder(viewingOrder); setViewingOrder(null); }} data-testid="edit-order-btn">
                  <Edit size={16} className="mr-1" /> Edit Order
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => { handleDeleteOrder(viewingOrder.id); setViewingOrder(null); }} data-testid="void-order-btn">
                  <Trash2 size={16} className="mr-1" /> Void Order
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {loadingOrders ? (
                <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No orders today</div>
              ) : (
                orders.map(order => (
                  <div 
                    key={order.id} 
                    className="border rounded-lg p-3 hover:bg-stone-50 cursor-pointer transition-colors"
                    onClick={() => setViewingOrder(order)}
                    data-testid={`order-row-${order.order_number}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-100 text-orange-700 font-bold rounded-lg px-3 py-1 text-sm">
                          #{order.order_number}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{(order.items || []).length} item(s) - {order.order_type?.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.created_at ? new Date(order.created_at).toLocaleTimeString() : ''} 
                            {order.cashier_name ? ` · ${order.cashier_name}` : ''}
                            {order.customer_name ? ` · ${order.customer_name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">SAR {order.total?.toFixed(2)}</p>
                        <Badge className={`text-[10px] ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : order.status === 'preparing' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100'}`}>
                          {order.payment_method} · {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Printer Settings Dialog */}
      <Dialog open={showPrinterSettings} onOpenChange={setShowPrinterSettings}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer size={18} className="text-primary" />
              Printer Settings
            </DialogTitle>
          </DialogHeader>

          {/* Printer Form */}
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">{editingPrinter ? 'Edit Printer' : 'Add New Printer'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Printer Name</Label>
                <Input placeholder="e.g., Receipt Printer 1" value={printerForm.name}
                  onChange={e => setPrinterForm({...printerForm, name: e.target.value})}
                  className="rounded-lg" data-testid="printer-name-input" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={printerForm.type} onValueChange={v => setPrinterForm({...printerForm, type: v})}>
                  <SelectTrigger className="rounded-lg" data-testid="printer-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Receipt Printer</SelectItem>
                    <SelectItem value="kitchen">Kitchen Printer</SelectItem>
                    <SelectItem value="label">Label Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">IP Address</Label>
                <Input placeholder="192.168.1.100" value={printerForm.ip_address}
                  onChange={e => setPrinterForm({...printerForm, ip_address: e.target.value})}
                  className="rounded-lg" data-testid="printer-ip-input" />
              </div>
              <div>
                <Label className="text-xs">Port</Label>
                <Input type="number" value={printerForm.port}
                  onChange={e => setPrinterForm({...printerForm, port: parseInt(e.target.value) || 9100})}
                  className="rounded-lg" />
              </div>
              <div>
                <Label className="text-xs">Paper Width</Label>
                <Select value={printerForm.paper_width} onValueChange={v => setPrinterForm({...printerForm, paper_width: v})}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm</SelectItem>
                    <SelectItem value="80mm">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Copies</Label>
                <Input type="number" min="1" max="5" value={printerForm.copies}
                  onChange={e => setPrinterForm({...printerForm, copies: parseInt(e.target.value) || 1})}
                  className="rounded-lg" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={printerForm.is_default} onCheckedChange={v => setPrinterForm({...printerForm, is_default: v})} />
                  <Label className="text-xs">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={printerForm.auto_print} onCheckedChange={v => setPrinterForm({...printerForm, auto_print: v})} />
                  <Label className="text-xs">Auto Print</Label>
                </div>
              </div>
              <div className="flex gap-2">
                {editingPrinter && (
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => {
                    setEditingPrinter(null);
                    setPrinterForm({ name: '', type: 'receipt', ip_address: '', port: 9100, paper_width: '80mm', is_default: false, auto_print: false, copies: 1 });
                  }}>Cancel</Button>
                )}
                <Button size="sm" className="rounded-lg bg-primary hover:bg-primary/90" onClick={savePrinter}
                  disabled={!printerForm.name} data-testid="save-printer-btn">
                  {editingPrinter ? 'Update' : 'Add Printer'}
                </Button>
              </div>
            </div>
          </div>

          {/* Printer List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Configured Printers</h3>
            {printers.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <Printer size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No printers configured</p>
                <p className="text-xs">Add a printer above to start printing receipts</p>
              </div>
            ) : (
              printers.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white dark:bg-stone-800 border rounded-xl" data-testid={`printer-${p.id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                    <Printer size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.is_default && <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">Default</span>}
                      <span className="text-[9px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full capitalize">{p.type}</span>
                    </div>
                    <p className="text-[11px] text-stone-400">{p.ip_address || 'No IP set'} · {p.paper_width} · {p.copies} copies</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-blue-500" onClick={() => testPrinter(p.id)} title="Test">
                      <Wifi size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => {
                      setEditingPrinter(p);
                      setPrinterForm({ name: p.name, type: p.type, ip_address: p.ip_address || '', port: p.port || 9100, paper_width: p.paper_width || '80mm', is_default: p.is_default || false, auto_print: p.auto_print || false, copies: p.copies || 1 });
                    }}><Edit size={13} /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-red-400" onClick={() => deletePrinter(p.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
