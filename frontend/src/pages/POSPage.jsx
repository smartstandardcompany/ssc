import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, ShoppingCart, Receipt, CreditCard, Banknote, CheckCircle, Users, Truck, Package, Plus, Loader2, Calendar, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';

// Platform colors for visual distinction
const PLATFORM_COLORS = {
  'HungerStation': 'bg-red-50 border-red-200 focus:border-red-400',
  'Hunger': 'bg-orange-50 border-orange-200 focus:border-orange-400',
  'Jahez': 'bg-green-50 border-green-200 focus:border-green-400',
  'ToYou': 'bg-blue-50 border-blue-200 focus:border-blue-400',
  'Keta': 'bg-purple-50 border-purple-200 focus:border-purple-400',
  'Ninja': 'bg-yellow-50 border-yellow-200 focus:border-yellow-400',
  'Careem Food': 'bg-teal-50 border-teal-200 focus:border-teal-400',
  'Talabat': 'bg-pink-50 border-pink-200 focus:border-pink-400',
  'Marsool': 'bg-indigo-50 border-indigo-200 focus:border-indigo-400',
};

export default function POSPage() {
  const { t } = useLanguage();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branch, setBranch] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [entryType, setEntryType] = useState('sale');
  const [saleMode, setSaleMode] = useState('regular'); // 'regular' or 'online'
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastEntries, setLastEntries] = useState([]);
  const [todayStats, setTodayStats] = useState({ sales: 0, expenses: 0, count: 0, onlineSales: 0 });
  const [paymentMode, setPaymentMode] = useState('cash');
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Multi Supplier Payments - array of {supplier_id, amount, payment_mode}
  const [supplierPayments, setSupplierPayments] = useState([{ supplier_id: '', amount: '', payment_mode: 'cash' }]);
  const [submittingPayments, setSubmittingPayments] = useState(false);

  // Multi Expenses - array of {category, amount, payment_mode, supplier_id, description}
  const [expenses, setExpenses] = useState([{ category: '', amount: '', payment_mode: 'cash', supplier_id: '', description: '' }]);
  const [submittingExpenses, setSubmittingExpenses] = useState(false);

  // Regular sale amounts
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  // Online platform amounts - object with platform_id as key
  const [platformAmounts, setPlatformAmounts] = useState({});

  // For expense mode
  const [expenseAmount, setExpenseAmount] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/branches'), 
      api.get('/customers'), 
      api.get('/categories'),
      api.get('/platforms').catch(() => ({ data: [] })),
      api.get('/suppliers/names').catch(() => ({ data: [] })),
    ]).then(([bR, cR, catR, pR, sR]) => {
      setBranches(bR.data);
      setCustomers(cR.data);
      setCategories(catR.data);
      setPlatforms(pR.data || []);
      setSuppliers(sR.data || []);
      if (bR.data.length > 0) setBranch(bR.data[0].id);
    }).catch(() => {});
    refreshStats();
  }, []);

  const refreshStats = async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      // Get online sales from platforms summary
      let onlineSales = 0;
      try {
        const platformsRes = await api.get('/platforms/summary');
        if (platformsRes.data && platformsRes.data.platforms) {
          // Sum up all platform total_sales
          platformsRes.data.platforms.forEach(platform => {
            onlineSales += platform.total_sales || 0;
          });
        }
      } catch {}
      setTodayStats({ 
        sales: data.total_sales || 0, 
        expenses: data.total_expenses || 0, 
        count: (data.total_sales_count || 0) + (data.total_expenses_count || 0),
        onlineSales: onlineSales
      });
    } catch {}
  };

  const totalRegularAmount = parseFloat(cashAmount || 0) + parseFloat(bankAmount || 0) + parseFloat(creditAmount || 0);
  const totalOnlineAmount = Object.values(platformAmounts).reduce((sum, amt) => sum + parseFloat(amt || 0), 0);

  const updatePlatformAmount = (platformId, amount) => {
    setPlatformAmounts(prev => ({ ...prev, [platformId]: amount }));
  };

  const getDateISO = () => {
    // Use selected date with current time
    const now = new Date();
    const [year, month, day] = selectedDate.split('-');
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes()).toISOString();
  };

  const submitRegularSale = async () => {
    if (!branch) { toast.error('Select a branch'); return; }
    if (totalRegularAmount <= 0) { toast.error('Enter at least one payment amount'); return; }

    setSubmitting(true);
    try {
      const paymentDetails = [];
      const cash = parseFloat(cashAmount || 0);
      const bank = parseFloat(bankAmount || 0);
      const credit = parseFloat(creditAmount || 0);

      if (cash > 0) paymentDetails.push({ mode: 'cash', amount: cash, discount: 0 });
      if (bank > 0) paymentDetails.push({ mode: 'bank', amount: bank, discount: 0 });
      if (credit > 0) paymentDetails.push({ mode: 'credit', amount: credit, discount: 0 });

      const payload = {
        sale_type: 'pos',
        amount: totalRegularAmount,
        branch_id: branch,
        notes: description || 'POS Sale',
        date: getDateISO(),
        payment_details: paymentDetails,
      };
      if (credit > 0 && customerId) payload.customer_id = customerId;
      await api.post('/sales', payload);

      const modes = paymentDetails.map(p => p.mode).join(', ');
      toast.success(`Sale SAR ${totalRegularAmount.toLocaleString()} recorded (${modes})`);
      setLastEntries([{ type: 'Sale', amount: totalRegularAmount, mode: modes }]);

      setCashAmount(''); setBankAmount(''); setCreditAmount('');
      setDescription(''); setCustomerId('');
      refreshStats();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const submitOnlineSales = async () => {
    if (!branch) { toast.error('Select a branch'); return; }
    
    // Get platforms with amounts > 0
    const salesData = platforms
      .filter(p => parseFloat(platformAmounts[p.id] || 0) > 0)
      .map(p => ({
        platform: p,
        amount: parseFloat(platformAmounts[p.id])
      }));

    if (salesData.length === 0) {
      toast.error('Enter amount for at least one platform');
      return;
    }

    setSubmitting(true);
    const results = [];

    try {
      for (const sale of salesData) {
        try {
          await api.post('/sales', {
            sale_type: 'online',
            amount: sale.amount,
            branch_id: branch,
            notes: `${sale.platform.name} Sale`,
            date: getDateISO(),
            payment_details: [{ mode: 'online_platform', amount: sale.amount, discount: 0 }],
            platform_id: sale.platform.id,
            platform_status: 'pending',
          });
          results.push({ platform: sale.platform.name, amount: sale.amount, success: true });
        } catch (err) {
          results.push({ platform: sale.platform.name, amount: sale.amount, success: false, error: err.response?.data?.detail });
        }
      }

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        const total = successful.reduce((s, r) => s + r.amount, 0);
        toast.success(`${successful.length} online sales recorded (SAR ${total.toLocaleString()})`);
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} sales failed`);
      }

      setLastEntries(results.map(r => ({
        type: 'Online Sale',
        platform: r.platform,
        amount: r.amount,
        success: r.success
      })));

      // Clear amounts
      setPlatformAmounts({});
      refreshStats();
    } catch (err) {
      toast.error('Failed to record sales');
    } finally {
      setSubmitting(false);
    }
  };

  const submitExpense = async () => {
    if (!branch) { toast.error('Select a branch'); return; }
    const amt = parseFloat(expenseAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }

    setSubmitting(true);
    try {
      await api.post('/expenses', {
        amount: amt, 
        category: category || 'General',
        branch_id: branch, 
        description: description || 'POS Expense',
        date: getDateISO(),
        payment_mode: paymentMode,
        supplier_id: supplierId || undefined,
      });
      const supplierName = suppliers.find(s => s.id === supplierId)?.name;
      toast.success(`Expense SAR ${amt.toLocaleString()} recorded${supplierName ? ` - ${supplierName}` : ''}`);
      setLastEntries([{ type: 'Expense', amount: amt, mode: `${category || 'General'} (${paymentMode})`, supplier: supplierName }]);
      setExpenseAmount(''); setDescription(''); setSupplierId(''); setPaymentMode('cash');
      refreshStats();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  // Multi Supplier Payment Functions
  const addPaymentRow = () => {
    setSupplierPayments([...supplierPayments, { supplier_id: '', amount: '', payment_mode: 'cash' }]);
  };

  const removePaymentRow = (index) => {
    if (supplierPayments.length > 1) {
      setSupplierPayments(supplierPayments.filter((_, i) => i !== index));
    }
  };

  const updatePaymentRow = (index, field, value) => {
    const updated = [...supplierPayments];
    updated[index][field] = value;
    setSupplierPayments(updated);
  };

  const submitMultiplePayments = async () => {
    const validPayments = supplierPayments.filter(p => p.supplier_id && parseFloat(p.amount) > 0);
    if (validPayments.length === 0) {
      toast.error('Please add at least one payment with supplier and amount');
      return;
    }

    setSubmittingPayments(true);
    let successCount = 0;
    const entries = [];

    for (const payment of validPayments) {
      try {
        await api.post(`/suppliers/${payment.supplier_id}/pay-credit`, {
          amount: parseFloat(payment.amount),
          payment_mode: payment.payment_mode,
          branch_id: branch || '',
          date: getDateISO(),
        });
        const supplierName = suppliers.find(s => s.id === payment.supplier_id)?.name;
        entries.push({ type: 'Supplier Payment', amount: parseFloat(payment.amount), mode: payment.payment_mode, supplier: supplierName });
        successCount++;
      } catch (err) {
        const supplierName = suppliers.find(s => s.id === payment.supplier_id)?.name;
        toast.error(`Failed to pay ${supplierName}: ${err.response?.data?.detail || 'Error'}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} supplier payment(s) recorded successfully!`);
      setLastEntries(entries);
      setSupplierPayments([{ supplier_id: '', amount: '', payment_mode: 'cash' }]);
      // Refresh supplier list to get updated balances
      api.get('/suppliers/names').then(res => setSuppliers(res.data || [])).catch(() => {});
    }
    setSubmittingPayments(false);
  };

  const totalPaymentsAmount = supplierPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Multi Expense Functions
  const addExpenseRow = () => {
    setExpenses([...expenses, { category: '', amount: '', payment_mode: 'cash', supplier_id: '', description: '' }]);
  };

  const removeExpenseRow = (index) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter((_, i) => i !== index));
    }
  };

  const updateExpenseRow = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const submitMultipleExpenses = async () => {
    if (!branch) { toast.error('Select a branch'); return; }
    
    const validExpenses = expenses.filter(e => parseFloat(e.amount) > 0);
    if (validExpenses.length === 0) {
      toast.error('Please add at least one expense with amount');
      return;
    }

    setSubmittingExpenses(true);
    let successCount = 0;
    const entries = [];

    for (const expense of validExpenses) {
      try {
        await api.post('/expenses', {
          amount: parseFloat(expense.amount),
          category: expense.category || 'General',
          branch_id: branch,
          description: expense.description || 'POS Expense',
          date: getDateISO(),
          payment_mode: expense.payment_mode,
          supplier_id: expense.supplier_id || undefined,
        });
        const supplierName = suppliers.find(s => s.id === expense.supplier_id)?.name;
        entries.push({ 
          type: 'Expense', 
          amount: parseFloat(expense.amount), 
          mode: `${expense.category || 'General'} (${expense.payment_mode})`,
          supplier: supplierName 
        });
        successCount++;
      } catch (err) {
        toast.error(`Failed to record expense: ${err.response?.data?.detail || 'Error'}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} expense(s) recorded successfully!`);
      setLastEntries(entries);
      setExpenses([{ category: '', amount: '', payment_mode: 'cash', supplier_id: '', description: '' }]);
      refreshStats();
    }
    setSubmittingExpenses(false);
  };

  const totalExpensesAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto py-4 px-2 space-y-4" data-testid="pos-page">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold font-outfit">Quick Entry</h1>
          <p className="text-sm text-muted-foreground">Sales & Expenses</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-emerald-600">Total Sales</p>
              <p className="text-lg font-bold font-outfit text-emerald-700">SAR {todayStats.sales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-purple-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-purple-600 flex items-center justify-center gap-1">
                <Truck size={12} /> Online Sales
              </p>
              <p className="text-lg font-bold font-outfit text-purple-700">SAR {todayStats.onlineSales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-red-600">Expenses</p>
              <p className="text-lg font-bold font-outfit text-red-700">SAR {todayStats.expenses.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-blue-600">Net Profit</p>
              <p className="text-lg font-bold font-outfit text-blue-700">SAR {(todayStats.sales - todayStats.expenses).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Entry Type Toggle */}
        <div className="flex rounded-xl overflow-hidden border">
          <button onClick={() => setEntryType('sale')}
            className={`flex-1 py-3 font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'sale' ? 'bg-emerald-500 text-white' : 'bg-white text-stone-600'}`}
            data-testid="pos-sale-btn">
            <ShoppingCart size={18} /> Sales
          </button>
          <button onClick={() => setEntryType('expense')}
            className={`flex-1 py-3 font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-stone-600'}`}
            data-testid="pos-expense-btn">
            <Receipt size={18} /> Expenses
          </button>
          <button onClick={() => setEntryType('supplier_payment')}
            className={`flex-1 py-3 font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'supplier_payment' ? 'bg-orange-500 text-white' : 'bg-white text-stone-600'}`}
            data-testid="pos-supplier-payment-btn">
            <Truck size={18} /> Pay Suppliers
          </button>
        </div>

        {/* Branch Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="h-12 rounded-xl" data-testid="pos-branch">
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
          {/* Date Selection */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-4 text-stone-400 z-10" />
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="h-12 pl-9 rounded-xl"
              data-testid="pos-date"
            />
          </div>
        </div>

        {/* SALES MODE */}
        {entryType === 'sale' && (
          <div className="space-y-4">
            {/* Sale Type Tabs */}
            <Tabs value={saleMode} onValueChange={setSaleMode}>
              <TabsList className="w-full">
                <TabsTrigger value="regular" className="flex-1" data-testid="regular-sale-tab">
                  <Banknote size={16} className="mr-1" /> Regular Sale
                </TabsTrigger>
                <TabsTrigger value="online" className="flex-1 data-[state=active]:bg-purple-500 data-[state=active]:text-white" data-testid="online-sale-tab">
                  <Truck size={16} className="mr-1" /> Online Sales
                </TabsTrigger>
              </TabsList>

              {/* Regular Sale */}
              <TabsContent value="regular" className="space-y-4 mt-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    <Label className="text-xs text-stone-500 font-medium">PAYMENT AMOUNTS</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-emerald-600 flex items-center gap-1">
                          <Banknote size={12} /> Cash
                        </Label>
                        <Input type="number" inputMode="decimal" value={cashAmount}
                          onChange={e => setCashAmount(e.target.value)} placeholder="0"
                          className="h-11 text-center font-semibold bg-emerald-50 border-emerald-200" data-testid="pos-cash" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-blue-600 flex items-center gap-1">
                          <CreditCard size={12} /> Bank
                        </Label>
                        <Input type="number" inputMode="decimal" value={bankAmount}
                          onChange={e => setBankAmount(e.target.value)} placeholder="0"
                          className="h-11 text-center font-semibold bg-blue-50 border-blue-200" data-testid="pos-bank" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-600 flex items-center gap-1">
                          <Users size={12} /> Credit
                        </Label>
                        <Input type="number" inputMode="decimal" value={creditAmount}
                          onChange={e => setCreditAmount(e.target.value)} placeholder="0"
                          className="h-11 text-center font-semibold bg-amber-50 border-amber-200" data-testid="pos-credit" />
                      </div>
                    </div>

                    {/* Customer for Credit */}
                    {parseFloat(creditAmount || 0) > 0 && (
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="Select Customer for Credit" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Total */}
                    {totalRegularAmount > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Total</span>
                        <span className="text-2xl font-bold text-emerald-600">SAR {totalRegularAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Description (optional)" className="h-11 rounded-xl" />

                <Button onClick={submitRegularSale} disabled={submitting || totalRegularAmount <= 0}
                  className="w-full h-14 rounded-xl text-lg font-semibold bg-emerald-500 hover:bg-emerald-600">
                  {submitting ? <Loader2 className="animate-spin mr-2" /> : <Plus size={20} className="mr-2" />}
                  Record Sale - SAR {totalRegularAmount.toLocaleString()}
                </Button>
              </TabsContent>

              {/* Online Sales - Multiple Platforms */}
              <TabsContent value="online" className="space-y-4 mt-4">
                <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Truck size={18} className="text-purple-600" />
                      <Label className="text-sm font-medium text-purple-700">Enter amounts for each platform</Label>
                    </div>
                    
                    <div className="space-y-2">
                      {platforms.filter(p => p.is_active !== false).map(platform => (
                        <div key={platform.id} className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-stone-600 mb-1 block">
                              {platform.name} 
                              <span className="text-purple-500 ml-1">({platform.commission_rate}%)</span>
                            </Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={platformAmounts[platform.id] || ''}
                              onChange={e => updatePlatformAmount(platform.id, e.target.value)}
                              placeholder="0.00"
                              className={`h-10 text-center font-semibold ${PLATFORM_COLORS[platform.name] || 'bg-purple-50 border-purple-200'}`}
                              data-testid={`platform-${platform.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {platforms.length === 0 && (
                      <p className="text-sm text-stone-500 text-center py-4">
                        No platforms configured. <a href="/platforms" className="text-purple-600 underline">Add platforms</a>
                      </p>
                    )}

                    {/* Total Online */}
                    {totalOnlineAmount > 0 && (
                      <div className="flex items-center justify-between pt-3 border-t border-purple-200">
                        <div>
                          <span className="text-sm font-medium text-purple-700">Total Online Sales</span>
                          <p className="text-xs text-purple-500">
                            {Object.entries(platformAmounts).filter(([_, amt]) => parseFloat(amt || 0) > 0).length} platforms
                          </p>
                        </div>
                        <span className="text-2xl font-bold text-purple-600">SAR {totalOnlineAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={submitOnlineSales} disabled={submitting || totalOnlineAmount <= 0}
                  className="w-full h-14 rounded-xl text-lg font-semibold bg-purple-500 hover:bg-purple-600">
                  {submitting ? <Loader2 className="animate-spin mr-2" /> : <Truck size={20} className="mr-2" />}
                  Record {Object.values(platformAmounts).filter(a => parseFloat(a || 0) > 0).length} Online Sales
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* EXPENSE MODE - Multiple Expenses */}
        {entryType === 'expense' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-red-700">Record Multiple Expenses</Label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                onClick={addExpenseRow}
                className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                data-testid="add-expense-row"
              >
                <Plus size={14} className="mr-1" /> Add More
              </Button>
            </div>

            {/* Expense Rows */}
            <div className="space-y-2">
              {expenses.map((expense, index) => (
                <div key={index} className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-red-600">Expense #{index + 1}</span>
                    {expenses.length > 1 && (
                      <button 
                        onClick={() => removeExpenseRow(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                        data-testid={`remove-expense-${index}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Amount */}
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={expense.amount}
                      onChange={(e) => updateExpenseRow(index, 'amount', e.target.value)}
                      className="h-10 rounded-lg bg-white"
                      data-testid={`expense-amount-${index}`}
                    />
                    
                    {/* Category */}
                    <Select 
                      value={expense.category || "general"} 
                      onValueChange={(v) => updateExpenseRow(index, 'category', v)}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-white" data-testid={`expense-category-${index}`}>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>)}
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Payment Mode */}
                    <Select 
                      value={expense.payment_mode} 
                      onValueChange={(v) => updateExpenseRow(index, 'payment_mode', v)}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-white" data-testid={`expense-mode-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2">
                            <Banknote size={14} /> Cash
                          </div>
                        </SelectItem>
                        <SelectItem value="bank">
                          <div className="flex items-center gap-2">
                            <CreditCard size={14} /> Bank
                          </div>
                        </SelectItem>
                        <SelectItem value="credit">
                          <div className="flex items-center gap-2">
                            <Users size={14} /> Credit
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Supplier Selection */}
                    <Select 
                      value={expense.supplier_id || "none"} 
                      onValueChange={(v) => updateExpenseRow(index, 'supplier_id', v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-white" data-testid={`expense-supplier-${index}`}>
                        <SelectValue placeholder="Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">- No Supplier -</SelectItem>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <Input
                    placeholder="Description (optional)"
                    value={expense.description}
                    onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                    className="h-9 rounded-lg bg-white text-sm"
                    data-testid={`expense-description-${index}`}
                  />

                  {/* Credit Warning */}
                  {expense.payment_mode === 'credit' && expense.supplier_id && (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
                      <strong>Credit:</strong> Will be added to supplier's balance
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total & Submit */}
            <div className="p-3 bg-red-100 rounded-xl border border-red-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-700">Total Expenses</span>
                <span className="text-lg font-bold text-red-800">SAR {totalExpensesAmount.toLocaleString()}</span>
              </div>
              <div className="text-xs text-red-600">
                {expenses.filter(e => parseFloat(e.amount) > 0).length} expense(s) to record
              </div>
            </div>

            <Button 
              onClick={submitMultipleExpenses} 
              disabled={submittingExpenses || totalExpensesAmount === 0}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-red-500 hover:bg-red-600"
              data-testid="submit-expenses"
            >
              {submittingExpenses ? <Loader2 className="animate-spin mr-2" /> : <Receipt size={20} className="mr-2" />}
              Record Expenses - SAR {totalExpensesAmount.toLocaleString()}
            </Button>
          </div>
        )}

        {/* SUPPLIER PAYMENTS SECTION */}
        {entryType === 'supplier_payment' && (
          <div className="space-y-3">
            {/* Help Box */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs">
              <p className="font-medium text-blue-800">💡 What is this for?</p>
              <p className="text-blue-700 mt-1">
                Use this to <strong>PAY BACK</strong> credit you owe to suppliers. 
                This reduces your credit balance with them.
              </p>
              <p className="text-blue-600 mt-1">
                For <strong>Purchase Bills</strong> (when you BUY from supplier), go to <strong>Expenses</strong> tab or <strong>Suppliers → Add Bill</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-orange-700">Pay Credit to Suppliers</Label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                onClick={addPaymentRow}
                className="h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                data-testid="add-payment-row"
              >
                <Plus size={14} className="mr-1" /> Add More
              </Button>
            </div>

            {/* Payment Rows */}
            <div className="space-y-2">
              {supplierPayments.map((payment, index) => (
                <div key={index} className="p-3 bg-orange-50/50 rounded-xl border border-orange-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-600">Payment #{index + 1}</span>
                    {supplierPayments.length > 1 && (
                      <button 
                        onClick={() => removePaymentRow(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                        data-testid={`remove-payment-${index}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  {/* Supplier Selection */}
                  <Select 
                    value={payment.supplier_id || "none"} 
                    onValueChange={(v) => updatePaymentRow(index, 'supplier_id', v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="h-10 rounded-lg bg-white" data-testid={`payment-supplier-${index}`}>
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">- Select Supplier -</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Amount */}
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={payment.amount}
                      onChange={(e) => updatePaymentRow(index, 'amount', e.target.value)}
                      className="h-10 rounded-lg bg-white"
                      data-testid={`payment-amount-${index}`}
                    />
                    
                    {/* Payment Mode */}
                    <Select 
                      value={payment.payment_mode} 
                      onValueChange={(v) => updatePaymentRow(index, 'payment_mode', v)}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-white" data-testid={`payment-mode-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2">
                            <Banknote size={14} /> Cash
                          </div>
                        </SelectItem>
                        <SelectItem value="bank">
                          <div className="flex items-center gap-2">
                            <CreditCard size={14} /> Bank
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Total & Submit */}
            <div className="p-3 bg-orange-100 rounded-xl border border-orange-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">Total Payments</span>
                <span className="text-lg font-bold text-orange-800">SAR {totalPaymentsAmount.toLocaleString()}</span>
              </div>
              <div className="text-xs text-orange-600 mb-2">
                {supplierPayments.filter(p => p.supplier_id && parseFloat(p.amount) > 0).length} valid payment(s)
              </div>
            </div>

            <Button 
              onClick={submitMultiplePayments} 
              disabled={submittingPayments || totalPaymentsAmount === 0}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-orange-500 hover:bg-orange-600"
              data-testid="submit-supplier-payments"
            >
              {submittingPayments ? <Loader2 className="animate-spin mr-2" /> : <Truck size={20} className="mr-2" />}
              Pay Suppliers - SAR {totalPaymentsAmount.toLocaleString()}
            </Button>
          </div>
        )}

        {/* Last Entries */}
        {lastEntries.length > 0 && (
          <Card className="border-0 shadow-sm bg-stone-50">
            <CardContent className="p-3">
              <Label className="text-xs text-stone-500 mb-2 block">Last Recorded</Label>
              <div className="space-y-1">
                {lastEntries.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {entry.success === false ? (
                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                      ) : (
                        <CheckCircle size={14} className="text-emerald-500" />
                      )}
                      <span>{entry.platform || entry.type}</span>
                    </div>
                    <span className="font-semibold">SAR {entry.amount?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
