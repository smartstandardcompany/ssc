import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CreditReportPage() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const response = await api.get('/reports/credit-sales');
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to fetch credit report');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/20 text-success border-success/30">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Partial</Badge>;
      default:
        return <Badge className="bg-error/20 text-error border-error/30">Pending</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="credit-report-title">Credit Sales Report</h1>
          <p className="text-muted-foreground">Track credit sales, received payments, and outstanding balances</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border bg-gradient-to-br from-credit/10 to-credit/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Credit Given</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-credit" data-testid="total-credit-given">
                ${reportData?.summary?.total_credit_given?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-success/10 to-success/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Amount Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-success" data-testid="total-credit-received">
                ${reportData?.summary?.total_credit_received?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-gradient-to-br from-error/10 to-error/5">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-error" data-testid="total-credit-remaining">
                ${reportData?.summary?.total_credit_remaining?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Credit Sales Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Credit Sales Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="credit-sales-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Type</th>
                    <th className="text-left p-3 font-medium text-sm">Branch/Customer</th>
                    <th className="text-right p-3 font-medium text-sm">Total</th>
                    <th className="text-right p-3 font-medium text-sm">Credit Given</th>
                    <th className="text-right p-3 font-medium text-sm">Received</th>
                    <th className="text-right p-3 font-medium text-sm">Remaining</th>
                    <th className="text-center p-3 font-medium text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.credit_sales?.map((sale) => (
                    <tr key={sale.id} className="border-b border-border hover:bg-secondary/50" data-testid="credit-sale-row">
                      <td className="p-3 text-sm">{format(new Date(sale.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-sm capitalize">{sale.sale_type}</td>
                      <td className="p-3 text-sm">{sale.reference}</td>
                      <td className="p-3 text-sm text-right font-medium">${sale.total_amount.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-credit font-bold">${sale.credit_given.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-success">${sale.credit_received.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-error font-bold">${sale.remaining.toFixed(2)}</td>
                      <td className="p-3 text-center">{getStatusBadge(sale.status)}</td>
                    </tr>
                  ))}
                  {(!reportData?.credit_sales || reportData.credit_sales.length === 0) && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No credit sales found
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
