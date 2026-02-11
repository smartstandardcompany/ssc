import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
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
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', credit_limit: 0 });
  const [paymentData, setPaymentData] = useState({ payment_mode: 'cash', amount: '', branch_id: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppliersRes, branchesRes, categoriesRes, summariesRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/branches'),
        api.get('/categories?category_type=supplier'),
        api.get('/suppliers/payment-summaries'),
      ]);
      setSuppliers(suppliersRes.data);
      setBranches(branchesRes.data);
      setCategories(categoriesRes.data);
      setPaySummaries(summariesRes.data);
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

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      category: supplier.category || '',
      sub_category: supplier.sub_category || '',
      branch_id: supplier.branch_id || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      credit_limit: supplier.credit_limit || 0
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
    setFormData({ name: '', category: '', sub_category: '', branch_id: '', phone: '', email: '', credit_limit: 0 });
    setEditingSupplier(null);
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
                          <div className="text-sm font-bold text-cash">${paySummaries[supplier.id].cash.toFixed(2)}</div>
                        </div>
                        <div className="flex-1 p-2 bg-bank/10 rounded text-center">
                          <div className="text-xs text-muted-foreground">Bank Paid</div>
                          <div className="text-sm font-bold text-bank">${paySummaries[supplier.id].bank.toFixed(2)}</div>
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
                      <span className="text-sm font-bold">${supplier.current_credit?.toFixed(2) || '0.00'} / ${supplier.credit_limit?.toFixed(2) || '0.00'}</span>
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

                  {supplier.current_credit > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setPayingSupplier(supplier); setShowPayDialog(true); }}
                      data-testid="pay-credit-button"
                      className="w-full mt-2"
                    >
                      <DollarSign size={14} className="mr-1" />
                      Pay Credit
                    </Button>
                  )}
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
                  Current Credit: <span className="font-bold text-error">${payingSupplier?.current_credit?.toFixed(2)}</span>
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
      </div>
    </DashboardLayout>
  );
}
