import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Percent, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function MonthlyReconReportPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const navigate = useNavigate();

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/platform-reconciliation/monthly-report?months=${months}`);
      setReport(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [months]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const grandTotals = (report?.months || []).reduce((acc, m) => ({
    sales: acc.sales + m.total_sales,
    received: acc.received + m.total_received,
    expected: acc.expected + m.total_expected_fee,
    actual: acc.actual + m.total_actual_cut,
    orders: acc.orders + m.order_count,
  }), { sales: 0, received: 0, expected: 0, actual: 0, orders: 0 });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button size="sm" variant="ghost" onClick={() => navigate('/platform-reconciliation')} className="h-7 px-2">
                <ArrowLeft size={14} />
              </Button>
              <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="monthly-recon-title">Monthly Reconciliation Report</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-9">Platform fees vs expected — spot overcharges month by month</p>
          </div>
          <Select value={String(months)} onValueChange={v => setMonths(parseInt(v))}>
            <SelectTrigger className="w-40" data-testid="months-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grand Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="grand-totals">
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardContent className="p-4">
              <div className="text-[10px] text-purple-600 uppercase tracking-wider">Total Sales</div>
              <div className="text-xl font-bold text-purple-800">SAR {grandTotals.sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="text-xs text-muted-foreground">{grandTotals.orders} orders</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <CardContent className="p-4">
              <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Total Received</div>
              <div className="text-xl font-bold text-emerald-700">SAR {grandTotals.received.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardContent className="p-4">
              <div className="text-[10px] text-amber-600 uppercase tracking-wider">Expected Fees</div>
              <div className="text-xl font-bold text-amber-700">SAR {grandTotals.expected.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <CardContent className="p-4">
              <div className="text-[10px] text-red-600 uppercase tracking-wider">Actual Cut</div>
              <div className="text-xl font-bold text-red-700">SAR {grandTotals.actual.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br border ${grandTotals.actual - grandTotals.expected > 0.5 ? 'from-red-50 to-white border-red-300' : 'from-emerald-50 to-white border-emerald-300'}`}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Variance</div>
              <div className={`text-xl font-bold ${grandTotals.actual - grandTotals.expected > 0.5 ? 'text-red-700' : 'text-emerald-700'}`}>
                {grandTotals.actual - grandTotals.expected > 0 ? '+' : ''}SAR {(grandTotals.actual - grandTotals.expected).toLocaleString(undefined, {minimumFractionDigits: 2})}
              </div>
              <div className="text-xs text-muted-foreground">
                {grandTotals.actual - grandTotals.expected > 0.5 ? 'Overpaying platforms' : 'Within expected range'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Breakdown */}
        <div className="space-y-3">
          {(report?.months || []).map(month => {
            const isExpanded = expandedMonth === month.month;
            const variance = month.total_variance;
            const hasVariance = Math.abs(variance) > 0.5;
            const isOverpaying = variance > 0.5;

            return (
              <Card key={month.month} className={`overflow-hidden ${isOverpaying ? 'border-red-200' : 'border-stone-200'}`} data-testid={`month-card-${month.month}`}>
                <div className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                  onClick={() => setExpandedMonth(prev => prev === month.month ? null : month.month)}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                      <div>
                        <div className="font-semibold text-base flex items-center gap-2">
                          {month.month_name}
                          {isOverpaying && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 border-0">
                              <AlertTriangle size={8} className="mr-0.5" /> Overpaying
                            </Badge>
                          )}
                          {month.total_sales === 0 && (
                            <Badge className="text-[10px] bg-stone-100 text-stone-500 border-0">No data</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{month.order_count} orders across {month.platforms.length} platforms</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Sales</div>
                        <div className="font-bold">SAR {month.total_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-emerald-600">Received</div>
                        <div className="font-bold text-emerald-700">SAR {month.total_received.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-amber-600">Expected Fee</div>
                        <div className="font-bold text-amber-700">SAR {month.total_expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-red-500">Actual Cut</div>
                        <div className="font-bold text-red-600">SAR {month.total_actual_cut.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                      </div>
                      {hasVariance && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Variance</div>
                          <div className={`font-bold text-xs flex items-center gap-1 ${isOverpaying ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isOverpaying ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {variance > 0 ? '+' : ''}SAR {variance.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Platform Details */}
                {isExpanded && month.platforms.length > 0 && (
                  <div className="border-t bg-stone-50/50 px-4 py-3">
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Platform</th>
                            <th className="text-center px-3 py-2 font-medium">Rate</th>
                            <th className="text-right px-3 py-2 font-medium">Orders</th>
                            <th className="text-right px-3 py-2 font-medium">Sales</th>
                            <th className="text-right px-3 py-2 font-medium">Received</th>
                            <th className="text-right px-3 py-2 font-medium">Expected Fee</th>
                            <th className="text-right px-3 py-2 font-medium">Actual Cut</th>
                            <th className="text-right px-3 py-2 font-medium">Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.platforms.map(p => {
                            const pVariance = p.variance;
                            const pOver = pVariance > 0.5;
                            return (
                              <tr key={p.platform_id} className={`border-t ${pOver ? 'bg-red-50/50' : ''}`} data-testid={`platform-row-${p.platform_id}`}>
                                <td className="px-3 py-2 font-medium">{p.platform_name}</td>
                                <td className="px-3 py-2 text-center">
                                  <Badge className="text-[10px] bg-violet-100 text-violet-700 border-0">
                                    <Percent size={8} className="mr-0.5" />{p.commission_rate}%
                                  </Badge>
                                  {p.processing_fee > 0 && (
                                    <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0 ml-1">+{p.processing_fee}</Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">{p.sales_count}</td>
                                <td className="px-3 py-2 text-right">SAR {p.total_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right text-emerald-700">SAR {p.total_received.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right text-amber-700">SAR {p.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right text-red-600 font-bold">SAR {p.actual_cut.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right">
                                  {Math.abs(pVariance) > 0.5 ? (
                                    <span className={`font-bold flex items-center justify-end gap-0.5 ${pOver ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {pOver ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                                      {pVariance > 0 ? '+' : ''}SAR {pVariance.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                                      <CheckCircle2 size={10} /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {isExpanded && month.platforms.length === 0 && (
                  <div className="border-t p-4 text-center text-muted-foreground text-sm">No platform sales this month</div>
                )}
              </Card>
            );
          })}

          {(report?.months || []).length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                No monthly data available
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
