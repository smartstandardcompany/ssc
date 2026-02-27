import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DollarSign, ShoppingCart, Receipt, CreditCard, Banknote, Smartphone, CheckCircle, Users } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function POSPage() {
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branch, setBranch] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [entryType, setEntryType] = useState('sale');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastEntry, setLastEntry] = useState(null);
  const [todayStats, setTodayStats] = useState({ sales: 0, expenses: 0, count: 0 });

  // Multi-payment amounts
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  // For expense mode
  const [expenseAmount, setExpenseAmount] = useState('');

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

  const totalSaleAmount = parseFloat(cashAmount || 0) + parseFloat(bankAmount || 0) + parseFloat(onlineAmount || 0) + parseFloat(creditAmount || 0);

  const submit = async () => {
    if (!branch) { toast.error('Select a branch'); return; }

    if (entryType === 'sale') {
      if (totalSaleAmount <= 0) { toast.error('Enter at least one payment amount'); return; }

      setSubmitting(true);
      try {
        const paymentDetails = [];
        const cash = parseFloat(cashAmount || 0);
        const bank = parseFloat(bankAmount || 0);
        const online = parseFloat(onlineAmount || 0);
        const credit = parseFloat(creditAmount || 0);

        if (cash > 0) paymentDetails.push({ mode: 'cash', amount: cash, discount: 0 });
        if (bank > 0) paymentDetails.push({ mode: 'bank', amount: bank, discount: 0 });
        if (online > 0) paymentDetails.push({ mode: 'online', amount: online, discount: 0 });
        if (credit > 0) paymentDetails.push({ mode: 'credit', amount: credit, discount: 0 });

        const payload = {
          sale_type: 'pos',
          amount: totalSaleAmount,
          branch_id: branch,
          notes: description || 'POS Sale',
          date: new Date().toISOString(),
          payment_details: paymentDetails
        };
        if (credit > 0 && customerId) payload.customer_id = customerId;
        await api.post('/sales', payload);

        const modes = paymentDetails.map(p => p.mode).join(', ');
        toast.success(`Sale SAR ${totalSaleAmount.toLocaleString()} recorded`);
        setLastEntry({ type: 'Sale', amount: totalSaleAmount, mode: modes });

        setCashAmount(''); setBankAmount(''); setOnlineAmount(''); setCreditAmount('');
        setDescription(''); setCustomerId('');
        refreshStats();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
      finally { setSubmitting(false); }
    } else {
      const amt = parseFloat(expenseAmount);
      if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }

      setSubmitting(true);
      try {
        await api.post('/expenses', {
          amount: amt, category: category || 'General',
          branch_id: branch, description: description || 'POS Expense',
          date: new Date().toISOString(),
        });
        toast.success(`Expense SAR ${amt.toLocaleString()} recorded`);
        setLastEntry({ type: 'Expense', amount: amt, mode: category || 'General' });
        setExpenseAmount(''); setDescription('');
        refreshStats();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
      finally { setSubmitting(false); }
    }
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
            <p className="text-sm font-bold font-outfit text-emerald-700" data-testid="pos-stat-sales">SAR {todayStats.sales.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-red-100 bg-red-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">Expenses</p>
            <p className="text-sm font-bold font-outfit text-red-700" data-testid="pos-stat-expenses">SAR {todayStats.expenses.toLocaleString()}</p>
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

        {/* SALE: Multi-payment entry */}
        {entryType === 'sale' && (
          <Card className="border-stone-200" data-testid="pos-multi-payment">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Payment Amounts</p>

              <div className="grid grid-cols-2 gap-3">
                {/* Cash */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Banknote size={13} className="text-emerald-500" /> Cash
                  </Label>
                  <Input type="number" inputMode="decimal" value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-cash" />
                </div>

                {/* Bank */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-blue-500" /> Bank
                  </Label>
                  <Input type="number" inputMode="decimal" value={bankAmount}
                    onChange={e => setBankAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-bank" />
                </div>

                {/* Online */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-purple-500" /> Online
                  </Label>
                  <Input type="number" inputMode="decimal" value={onlineAmount}
                    onChange={e => setOnlineAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-online" />
                </div>

                {/* Credit */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Users size={13} className="text-amber-500" /> Credit
                  </Label>
                  <Input type="number" inputMode="decimal" value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-credit" />
                </div>
              </div>

              {/* Total */}
              {totalSaleAmount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-dashed border-stone-200">
                  <span className="text-sm font-medium text-stone-600">Total</span>
                  <span className="text-xl font-bold font-outfit text-emerald-600" data-testid="pos-total">SAR {totalSaleAmount.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit: Customer select */}
        {entryType === 'sale' && parseFloat(creditAmount || 0) > 0 && (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-customer"><SelectValue placeholder="Select Customer (for credit)" /></SelectTrigger>
            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {/* EXPENSE: Amount */}
        {entryType === 'expense' && (
          <>
            <div className="relative">
              <DollarSign size={18} className="absolute left-3.5 top-3.5 text-stone-400" />
              <Input type="number" inputMode="decimal" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                placeholder="0.00" className="h-14 pl-10 text-2xl font-bold font-outfit rounded-xl text-center" data-testid="pos-amount" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-category"><SelectValue placeholder="Expense Category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>)}
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {/* Description */}
        <Input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)" className="h-11 rounded-xl text-sm" data-testid="pos-desc" />

        {/* Submit */}
        <Button disabled={submitting || (entryType === 'sale' ? totalSaleAmount <= 0 : !expenseAmount || parseFloat(expenseAmount) <= 0)} onClick={submit} data-testid="pos-submit"
          className={`w-full h-14 rounded-xl text-base font-bold transition-all ${entryType === 'sale' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {submitting ? 'Recording...' : entryType === 'sale'
            ? `Record Sale - SAR ${totalSaleAmount > 0 ? totalSaleAmount.toLocaleString() : '0'}`
            : `Record Expense - SAR ${expenseAmount || '0'}`
          }
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
