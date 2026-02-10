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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: '', branch_id: '', phone: '', email: '', credit_limit: 0 });
  const [paymentData, setPaymentData] = useState({ payment_mode: 'cash', amount: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppliersRes, branchesRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/branches'),
      ]);
      setSuppliers(suppliersRes.data);
      setBranches(branchesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

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
      setPaymentData({ payment_mode: 'cash', amount: '' });
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
    setFormData({ name: '', branch_id: '', phone: '', email: '', credit_limit: 0 });
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
                  <Label>Branch</Label>
                  <Select value={formData.branch_id} onValueChange={(val) => setFormData({ ...formData, branch_id: val })}>
                    <SelectTrigger data-testid="branch-select">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Branch</SelectItem>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((supplier) => {
            const branchName = branches.find((b) => b.id === supplier.branch_id)?.name || 'All Branches';
            const creditUtilization = supplier.credit_limit > 0 ? (supplier.current_credit / supplier.credit_limit) * 100 : 0;
            
            return (
              <Card key={supplier.id} className="border-border hover:shadow-lg transition-shadow" data-testid="supplier-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="font-outfit text-lg">{supplier.name}</CardTitle>
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
                  {supplier.email && <p className="text-sm">Email: {supplier.email}</p>}
                  
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
