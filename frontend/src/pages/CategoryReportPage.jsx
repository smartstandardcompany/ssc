import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ExportButtons } from '@/components/ExportButtons';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#7C3AED', '#0EA5E9', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

export default function CategoryReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    try {
      const response = await api.get('/reports/supplier-categories');
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to fetch category report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>);
  }

  const totalExpenses = reportData.reduce((sum, c) => sum + c.total_expenses, 0);
  const totalPaid = reportData.reduce((sum, c) => sum + c.total_paid, 0);
  const totalCredit = reportData.reduce((sum, c) => sum + c.total_credit, 0);

  const barData = reportData.filter(c => c.total_expenses > 0 || c.total_paid > 0).map(c => ({
    name: c.category.length > 12 ? c.category.slice(0, 12) + '...' : c.category,
    Expenses: c.total_expenses,
    Paid: c.total_paid,
    Credit: c.total_credit,
  }));

  const pieData = reportData.filter(c => c.total_expenses > 0).map(c => ({ name: c.category, value: c.total_expenses }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="category-report-title">Category Report</h1>
            <p className="text-muted-foreground">Supplier category breakdown with charts</p>
          </div>
          <ExportButtons dataType="suppliers" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Category Expenses</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-error">${totalExpenses.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-success">${totalPaid.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Credit</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-warning">${totalCredit.toFixed(2)}</div></CardContent></Card>
        </div>

        {barData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Category-wise Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Paid" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Credit" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Expense Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">Category Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="category-report-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Category</th>
                    <th className="text-center p-3 font-medium text-sm">Suppliers</th>
                    <th className="text-right p-3 font-medium text-sm">Total Expenses</th>
                    <th className="text-right p-3 font-medium text-sm">Total Paid</th>
                    <th className="text-right p-3 font-medium text-sm">Outstanding Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((cat) => (
                    <tr key={cat.category} className="border-b border-border hover:bg-secondary/50" data-testid="category-report-row">
                      <td className="p-3 text-sm font-medium"><span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{cat.category}</span></td>
                      <td className="p-3 text-center"><Badge variant="secondary">{cat.supplier_count}</Badge></td>
                      <td className="p-3 text-sm text-right font-medium text-error">${cat.total_expenses.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-success">${cat.total_paid.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-bold text-warning">${cat.total_credit.toFixed(2)}</td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No category data available</td></tr>
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
