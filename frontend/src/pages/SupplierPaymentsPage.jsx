import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { DateFilter } from '@/components/DateFilter';

export default function SupplierPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: '',
    amount: '',
    payment_mode: 'cash',
    branch_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, suppliersRes, branchesRes] = await Promise.all([
        api.get('/supplier-payments'),
        api.get('/suppliers'),
        api.get('/branches'),
      ]);
      setPayments(paymentsRes.data);
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
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        branch_id: formData.branch_id || null,
        date: new Date(formData.date).toISOString(),
      };
      await api.post('/supplier-payments', payload);
      toast.success('Supplier payment added successfully');
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add payment');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      amount: '',
      payment_mode: 'cash',
      branch_id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await api.delete(`/supplier-payments/${id}`);
        toast.success('Payment deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete payment');
      }
    }
  };

  const getPaymentBadgeClass = (mode) => {
    switch (mode) {
      case 'cash':
        return 'bg-cash/20 text-cash border-cash/30';
      case 'bank':
        return 'bg-bank/20 text-bank border-bank/30';
      case 'credit':
        return 'bg-credit/20 text-credit border-credit/30';
      default:
        return 'bg-secondary text-secondary-foreground';
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
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="supplier-payments-page-title">Supplier Payments</h1>
            <p className="text-muted-foreground">Track payments made to suppliers</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <DateFilter onFilterChange={setDateFilter} />
            <ExportButtons dataType="supplier-payments" />
            <Button
            onClick={() => setShowForm(!showForm)}
            data-testid="add-payment-button"
            className="rounded-full"
          >
            <Plus size={18} className="mr-2" />
            Add Payment
          </Button>
          </div>
        </div>

        {showForm && (
          <Card className="border-border" data-testid="payment-form-card">
            <CardHeader>
              <CardTitle className="font-outfit">Add Supplier Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })} required>
                      <SelectTrigger data-testid="supplier-select">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} {supplier.current_credit > 0 && `(Credit: $${supplier.current_credit.toFixed(2)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      data-testid="amount-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label>Payment Mode *</Label>
                    <Select value={formData.payment_mode} onValueChange={(val) => setFormData({ ...formData, payment_mode: val })}>
                      <SelectTrigger data-testid="payment-mode-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>From Branch</Label>
                    <Select value={formData.branch_id || "all"} onValueChange={(val) => setFormData({ ...formData, branch_id: val === "all" ? "" : val })}>
                      <SelectTrigger data-testid="sp-branch-select">
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

                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      data-testid="date-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      data-testid="notes-input"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button type="submit" data-testid="submit-payment-button" className="rounded-full">Add Payment</Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-full">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">All Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="payments-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Supplier</th>
                    <th className="text-right p-3 font-medium text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-sm">Payment Mode</th>
                    <th className="text-left p-3 font-medium text-sm">Notes</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => {
                    if (dateFilter.start && dateFilter.end) {
                      const d = new Date(p.date);
                      return d >= dateFilter.start && d <= dateFilter.end;
                    }
                    return true;
                  }).map((payment) => (
                    <tr key={payment.id} className="border-b border-border hover:bg-secondary/50" data-testid="payment-row">
                      <td className="p-3 text-sm">{format(new Date(payment.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-sm font-medium">{payment.supplier_name}</td>
                      <td className="p-3 text-sm text-right font-medium">${payment.amount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPaymentBadgeClass(payment.payment_mode)}`}>
                          {payment.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{payment.notes || '-'}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(payment.id)}
                          data-testid="delete-payment-button"
                          className="h-8 text-error hover:text-error"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No supplier payments recorded yet. Add your first payment above!
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
