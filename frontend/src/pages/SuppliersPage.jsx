import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign, FileText, ArrowUpCircle, ArrowDownCircle, Receipt, CreditCard, Banknote } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExportButtons } from '@/components/ExportButtons';
import { BranchFilter } from '@/components/BranchFilter';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branchFilter, setBranchFilter] = useState([]);
  const [paySummaries, setPaySummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [showAddBillDialog, setShowAddBillDialog] = useState(false);
  const [billData, setBillData] = useState({ amount: '', category: '', payment_mode: 'credit', description: '' });
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', account_number: '', credit_limit: 0 });
  const [paymentData, setPaymentData] = useState({ payment_mode: 'cash', amount: '', branch_id: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppliersRes, branchesRes, categoriesRes, summariesRes, expCatRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/branches'),
        api.get('/categories?category_type=supplier'),
        api.get('/suppliers/payment-summaries'),
        api.get('/categories?category_type=expense').catch(() => ({ data: [] })),
      ]);
      setSuppliers(suppliersRes.data);
      setBranches(branchesRes.data);
      setCategories(categoriesRes.data);
      setPaySummaries(summariesRes.data);
      setExpenseCategories(expCatRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await api.post('/categories', { name: newCategory.trim(), type: 'supplier' });
      toast.success('Category added');
      setNewCategory('');
      const res = await api.get('/categories?category_type=supplier');
      setCategories(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add category');
    }
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
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const subCategories = categories.filter(c => {
    const parent = categories.find(p => p.name === formData.category && !p.parent_id);
    return c.parent_id && parent && c.parent_id === parent.id;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, formData);
        toast.success('Supplier updated successfully');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Supplier added successfully');
      }
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save supplier');
    }
  };

  const handlePayCredit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/suppliers/${payingSupplier.id}/pay-credit`, paymentData);
      toast.success('Credit payment recorded');
      setShowPayDialog(false);
      setPaymentData({ payment_mode: 'cash', amount: '', branch_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    }
  };

  const viewLedger = async (supplier) => {
    setLedgerLoading(true);
    setShowLedgerDialog(true);
    try {
      const res = await api.get(`/suppliers/${supplier.id}/ledger`);
      setLedgerData(res.data);
    } catch (error) {
      toast.error('Failed to load supplier ledger');
      setShowLedgerDialog(false);
    } finally {
      setLedgerLoading(false);
    }
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
        branch_id: payingSupplier.branch_id || '',
        date: new Date().toISOString(),
      });
      
      const modeText = billData.payment_mode === 'credit' ? 'Credit bill added to balance' : 'Cash/Bank bill recorded';
      toast.success(`Purchase bill recorded! ${modeText}`);
      setShowAddBillDialog(false);
      setBillData({ amount: '', category: '', payment_mode: 'credit', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add purchase bill');
    }
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
      account_number: supplier.account_number || '', credit_limit: supplier.credit_limit || 0
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        toast.success('Supplier deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete supplier');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', account_number: '', credit_limit: 0 });
    setEditingSupplier(null);
  };

  const [showMigrateDialog, setShowMigrateDialog] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const previewMigration = async () => {
    try {
      const res = await api.get('/suppliers/migration-preview');
      setMigrationPreview(res.data);
      setShowMigrateDialog(true);
    } catch (error) {
      toast.error('Failed to preview migration');
    }
  };

  const executeMigration = async () => {
    setMigrating(true);
    try {
      const res = await api.post('/suppliers/migrate-payments-to-bills');
      toast.success(res.data.message);
      setShowMigrateDialog(false);
      setMigrationPreview(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="suppliers-page-title">Suppliers</h1>
            <p className="text-muted-foreground">Manage suppliers and track credit</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <ExportButtons dataType="suppliers" />
            
            {/* Migration Button */}
            <Button 
              variant="outline" 
              onClick={previewMigration}
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
              data-testid="migrate-payments-btn"
            >
              <ArrowUpCircle size={16} className="mr-1" />
              Fix Payment Data
            </Button>
            
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="add-supplier-button">
                <Plus size={18} className="mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="supplier-dialog" aria-describedby="supplier-dialog-description">
              <DialogHeader>
                <DialogTitle className="font-outfit">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Supplier Name *</Label>
                  <Input
                    value={formData.name}
                    data-testid="supplier-name-input"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={formData.category || "none"} onValueChange={(val) => setFormData({ ...formData, category: val === "none" ? "" : val })}>
                    <SelectTrigger data-testid="supplier-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.filter(c => !c.parent_id).map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="New category name"
                      className="h-8 text-xs"
                      data-testid="new-category-input"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={handleAddCategory} className="h-8 text-xs whitespace-nowrap" data-testid="add-category-button">
                      <Plus size={12} className="mr-1" />
                      Add
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
                    <SelectTrigger data-testid="branch-select">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    data-testid="supplier-phone-input"
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    data-testid="supplier-email-input"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bank Account #</Label>
                  <Input value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} placeholder="For bank statement matching" />
                </div>
                <div>
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    data-testid="credit-limit-input"
                    onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" data-testid="submit-supplier-button" className="rounded-full">
                    {editingSupplier ? 'Update' : 'Add'} Supplier
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.filter(s => branchFilter.length === 0 || branchFilter.includes(s.branch_id) || !s.branch_id).map((supplier) => {
            const branchName = branches.find((b) => b.id === supplier.branch_id)?.name || 'All Branches';
            const creditUtilization = supplier.credit_limit > 0 ? (supplier.current_credit / supplier.credit_limit) * 100 : 0;
            
            return (
              <Card key={supplier.id} className="border-border hover:shadow-lg transition-shadow" data-testid="supplier-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="font-outfit text-lg">{supplier.name}</CardTitle>
                      {supplier.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {supplier.category}
                        </span>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">{branchName}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(supplier)}
                        data-testid="edit-supplier-button"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(supplier.id)}
                        data-testid="delete-supplier-button"
                        className="text-error hover:text-error"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supplier.phone && <p className="text-sm">Phone: {supplier.phone}</p>}
                  
                  {/* Cash/Bank Paid Breakdown */}
                  {paySummaries[supplier.id] && (paySummaries[supplier.id].cash > 0 || paySummaries[supplier.id].bank > 0) && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1 p-2 bg-cash/10 rounded text-center">
                          <div className="text-xs text-muted-foreground">Cash Paid</div>
                          <div className="text-sm font-bold text-cash"> SAR {paySummaries[supplier.id].cash.toFixed(2)}</div>
                        </div>
                        <div className="flex-1 p-2 bg-bank/10 rounded text-center">
                          <div className="text-xs text-muted-foreground">Bank Paid</div>
                          <div className="text-sm font-bold text-bank"> SAR {paySummaries[supplier.id].bank.toFixed(2)}</div>
                        </div>
                      </div>
                      {Object.keys(paySummaries[supplier.id].by_branch || {}).length > 0 && (
                        <div className="space-y-1">
                          {Object.entries(paySummaries[supplier.id].by_branch).map(([bName, bData]) => (
                            <div key={bName} className="flex justify-between text-xs p-1.5 bg-secondary/50 rounded">
                              <span className="font-medium">{bName}</span>
                              <span><span className="text-cash">C:${bData.cash.toFixed(0)}</span> <span className="text-bank">B:${bData.bank.toFixed(0)}</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Credit Status</span>
                      <span className="text-sm font-bold"> SAR {supplier.current_credit?.toFixed(2) || '0.00'} / ${supplier.credit_limit?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          creditUtilization > 80 ? 'bg-error' : creditUtilization > 50 ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {/* Add Purchase Bill */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { 
                        setPayingSupplier(supplier); 
                        setShowAddBillDialog(true);
                        setBillData({ amount: '', category: '', payment_mode: 'credit', description: '' });
                      }}
                      data-testid={`add-bill-${supplier.id}`}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <Receipt size={14} className="mr-1" />
                      Add Bill
                    </Button>
                    
                    {/* Pay Credit */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setPayingSupplier(supplier); setShowPayDialog(true); }}
                      data-testid="pay-credit-button"
                      className={`${supplier.current_credit > 0 ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-stone-400 border-stone-200'}`}
                      disabled={!supplier.current_credit || supplier.current_credit <= 0}
                    >
                      <DollarSign size={14} className="mr-1" />
                      Pay Credit
                    </Button>
                  </div>
                  
                  {/* View Ledger Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => viewLedger(supplier)}
                    data-testid={`view-ledger-${supplier.id}`}
                    className="w-full mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <FileText size={14} className="mr-1" />
                    View Ledger (Invoices & Payments)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {suppliers.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No suppliers yet. Add your first supplier to get started!</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pay Credit Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent data-testid="pay-credit-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">Pay Supplier Credit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePayCredit} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Paying to: <span className="font-medium text-foreground">{payingSupplier?.name}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Current Credit: <span className="font-bold text-error"> SAR {payingSupplier?.current_credit?.toFixed(2)}</span>
                </p>
              </div>
              <div>
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  data-testid="payment-amount-input"
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  required
                  max={payingSupplier?.current_credit}
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={paymentData.payment_mode} onValueChange={(val) => setPaymentData({ ...paymentData, payment_mode: val })}>
                  <SelectTrigger data-testid="payment-mode-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>From Branch</Label>
                <Select value={paymentData.branch_id || "all"} onValueChange={(val) => setPaymentData({ ...paymentData, branch_id: val === "all" ? "" : val })}>
                  <SelectTrigger data-testid="pay-branch-select">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">No Branch</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-payment-button" className="rounded-full">Pay Credit</Button>
                <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)} className="rounded-full">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Supplier Ledger Dialog */}
        <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="text-blue-500" />
                {ledgerData?.supplier_name} - Ledger
              </DialogTitle>
            </DialogHeader>
            
            {ledgerLoading ? (
              <div className="flex items-center justify-center py-8">Loading...</div>
            ) : ledgerData && (
              <div className="flex-1 overflow-auto space-y-4">
                {/* Current Balance */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Credit Balance</p>
                    <p className="text-3xl font-bold text-blue-600">SAR {ledgerData.current_balance?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <p className="text-xs text-amber-600">Credit Purchases</p>
                    <p className="text-lg font-bold text-amber-700">SAR {ledgerData.summary?.total_purchases_credit?.toFixed(0) || 0}</p>
                    <p className="text-[10px] text-amber-500">Adds to balance</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                    <p className="text-xs text-emerald-600">Cash/Bank Purchases</p>
                    <p className="text-lg font-bold text-emerald-700">SAR {ledgerData.summary?.total_purchases_cash?.toFixed(0) || 0}</p>
                    <p className="text-[10px] text-emerald-500">Paid immediately</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-xs text-blue-600">Credit Paid</p>
                    <p className="text-lg font-bold text-blue-700">SAR {ledgerData.summary?.total_credit_paid?.toFixed(0) || 0}</p>
                    <p className="text-[10px] text-blue-500">Reduces balance</p>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                    <p className="text-xs text-stone-600">Total Invoices</p>
                    <p className="text-lg font-bold text-stone-700">{ledgerData.summary?.purchase_invoices_count || 0}</p>
                    <p className="text-[10px] text-stone-500">Payments: {ledgerData.summary?.payments_count || 0}</p>
                  </div>
                </div>

                {/* Transaction Legend */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                    <ArrowUpCircle size={12} className="mr-1" /> Credit Invoice = +Balance
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    <Receipt size={12} className="mr-1" /> Cash Invoice = Paid
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    <ArrowDownCircle size={12} className="mr-1" /> Payment = -Balance
                  </Badge>
                </div>

                {/* Transactions List */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-stone-100 px-3 py-2 text-xs font-medium grid grid-cols-12 gap-2">
                    <span className="col-span-2">Date</span>
                    <span className="col-span-3">Type</span>
                    <span className="col-span-4">Description</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-1 text-center">Mode</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {ledgerData.transactions?.map((txn, idx) => (
                      <div 
                        key={txn.id || idx} 
                        className={`px-3 py-2 text-xs grid grid-cols-12 gap-2 border-t ${
                          txn.type === 'purchase_invoice' 
                            ? txn.sub_type === 'credit' ? 'bg-amber-50/50' : 'bg-emerald-50/50'
                            : txn.type === 'credit_payment' ? 'bg-blue-50/50' : 'bg-stone-50'
                        }`}
                      >
                        <span className="col-span-2 text-muted-foreground">
                          {txn.date ? new Date(txn.date).toLocaleDateString() : '-'}
                        </span>
                        <span className="col-span-3">
                          {txn.type === 'purchase_invoice' && (
                            <Badge variant="outline" className={`text-[10px] ${txn.sub_type === 'credit' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {txn.sub_type === 'credit' ? 'Credit Invoice' : 'Cash Invoice'}
                            </Badge>
                          )}
                          {txn.type === 'credit_payment' && (
                            <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700">
                              Credit Payment
                            </Badge>
                          )}
                          {txn.type === 'credit_addition' && (
                            <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700">
                              Credit Added
                            </Badge>
                          )}
                        </span>
                        <span className="col-span-4 truncate" title={txn.description}>
                          {txn.description || txn.category || '-'}
                        </span>
                        <span className={`col-span-2 text-right font-medium ${
                          txn.type === 'credit_payment' ? 'text-blue-600' : 
                          txn.sub_type === 'credit' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {txn.type === 'credit_payment' ? '-' : ''}SAR {txn.amount?.toFixed(2)}
                        </span>
                        <span className="col-span-1 text-center">
                          {txn.payment_mode === 'cash' && <Banknote size={14} className="inline text-emerald-500" />}
                          {txn.payment_mode === 'bank' && <CreditCard size={14} className="inline text-blue-500" />}
                          {txn.payment_mode === 'credit' && <Receipt size={14} className="inline text-amber-500" />}
                        </span>
                      </div>
                    ))}
                    {(!ledgerData.transactions || ledgerData.transactions.length === 0) && (
                      <div className="px-3 py-8 text-center text-muted-foreground">
                        No transactions found for this supplier
                      </div>
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
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="text-amber-500" />
                Add Purchase Bill - {payingSupplier?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddBill} className="space-y-4">
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
                <Input
                  type="number"
                  value={billData.amount}
                  onChange={(e) => setBillData({ ...billData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                  className="text-lg font-bold"
                />
              </div>
              
              <div>
                <Label>Payment Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['credit', 'cash', 'bank'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBillData({ ...billData, payment_mode: mode })}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all border ${
                        billData.payment_mode === mode
                          ? mode === 'credit' ? 'bg-amber-500 text-white border-amber-500'
                            : mode === 'cash' ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {mode === 'credit' && <Receipt size={14} className="inline mr-1" />}
                      {mode === 'cash' && <Banknote size={14} className="inline mr-1" />}
                      {mode === 'bank' && <CreditCard size={14} className="inline mr-1" />}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {billData.payment_mode === 'credit' 
                    ? '⚠️ Credit: Will add to supplier balance (pay later)' 
                    : '✅ Paid: No balance change'}
                </p>
              </div>
              
              <div>
                <Label>Category</Label>
                <Select value={billData.category || "general"} onValueChange={(v) => setBillData({ ...billData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supplier Purchase">Supplier Purchase</SelectItem>
                    <SelectItem value="Inventory">Inventory</SelectItem>
                    <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id || c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={billData.description}
                  onChange={(e) => setBillData({ ...billData, description: e.target.value })}
                  placeholder="e.g., Invoice #1234"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600">
                  <Receipt size={16} className="mr-1" />
                  Add Purchase Bill
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddBillDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Migration Dialog */}
        <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <ArrowUpCircle />
                Fix Payment Data - Convert to Purchase Bills
              </DialogTitle>
            </DialogHeader>
            
            {migrationPreview && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                  <p className="font-medium text-amber-800">What will happen?</p>
                  <p className="text-amber-700 mt-1">
                    Your supplier payments will be converted to <strong>Purchase Bills (Expenses)</strong> with credit payment mode.
                    This fixes the data so balances calculate correctly.
                  </p>
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
                          <span className="text-muted-foreground">{data.count} entries • SAR {data.total?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        onClick={executeMigration} 
                        disabled={migrating}
                        className="flex-1 bg-amber-500 hover:bg-amber-600"
                      >
                        {migrating ? 'Converting...' : 'Convert to Purchase Bills'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowMigrateDialog(false)}>
                        Cancel
                      </Button>
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
