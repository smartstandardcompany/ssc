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
  Pizza, Salad, Grid, Star, LogOut, Receipt, Percent, DollarSign, User, Building2
} from 'lucide-react';
import api from '@/lib/api';

const CATEGORY_ICONS = {
  all: Grid,
  popular: Star,
  main: UtensilsCrossed,
  appetizer: Salad,
  beverage: Coffee,
  dessert: Cake,
  sides: Pizza,
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
      const [catRes, menuRes, custRes, statsRes] = await Promise.all([
        api.get('/cashier/categories', { headers }),
        api.get('/cashier/menu', { headers }),
        api.get('/cashier/customers', { headers }),
        api.get('/cashier/stats', { headers }),
      ]);
      setCategories(catRes.data);
      setMenuItems(menuRes.data);
      setCustomers(custRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Filter menu items
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
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = discountType === 'percent' ? subtotal * (discount / 100) : discount;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * 0.15;
  const total = taxableAmount + tax;

  // Add item to cart
  const handleAddItem = (item) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedItem(item);
      setSelectedModifiers({});
      setShowModifiers(true);
    } else {
      addToCart(item, []);
    }
  };

  const addToCart = (item, modifiers) => {
    const modifierTotal = modifiers.reduce((sum, m) => sum + (m.price || 0), 0);
    const itemTotal = (item.price + modifierTotal);
    
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
        unit_price: item.price,
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

  if (!user) return null;

  return (
    <div className="h-screen flex bg-stone-100 overflow-hidden" data-testid="cashier-pos">
      {/* Left: Menu Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-outfit" data-testid="pos-title">Restaurant POS</h1>
              <p className="text-xs text-muted-foreground">{user.branch_name || 'Main Branch'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="flex gap-4 text-xs">
                <div className="text-center">
                  <p className="text-muted-foreground">Today Sales</p>
                  <p className="font-bold text-emerald-600" data-testid="today-sales">SAR {stats.today?.total_sales?.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Orders</p>
                  <p className="font-bold">{stats.today?.total_orders}</p>
                </div>
              </div>
            )}
            <Badge variant="outline" className="text-xs">{user.name}</Badge>
            <Button size="sm" variant="ghost" onClick={handleLogout} data-testid="logout-btn">
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-white border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-stone-400" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl"
              data-testid="menu-search"
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
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[80px] ${
                    selectedCategory === cat.id 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  data-testid={`cat-${cat.id}`}
                >
                  <Icon size={20} />
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
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 ${
                  !item.is_available ? 'opacity-50 border-red-200' : 'border-transparent hover:border-orange-200'
                }`}
                onClick={() => item.is_available && handleAddItem(item)}
                data-testid={`menu-item-${item.id}`}
              >
                <CardContent className="p-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg mb-2 flex items-center justify-center">
                      <UtensilsCrossed size={32} className="text-orange-400" />
                    </div>
                  )}
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.name_ar && <p className="text-xs text-muted-foreground truncate" dir="rtl">{item.name_ar}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-orange-600">SAR {item.price}</span>
                    {item.tags?.includes('popular') && <Star size={14} className="text-amber-500 fill-amber-500" />}
                  </div>
                  {item.modifiers?.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] mt-1">Has options</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No items found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart Section */}
      <div className="w-96 bg-white border-l flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-600" />
            <h2 className="font-bold font-outfit">Current Order</h2>
          </div>
          <div className="flex gap-2">
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="w-28 h-8 text-xs">
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
                className="w-20 h-8 text-xs"
              />
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
              <p>Cart is empty</p>
              <p className="text-xs">Tap items to add</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="bg-stone-50 rounded-xl p-3" data-testid={`cart-item-${index}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    {item.modifiers?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.modifiers.map((m, i) => (
                          <span key={i} className="mr-2">+{m.name}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-orange-600 mt-1">SAR {item.unit_price + item.modifier_total} each</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(index)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(index, -1)}>
                      <Minus size={14} />
                    </Button>
                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(index, 1)}>
                      <Plus size={14} />
                    </Button>
                  </div>
                  <span className="font-bold text-sm">SAR {item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3">
            {/* Discount */}
            <div className="flex gap-2">
              <div className="flex-1 flex gap-1">
                <Input 
                  type="number"
                  placeholder="Discount"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="w-20 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount"><DollarSign size={14} /></SelectItem>
                    <SelectItem value="percent"><Percent size={14} /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>SAR {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-SAR {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (15%)</span>
                <span>SAR {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-orange-600" data-testid="cart-total">SAR {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Buttons - 3 Options: Cash, Bank, Credit */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className={`h-14 flex-col gap-1 ${paymentMethod === 'cash' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                onClick={() => { setPaymentMethod('cash'); setShowPayment(true); }}
                data-testid="pay-cash"
              >
                <Banknote size={22} />
                <span className="text-xs font-medium">Cash</span>
              </Button>
              <Button 
                variant={paymentMethod === 'bank' ? 'default' : 'outline'}
                className={`h-14 flex-col gap-1 ${paymentMethod === 'bank' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                onClick={() => { setPaymentMethod('bank'); setShowPayment(true); }}
                data-testid="pay-bank"
              >
                <CreditCard size={22} />
                <span className="text-xs font-medium">Bank</span>
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
            <Button onClick={confirmModifiers} className="bg-orange-500 hover:bg-orange-600">Add to Cart</Button>
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
    </div>
  );
}
