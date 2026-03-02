import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DollarSign, ShoppingCart, Receipt, CreditCard, Banknote, Smartphone, CheckCircle, Users, Truck, Package } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function POSPage() {
  const { t } = useLanguage();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branch, setBranch] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [entryType, setEntryType] = useState('sale');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastEntry, setLastEntry] = useState(null);
  const [todayStats, setTodayStats] = useState({ sales: 0, expenses: 0, count: 0 });
  const [paymentMode, setPaymentMode] = useState('cash'); // For expenses

  // Multi-payment amounts
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  // For expense mode
  const [expenseAmount, setExpenseAmount] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/branches'), 
      api.get('/customers'), 
      api.get('/categories'),
      api.get('/platforms').catch(() => ({ data: [] })),
      api.get('/suppliers').catch(() => ({ data: [] })),
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
      setTodayStats({ sales: data.total_sales || 0, expenses: data.total_expenses || 0, count: (data.total_sales_count || 0) + (data.total_expenses_count || 0) });
    } catch {}
  };

  const totalSaleAmount = parseFloat(cashAmount || 0) + parseFloat(bankAmount || 0) + parseFloat(onlineAmount || 0) + parseFloat(creditAmount || 0);

  const submit = async () => {
    if (!branch) { toast.error('Select a branch'); return; }

    if (entryType === 'sale') {
      if (totalSaleAmount <= 0) { toast.error('Enter at least one payment amount'); return; }
      
      // If online amount entered, require platform
      if (parseFloat(onlineAmount || 0) > 0 && !platformId) {
        toast.error('Select a delivery platform for online sales');
        return;
      }

      setSubmitting(true);
      try {
        const paymentDetails = [];
        const cash = parseFloat(cashAmount || 0);
        const bank = parseFloat(bankAmount || 0);
        const online = parseFloat(onlineAmount || 0);
        const credit = parseFloat(creditAmount || 0);

        if (cash > 0) paymentDetails.push({ mode: 'cash', amount: cash, discount: 0 });
        if (bank > 0) paymentDetails.push({ mode: 'bank', amount: bank, discount: 0 });
        if (online > 0) paymentDetails.push({ mode: 'online_platform', amount: online, discount: 0 });
        if (credit > 0) paymentDetails.push({ mode: 'credit', amount: credit, discount: 0 });

        const payload = {
          sale_type: online > 0 ? 'online' : 'pos',
          amount: totalSaleAmount,
          branch_id: branch,
          notes: description || 'POS Sale',
          date: new Date().toISOString(),
          payment_details: paymentDetails,
          platform_id: online > 0 ? platformId : undefined,
          platform_status: online > 0 ? 'pending' : undefined,
        };
        if (credit > 0 && customerId) payload.customer_id = customerId;
        await api.post('/sales', payload);

        const modes = paymentDetails.map(p => p.mode === 'online_platform' ? 'Online' : p.mode).join(', ');
        const platformName = platforms.find(p => p.id === platformId)?.name;
        toast.success(`Sale SAR ${totalSaleAmount.toLocaleString()} recorded${platformName ? ` via ${platformName}` : ''}`);
        setLastEntry({ type: 'Sale', amount: totalSaleAmount, mode: modes, platform: platformName });

        setCashAmount(''); setBankAmount(''); setOnlineAmount(''); setCreditAmount('');
        setDescription(''); setCustomerId(''); setPlatformId('');
        refreshStats();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
      finally { setSubmitting(false); }
    } else {
      const amt = parseFloat(expenseAmount);
      if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }

      setSubmitting(true);
      try {
        await api.post('/expenses', {
          amount: amt, 
          category: category || 'General',
          branch_id: branch, 
          description: description || 'POS Expense',
          date: new Date().toISOString(),
          payment_mode: paymentMode,
          supplier_id: supplierId || undefined,
        });
        const supplierName = suppliers.find(s => s.id === supplierId)?.name;
        toast.success(`Expense SAR ${amt.toLocaleString()} recorded${supplierName ? ` - ${supplierName}` : ''}`);
        setLastEntry({ type: 'Expense', amount: amt, mode: `${category || 'General'} (${paymentMode})`, supplier: supplierName });
        setExpenseAmount(''); setDescription(''); setSupplierId(''); setPaymentMode('cash');
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
          <h1 className="text-xl font-bold font-outfit" data-testid="pos-title">{t('pos_title')}</h1>
          <p className="text-xs text-muted-foreground">{t('nav_sales')} & {t('expenses_title')}</p>
        </div>

        {/* Today Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-emerald-100 bg-emerald-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-medium">{t('nav_sales')}</p>
            <p className="text-sm font-bold font-outfit text-emerald-700" data-testid="pos-stat-sales">SAR {todayStats.sales.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-red-100 bg-red-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">{t('expenses_title')}</p>
            <p className="text-sm font-bold font-outfit text-red-700" data-testid="pos-stat-expenses">SAR {todayStats.expenses.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-blue-100 bg-blue-50/50"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium">{t('net_profit')}</p>
            <p className="text-sm font-bold font-outfit text-blue-700">SAR {(todayStats.sales - todayStats.expenses).toLocaleString()}</p>
          </CardContent></Card>
        </div>

        {/* Entry Type Toggle */}
        <div className="flex rounded-xl border overflow-hidden">
          <button onClick={() => setEntryType('sale')} data-testid="pos-sale-btn"
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'sale' ? 'bg-emerald-500 text-white' : 'bg-white text-stone-500'}`}>
            <ShoppingCart size={16} />{t('nav_sales')}
          </button>
          <button onClick={() => setEntryType('expense')} data-testid="pos-expense-btn"
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${entryType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-stone-500'}`}>
            <Receipt size={16} />{t('expenses_title')}
          </button>
        </div>

        {/* Branch */}
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="h-12 rounded-xl text-sm" data-testid="pos-branch"><SelectValue placeholder={t('branch')} /></SelectTrigger>
          <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>

        {/* SALE: Multi-payment entry */}
        {entryType === 'sale' && (
          <Card className="border-stone-200" data-testid="pos-multi-payment">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{t('payment_details')}</p>

              <div className="grid grid-cols-2 gap-3">
                {/* Cash */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Banknote size={13} className="text-emerald-500" /> {t('pos_cash')}
                  </Label>
                  <Input type="number" inputMode="decimal" value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-cash" />
                </div>

                {/* Bank */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-blue-500" /> {t('pos_bank')}
                  </Label>
                  <Input type="number" inputMode="decimal" value={bankAmount}
                    onChange={e => setBankAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-bank" />
                </div>

                {/* Online */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Truck size={13} className="text-purple-500" /> Online Platform
                  </Label>
                  <Input type="number" inputMode="decimal" value={onlineAmount}
                    onChange={e => setOnlineAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit border-purple-200 focus:border-purple-400" data-testid="pos-online" />
                </div>

                {/* Credit */}
                <div className="space-y-1">
                  <Label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Users size={13} className="text-amber-500" /> {t('pos_credit')}
                  </Label>
                  <Input type="number" inputMode="decimal" value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)} placeholder="0.00"
                    className="h-11 rounded-lg text-base font-semibold font-outfit" data-testid="pos-credit" />
                </div>
              </div>

              {/* Total */}
              {totalSaleAmount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-dashed border-stone-200">
                  <span className="text-sm font-medium text-stone-600">{t('pos_total')}</span>
                  <span className="text-xl font-bold font-outfit text-emerald-600" data-testid="pos-total">SAR {totalSaleAmount.toLocaleString()}</span>
                </div>
              )}
              
              {/* Platform Selection - Show when online amount > 0 */}
              {parseFloat(onlineAmount || 0) > 0 && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                  <Label className="text-xs text-purple-700 font-medium flex items-center gap-1.5">
                    <Truck size={13} /> Select Delivery Platform *
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {platforms.filter(p => p.is_active !== false).map(p => (
                      <button key={p.id} type="button" onClick={() => setPlatformId(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          platformId === p.id 
                            ? 'bg-purple-600 text-white border-purple-600' 
                            : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                        }`}>
                        {p.name} {p.commission_rate > 0 && <span className="opacity-70">({p.commission_rate}%)</span>}
                      </button>
                    ))}
                  </div>
                  {platforms.length === 0 && (
                    <p className="text-xs text-purple-600">No platforms configured. <a href="/platforms" className="underline">Add platforms</a></p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit: Customer select */}
        {entryType === 'sale' && parseFloat(creditAmount || 0) > 0 && (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-customer"><SelectValue placeholder={t('pos_customer')} /></SelectTrigger>
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
            
            {/* Category */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-category"><SelectValue placeholder={t('expense_category')} /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>)}
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Payment Mode */}
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'bank', 'credit'].map(mode => (
                <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-all border ${
                    paymentMode === mode 
                      ? mode === 'cash' ? 'bg-emerald-500 text-white border-emerald-500' 
                        : mode === 'bank' ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}>
                  {mode === 'cash' && <Banknote size={14} className="inline mr-1" />}
                  {mode === 'bank' && <CreditCard size={14} className="inline mr-1" />}
                  {mode === 'credit' && <Users size={14} className="inline mr-1" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Supplier Selection */}
            <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-11 rounded-xl text-sm" data-testid="pos-supplier">
                <Package size={14} className="mr-2 text-stone-400" />
                <SelectValue placeholder="Select Supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- No Supplier -</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.current_credit > 0 && `(Credit: SAR ${s.current_credit})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Credit Warning */}
            {paymentMode === 'credit' && supplierId && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
                <strong>Credit Purchase:</strong> This will be added to supplier's balance. Pay later via Supplier Payments.
              </div>
            )}
          </>
        )}

        {/* Description */}
        <Input value={description} onChange={e => setDescription(e.target.value)}
          placeholder={t('description')} className="h-11 rounded-xl text-sm" data-testid="pos-desc" />

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
