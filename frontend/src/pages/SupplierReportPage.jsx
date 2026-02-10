import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, CreditCard, Receipt } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SupplierReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const response = await api.get('/reports/suppliers');
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to fetch supplier report');
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

  const totalExpenses = reportData.reduce((sum, s) => sum + s.total_expenses, 0);
  const totalPaid = reportData.reduce((sum, s) => sum + s.total_paid, 0);
  const totalCredit = reportData.reduce((sum, s) => sum + s.current_credit, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="supplier-report-title">Supplier Report</h1>
          <p className="text-muted-foreground">Track supplier expenses, payments, and outstanding credit</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-primary" data-testid="total-suppliers">{reportData.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-error" data-testid="total-supplier-expenses">${totalExpenses.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-success" data-testid="total-supplier-paid">${totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Credit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-warning" data-testid="total-outstanding-credit">${totalCredit.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Supplier Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="supplier-report-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Supplier</th>
                    <th className="text-left p-3 font-medium text-sm">Category</th>
                    <th className="text-right p-3 font-medium text-sm">Total Expenses</th>
                    <th className="text-right p-3 font-medium text-sm">Total Paid</th>
                    <th className="text-right p-3 font-medium text-sm">Current Credit</th>
                    <th className="text-right p-3 font-medium text-sm">Credit Limit</th>
                    <th className="text-center p-3 font-medium text-sm">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-border hover:bg-secondary/50" data-testid="supplier-report-row">
                      <td className="p-3 text-sm font-medium">{supplier.name}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {supplier.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-right font-medium text-error">${supplier.total_expenses.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-success">${supplier.total_paid.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-bold text-warning">${supplier.current_credit.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">${supplier.credit_limit.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary">{supplier.transaction_count}</Badge>
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No supplier data available
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
