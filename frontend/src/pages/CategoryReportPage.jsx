import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function CategoryReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

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
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const totalExpenses = reportData.reduce((sum, c) => sum + c.total_expenses, 0);
  const totalPaid = reportData.reduce((sum, c) => sum + c.total_paid, 0);
  const totalCredit = reportData.reduce((sum, c) => sum + c.total_credit, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="category-report-title">Category Report</h1>
          <p className="text-muted-foreground">Supplier category-wise breakdown of expenses and payments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Category Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-error" data-testid="total-category-expenses">${totalExpenses.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-success" data-testid="total-category-paid">${totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding Credit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-warning" data-testid="total-category-credit">${totalCredit.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Category Breakdown</CardTitle>
          </CardHeader>
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
                  {reportData.map((category) => (
                    <tr key={category.category} className="border-b border-border hover:bg-secondary/50" data-testid="category-report-row">
                      <td className="p-3 text-sm font-medium">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {category.category}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary">{category.supplier_count}</Badge>
                      </td>
                      <td className="p-3 text-sm text-right font-medium text-error">${category.total_expenses.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-success">${category.total_paid.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-bold text-warning">${category.total_credit.toFixed(2)}</td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No category data available. Add categories to suppliers first.
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
