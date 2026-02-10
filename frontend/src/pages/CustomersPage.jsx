import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', branch_id: '', phone: '', email: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, branchesRes] = await Promise.all([
        api.get('/customers'),
        api.get('/branches'),
      ]);
      setCustomers(customersRes.data);
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
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
        toast.success('Customer updated successfully');
      } else {
        await api.post('/customers', formData);
        toast.success('Customer added successfully');
      }
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save customer');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, branch_id: customer.branch_id || '', phone: customer.phone || '', email: customer.email || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await api.delete(`/customers/${id}`);
        toast.success('Customer deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete customer');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', branch_id: '', phone: '', email: '' });
    setEditingCustomer(null);
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
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="customers-page-title">Customers</h1>
            <p className="text-muted-foreground">Manage your online sales customers</p>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="add-customer-button">
                <Plus size={18} className="mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="customer-dialog" aria-describedby="customer-dialog-description">
              <DialogHeader>
                <DialogTitle className="font-outfit">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    value={formData.name}
                    data-testid="customer-name-input"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Select value={formData.branch_id} onValueChange={(val) => setFormData({ ...formData, branch_id: val })}>
                    <SelectTrigger data-testid="customer-branch-select">
                      <SelectValue placeholder="All branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Branches</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for all branches</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    data-testid="customer-phone-input"
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., +1 234 567 8900"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    data-testid="customer-email-input"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., john@example.com"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" data-testid="submit-customer-button" className="rounded-full">
                    {editingCustomer ? 'Update' : 'Add'} Customer
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">All Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="customers-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Name</th>
                    <th className="text-left p-3 font-medium text-sm">Branch</th>
                    <th className="text-left p-3 font-medium text-sm">Phone</th>
                    <th className="text-left p-3 font-medium text-sm">Email</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const branchName = branches.find((b) => b.id === customer.branch_id)?.name || 'All Branches';
                    return (
                      <tr key={customer.id} className="border-b border-border hover:bg-secondary/50" data-testid="customer-row">
                        <td className="p-3 text-sm font-medium">{customer.name}</td>
                        <td className="p-3 text-sm">{branchName}</td>
                        <td className="p-3 text-sm">{customer.phone || '-'}</td>
                        <td className="p-3 text-sm">{customer.email || '-'}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(customer)}
                            data-testid="edit-customer-button"
                            className="h-8"
                          >
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(customer.id)}
                            data-testid="delete-customer-button"
                            className="h-8 text-error hover:text-error"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        No customers yet. Add your first customer above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
