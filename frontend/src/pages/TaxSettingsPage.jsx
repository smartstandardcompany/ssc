import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Receipt, Plus, Pencil, Trash2, Star, Check, Globe } from 'lucide-react';
import api from '@/lib/api';

export default function TaxSettingsPage() {
  const [taxRates, setTaxRates] = useState([]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editTax, setEditTax] = useState(null);
  const [taxForm, setTaxForm] = useState({ name: '', rate: 15, type: 'vat', is_default: false, description: '' });
  const [currencies, setCurrencies] = useState({ available: [], default: 'SAR', enabled: ['SAR'] });
  const [enabledCurrencies, setEnabledCurrencies] = useState(['SAR']);
  const [defaultCurrency, setDefaultCurrency] = useState('SAR');

  const fetchTaxRates = async () => {
    try {
      const res = await api.get('/accounting/tax-rates');
      setTaxRates(res.data);
    } catch { toast.error('Failed to load tax rates'); }
  };

  const fetchCurrencies = async () => {
    try {
      const res = await api.get('/accounting/currencies');
      setCurrencies(res.data);
      setEnabledCurrencies(res.data.enabled || ['SAR']);
      setDefaultCurrency(res.data.default || 'SAR');
    } catch {}
  };

  useEffect(() => { fetchTaxRates(); fetchCurrencies(); }, []);

  const handleSaveTax = async () => {
    if (!taxForm.name) { toast.error('Name is required'); return; }
    try {
      if (editTax) {
        await api.put(`/accounting/tax-rates/${editTax.id}`, taxForm);
        toast.success('Tax rate updated');
      } else {
        await api.post('/accounting/tax-rates', taxForm);
        toast.success('Tax rate created');
      }
      setShowTaxModal(false);
      setEditTax(null);
      fetchTaxRates();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
  };

  const handleDeleteTax = async (id) => {
    if (!window.confirm('Delete this tax rate?')) return;
    try {
      await api.delete(`/accounting/tax-rates/${id}`);
      toast.success('Deleted');
      fetchTaxRates();
    } catch { toast.error('Failed to delete'); }
  };

  const openNewTax = () => {
    setEditTax(null);
    setTaxForm({ name: '', rate: 15, type: 'vat', is_default: false, description: '' });
    setShowTaxModal(true);
  };

  const openEditTax = (tax) => {
    setEditTax(tax);
    setTaxForm({ name: tax.name, rate: tax.rate, type: tax.type, is_default: tax.is_default, description: tax.description || '' });
    setShowTaxModal(true);
  };

  const toggleCurrency = (code) => {
    setEnabledCurrencies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const saveCurrencySettings = async () => {
    try {
      await api.put('/accounting/currencies', {
        default_currency: defaultCurrency,
        enabled_currencies: enabledCurrencies,
      });
      toast.success('Currency settings saved');
    } catch { toast.error('Failed to save'); }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="tax-settings-page">
        <div>
          <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Tax & Currency Settings</h1>
          <p className="text-sm text-stone-500 mt-1">Manage VAT rates and currency preferences</p>
        </div>

        {/* VAT / Tax Rates */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-800">VAT / Tax Rates</h2>
              <p className="text-xs text-stone-500 mt-0.5">Middle East standard: 15% VAT (Saudi Arabia)</p>
            </div>
            <Button onClick={openNewTax} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="add-tax-btn">
              <Plus className="w-4 h-4 mr-1" /> Add Rate
            </Button>
          </div>
          <div className="divide-y divide-stone-50">
            {taxRates.map(tax => (
              <div key={tax.id} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors" data-testid={`tax-row-${tax.id}`}>
                <div className="flex items-center gap-3">
                  {tax.is_default && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  <div>
                    <p className="font-medium text-stone-800">{tax.name}</p>
                    <p className="text-xs text-stone-500">{tax.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-stone-800">{tax.rate}%</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${tax.type === 'vat' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                    {tax.type}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEditTax(tax)} className="p-1.5 rounded-md hover:bg-stone-100">
                      <Pencil className="w-3.5 h-3.5 text-stone-400" />
                    </button>
                    <button onClick={() => handleDeleteTax(tax.id)} className="p-1.5 rounded-md hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currency Settings */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100">
            <h2 className="text-lg font-semibold text-stone-800">Currency Settings</h2>
            <p className="text-xs text-stone-500 mt-0.5">Configure which currencies are available in your system</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-600 mb-2 block">Default Currency</label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="w-64" data-testid="default-currency-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {enabledCurrencies.map(c => {
                    const cur = currencies.available.find(a => a.code === c);
                    return <SelectItem key={c} value={c}>{cur ? `${cur.code} - ${cur.name}` : c}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-600 mb-3 block">Enabled Currencies</label>
              <div className="grid grid-cols-3 gap-3">
                {currencies.available.map(cur => (
                  <button key={cur.code} onClick={() => toggleCurrency(cur.code)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      enabledCurrencies.includes(cur.code)
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`} data-testid={`currency-${cur.code}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      enabledCurrencies.includes(cur.code) ? 'border-orange-500 bg-orange-500' : 'border-stone-300'
                    }`}>
                      {enabledCurrencies.includes(cur.code) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-stone-800">{cur.code} - {cur.symbol}</p>
                      <p className="text-xs text-stone-500">{cur.name} ({cur.country})</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={saveCurrencySettings} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="save-currency-btn">
                Save Currency Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Tax Rate Modal */}
        <Dialog open={showTaxModal} onOpenChange={setShowTaxModal}>
          <DialogContent data-testid="tax-modal">
            <DialogHeader>
              <DialogTitle>{editTax ? 'Edit Tax Rate' : 'Add Tax Rate'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-stone-600 mb-1 block">Name *</label>
                <Input value={taxForm.name} onChange={e => setTaxForm({...taxForm, name: e.target.value})}
                  placeholder="e.g. VAT 15%" data-testid="tax-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Rate (%)</label>
                  <Input type="number" step="0.5" value={taxForm.rate}
                    onChange={e => setTaxForm({...taxForm, rate: parseFloat(e.target.value) || 0})} data-testid="tax-rate-input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Type</label>
                  <Select value={taxForm.type} onValueChange={v => setTaxForm({...taxForm, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vat">VAT</SelectItem>
                      <SelectItem value="sales_tax">Sales Tax</SelectItem>
                      <SelectItem value="service_tax">Service Tax</SelectItem>
                      <SelectItem value="exempt">Exempt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-600 mb-1 block">Description</label>
                <Input value={taxForm.description} onChange={e => setTaxForm({...taxForm, description: e.target.value})}
                  placeholder="Optional description" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={taxForm.is_default}
                  onChange={e => setTaxForm({...taxForm, is_default: e.target.checked})}
                  className="rounded border-stone-300" />
                <span className="text-sm text-stone-600">Set as default tax rate</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaxModal(false)}>Cancel</Button>
              <Button onClick={handleSaveTax} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="save-tax-btn">
                {editTax ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
