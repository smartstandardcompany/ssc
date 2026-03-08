import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDownUp, Plus, Trash2, DollarSign, ChevronDown, ChevronRight, Percent, Calculator, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { DateQuickFilter } from '@/components/DateQuickFilter';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function PlatformReconciliationPage() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showFeeSettingsDialog, setShowFeeSettingsDialog] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [receiveForm, setReceiveForm] = useState({
    platform_id: '', amount: '', date: new Date().toISOString().split('T')[0], branch_name: '', notes: ''
  });
  const [feeForm, setFeeForm] = useState({ commission_rate: '', processing_fee: '' });

  const fetchData = async () => {
    try {
      let url = '/platform-reconciliation/summary';
      const params = [];
      if (dateRange) {
        params.push(`start_date=${dateRange.start}`, `end_date=${dateRange.end}`);
      }
      if (params.length) url += '?' + params.join('&');

      const [sumRes, histRes, platRes] = await Promise.all([
        api.get(url),
        api.get('/platform-reconciliation/history'),
        api.get('/platforms').catch(() => ({ data: [] })),
      ]);
      setSummary(sumRes.data);
      setHistory(histRes.data || []);
      setPlatforms(platRes.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  // Auto-calculate expected received amount when platform is selected
  const selectedPlatformData = useMemo(() => {
    if (!receiveForm.platform_id || !summary?.platforms) return null;
    return summary.platforms.find(p => p.platform_id === receiveForm.platform_id);
  }, [receiveForm.platform_id, summary]);

  const selectedPlatformInfo = useMemo(() => {
    if (!receiveForm.platform_id) return null;
    return platforms.find(p => p.id === receiveForm.platform_id);
  }, [receiveForm.platform_id, platforms]);

  const handleReceive = async (e) => {
    e.preventDefault();
    try {
      await api.post('/platform-reconciliation/receive', {
        ...receiveForm,
        amount: parseFloat(receiveForm.amount),
        branch_name: receiveForm.branch_name || null,
      });
      toast.success('Payment recorded');
      setShowReceiveDialog(false);
      setReceiveForm({ platform_id: '', amount: '', date: new Date().toISOString().split('T')[0], branch_name: '', notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`/platform-reconciliation/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const handleSaveFeeSettings = async () => {
    if (!editingPlatform) return;
    try {
      await api.put(`/platforms/${editingPlatform.id}`, {
        ...editingPlatform,
        commission_rate: parseFloat(feeForm.commission_rate) || 0,
        processing_fee: parseFloat(feeForm.processing_fee) || 0,
      });
      toast.success(`Fee settings updated for ${editingPlatform.name}`);
      setShowFeeSettingsDialog(false);
      setEditingPlatform(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
  };

  const openFeeSettings = (platformId) => {
    const plat = platforms.find(p => p.id === platformId);
    if (!plat) return;
    setEditingPlatform(plat);
    setFeeForm({
      commission_rate: plat.commission_rate || '',
      processing_fee: plat.processing_fee || '',
    });
    setShowFeeSettingsDialog(true);
  };

  // Auto-fill expected amount when platform changes
  const handlePlatformSelect = (platformId) => {
    setReceiveForm(prev => ({ ...prev, platform_id: platformId === "none" ? "" : platformId }));
  };

  const autoFillExpectedAmount = () => {
    if (!selectedPlatformData) return;
    const remaining = selectedPlatformData.expected_received - selectedPlatformData.total_received;
    if (remaining > 0) {
      setReceiveForm(prev => ({ ...prev, amount: remaining.toFixed(2) }));
    }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const platformNames = {};
  platforms.forEach(p => { platformNames[p.id] = p.name; });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="platform-recon-title">Platform Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Track platform sales vs received payments with auto fee calculation</p>
          </div>
          <Button className="rounded-xl" onClick={() => setShowReceiveDialog(true)} data-testid="record-payment-btn">
            <Plus size={16} className="mr-1" /> Record Received Payment
          </Button>
        </div>

        <DateQuickFilter onFilterChange={(range) => setDateRange(range)} />

        {/* Grand Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="platform-grand-summary">
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <CardContent className="p-4">
                <div className="text-[10px] text-purple-600 uppercase tracking-wider">Total Online Sales</div>
                <div className="text-2xl font-bold text-purple-800">SAR {summary.total_online_sales?.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardContent className="p-4">
                <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Total Received</div>
                <div className="text-2xl font-bold text-emerald-700">SAR {summary.total_received?.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <CardContent className="p-4">
                <div className="text-[10px] text-amber-600 uppercase tracking-wider">Expected Fees</div>
                <div className="text-2xl font-bold text-amber-700">SAR {(summary.total_expected_fee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                {summary.total_online_sales > 0 && (
                  <div className="text-xs text-amber-500 mt-0.5">
                    {((summary.total_expected_fee / summary.total_online_sales) * 100).toFixed(1)}% of sales
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
              <CardContent className="p-4">
                <div className="text-[10px] text-red-600 uppercase tracking-wider">Actual Platform Cut</div>
                <div className="text-2xl font-bold text-red-700">SAR {summary.total_platform_cut?.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                {summary.total_expected_fee > 0 && summary.total_platform_cut !== summary.total_expected_fee && (
                  <div className={`text-xs mt-0.5 ${summary.total_platform_cut > summary.total_expected_fee ? 'text-red-600' : 'text-emerald-600'}`}>
                    {summary.total_platform_cut > summary.total_expected_fee ? 'Over' : 'Under'} expected by SAR {Math.abs(summary.total_platform_cut - summary.total_expected_fee).toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="platforms">
          <TabsList>
            <TabsTrigger value="platforms">By Platform</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          {/* Platform Breakdown */}
          <TabsContent value="platforms">
            {summary?.platforms?.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <ArrowDownUp size={40} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="text-muted-foreground">No online platform sales found for this period</p>
                  <p className="text-xs text-muted-foreground mt-1">Record sales with platform type to see reconciliation</p>
                </CardContent>
              </Card>
            )}
            <div className="space-y-3">
              {(summary?.platforms || []).map(platform => {
                const feeVariance = platform.expected_fee > 0 ? platform.platform_cut - platform.expected_fee : 0;
                const hasVariance = Math.abs(feeVariance) > 0.5;
                return (
                <Card key={platform.platform_id} className="border-stone-200 overflow-hidden" data-testid={`platform-card-${platform.platform_id}`}>
                  {/* Platform Header */}
                  <div className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                    onClick={() => setExpandedPlatform(prev => prev === platform.platform_id ? null : platform.platform_id)}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {expandedPlatform === platform.platform_id ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                        <div>
                          <div className="font-semibold text-base flex items-center gap-2">
                            {platform.platform_name}
                            {platform.commission_rate > 0 && (
                              <Badge className="text-[10px] bg-violet-100 text-violet-700 border-0" data-testid={`commission-badge-${platform.platform_id}`}>
                                <Percent size={8} className="mr-0.5" />{platform.commission_rate}%
                              </Badge>
                            )}
                            {platform.processing_fee > 0 && (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">
                                +SAR {platform.processing_fee}/order
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{platform.sales_count} orders</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Sales</div>
                          <div className="font-bold">SAR {platform.total_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-emerald-600">Received</div>
                          <div className="font-bold text-emerald-700">SAR {platform.total_received.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </div>
                        {platform.expected_fee > 0 && (
                          <div className="text-right">
                            <div className="text-xs text-amber-600">Expected Fee</div>
                            <div className="font-bold text-amber-700">SAR {platform.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                          </div>
                        )}
                        <div className="text-right">
                          <div className="text-xs text-red-500">Actual Cut</div>
                          <div className="font-bold text-red-600">
                            SAR {platform.platform_cut.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            <Badge className="ml-1 text-[10px] bg-red-100 text-red-700 border-0">
                              {platform.cut_percentage}%
                            </Badge>
                          </div>
                        </div>
                        {hasVariance && (
                          <div className="text-right" data-testid={`fee-variance-${platform.platform_id}`}>
                            <div className="text-xs text-muted-foreground">Variance</div>
                            <div className={`font-bold text-xs flex items-center gap-1 ${feeVariance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {feeVariance > 0 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                              {feeVariance > 0 ? '+' : ''}SAR {feeVariance.toFixed(2)}
                            </div>
                          </div>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-violet-600"
                          onClick={(e) => { e.stopPropagation(); openFeeSettings(platform.platform_id); }}
                          title="Edit fee settings" data-testid={`edit-fees-${platform.platform_id}`}>
                          <Settings size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Expanded Branch Breakdown */}
                  {expandedPlatform === platform.platform_id && Object.keys(platform.by_branch || {}).length > 0 && (
                    <div className="border-t bg-stone-50/50 px-4 py-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">By Branch</div>
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-stone-50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Branch</th>
                              <th className="text-right px-3 py-2 font-medium">Orders</th>
                              <th className="text-right px-3 py-2 font-medium">Sales</th>
                              <th className="text-right px-3 py-2 font-medium">Received</th>
                              <th className="text-right px-3 py-2 font-medium">Expected Fee</th>
                              <th className="text-right px-3 py-2 font-medium">Actual Cut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(platform.by_branch).map(([bname, bd]) => (
                              <tr key={bname} className="border-t" data-testid={`branch-row-${bname}`}>
                                <td className="px-3 py-2 font-medium">{bname}</td>
                                <td className="px-3 py-2 text-right">{bd.count}</td>
                                <td className="px-3 py-2 text-right">SAR {bd.sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right text-emerald-700">SAR {bd.received.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-3 py-2 text-right text-amber-700">
                                  {bd.expected_fee > 0 ? `SAR ${bd.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600 font-bold">
                                  SAR {bd.cut.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  {bd.sales > 0 && <span className="text-[10px] ml-1">({((bd.cut / bd.sales) * 100).toFixed(1)}%)</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );})}
            </div>
          </TabsContent>

          {/* Payment History */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No payments recorded yet</p>
                    <p className="text-xs mt-1">Click "Record Received Payment" to log platform payouts</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Date</th>
                          <th className="text-left px-4 py-3 font-medium">Platform</th>
                          <th className="text-left px-4 py-3 font-medium">Branch</th>
                          <th className="text-right px-4 py-3 font-medium">Amount</th>
                          <th className="text-left px-4 py-3 font-medium">Notes</th>
                          <th className="text-right px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(rec => (
                          <tr key={rec.id} className="border-t hover:bg-stone-50" data-testid={`recon-history-${rec.id}`}>
                            <td className="px-4 py-2">{rec.date}</td>
                            <td className="px-4 py-2 font-medium">{platformNames[rec.platform_id] || rec.platform_id}</td>
                            <td className="px-4 py-2">{rec.branch_name || 'All'}</td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-700">SAR {rec.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">{rec.notes || '-'}</td>
                            <td className="px-4 py-2 text-right">
                              <Button size="sm" variant="ghost" className="h-7 text-error" onClick={() => handleDelete(rec.id)} data-testid="delete-recon-btn">
                                <Trash2 size={12} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Record Payment Dialog with Auto Calculator */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent data-testid="receive-payment-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit flex items-center gap-2">
                <Calculator size={18} /> Record Platform Payment
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReceive} className="space-y-4">
              <div>
                <Label>Platform *</Label>
                <Select value={receiveForm.platform_id || "none"} onValueChange={handlePlatformSelect}>
                  <SelectTrigger data-testid="recon-platform-select"><SelectValue placeholder="Select platform" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select...</SelectItem>
                    {platforms.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.commission_rate ? `(${p.commission_rate}%)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-calculated fee info */}
              {selectedPlatformData && selectedPlatformInfo && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-2" data-testid="auto-fee-calculator">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 uppercase tracking-wider">
                    <Calculator size={12} /> Auto Fee Calculator
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Total Sales</span>
                      <div className="font-bold">SAR {selectedPlatformData.total_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Commission Rate</span>
                      <div className="font-bold text-violet-700">{selectedPlatformInfo.commission_rate || 0}%
                        {(selectedPlatformInfo.processing_fee || 0) > 0 && <span className="text-xs ml-1">+ SAR {selectedPlatformInfo.processing_fee}/order</span>}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Expected Fee</span>
                      <div className="font-bold text-amber-700">SAR {selectedPlatformData.expected_fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Expected You Receive</span>
                      <div className="font-bold text-emerald-700">SAR {selectedPlatformData.expected_received.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Already Received</span>
                      <div className="font-bold">SAR {selectedPlatformData.total_received.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Remaining to Receive</span>
                      <div className="font-bold text-blue-700">
                        SAR {Math.max(0, selectedPlatformData.expected_received - selectedPlatformData.total_received).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                    </div>
                  </div>
                  {selectedPlatformData.expected_received - selectedPlatformData.total_received > 0 && (
                    <Button type="button" size="sm" variant="outline" className="w-full text-xs border-violet-300 text-violet-700 hover:bg-violet-100"
                      onClick={autoFillExpectedAmount} data-testid="auto-fill-amount-btn">
                      <Calculator size={12} className="mr-1" /> Auto-fill remaining: SAR {(selectedPlatformData.expected_received - selectedPlatformData.total_received).toFixed(2)}
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount Received (SAR) *</Label>
                  <Input type="number" step="0.01" value={receiveForm.amount} onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })} required data-testid="recon-amount-input" />
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={receiveForm.date} onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Branch (optional)</Label>
                <Input value={receiveForm.branch_name} onChange={e => setReceiveForm({ ...receiveForm, branch_name: e.target.value })} placeholder="Leave empty for all branches" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={receiveForm.notes} onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="e.g., Weekly settlement" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={!receiveForm.platform_id || !receiveForm.amount} data-testid="save-recon-btn">Record Payment</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Fee Settings Dialog */}
        <Dialog open={showFeeSettingsDialog} onOpenChange={setShowFeeSettingsDialog}>
          <DialogContent data-testid="fee-settings-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit flex items-center gap-2">
                <Settings size={18} /> Fee Settings - {editingPlatform?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Commission Rate (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" value={feeForm.commission_rate}
                  onChange={e => setFeeForm({ ...feeForm, commission_rate: e.target.value })}
                  placeholder="e.g., 20 for 20%" data-testid="commission-rate-input" />
                <p className="text-xs text-muted-foreground mt-1">Percentage the platform takes from each order</p>
              </div>
              <div>
                <Label>Fixed Processing Fee (SAR per order)</Label>
                <Input type="number" step="0.01" min="0" value={feeForm.processing_fee}
                  onChange={e => setFeeForm({ ...feeForm, processing_fee: e.target.value })}
                  placeholder="e.g., 2.50" data-testid="processing-fee-input" />
                <p className="text-xs text-muted-foreground mt-1">Fixed fee per order on top of commission</p>
              </div>

              {/* Preview calculation */}
              <div className="p-3 bg-stone-50 rounded-lg border text-sm">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Example: SAR 100 order</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span>Commission ({feeForm.commission_rate || 0}%):</span>
                  <span className="text-right font-bold">SAR {((parseFloat(feeForm.commission_rate) || 0) * 100 / 100).toFixed(2)}</span>
                  <span>Processing Fee:</span>
                  <span className="text-right font-bold">SAR {(parseFloat(feeForm.processing_fee) || 0).toFixed(2)}</span>
                  <span className="border-t pt-1">Total Fee:</span>
                  <span className="text-right font-bold border-t pt-1 text-red-600">
                    SAR {(((parseFloat(feeForm.commission_rate) || 0) * 100 / 100) + (parseFloat(feeForm.processing_fee) || 0)).toFixed(2)}
                  </span>
                  <span>You Receive:</span>
                  <span className="text-right font-bold text-emerald-700">
                    SAR {(100 - ((parseFloat(feeForm.commission_rate) || 0) * 100 / 100) - (parseFloat(feeForm.processing_fee) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowFeeSettingsDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveFeeSettings} data-testid="save-fee-settings-btn">Save Fee Settings</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
