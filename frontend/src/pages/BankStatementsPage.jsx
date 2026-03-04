import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Eye, AlertTriangle, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];
const CAT_LABELS = { pos_sales: 'POS Sales', pos_fees: 'POS Fees', bank_fees: 'Bank Fees', vat_fees: 'VAT on Fees', internal_transfer: 'Internal Transfers', incoming_transfer: 'Incoming Transfers', outgoing_transfer: 'Outgoing Transfers', sadad_payment: 'SADAD Bills', sadad_refund: 'SADAD Refund', iqama_renewal: 'Iqama Renewal', salary: 'Salary', vat: 'VAT', other: 'Other' };

export default function BankStatementsPage() {
  const { t } = useLanguage();
  const [statements, setStatements] = useState([]);
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [posMachines, setPosMachines] = useState([]);
  const [detail, setDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ bank_name: '', branch_id: '' });
  const [showPosManager, setShowPosManager] = useState(false);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

  useEffect(() => { fetchData(); _fetchBr(); }, []);
  const fetchData = async () => {
    try { const [sR, pR] = await Promise.all([api.get('/bank-statements'), api.get('/pos-machines')]); setStatements(sR.data); setPosMachines(pR.data); }
    catch {} finally { setLoading(false); }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file); form.append('bank_name', uploadData.bank_name); form.append('branch_id', uploadData.branch_id || '');
      const res = await api.post('/bank-statements/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Parsed ${res.data.transactions_parsed} transactions!`);
      fetchData();
      viewDetail(res.data.id);
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const viewDetail = async (id) => {
    try {
      const [dR, aR] = await Promise.all([api.get(`/bank-statements/${id}`), api.get(`/bank-statements/${id}/analysis`)]);
      setDetail(dR.data); setAnalysis(aR.data);
      // Load reconciliation
      setReconLoading(true);
      try {
        const rR = await api.get(`/bank-statements/${id}/reconciliation`);
        setReconciliation(rR.data);
      } catch { setReconciliation(null); }
      finally { setReconLoading(false); }
    } catch { toast.error('Failed'); }
  };

  const savePosMapping = async (machineId, branchId, label) => {
    try { await api.post('/pos-machines', { machine_id: machineId, branch_id: branchId, label }); toast.success('Saved'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-4xl font-bold font-outfit mb-2">Bank Statements</h1><p className="text-muted-foreground">Upload, analyze & reconcile bank statements</p></div>

        {/* Upload */}
        <Card className="border-stone-100 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div><Label>Bank</Label><Input value={uploadData.bank_name} onChange={(e) => setUploadData({...uploadData, bank_name: e.target.value})} placeholder="Alinma / Bilad" className="h-10" /></div>
              <div><Label>Branch</Label><Select value={uploadData.branch_id || "none"} onValueChange={(v) => setUploadData({...uploadData, branch_id: v === "none" ? "" : v})}><SelectTrigger className="h-10"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="none">All</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="cursor-pointer"><input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => handleUpload(e.target.files[0])} /><Label className="mb-1 block">Upload PDF / Excel</Label><Button className="w-full h-10 rounded-xl" disabled={uploading} asChild><span><Upload size={16} className="mr-2" />{uploading ? 'Parsing...' : 'Upload & Analyze'}</span></Button></label></div>
              <div><Button variant="outline" className="w-full h-10 rounded-xl" onClick={() => setShowPosManager(true)}>POS Machine Settings</Button></div>
            </div>
          </CardContent>
        </Card>

        {/* Statements List */}
        <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Uploaded Statements</CardTitle></CardHeader><CardContent>
          <div className="space-y-3">{statements.map(s => (
            <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-stone-50 transition-all">
              <div><div className="font-medium">{s.bank_name || 'Unknown'} - {s.file_name}</div><div className="text-xs text-muted-foreground mt-1">{s.period} | {s.transaction_count} txns</div></div>
              <div className="flex items-center gap-4">
                <div className="text-right"><div className="text-sm text-success font-bold">+SAR {s.total_credit?.toFixed(2)}</div><div className="text-sm text-error">-SAR {s.total_debit?.toFixed(2)}</div></div>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => viewDetail(s.id)}><Eye size={14} className="mr-1" />Analyze</Button>
                <Button size="sm" variant="ghost" className="text-error" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/bank-statements/${s.id}`); fetchData(); setDetail(null); }}}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}{statements.length === 0 && <p className="text-center text-muted-foreground py-8">Upload a bank statement to start</p>}</div>
        </CardContent></Card>

        {/* Detail View */}
        {detail && (
          <Card className="border-stone-100 border-primary/20">
            <CardHeader><CardTitle className="font-outfit">{detail.bank_name} Analysis - {detail.transaction_count} Transactions</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="summary">
                <TabsList className="flex-wrap"><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="reconciliation" data-testid="reconciliation-tab">Reconciliation</TabsTrigger><TabsTrigger value="senders">Senders/Receivers</TabsTrigger><TabsTrigger value="pos">POS by Branch</TabsTrigger><TabsTrigger value="mismatch">Mismatches</TabsTrigger><TabsTrigger value="suppliers">Supplier Payments</TabsTrigger><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="all">All Transactions</TabsTrigger></TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 bg-success/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Total In</div><div className="text-lg font-bold text-success">SAR {detail.total_credit?.toFixed(0)}</div></div>
                    <div className="p-3 bg-error/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Total Out</div><div className="text-lg font-bold text-error">SAR {detail.total_debit?.toFixed(0)}</div></div>
                    <div className="p-3 bg-primary/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Net</div><div className={`text-lg font-bold ${(detail.total_credit - detail.total_debit) >= 0 ? 'text-success' : 'text-error'}`}>SAR {(detail.total_credit - detail.total_debit)?.toFixed(0)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Bank Fees</div><div className="text-lg font-bold text-warning">SAR {(analysis?.total_bank_fees || 0).toFixed(0)}</div></div>
                    <div className="p-3 bg-info/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">POS Sales</div><div className="text-lg font-bold text-info">SAR {(analysis?.total_pos_sales || 0).toFixed(0)}</div></div>
                  </div>
                  {detail.categories && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>{Object.entries(detail.categories).map(([cat, data], i) => (
                      <div key={cat} className="flex justify-between items-center p-3 border-b"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background: COLORS[i % COLORS.length]}} /><span className="text-sm font-medium">{CAT_LABELS[cat] || cat}</span><Badge variant="secondary">{data.count}</Badge></div><div className="text-right"><span className="text-success text-sm mr-3">+{data.credit.toFixed(0)}</span><span className="text-error text-sm">-{data.debit.toFixed(0)}</span></div></div>
                    ))}</div>
                    <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={Object.entries(detail.categories).filter(([,d]) => d.credit > 0 || d.debit > 0).map(([k,v]) => ({name: CAT_LABELS[k]||k, value: v.credit + v.debit}))} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>{Object.keys(detail.categories).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `SAR ${v.toFixed(2)}`} /></PieChart></ResponsiveContainer>
                  </div>}
                </TabsContent>

                {/* RECONCILIATION TAB */}
                <TabsContent value="reconciliation" className="space-y-4" data-testid="reconciliation-content">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">POS Sales Reconciliation</p>
                      <p className="text-xs text-muted-foreground">Bank POS deposits vs SSC Track bank sales (1-day offset: today's sale → tomorrow's bank deposit)</p>
                    </div>
                    {reconciliation && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
                      const csv = 'Deposit Date,Sale Date,Branch,Bank Amount,App Amount,Difference,Status\n' + reconciliation.rows.map(r => `${r.deposit_date},${r.sale_date},${r.branch},${r.bank_amount},${r.app_amount},${r.difference},${r.status}`).join('\n');
                      const blob = new Blob([csv], {type: 'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pos_reconciliation.csv'; a.click();
                      toast.success('Exported');
                    }}><Upload size={14} className="mr-1" />Export CSV</Button>}
                  </div>
                  {reconLoading ? <div className="text-center py-8">Loading reconciliation...</div> : !reconciliation ? (
                    <div className="text-center py-8 text-muted-foreground">No reconciliation data available</div>
                  ) : (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="p-3 bg-success/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Bank POS Total</div><div className="text-lg font-bold text-success">SAR {reconciliation.summary.total_bank_pos.toFixed(0)}</div></div>
                        <div className="p-3 bg-primary/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">App Sales Total</div><div className="text-lg font-bold text-primary">SAR {reconciliation.summary.total_app_sales.toFixed(0)}</div></div>
                        <div className={`p-3 rounded-xl text-center ${Math.abs(reconciliation.summary.total_difference) < 1 ? 'bg-success/10' : 'bg-error/10'}`}><div className="text-xs text-muted-foreground">Difference</div><div className={`text-lg font-bold ${Math.abs(reconciliation.summary.total_difference) < 1 ? 'text-success' : 'text-error'}`}>SAR {reconciliation.summary.total_difference.toFixed(2)}</div></div>
                        <div className="p-3 bg-success/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Matched</div><div className="text-lg font-bold text-success">{reconciliation.summary.matched_count}</div></div>
                        <div className="p-3 bg-warning/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Discrepancies</div><div className="text-lg font-bold text-warning">{reconciliation.summary.discrepancy_count}</div></div>
                      </div>

                      {/* Side-by-side Table */}
                      <div className="max-h-[500px] overflow-y-auto border rounded-xl">
                        <div className="overflow-x-auto"><table className="w-full" data-testid="reconciliation-table">
                          <thead className="sticky top-0 bg-stone-50 z-10"><tr className="border-b">
                            <th className="text-left p-2 text-xs font-medium">Bank Date</th>
                            <th className="text-left p-2 text-xs font-medium">Sale Date</th>
                            <th className="text-left p-2 text-xs font-medium">Branch</th>
                            <th className="text-right p-2 text-xs font-medium">Bank POS</th>
                            <th className="text-right p-2 text-xs font-medium">App Sales</th>
                            <th className="text-right p-2 text-xs font-medium">Difference</th>
                            <th className="text-center p-2 text-xs font-medium">Status</th>
                          </tr></thead>
                          <tbody>
                            {reconciliation.rows.map((r, i) => (
                              <tr key={i} className={`border-b hover:bg-stone-50 ${r.status === 'matched' ? '' : r.status === 'bank_only' ? 'bg-warning/5' : r.status === 'app_only' ? 'bg-info/5' : 'bg-error/5'}`}>
                                <td className="p-2 text-sm">{r.deposit_date}</td>
                                <td className="p-2 text-sm">{r.sale_date || <span className="text-muted-foreground">-</span>}</td>
                                <td className="p-2 text-sm">{r.branch}</td>
                                <td className="p-2 text-sm text-right font-medium text-success">{r.bank_amount > 0 ? `SAR ${r.bank_amount.toFixed(2)}` : '-'}</td>
                                <td className="p-2 text-sm text-right font-medium text-primary">{r.app_amount > 0 ? `SAR ${r.app_amount.toFixed(2)}` : '-'}</td>
                                <td className={`p-2 text-sm text-right font-bold ${Math.abs(r.difference) < 1 ? 'text-success' : 'text-error'}`}>{r.difference !== 0 ? `SAR ${r.difference.toFixed(2)}` : '-'}</td>
                                <td className="p-2 text-center">
                                  <Badge className={
                                    r.status === 'matched' ? 'bg-success/20 text-success' :
                                    r.status === 'bank_only' ? 'bg-warning/20 text-warning' :
                                    r.status === 'app_only' ? 'bg-info/20 text-info' :
                                    'bg-error/20 text-error'
                                  }>{r.status === 'matched' ? 'Matched' : r.status === 'bank_only' ? 'Bank Only' : r.status === 'app_only' ? 'App Only' : 'Mismatch'}</Badge>
                                </td>
                              </tr>
                            ))}
                            {reconciliation.rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No POS transactions to reconcile. Ensure POS machines are mapped to branches.</td></tr>}
                          </tbody>
                        </table></div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="senders">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-muted-foreground">Grouped by sender/receiver - totals at bottom</p>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
                      if (!analysis?.senders) return;
                      const csv = 'Name,IBAN,Bank,Count,Received,Sent,Fees,VAT,Period\n' + analysis.senders.map(s => `"${s.name}","${(s.iban||[])[0]||''}","${(s.bank||[])[0]||''}",${s.count},${s.total_credit.toFixed(2)},${s.total_debit.toFixed(2)},${(s.fees||0).toFixed(2)},${(s.vat||0).toFixed(2)},"${s.first_date}-${s.last_date}"`).join('\n');
                      const blob = new Blob([csv], {type: 'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'senders_receivers.csv'; a.click();
                      toast.success('Exported');
                    }}><Upload size={14} className="mr-1" />Export CSV</Button>
                  </div>
                  <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-stone-50"><th className="text-left p-2 text-xs font-medium">Name / IBAN / Bank</th><th className="text-center p-2 text-xs font-medium">Times</th><th className="text-right p-2 text-xs font-medium">Received</th><th className="text-right p-2 text-xs font-medium">Sent</th><th className="text-right p-2 text-xs font-medium">Fees/VAT</th><th className="text-left p-2 text-xs font-medium">Period</th></tr></thead>
                  <tbody>{analysis?.senders?.map((s, i) => (
                    <tr key={i} className="border-b hover:bg-stone-50">
                      <td className="p-2 text-sm font-medium max-w-xs">
                        <div>{s.name}</div>
                        {s.iban?.length > 0 && <div className="text-xs text-muted-foreground font-mono mt-0.5">{s.iban[0]}</div>}
                        {s.bank?.length > 0 && <div className="text-xs text-info">{s.bank[0]}</div>}
                      </td>
                      <td className="p-2 text-center"><Badge variant="secondary">{s.count}x</Badge></td>
                      <td className="p-2 text-sm text-right text-success">{s.total_credit > 0 ? `SAR ${s.total_credit.toFixed(2)}` : '-'}</td>
                      <td className="p-2 text-sm text-right text-error">{s.total_debit > 0 ? `SAR ${s.total_debit.toFixed(2)}` : '-'}</td>
                      <td className="p-2 text-xs text-right">{(s.fees || 0) > 0 && <span className="text-warning">Fee:{s.fees.toFixed(1)}</span>}{(s.vat || 0) > 0 && <span className="text-error ml-1">VAT:{s.vat.toFixed(1)}</span>}</td>
                      <td className="p-2 text-xs text-muted-foreground">{s.first_date}{s.first_date !== s.last_date ? ` → ${s.last_date}` : ''}</td>
                    </tr>
                  ))}
                  <tr className="bg-primary/10 font-bold border-t-2">
                    <td className="p-2 text-sm">TOTAL ({analysis?.senders?.length || 0} groups)</td>
                    <td className="p-2 text-center">{analysis?.senders?.reduce((s,x) => s + x.count, 0)}</td>
                    <td className="p-2 text-sm text-right text-success">SAR {(analysis?.senders?.reduce((s,x) => s + x.total_credit, 0) || 0).toFixed(2)}</td>
                    <td className="p-2 text-sm text-right text-error">SAR {(analysis?.senders?.reduce((s,x) => s + x.total_debit, 0) || 0).toFixed(2)}</td>
                    <td className="p-2 text-xs text-right">Fee:{(analysis?.senders?.reduce((s,x) => s + (x.fees||0), 0) || 0).toFixed(1)}</td>
                    <td></td>
                  </tr>
                  </tbody></table></div>
                </TabsContent>

                <TabsContent value="pos" className="space-y-4">
                  <p className="text-sm text-muted-foreground">POS machines with sales (MADA/VISA/MC), fees, VAT breakdown</p>
                  {analysis?.pos_by_machine && Object.entries(analysis.pos_by_machine).sort((a,b) => b[1].sales_total - a[1].sales_total).map(([mid, data]) => (
                    <div key={mid} className="border rounded-xl p-4 hover:bg-stone-50 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div><span className="font-mono text-sm font-bold">{mid}</span><Badge className="ml-2 bg-primary/20 text-primary">{data.branch}</Badge></div>
                        <div className="text-right"><div className="text-lg font-bold text-success">SAR {data.sales_total.toFixed(2)}</div><div className="text-xs text-muted-foreground">{data.sales_count} sales | Net: SAR {data.net.toFixed(2)}</div></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="p-2 bg-green-50 rounded-lg text-center"><div className="text-xs text-muted-foreground">MADA</div><div className="text-sm font-bold text-green-700">SAR {data.mada.toFixed(0)}</div>{data.mada_fee > 0 && <div className="text-xs text-error">Fee: -{data.mada_fee.toFixed(2)}</div>}</div>
                        <div className="p-2 bg-blue-50 rounded-lg text-center"><div className="text-xs text-muted-foreground">VISA</div><div className="text-sm font-bold text-blue-700">SAR {data.visa.toFixed(0)}</div>{data.visa_fee > 0 && <div className="text-xs text-error">Fee: -{data.visa_fee.toFixed(2)}</div>}</div>
                        <div className="p-2 bg-orange-50 rounded-lg text-center"><div className="text-xs text-muted-foreground">MasterCard</div><div className="text-sm font-bold text-orange-700">SAR {data.mastercard.toFixed(0)}</div>{data.mc_fee > 0 && <div className="text-xs text-error">Fee: -{data.mc_fee.toFixed(2)}</div>}</div>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-success">Total In: SAR {data.sales_total.toFixed(2)}</span>
                        <span className="text-error">Fees: -SAR {data.fees.toFixed(2)}</span>
                        <span className="text-error">VAT: -SAR {data.vat.toFixed(2)}</span>
                        <span className="font-bold">Net: SAR {data.net.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {(!analysis?.pos_by_machine || Object.keys(analysis.pos_by_machine).length === 0) && <p className="text-center text-muted-foreground py-8">No POS machines detected</p>}
                </TabsContent>

                <TabsContent value="mismatch" className="space-y-4">
                  {analysis?.mismatches?.length > 0 ? analysis.mismatches.map((m, i) => (
                    <div key={i} className={`p-4 border rounded-xl ${Math.abs(m.difference) > 100 ? 'bg-error/5 border-error/30' : 'bg-warning/5 border-warning/30'}`}>
                      <div className="flex justify-between items-center"><div><div className="font-bold">{m.branch}</div><div className="text-xs text-muted-foreground mt-1">Bank POS: SAR {m.bank_amount.toFixed(2)} | System: SAR {m.system_amount.toFixed(2)}</div></div>
                        <Badge className={Math.abs(m.difference) > 100 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>Diff: SAR {m.difference.toFixed(2)}</Badge>
                      </div>
                    </div>
                  )) : <div className="text-center py-8"><AlertTriangle size={24} className="mx-auto mb-2 text-success" /><p className="text-success font-medium">No major mismatches detected</p><p className="text-xs text-muted-foreground">Map POS machines to branches first for accurate comparison</p></div>}
                </TabsContent>

                <TabsContent value="suppliers" className="space-y-4">
                  <p className="text-sm text-muted-foreground">Matches bank transactions to suppliers by name or account number. Add account numbers to suppliers for better matching.</p>
                  {analysis?.supplier_summary?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Supplier Summary</p>
                      {analysis.supplier_summary.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-xl">
                          <div><span className="font-medium">{s.name}</span><Badge className="ml-2" variant="secondary">{s.match_type === 'account' ? 'By Account #' : 'By Name'}</Badge></div>
                          <div className="flex items-center gap-4"><Badge variant="secondary">{s.count}x</Badge><span className="font-bold text-error">SAR {s.total.toFixed(2)}</span><span className="text-xs text-muted-foreground">{s.first_date} → {s.last_date}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Transaction</th><th className="text-left p-2 text-xs font-medium">Supplier</th><th className="text-left p-2 text-xs font-medium">Match</th><th className="text-right p-2 text-xs font-medium">Amount</th><th className="text-left p-2 text-xs font-medium">Date</th></tr></thead>
                  <tbody>{analysis?.supplier_matches?.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-stone-50"><td className="p-2 text-xs max-w-xs truncate">{m.transaction}</td><td className="p-2"><Badge className="bg-primary/20 text-primary">{m.supplier}</Badge></td><td className="p-2"><Badge variant="outline" className="text-xs">{m.match_type}</Badge></td><td className="p-2 text-sm text-right font-bold text-error">SAR {m.amount.toFixed(2)}</td><td className="p-2 text-xs">{m.date}</td></tr>
                  ))}{(!analysis?.supplier_matches || analysis.supplier_matches.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Add supplier account numbers in Suppliers page for auto-matching</td></tr>}</tbody></table></div>
                </TabsContent>

                <TabsContent value="daily"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-right p-2 text-xs font-medium">In</th><th className="text-right p-2 text-xs font-medium">Out</th><th className="text-right p-2 text-xs font-medium">Net</th></tr></thead>
                <tbody>{detail.daily_summary?.map(d => (<tr key={d.date} className="border-b hover:bg-stone-50"><td className="p-2 text-sm">{d.date}</td><td className="p-2 text-sm text-right text-success">SAR {d.credit.toFixed(2)}</td><td className="p-2 text-sm text-right text-error">SAR {d.debit.toFixed(2)}</td><td className={`p-2 text-sm text-right font-bold ${d.credit-d.debit>=0?'text-success':'text-error'}`}>SAR {(d.credit-d.debit).toFixed(2)}</td></tr>))}</tbody></table></div></TabsContent>

                <TabsContent value="all"><div className="max-h-96 overflow-y-auto"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b sticky top-0 bg-white"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-left p-2 text-xs font-medium">Cat</th><th className="text-left p-2 text-xs font-medium">Description</th><th className="text-right p-2 text-xs font-medium">In</th><th className="text-right p-2 text-xs font-medium">Out</th></tr></thead>
                <tbody>{detail.transactions?.map((t, i) => (<tr key={i} className="border-b hover:bg-stone-50 text-xs"><td className="p-2">{t.date}</td><td className="p-2"><Badge variant="secondary" className="text-xs">{CAT_LABELS[t.category]||t.category}</Badge></td><td className="p-2 max-w-md truncate">{t.description}</td><td className="p-2 text-right text-success">{t.credit>0?`${t.credit.toFixed(2)}`:''}</td><td className="p-2 text-right text-error">{t.debit>0?`${t.debit.toFixed(2)}`:''}</td></tr>))}</tbody></table></div></div></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* POS Machine Manager */}
        <Dialog open={showPosManager} onOpenChange={setShowPosManager}>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="font-outfit">POS Machine → Branch Mapping</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">Add POS machines manually or auto-detected from statements</p>
            
            {/* Manual Add */}
            <div className="flex gap-2 items-end p-3 bg-stone-50 rounded-xl border mb-3">
              <div className="flex-1"><Label className="text-xs">Machine ID</Label><Input id="new-pos-id" placeholder="e.g., 6377290677581211" className="h-8 font-mono" /></div>
              <div className="w-32"><Label className="text-xs">Label</Label><Input id="new-pos-label" placeholder="POS 1" className="h-8" /></div>
              <div className="w-36"><Label className="text-xs">Branch</Label>
                <Select onValueChange={(v) => document.getElementById('new-pos-branch').value = v === "none" ? "" : v}><SelectTrigger className="h-8"><SelectValue placeholder="Branch" /></SelectTrigger><SelectContent><SelectItem value="none">Select</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
                <input type="hidden" id="new-pos-branch" />
              </div>
              <Button size="sm" className="h-8 rounded-xl" onClick={() => {
                const mid = document.getElementById('new-pos-id').value;
                const label = document.getElementById('new-pos-label').value;
                const bid = document.getElementById('new-pos-branch').value;
                if (!mid) { toast.error('Enter machine ID'); return; }
                savePosMapping(mid, bid, label);
                document.getElementById('new-pos-id').value = '';
                document.getElementById('new-pos-label').value = '';
              }}>Add</Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {/* Existing mapped machines */}
              {posMachines.map(pm => (
                <div key={pm.machine_id} className="flex gap-2 items-center p-2 border rounded-xl bg-success/5">
                  <span className="font-mono text-xs flex-1">{pm.machine_id}</span>
                  <Badge variant="secondary">{pm.label || 'No label'}</Badge>
                  <Badge className="bg-success/20 text-success">{branches.find(b => b.id === pm.branch_id)?.name || 'Unmapped'}</Badge>
                  <Button size="sm" variant="ghost" className="h-6 text-error" onClick={async () => { await api.delete(`/pos-machines/${pm.machine_id}`); fetchData(); }}><Trash2 size={12} /></Button>
                </div>
              ))}
              {/* Unmapped machines from statements */}
              {(() => {
                const mapped = new Set(posMachines.map(p => p.machine_id));
                const unmapped = new Set();
                statements.forEach(s => { if (s.pos_machines) Object.keys(s.pos_machines).forEach(m => { if (!mapped.has(m)) unmapped.add(m); }); });
                if (detail?.pos_machines) Object.keys(detail.pos_machines).forEach(m => { if (!mapped.has(m)) unmapped.add(m); });
                return [...unmapped].map(mid => (
                  <div key={mid} className="flex gap-2 items-center p-2 border rounded-xl bg-warning/5">
                    <span className="font-mono text-xs flex-1">{mid}</span>
                    <Badge className="bg-warning/20 text-warning">Unmapped</Badge>
                    <Select onValueChange={(v) => savePosMapping(mid, v === "none" ? "" : v, "")}>
                      <SelectTrigger className="w-32 h-7"><SelectValue placeholder="Assign" /></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ));
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
