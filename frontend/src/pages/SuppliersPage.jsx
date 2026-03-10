import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign, FileText, ArrowUpCircle, ArrowDownCircle, Receipt, CreditCard, Banknote, Download, Building2, X, Send, Mail, MessageSquare, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExportButtons } from '@/components/ExportButtons';
import { AdvancedSearch, applySearchFilters } from '@/components/AdvancedSearch';
import { useBranchStore } from '@/stores';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const { branches, fetchBranches } = useBranchStore();
  const [categories, setCategories] = useState([]);
  const [searchFilters, setSearchFilters] = useState({});
  const [paySummaries, setPaySummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [showAddBillDialog, setShowAddBillDialog] = useState(false);
  const [billData, setBillData] = useState({ amount: '', category: '', payment_mode: 'credit', description: '', branch_id: '' });
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerSupplier, setLedgerSupplier] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', account_number: '', credit_limit: 0,
    bank_accounts: []
  });
  const [paymentData, setPaymentData] = useState({ payment_mode: 'cash', amount: '', branch_id: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareData, setShareData] = useState({ channels: [], email: '', phone: '' });
  const [sharing, setSharing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Use Zustand for branches
      fetchBranches();
      const [suppliersRes, categoriesRes, summariesRes, expCatRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/categories?category_type=supplier'),
        api.get('/suppliers/payment-summaries'),
        api.get('/categories?category_type=expense').catch(() => ({ data: [] })),
      ]);
      setSuppliers(suppliersRes.data);
      setCategories(categoriesRes.data);
      setPaySummaries(summariesRes.data);
      setExpenseCategories(expCatRes.data || []);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await api.post('/categories', { name: newCategory.trim(), type: 'supplier' });
      toast.success('Category added');
      setNewCategory('');
      const res = await api.get('/categories?category_type=supplier');
      setCategories(res.data);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add category'); }
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategory.trim() || !formData.category) return;
    try {
      const parent = categories.find(c => c.name === formData.category);
      await api.post('/categories', { name: newSubCategory.trim(), type: 'supplier', parent_id: parent?.id || null });
      toast.success('Sub-category added');
      setNewSubCategory('');
      const res = await api.get('/categories?category_type=supplier');
      setCategories(res.data);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const subCategories = categories.filter(c => {
    const parent = categories.find(p => p.name === formData.category && !p.parent_id);
    return c.parent_id && parent && c.parent_id === parent.id;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };
      // Validate bank accounts (max 3, filter empty)
      submitData.bank_accounts = (formData.bank_accounts || [])
        .filter(ba => ba.bank_name || ba.account_number || ba.iban)
        .slice(0, 3);
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, submitData);
        toast.success('Supplier updated successfully');
      } else {
        await api.post('/suppliers', submitData);
        toast.success('Supplier added successfully');
      }
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save supplier'); }
  };

  const handlePayCredit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/suppliers/${payingSupplier.id}/pay-credit`, paymentData);
      toast.success('Credit payment recorded');
      setShowPayDialog(false);
      setPaymentData({ payment_mode: 'cash', amount: '', branch_id: '' });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to record payment'); }
  };

  const viewLedger = async (supplier, startDate, endDate) => {
    setLedgerLoading(true);
    setLedgerSupplier(supplier);
    setShowLedgerDialog(true);
    try {
      let url = `/suppliers/${supplier.id}/ledger`;
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      const res = await api.get(url);
      setLedgerData(res.data);
    } catch { toast.error('Failed to load supplier ledger'); setShowLedgerDialog(false); }
    finally { setLedgerLoading(false); }
  };

  const exportLedger = async (format) => {
    if (!ledgerSupplier) return;
    try {
      let url = `/suppliers/${ledgerSupplier.id}/ledger/export?format=${format}`;
      if (ledgerStartDate) url += `&start_date=${ledgerStartDate}`;
      if (ledgerEndDate) url += `&end_date=${ledgerEndDate}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ledger_${ledgerSupplier.name.replace(/\s+/g, '_')}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Ledger exported as ${format.toUpperCase()}`);
    } catch { toast.error('Failed to export ledger'); }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();
    if (!payingSupplier) return;
    try {
      await api.post('/expenses', {
        amount: parseFloat(billData.amount),
        category: billData.category || 'Supplier Purchase',
        description: billData.description || `Purchase from ${payingSupplier.name}`,
        payment_mode: billData.payment_mode,
        supplier_id: payingSupplier.id,
        branch_id: billData.branch_id || '',
        date: `${new Date().toISOString().split('T')[0]}T${new Date().toTimeString().slice(0,8)}`,
      });
      
      // Also create supplier payment to update credit balance
      await api.post('/supplier-payments', {
        supplier_id: payingSupplier.id,
        amount: parseFloat(billData.amount),
        payment_mode: billData.payment_mode,
        branch_id: billData.branch_id || null,
        date: `${new Date().toISOString().split('T')[0]}T${new Date().toTimeString().slice(0,8)}`,
        notes: `Bill: ${billData.description || `Purchase from ${payingSupplier.name}`}`,
      }).catch(() => {});
      
      const modeText = billData.payment_mode === 'credit' ? 'Credit bill added to balance' : 'Cash/Bank bill recorded';
      toast.success(`Purchase bill recorded! ${modeText}`);
      setShowAddBillDialog(false);
      setBillData({ amount: '', category: '', payment_mode: 'credit', description: '', branch_id: '' });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add purchase bill'); }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      category: supplier.category || '',
      sub_category: supplier.sub_category || '',
      branch_id: supplier.branch_id || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      account_number: supplier.account_number || '',
      credit_limit: supplier.credit_limit || 0,
      bank_accounts: supplier.bank_accounts || []
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        toast.success('Supplier deleted successfully');
        fetchData();
      } catch { toast.error('Failed to delete supplier'); }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', account_number: '', credit_limit: 0, bank_accounts: [] });
    setEditingSupplier(null);
  };

  // Bank account helpers
  const addBankAccount = () => {
    if ((formData.bank_accounts || []).length >= 3) {
      toast.error('Maximum 3 bank accounts allowed');
      return;
    }
    setFormData({
      ...formData,
      bank_accounts: [...(formData.bank_accounts || []), { bank_name: '', account_number: '', iban: '', swift_code: '' }]
    });
  };

  const updateBankAccount = (index, field, value) => {
    const updated = [...(formData.bank_accounts || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, bank_accounts: updated });
  };

  const removeBankAccount = (index) => {
    setFormData({ ...formData, bank_accounts: formData.bank_accounts.filter((_, i) => i !== index) });
  };

  // Share statement
  const openShareDialog = () => {
    setShareData({
      channels: [],
      email: ledgerData?.supplier?.email || ledgerSupplier?.email || '',
      phone: ledgerData?.supplier?.phone || ledgerSupplier?.phone || ''
    });
    setShowShareDialog(true);
  };

  const toggleShareChannel = (channel) => {
    setShareData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }));
  };

  const shareStatement = async () => {
    if (shareData.channels.length === 0) { toast.error('Select at least one channel'); return; }
    if (shareData.channels.includes('email') && !shareData.email) { toast.error('Enter email address'); return; }
    if (shareData.channels.includes('whatsapp') && !shareData.phone) { toast.error('Enter phone number'); return; }
    setSharing(true);
    try {
      const res = await api.post(`/suppliers/${ledgerSupplier.id}/share-statement`, {
        channels: shareData.channels,
        email: shareData.email,
        phone: shareData.phone,
        start_date: ledgerStartDate || undefined,
        end_date: ledgerEndDate || undefined
      });
      const r = res.data.results;
      if (r.email?.success) toast.success(`Statement sent to ${r.email.sent_to}`);
      if (r.email && !r.email.success) toast.error(`Email: ${r.email.error}`);
      if (r.whatsapp?.success) toast.success(`WhatsApp sent to ${r.whatsapp.sent_to}`);
      if (r.whatsapp && !r.whatsapp.success) toast.error(`WhatsApp: ${r.whatsapp.error}`);
      setShowShareDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to share statement');
    } finally { setSharing(false); }
  };

  // Migration
  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const previewMigration = async () => {
    try {
      const res = await api.get('/suppliers/migration-preview');
      setMigrationPreview(res.data);
      setShowMigrateDialog(true);
    } catch { toast.error('Failed to preview migration'); }
  };

  const executeMigration = async () => {
    setMigrating(true);
    try {
      const res = await api.post('/suppliers/migrate-payments-to-bills');
      toast.success(res.data.message);
      setShowMigrateDialog(false);
      setMigrationPreview(null);
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Migration failed'); }
    finally { setMigrating(false); }
  };

  if (loading) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="suppliers-page-title">Suppliers</h1>
            <p className="text-muted-foreground text-sm">Manage suppliers and track credit</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <ExportButtons dataType="suppliers" />
            <Button variant="outline" size="sm" onClick={previewMigration}
              className="text-amber-600 border-amber-300 hover:bg-amber-50" data-testid="migrate-payments-btn">
              <ArrowUpCircle size={16} className="mr-1" /> Fix Data
            </Button>
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-supplier-button">
                  <Plus size={18} className="mr-2" /> Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="supplier-dialog" aria-describedby="supplier-dialog-description">
                <DialogHeader>
                  <DialogTitle className="font-outfit">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Supplier Name *</Label>
                    <Input value={formData.name} data-testid="supplier-name-input"
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={formData.category || "none"} onValueChange={(val) => setFormData({ ...formData, category: val === "none" ? "" : val })}>
                      <SelectTrigger data-testid="supplier-category-select"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Category</SelectItem>
                        {categories.filter(c => !c.parent_id).map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 mt-2">
                      <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" className="h-8 text-xs" data-testid="new-category-input" />
                      <Button type="button" size="sm" variant="outline" onClick={handleAddCategory} className="h-8 text-xs whitespace-nowrap" data-testid="add-category-button">
                        <Plus size={12} className="mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                  {formData.category && (
                    <div>
                      <Label>Sub-Category</Label>
                      <Select value={formData.sub_category || "none"} onValueChange={(val) => setFormData({ ...formData, sub_category: val === "none" ? "" : val })}>
                        <SelectTrigger data-testid="supplier-subcategory-select"><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Sub-Category</SelectItem>
                          {subCategories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 mt-2">
                        <Input value={newSubCategory} onChange={(e) => setNewSubCategory(e.target.value)} placeholder="New sub-category" className="h-8 text-xs" data-testid="new-subcategory-input" />
                        <Button type="button" size="sm" variant="outline" onClick={handleAddSubCategory} className="h-8 text-xs whitespace-nowrap"><Plus size={12} className="mr-1" />Add</Button>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label>Branch</Label>
                    <Select value={formData.branch_id || "all"} onValueChange={(val) => setFormData({ ...formData, branch_id: val === "all" ? "" : val })}>
                      <SelectTrigger data-testid="branch-select"><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone</Label>
                      <Input value={formData.phone} data-testid="supplier-phone-input" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={formData.email} data-testid="supplier-email-input" onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Credit Limit</Label>
                    <Input type="number" step="0.01" value={formData.credit_limit} data-testid="credit-limit-input"
                      onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })} />
                  </div>

                  {/* Bank Accounts Section */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Building2 size={14} /> Bank Accounts
                        <span className="text-xs text-muted-foreground">({(formData.bank_accounts || []).length}/3)</span>
                      </Label>
                      {(formData.bank_accounts || []).length < 3 && (
                        <Button type="button" size="sm" variant="outline" onClick={addBankAccount}
                          className="h-7 text-xs" data-testid="add-bank-account-btn">
                          <Plus size={12} className="mr-1" /> Add Bank
                        </Button>
                      )}
                    </div>
                    {(formData.bank_accounts || []).map((ba, idx) => (
                      <div key={idx} className="p-3 bg-stone-50 rounded-lg border space-y-2" data-testid={`bank-account-${idx}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-stone-500">Bank #{idx + 1}</span>
                          <button type="button" onClick={() => removeBankAccount(idx)} className="text-xs text-red-500 hover:text-red-700">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Bank Name" value={ba.bank_name || ''} className="h-8 text-sm"
                            onChange={(e) => updateBankAccount(idx, 'bank_name', e.target.value)} data-testid={`bank-name-${idx}`} />
                          <Input placeholder="Account Number" value={ba.account_number || ''} className="h-8 text-sm"
                            onChange={(e) => updateBankAccount(idx, 'account_number', e.target.value)} data-testid={`bank-acc-${idx}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="IBAN" value={ba.iban || ''} className="h-8 text-sm"
                            onChange={(e) => updateBankAccount(idx, 'iban', e.target.value)} data-testid={`bank-iban-${idx}`} />
                          <Input placeholder="SWIFT Code" value={ba.swift_code || ''} className="h-8 text-sm"
                            onChange={(e) => updateBankAccount(idx, 'swift_code', e.target.value)} data-testid={`bank-swift-${idx}`} />
                        </div>
                      </div>
                    ))}
                    {(formData.bank_accounts || []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No bank accounts added</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" data-testid="submit-supplier-button" className="rounded-full">
                      {editingSupplier ? 'Update' : 'Add'} Supplier
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Advanced Search */}
        <AdvancedSearch
          onSearch={setSearchFilters}
          config={{
            searchFields: ['name', 'phone', 'email', 'category'],
            placeholder: 'Search suppliers by name, category...',
            filters: [
              { key: 'branch_id', label: 'Branch', type: 'select', options: branches.map(b => ({ value: b.id, label: b.name })) },
              { key: 'category', label: 'Category', type: 'select', options: categories.filter(c => !c.parent_id).map(c => ({ value: c.name, label: c.name })) },
              { key: 'current_credit', label: 'Credit Balance', type: 'range' }
            ]
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applySearchFilters(suppliers, searchFilters).map((supplier) => {
            const branchName = branches.find((b) => b.id === supplier.branch_id)?.name || 'All Branches';
            const creditUtilization = supplier.credit_limit > 0 ? (supplier.current_credit / supplier.credit_limit) * 100 : 0;
            const totalPurchases = supplier.total_purchases || 0;

            return (
              <Card key={supplier.id} className="border-border hover:shadow-lg transition-shadow" data-testid="supplier-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="font-outfit text-lg">{supplier.name}</CardTitle>
                      {supplier.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{supplier.category}</span>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{branchName}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(supplier)} data-testid="edit-supplier-button"><Edit size={16} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(supplier.id)} data-testid="delete-supplier-button" className="text-error hover:text-error"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supplier.phone && <p className="text-sm">Phone: {supplier.phone}</p>}

                  {/* Total Purchases */}
                  <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200" data-testid={`total-purchases-${supplier.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-700 flex items-center gap-1"><Receipt size={12} /> Total Purchases</span>
                      <span className="text-sm font-bold text-amber-800">SAR {totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Cash/Bank Paid Breakdown */}
                  {paySummaries[supplier.id] && (paySummaries[supplier.id].cash > 0 || paySummaries[supplier.id].bank > 0) && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1 p-2 bg-cash/10 rounded text-center">
                          <div className="text-xs text-muted-foreground">Cash Paid</div>
                          <div className="text-sm font-bold text-cash">SAR {paySummaries[supplier.id].cash.toFixed(2)}</div>
                        </div>
                        <div className="flex-1 p-2 bg-bank/10 rounded text-center">
                          <div className="text-xs text-muted-foreground">Bank Paid</div>
                          <div className="text-sm font-bold text-bank">SAR {paySummaries[supplier.id].bank.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Accounts Preview */}
                  {supplier.bank_accounts && supplier.bank_accounts.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Building2 size={11} /> Bank Accounts ({supplier.bank_accounts.length})</p>
                      {supplier.bank_accounts.map((ba, i) => (
                        <div key={i} className="text-xs text-stone-600 bg-stone-50 px-2 py-1 rounded mb-1">
                          {ba.bank_name || 'Bank'}: {ba.account_number || ba.iban || '-'}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Credit Status</span>
                      <span className="text-sm font-bold">SAR {supplier.current_credit?.toFixed(2) || '0.00'} / {supplier.credit_limit?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${creditUtilization > 80 ? 'bg-error' : creditUtilization > 50 ? 'bg-warning' : 'bg-success'}`}
                        style={{ width: `${Math.min(creditUtilization, 100)}%` }} />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => { setPayingSupplier(supplier); setShowAddBillDialog(true); setBillData({ amount: '', category: '', payment_mode: 'credit', description: '', branch_id: supplier.branch_id || '' }); }}
                      data-testid={`add-bill-${supplier.id}`} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                      <Receipt size={14} className="mr-1" /> Add Bill
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPayingSupplier(supplier); setShowPayDialog(true); }}
                      data-testid="pay-credit-button"
                      className={`${supplier.current_credit > 0 ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-stone-400 border-stone-200'}`}
                      disabled={!supplier.current_credit || supplier.current_credit <= 0}>
                      <DollarSign size={14} className="mr-1" /> Pay Credit
                    </Button>
                  </div>

                  {/* View Ledger Button */}
                  <Button size="sm" variant="ghost" onClick={() => { setLedgerStartDate(''); setLedgerEndDate(''); viewLedger(supplier); }}
                    data-testid={`view-ledger-${supplier.id}`} className="w-full mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <FileText size={14} className="mr-1" /> View Ledger
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {suppliers.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-12 text-center"><p className="text-muted-foreground">No suppliers yet. Add your first supplier to get started!</p></CardContent>
            </Card>
          )}
        </div>

        {/* Pay Credit Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent data-testid="pay-credit-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Pay Supplier Credit</DialogTitle></DialogHeader>
            <form onSubmit={handlePayCredit} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Paying to: <span className="font-medium text-foreground">{payingSupplier?.name}</span></p>
                <p className="text-sm text-muted-foreground">Current Credit: <span className="font-bold text-error">SAR {payingSupplier?.current_credit?.toFixed(2)}</span></p>
              </div>
              <div>
                <Label>Payment Amount *</Label>
                <Input type="number" step="0.01" value={paymentData.amount} data-testid="payment-amount-input"
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} required max={payingSupplier?.current_credit} />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={paymentData.payment_mode} onValueChange={(val) => setPaymentData({ ...paymentData, payment_mode: val })}>
                  <SelectTrigger data-testid="payment-mode-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>From Branch</Label>
                <Select value={paymentData.branch_id || "all"} onValueChange={(val) => setPaymentData({ ...paymentData, branch_id: val === "all" ? "" : val })}>
                  <SelectTrigger data-testid="pay-branch-select"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">No Branch</SelectItem>
                    {branches.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-payment-button" className="rounded-full">Pay Credit</Button>
                <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supplier Ledger Dialog */}
        <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="ledger-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="text-blue-500" />
                {ledgerData?.supplier?.name || ledgerSupplier?.name} - Ledger
              </DialogTitle>
            </DialogHeader>

            {/* Date Filter */}
            <div className="flex flex-wrap items-end gap-2 pb-3 border-b">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)}
                  className="h-8 text-sm w-36" data-testid="ledger-start-date" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)}
                  className="h-8 text-sm w-36" data-testid="ledger-end-date" />
              </div>
              <Button size="sm" variant="outline" className="h-8"
                onClick={() => ledgerSupplier && viewLedger(ledgerSupplier, ledgerStartDate, ledgerEndDate)}
                data-testid="ledger-filter-btn">Filter</Button>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline" className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={openShareDialog} data-testid="share-statement-btn">
                  <Send size={13} className="mr-1" /> Share
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => exportLedger('pdf')} data-testid="export-ledger-pdf">
                  <Download size={13} className="mr-1" /> PDF
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => exportLedger('excel')} data-testid="export-ledger-excel">
                  <Download size={13} className="mr-1" /> Excel
                </Button>
              </div>
            </div>

            {ledgerLoading ? (
              <div className="flex items-center justify-center py-8">Loading...</div>
            ) : ledgerData && (
              <div className="flex-1 overflow-auto space-y-4">
                {/* Current Balance */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Credit Balance</p>
                    <p className="text-3xl font-bold text-blue-600" data-testid="ledger-balance">
                      SAR {ledgerData.supplier?.current_credit?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <p className="text-xs text-amber-600">Credit Purchases</p>
                    <p className="text-lg font-bold text-amber-700">SAR {(ledgerData.summary?.credit_purchases || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-amber-500">Adds to balance</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                    <p className="text-xs text-emerald-600">Cash/Bank Purchases</p>
                    <p className="text-lg font-bold text-emerald-700">SAR {((ledgerData.summary?.cash_purchases || 0) + (ledgerData.summary?.bank_purchases || 0)).toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-500">Paid immediately</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-xs text-blue-600">Credit Paid</p>
                    <p className="text-lg font-bold text-blue-700">SAR {(ledgerData.summary?.total_payments || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-blue-500">Reduces balance</p>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                    <p className="text-xs text-stone-600">Closing Balance</p>
                    <p className="text-lg font-bold text-stone-700">SAR {(ledgerData.summary?.closing_balance || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-stone-500">{ledgerData.entry_count || 0} entries</p>
                  </div>
                </div>

                {/* Ledger Entries Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-stone-100 px-3 py-2 text-xs font-medium grid grid-cols-14 gap-2">
                    <span className="col-span-2">Date</span>
                    <span className="col-span-2">Type</span>
                    <span className="col-span-2">Branch</span>
                    <span className="col-span-3">Description</span>
                    <span className="col-span-2 text-right">Debit</span>
                    <span className="col-span-1 text-right">Credit</span>
                    <span className="col-span-2 text-right">Balance</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {ledgerData.entries?.map((entry, idx) => (
                      <div key={idx} className={`px-3 py-2 text-xs grid grid-cols-14 gap-2 border-t ${
                        entry.type === 'purchase' ? 'bg-amber-50/30' : 'bg-blue-50/30'
                      }`} data-testid={`ledger-entry-${idx}`}>
                        <span className="col-span-2 text-muted-foreground">
                          {entry.date ? new Date(entry.date).toLocaleDateString() : '-'}
                        </span>
                        <span className="col-span-2">
                          <Badge variant="outline" className={`text-[10px] ${
                            entry.type === 'purchase'
                              ? entry.payment_mode === 'credit' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.type === 'purchase'
                              ? (entry.payment_mode === 'credit' ? 'Credit Purchase' : 'Paid Purchase')
                              : 'Payment'}
                          </Badge>
                        </span>
                        <span className="col-span-2">
                          <Badge variant="outline" className="text-[10px] bg-stone-100 text-stone-600">{entry.branch_name || '-'}</Badge>
                        </span>
                        <span className="col-span-3 truncate" title={entry.description}>{entry.description || '-'}</span>
                        <span className={`col-span-2 text-right font-medium ${entry.debit > 0 ? 'text-amber-600' : ''}`}>
                          {entry.debit > 0 ? `${entry.debit.toFixed(2)}` : ''}
                        </span>
                        <span className={`col-span-1 text-right font-medium ${entry.credit > 0 ? 'text-blue-600' : ''}`}>
                          {entry.credit > 0 ? `${entry.credit.toFixed(2)}` : ''}
                        </span>
                        <span className="col-span-2 text-right font-bold">{entry.balance?.toFixed(2)}</span>
                      </div>
                    ))}
                    {(!ledgerData.entries || ledgerData.entries.length === 0) && (
                      <div className="px-3 py-8 text-center text-muted-foreground">No transactions found</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Purchase Bill Dialog */}
        <Dialog open={showAddBillDialog} onOpenChange={setShowAddBillDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Receipt className="text-amber-500" /> Add Purchase Bill</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddBill} className="space-y-4">
              {/* Supplier info (pre-selected, changeable) */}
              <div>
                <Label>Supplier</Label>
                <Select value={payingSupplier?.id || "none"} onValueChange={(v) => {
                  const s = suppliers.find(sup => sup.id === v);
                  if (s) { setPayingSupplier(s); setBillData(prev => ({ ...prev, branch_id: s.branch_id || prev.branch_id })); }
                }}>
                  <SelectTrigger data-testid="bill-supplier-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Selection */}
              <div>
                <Label>Branch</Label>
                <Select value={billData.branch_id || "all"} onValueChange={(v) => setBillData({ ...billData, branch_id: v === "all" ? "" : v })}>
                  <SelectTrigger data-testid="bill-branch-select"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                <p className="font-medium text-amber-800">What is a Purchase Bill?</p>
                <p className="text-amber-700 text-xs mt-1">
                  A purchase bill is when you BUY goods from this supplier.
                  Choose <strong>Credit</strong> if you'll pay later (adds to balance),
                  or <strong>Cash/Bank</strong> if paid now.
                </p>
              </div>
              <div>
                <Label>Amount (SAR)</Label>
                <Input type="number" value={billData.amount} onChange={(e) => setBillData({ ...billData, amount: e.target.value })} placeholder="0.00" required className="text-lg font-bold" data-testid="bill-amount-input" />
              </div>
              <div>
                <Label>Payment Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['credit', 'cash', 'bank'].map(mode => (
                    <button key={mode} type="button" onClick={() => setBillData({ ...billData, payment_mode: mode })}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border ${
                        billData.payment_mode === mode
                          ? mode === 'credit' ? 'bg-amber-500 text-white border-amber-500'
                            : mode === 'cash' ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`} data-testid={`bill-mode-${mode}`}>
                      {mode === 'credit' && <Receipt size={14} className="inline mr-1" />}
                      {mode === 'cash' && <Banknote size={14} className="inline mr-1" />}
                      {mode === 'bank' && <CreditCard size={14} className="inline mr-1" />}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {billData.payment_mode === 'credit' ? 'Credit: Will add to supplier balance (pay later)' : 'Paid: No balance change'}
                </p>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={billData.category || "general"} onValueChange={(v) => setBillData({ ...billData, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supplier Purchase">Supplier Purchase</SelectItem>
                    <SelectItem value="Inventory">Inventory</SelectItem>
                    <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    {expenseCategories.map(c => (<SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input value={billData.description} onChange={(e) => setBillData({ ...billData, description: e.target.value })} placeholder="e.g., Invoice #1234" data-testid="bill-description-input" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600" data-testid="submit-bill-btn"><Receipt size={16} className="mr-1" /> Add Purchase Bill</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddBillDialog(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Share Statement Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="max-w-sm" data-testid="share-statement-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Send className="text-blue-500" size={18} /> Share Statement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send <strong>{ledgerSupplier?.name}</strong>'s statement via:
              </p>

              {/* Channel Selection */}
              <div className="flex gap-3">
                <button type="button" onClick={() => toggleShareChannel('email')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all text-center ${
                    shareData.channels.includes('email')
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`} data-testid="share-email-toggle">
                  <Mail size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Email</span>
                  <p className="text-[10px] mt-0.5">PDF attached</p>
                </button>
                <button type="button" onClick={() => toggleShareChannel('whatsapp')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all text-center ${
                    shareData.channels.includes('whatsapp')
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`} data-testid="share-whatsapp-toggle">
                  <MessageSquare size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">WhatsApp</span>
                  <p className="text-[10px] mt-0.5">Summary text</p>
                </button>
              </div>

              {/* Email Input */}
              {shareData.channels.includes('email') && (
                <div>
                  <Label className="text-xs">Email Address</Label>
                  <Input value={shareData.email} onChange={e => setShareData({ ...shareData, email: e.target.value })}
                    placeholder="supplier@example.com" type="email" data-testid="share-email-input" />
                </div>
              )}

              {/* Phone Input */}
              {shareData.channels.includes('whatsapp') && (
                <div>
                  <Label className="text-xs">WhatsApp Number (with country code)</Label>
                  <Input value={shareData.phone} onChange={e => setShareData({ ...shareData, phone: e.target.value })}
                    placeholder="+966512345678" data-testid="share-phone-input" />
                </div>
              )}

              <Button onClick={shareStatement} disabled={sharing || shareData.channels.length === 0}
                className="w-full" data-testid="send-statement-btn">
                {sharing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                {sharing ? 'Sending...' : 'Send Statement'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Migration Dialog */}
        <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600"><ArrowUpCircle /> Fix Payment Data - Convert to Purchase Bills</DialogTitle>
            </DialogHeader>
            {migrationPreview && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                  <p className="font-medium text-amber-800">What will happen?</p>
                  <p className="text-amber-700 mt-1">Your supplier payments will be converted to <strong>Purchase Bills (Expenses)</strong> with credit payment mode.</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{migrationPreview.total_payments}</p>
                      <p className="text-xs text-muted-foreground">Payments to Convert</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">SAR {migrationPreview.total_amount?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                    </div>
                  </div>
                </div>
                {migrationPreview.total_payments > 0 ? (
                  <>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <div className="p-2 bg-stone-100 text-xs font-medium sticky top-0">By Supplier</div>
                      {Object.entries(migrationPreview.by_supplier || {}).map(([name, data]) => (
                        <div key={name} className="px-3 py-2 border-t flex justify-between text-sm">
                          <span>{name}</span>
                          <span className="text-muted-foreground">{data.count} entries - SAR {data.total?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={executeMigration} disabled={migrating} className="flex-1 bg-amber-500 hover:bg-amber-600">
                        {migrating ? 'Converting...' : 'Convert to Purchase Bills'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowMigrateDialog(false)}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No payments to migrate!</p>
                    <p className="text-xs mt-1">All data is already correct.</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
