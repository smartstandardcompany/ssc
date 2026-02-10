import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';

export default function CreditReportPage() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivingSale, setReceivingSale] = useState(null);
  const [receivePayment, setReceivePayment] = useState({ payment_mode: 'cash', amount: '' });

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

  const handleReceiveCredit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/sales/${receivingSale.id}/receive-credit`, {
        payment_mode: receivePayment.payment_mode,
        amount: parseFloat(receivePayment.amount)
      });
      toast.success('Credit payment received');
      setShowReceiveDialog(false);
      setReceivePayment({ payment_mode: 'cash', amount: '' });
      fetchReport();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive payment');
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
        <ExportButtons dataType="sales" />

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
                    <th className="text-left p-3 font-medium text-sm">Branch</th>
                    <th className="text-left p-3 font-medium text-sm">Customer</th>
                    <th className="text-right p-3 font-medium text-sm">Total</th>
                    <th className="text-right p-3 font-medium text-sm">Credit Given</th>
                    <th className="text-right p-3 font-medium text-sm">Received</th>
                    <th className="text-right p-3 font-medium text-sm">Remaining</th>
                    <th className="text-center p-3 font-medium text-sm">Status</th>
                    <th className="text-right p-3 font-medium text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.credit_sales?.map((sale) => (
                    <tr key={sale.id} className="border-b border-border hover:bg-secondary/50" data-testid="credit-sale-row">
                      <td className="p-3 text-sm">{format(new Date(sale.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-sm capitalize">{sale.sale_type}</td>
                      <td className="p-3 text-sm">{sale.branch}</td>
                      <td className="p-3 text-sm">{sale.sale_type === 'online' ? sale.reference : '-'}</td>
                      <td className="p-3 text-sm text-right font-medium">${sale.total_amount.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-credit font-bold">${sale.credit_given.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-success">${sale.credit_received.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-error font-bold">${sale.remaining.toFixed(2)}</td>
                      <td className="p-3 text-center">{getStatusBadge(sale.status)}</td>
                      <td className="p-3 text-right">
                        {sale.remaining > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReceivingSale(sale); setShowReceiveDialog(true); }}
                            data-testid="receive-button"
                            className="h-8"
                          >
                            <DollarSign size={14} className="mr-1" />
                            Receive
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!reportData?.credit_sales || reportData.credit_sales.length === 0) && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        No credit sales found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Receive Credit Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent data-testid="receive-credit-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">Receive Credit Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReceiveCredit} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Sale Amount: <span className="font-medium text-foreground">${receivingSale?.total_amount?.toFixed(2)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Remaining Credit: <span className="font-bold text-credit">${receivingSale?.remaining?.toFixed(2)}</span>
                </p>
              </div>
              <div>
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={receivePayment.amount}
                  data-testid="receive-amount-input"
                  onChange={(e) => setReceivePayment({ ...receivePayment, amount: e.target.value })}
                  required
                  max={receivingSale?.remaining}
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={receivePayment.payment_mode} onValueChange={(val) => setReceivePayment({ ...receivePayment, payment_mode: val })}>
                  <SelectTrigger data-testid="receive-mode-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-receive-button" className="rounded-full">Receive Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)} className="rounded-full">
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
