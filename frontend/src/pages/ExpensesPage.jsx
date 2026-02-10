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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [branches, setBranches] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [formData, setFormData] = useState({
    category: 'salary',
    sub_category: '',
    description: '',
    amount: '',
    payment_mode: 'cash',
    branch_id: '',
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });

  const defaultCategories = [
    { value: 'salary', label: 'Salary' },
    { value: 'rent', label: 'Rent' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'vat', label: 'VAT' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'supplier', label: 'Supplier Expense' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expensesRes, suppliersRes, categoriesRes, branchesRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/suppliers'),
        api.get('/categories?category_type=expense'),
        api.get('/branches'),
      ]);
      setExpenses(expensesRes.data);
      setSuppliers(suppliersRes.data);
      setCustomCategories(categoriesRes.data);
      setBranches(branchesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const allCategories = [
    ...defaultCategories,
    ...customCategories.filter(c => !defaultCategories.find(d => d.value === c.name.toLowerCase())).map(c => ({ value: c.name.toLowerCase(), label: c.name }))
  ];

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await api.post('/categories', { name: newCategory.trim(), type: 'expense' });
      toast.success('Category added');
      setNewCategory('');
      const res = await api.get('/categories?category_type=expense');
      setCustomCategories(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add category');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        supplier_id: formData.supplier_id || null,
        branch_id: formData.branch_id || null,
        date: new Date(formData.date).toISOString(),
      };
      await api.post('/expenses', payload);
      toast.success('Expense added successfully');
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add expense');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'salary',
      description: '',
      amount: '',
      payment_mode: 'cash',
      branch_id: '',
      supplier_id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await api.delete(`/expenses/${id}`);
        toast.success('Expense deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete expense');
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

  const isSupplierCategory = formData.category === 'supplier';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="expenses-page-title">Expenses</h1>
            <p className="text-muted-foreground">Track business expenses and supplier costs</p>
          </div>
          <div className="flex gap-3 items-center">
            <DateFilter onFilterChange={setDateFilter} />
            <ExportButtons dataType="expenses" />
            <Button
            onClick={() => setShowForm(!showForm)}
            data-testid="add-expense-button"
            className="rounded-full"
          >
            <Plus size={18} className="mr-2" />
            Add Expense
          </Button>
          </div>
        </div>

        {showForm && (
          <Card className="border-border" data-testid="expense-form-card">
            <CardHeader>
              <CardTitle className="font-outfit">Add Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val, supplier_id: '' })}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category"
                        className="h-8 text-xs"
                        data-testid="new-expense-category-input"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={handleAddCategory} className="h-8 text-xs whitespace-nowrap" data-testid="add-expense-category-button">
                        <Plus size={12} className="mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {isSupplierCategory && (
                    <div>
                      <Label>Supplier *</Label>
                      <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })} required={isSupplierCategory}>
                        <SelectTrigger data-testid="supplier-select">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className={isSupplierCategory ? '' : 'md:col-span-2'}>
                    <Label>Description *</Label>
                    <Input
                      value={formData.description}
                      data-testid="description-input"
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      placeholder="e.g., Office rent for January"
                    />
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
                        {isSupplierCategory && <SelectItem value="credit">Credit</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Branch (cash/bank from)</Label>
                    <Select value={formData.branch_id || "all"} onValueChange={(val) => setFormData({ ...formData, branch_id: val === "all" ? "" : val })}>
                      <SelectTrigger data-testid="expense-branch-select">
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

                  <div>
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
                  <Button type="submit" data-testid="submit-expense-button" className="rounded-full">Add Expense</Button>
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
            <CardTitle className="font-outfit">All Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="expenses-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Category</th>
                    <th className="text-left p-3 font-medium text-sm">Description</th>
                    <th className="text-left p-3 font-medium text-sm">Supplier</th>
                    <th className="text-right p-3 font-medium text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-sm">Payment</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter(e => {
                    if (dateFilter.start && dateFilter.end) {
                      const d = new Date(e.date);
                      return d >= dateFilter.start && d <= dateFilter.end;
                    }
                    return true;
                  }).map((expense) => {
                    const supplierName = suppliers.find((s) => s.id === expense.supplier_id)?.name || '-';
                    return (
                      <tr key={expense.id} className="border-b border-border hover:bg-secondary/50" data-testid="expense-row">
                        <td className="p-3 text-sm">{format(new Date(expense.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary capitalize">
                            {expense.category}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{expense.description}</td>
                        <td className="p-3 text-sm">{supplierName}</td>
                        <td className="p-3 text-sm text-right font-medium">${expense.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPaymentBadgeClass(expense.payment_mode)}`}>
                            {expense.payment_mode}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(expense.id)}
                            data-testid="delete-expense-button"
                            className="h-8 text-error hover:text-error"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No expenses recorded yet. Add your first expense above!
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
