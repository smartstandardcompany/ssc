import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ShoppingCart, Receipt, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
  { value: 'bank', label: 'Bank', icon: CreditCard, color: 'bg-blue-500' },
  { value: 'online', label: 'Online', icon: Smartphone, color: 'bg-purple-500' },
  { value: 'credit', label: 'Credit', icon: Receipt, color: 'bg-amber-500' },
];

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500, 1000, 2500];

export default function POSPage() {
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branch, setBranch] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [entryType, setEntryType] = useState('sale');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastEntry, setLastEntry] = useState(null);
  const [todayStats, setTodayStats] = useState({ sales: 0, expenses: 0, count: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/branches'), api.get('/customers'), api.get('/categories'),
    ]).then(([bR, cR, catR]) => {
      setBranches(bR.data);
      setCustomers(cR.data);
      setCategories(catR.data);
      if (bR.data.length > 0) setBranch(bR.data[0].id);
    }).catch(() => {});
    refreshStats();
  }, []);

  const refreshStats = async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setTodayStats({ sales: data.total_sales || 0, expenses: data.total_expenses || 0, count: (data.total_sales_count || 0) + (data.total_expenses_count || 0) });
    } catch {}
  };

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!branch) { toast.error('Select a branch'); return; }
    setSubmitting(true);
    try {
      if (entryType === 'sale') {
        const saleAmount = parseFloat(amount);
        const payload = {
          sale_type: 'pos',
          amount: saleAmount,
          branch_id: branch,
          notes: description || 'POS Sale',
          date: new Date().toISOString(),
          payment_details: [{
            payment_mode: paymentMode,
            amount: saleAmount,
            discount: 0
          }]
        };
        if (paymentMode === 'credit' && customerId) payload.customer_id = customerId;
        await api.post('/sales', payload);
        toast.success(`Sale SAR ${amount} recorded`);
        setLastEntry({ type: 'Sale', amount: parseFloat(amount), mode: paymentMode });
      } else {
        await api.post('/expenses', {
          amount: parseFloat(amount), category: category || 'General',
          branch_id: branch, description: description || 'POS Expense',
          date: new Date().toISOString(),
        });
        toast.success(`Expense SAR ${amount} recorded`);
        setLastEntry({ type: 'Expense', amount: parseFloat(amount), mode: category || 'General' });
      }
      setAmount(''); setDescription('');
      refreshStats();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8" data-testid="pos-page">
        {/* Header */}
        <div className="text-center pt-2">
          <h1 className="text-xl font-bold font-outfit" data-testid="pos-title">Quick Entry</h1>
          <p className="text-xs text-muted-foreground">Fast sale & expense recording</p>
        </div>

        {/* Today Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-emerald-100 bg-emerald-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-medium">Sales</p>
            <p className="text-sm font-bold font-outfit text-emerald-700">SAR {todayStats.sales.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-red-100 bg-red-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">Expenses</p>
            <p className="text-sm font-bold font-outfit text-red-700">SAR {todayStats.expenses.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-blue-100 bg-blue-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium">Net</p>
            <p className="text-sm font-bold font-outfit text-blue-700">SAR {(todayStats.sales - todayStats.expenses).toLocaleString()}</p>
          </CardContent></Card>
        </div>

        {/* Entry Type Toggle */}
        <div className="flex rounded-xl border overflow-hidden">
          <button onClick={() => setEntryType('sale')} data-testid="pos-sale-btn"
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'sale' ? 'bg-emerald-500 text-white' : 'bg-white text-stone-500'}`}>
            <ShoppingCart size={16} />Sale
          </button>
          <button onClick={() => setEntryType('expense')} data-testid="pos-expense-btn"
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-stone-500'}`}>
            <Receipt size={16} />Expense
          </button>
        </div>

        {/* Branch */}
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="h-12 rounded-xl text-sm" data-testid="pos-branch"><SelectValue placeholder="Select Branch" /></SelectTrigger>
          <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>

        {/* Amount */}
        <div className="relative">
          <DollarSign size={18} className="absolute left-3.5 top-3.5 text-stone-400" />
          <Input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="h-14 pl-10 text-2xl font-bold font-outfit rounded-xl text-center" data-testid="pos-amount" />
        </div>

        {/* Quick amounts */}
        <div className="flex flex-wrap gap-2 justify-center">
          {QUICK_AMOUNTS.map(a => (
            <button key={a} onClick={() => setAmount(String(a))} data-testid={`quick-${a}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${amount === String(a) ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 active:bg-stone-50'}`}>
              {a}
            </button>
          ))}
        </div>

        {/* Payment Mode (for sales) */}
        {entryType === 'sale' && (
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_MODES.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.value} onClick={() => setPaymentMode(m.value)} data-testid={`pm-${m.value}`}
                  className={`p-3 rounded-xl border text-center transition-all ${paymentMode === m.value ? `${m.color} text-white border-transparent shadow-sm` : 'bg-white border-stone-200 text-stone-600'}`}>
                  <Icon size={18} className="mx-auto mb-1" />
                  <p className="text-[11px] font-medium">{m.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Credit: Customer select */}
        {entryType === 'sale' && paymentMode === 'credit' && (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-customer"><SelectValue placeholder="Select Customer" /></SelectTrigger>
            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {/* Expense category */}
        {entryType === 'expense' && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-category"><SelectValue placeholder="Expense Category" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>)}
              <SelectItem value="General">General</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Description */}
        <Input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)" className="h-11 rounded-xl text-sm" data-testid="pos-desc" />

        {/* Submit */}
        <Button disabled={submitting || !amount} onClick={submit} data-testid="pos-submit"
          className={`w-full h-14 rounded-xl text-base font-bold transition-all ${entryType === 'sale' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {submitting ? 'Recording...' : `Record ${entryType === 'sale' ? 'Sale' : 'Expense'} - SAR ${amount || '0'}`}
        </Button>

        {/* Last Entry Confirmation */}
        {lastEntry && (
          <Card className="border-emerald-200 bg-emerald-50" data-testid="last-entry">
            <CardContent className="p-3 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">{lastEntry.type} Recorded</p>
                <p className="text-xs text-emerald-600">SAR {lastEntry.amount.toLocaleString()} via {lastEntry.mode}</p>
              </div>
              <Badge variant="outline" className="border-emerald-300 text-emerald-600 text-[10px]">Just Now</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
