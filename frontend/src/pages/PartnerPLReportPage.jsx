import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Handshake, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3,
  Calendar, Download, RefreshCw, Loader2, Building2, Users, Percent
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];

export default function PartnerPLReportPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState('all');
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedPartner]);

  useEffect(() => {
    const now = new Date();
    if (dateRange === 'week') {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (dateRange === 'month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (dateRange === 'quarter') {
      setStartDate(format(subMonths(now, 3), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (dateRange === 'year') {
      setStartDate(format(subMonths(now, 12), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  }, [dateRange]);

  const fetchPartners = async () => {
    try {
      const res = await api.get('/partners');
      setPartners(res.data);
    } catch (err) {
      toast.error('Failed to load partners');
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (selectedPartner !== 'all') params.append('partner_id', selectedPartner);
      const res = await api.get(`/partner-pl-report?${params}`);
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    
    let csv = 'Partner P&L Report\n';
    csv += `Period: ${startDate} to ${endDate}\n\n`;
    csv += 'COMPANY SUMMARY\n';
    csv += `Total Revenue,${report.company_summary?.total_revenue}\n`;
    csv += `Cost of Goods,${report.company_summary?.cost_of_goods}\n`;
    csv += `Gross Profit,${report.company_summary?.gross_profit}\n`;
    csv += `Operating Expenses,${report.company_summary?.operating_expenses}\n`;
    csv += `Net Profit,${report.company_summary?.net_profit}\n\n`;
    csv += 'PARTNER BREAKDOWN\n';
    csv += 'Partner,Ownership %,Profit Share,Investments,Withdrawals,Balance\n';
    
    for (const p of report.partners || []) {
      csv += `${p.partner_name},${p.ownership_percentage}%,${p.company_share?.profit_share},${p.period_transactions?.investments},${p.period_transactions?.withdrawals},${p.balance?.current_balance}\n`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner_pl_${startDate}_${endDate}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-outfit flex items-center gap-2" data-testid="partner-pl-title">
              <Handshake className="text-primary" size={28} />
              Partner P&L Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Profit & Loss breakdown by partner ownership
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} data-testid="refresh-btn">
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
              Refresh
            </Button>
            <Button size="sm" onClick={exportReport} disabled={!report} data-testid="export-btn">
              <Download size={14} className="mr-1" /> Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs">Quick Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger data-testid="date-range-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">Last 3 Months</SelectItem>
                    <SelectItem value="year">Last 12 Months</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }} data-testid="start-date" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }} data-testid="end-date" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-xs">Partner</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger data-testid="partner-select">
                    <SelectValue placeholder="All Partners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Partners</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.ownership_percentage || 0}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : report ? (
          <>
            {/* Company Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="total-revenue">
                    SAR {report.company_summary?.total_revenue?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.company_summary?.transactions_count} transactions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-error/10">
                      <TrendingDown size={18} className="text-error" />
                    </div>
                    <span className="text-xs text-muted-foreground">Expenses</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="total-expenses">
                    SAR {((report.company_summary?.operating_expenses || 0) + (report.company_summary?.cost_of_goods || 0)).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    + SAR {(report.company_summary?.supplier_payments || 0).toLocaleString()} suppliers
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-success/10">
                      <DollarSign size={18} className="text-success" />
                    </div>
                    <span className="text-xs text-muted-foreground">Net Profit</span>
                  </div>
                  <p className={`text-2xl font-bold ${report.company_summary?.net_profit >= 0 ? 'text-success' : 'text-error'}`} data-testid="net-profit">
                    SAR {report.company_summary?.net_profit?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.company_summary?.net_margin}% margin
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users size={18} className="text-blue-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">Partners</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="total-partners">
                    {report.total_partners}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.total_ownership_tracked}% ownership tracked
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="partners" className="space-y-4">
              <TabsList>
                <TabsTrigger value="partners" data-testid="partners-tab">
                  <Handshake size={14} className="mr-1" /> Partner Breakdown
                </TabsTrigger>
                <TabsTrigger value="expenses" data-testid="expenses-tab">
                  <PieChart size={14} className="mr-1" /> Expense Categories
                </TabsTrigger>
                <TabsTrigger value="payments" data-testid="payments-tab">
                  <BarChart3 size={14} className="mr-1" /> Payment Modes
                </TabsTrigger>
              </TabsList>

              {/* Partner Breakdown Tab */}
              <TabsContent value="partners" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {report.partners?.map((partner, idx) => (
                    <Card key={partner.partner_id} className="border-border" data-testid={`partner-card-${partner.partner_id}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                              {partner.partner_name?.charAt(0)}
                            </div>
                            {partner.partner_name}
                          </span>
                          <Badge className="bg-primary/10 text-primary">
                            {partner.ownership_percentage}% Owner
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Company Share */}
                        <div className="p-3 bg-stone-50 rounded-xl">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Company Share (This Period)</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold text-primary">
                                {partner.company_share?.revenue_share?.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Revenue</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-error">
                                {partner.company_share?.expense_share?.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Expenses</p>
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${partner.company_share?.profit_share >= 0 ? 'text-success' : 'text-error'}`}>
                                {partner.company_share?.profit_share?.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Profit Share</p>
                            </div>
                          </div>
                        </div>

                        {/* Transactions */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <p className="text-sm font-bold text-blue-600">
                              {partner.period_transactions?.investments?.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Invested</p>
                          </div>
                          <div className="p-2 bg-orange-50 rounded-lg">
                            <p className="text-sm font-bold text-orange-600">
                              {partner.period_transactions?.withdrawals?.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Withdrawn</p>
                          </div>
                          <div className="p-2 bg-purple-50 rounded-lg">
                            <p className="text-sm font-bold text-purple-600">
                              {partner.period_transactions?.profit_taken?.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Profit Taken</p>
                          </div>
                        </div>

                        {/* Balance */}
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl">
                          <div>
                            <p className="text-xs text-muted-foreground">Current Balance</p>
                            <p className="text-xl font-bold">{partner.balance?.current_balance?.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Available for Withdrawal</p>
                            <p className="text-xl font-bold text-success">
                              {partner.balance?.available_for_withdrawal?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {(!report.partners || report.partners.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Handshake size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No partners found</p>
                    <p className="text-sm">Add partners in the Partners section to see P&L breakdown</p>
                  </div>
                )}
              </TabsContent>

              {/* Expense Categories Tab */}
              <TabsContent value="expenses">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Expense by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.expense_by_category?.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={report.expense_by_category?.slice(0, 6)}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="amount"
                                nameKey="category"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {report.expense_by_category?.slice(0, 6).map((entry, idx) => (
                                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => `SAR ${value.toLocaleString()}`} />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {report.expense_by_category?.map((cat, idx) => (
                            <div key={cat.category} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-sm">{cat.category}</span>
                              </div>
                              <span className="font-medium">SAR {cat.amount?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <PieChart size={48} className="mx-auto mb-4 opacity-30" />
                        <p>No expense data for this period</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payment Modes Tab */}
              <TabsContent value="payments">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Revenue by Payment Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.payment_breakdown ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Cash', amount: report.payment_breakdown.cash || 0 },
                            { name: 'Bank', amount: report.payment_breakdown.bank || 0 },
                            { name: 'Online', amount: report.payment_breakdown.online || 0 },
                            { name: 'Credit', amount: report.payment_breakdown.credit || 0 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => `SAR ${value.toLocaleString()}`} />
                            <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
                        <p>No payment data for this period</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 size={48} className="mx-auto mb-4 opacity-30" />
            <p>No report data available</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
