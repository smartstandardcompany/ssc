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
import { toast } from 'sonner';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];
const CAT_LABELS = { pos_sales: 'POS Sales', bank_fees: 'Bank Fees/VAT', internal_transfer: 'Internal Transfers', incoming_transfer: 'Incoming Transfers', salary: 'Salary', vat: 'VAT', other: 'Other' };

export default function BankStatementsPage() {
  const [statements, setStatements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [posMachines, setPosMachines] = useState([]);
  const [detail, setDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ bank_name: '', branch_id: '' });
  const [showPosManager, setShowPosManager] = useState(false);

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const [sR, bR, pR] = await Promise.all([api.get('/bank-statements'), api.get('/branches'), api.get('/pos-machines')]); setStatements(sR.data); setBranches(bR.data); setPosMachines(pR.data); }
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
                <TabsList className="flex-wrap"><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="senders">Senders/Receivers</TabsTrigger><TabsTrigger value="pos">POS by Branch</TabsTrigger><TabsTrigger value="mismatch">Mismatches</TabsTrigger><TabsTrigger value="suppliers">Supplier Payments</TabsTrigger><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="all">All Transactions</TabsTrigger></TabsList>

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

                <TabsContent value="senders">
                  <p className="text-sm text-muted-foreground mb-3">Grouped by sender/receiver name - shows frequency and total amounts</p>
                  <table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Name</th><th className="text-center p-2 text-xs font-medium">Times</th><th className="text-right p-2 text-xs font-medium">Received</th><th className="text-right p-2 text-xs font-medium">Sent</th><th className="text-left p-2 text-xs font-medium">Period</th></tr></thead>
                  <tbody>{analysis?.senders?.map((s, i) => (
                    <tr key={i} className="border-b hover:bg-stone-50"><td className="p-2 text-sm font-medium max-w-xs truncate">{s.name}</td><td className="p-2 text-center"><Badge variant="secondary">{s.count}</Badge></td><td className="p-2 text-sm text-right text-success">{s.total_credit > 0 ? `SAR ${s.total_credit.toFixed(0)}` : '-'}</td><td className="p-2 text-sm text-right text-error">{s.total_debit > 0 ? `SAR ${s.total_debit.toFixed(0)}` : '-'}</td><td className="p-2 text-xs text-muted-foreground">{s.first_date} - {s.last_date}</td></tr>
                  ))}</tbody></table>
                </TabsContent>

                <TabsContent value="pos" className="space-y-4">
                  <p className="text-sm text-muted-foreground">POS machines detected in bank statement. Map each to a branch for reconciliation.</p>
                  {analysis?.pos_by_branch && Object.entries(analysis.pos_by_branch).map(([bname, data]) => (
                    <div key={bname} className="p-4 border rounded-xl">
                      <div className="flex justify-between items-center"><span className="font-bold">{bname}</span><div className="text-right"><div className="text-success font-bold">SAR {data.total.toFixed(2)}</div><div className="text-xs text-muted-foreground">{data.count} txns | {data.machines?.length} machines</div></div></div>
                      <div className="flex gap-1 mt-2 flex-wrap">{data.machines?.map(m => <Badge key={m} variant="outline" className="text-xs font-mono">{m}</Badge>)}</div>
                    </div>
                  ))}
                  {detail?.pos_machines && Object.entries(detail.pos_machines).length > 0 && (
                    <div className="p-3 bg-stone-50 rounded-xl"><p className="text-xs font-medium mb-2">Map machines to branches (click "POS Machine Settings" above)</p></div>
                  )}
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

                <TabsContent value="suppliers">
                  <p className="text-sm text-muted-foreground mb-3">Bank debits that match your supplier names</p>
                  <table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Transaction</th><th className="text-left p-2 text-xs font-medium">Supplier Match</th><th className="text-right p-2 text-xs font-medium">Amount</th><th className="text-left p-2 text-xs font-medium">Date</th></tr></thead>
                  <tbody>{analysis?.supplier_matches?.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-stone-50"><td className="p-2 text-sm max-w-xs truncate">{m.transaction}</td><td className="p-2"><Badge className="bg-primary/20 text-primary">{m.supplier}</Badge></td><td className="p-2 text-sm text-right font-bold text-error">SAR {m.amount.toFixed(2)}</td><td className="p-2 text-xs">{m.date}</td></tr>
                  ))}{(!analysis?.supplier_matches || analysis.supplier_matches.length === 0) && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No supplier matches found. Add suppliers with correct names to auto-match.</td></tr>}</tbody></table>
                </TabsContent>

                <TabsContent value="daily"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-right p-2 text-xs font-medium">In</th><th className="text-right p-2 text-xs font-medium">Out</th><th className="text-right p-2 text-xs font-medium">Net</th></tr></thead>
                <tbody>{detail.daily_summary?.map(d => (<tr key={d.date} className="border-b hover:bg-stone-50"><td className="p-2 text-sm">{d.date}</td><td className="p-2 text-sm text-right text-success">SAR {d.credit.toFixed(2)}</td><td className="p-2 text-sm text-right text-error">SAR {d.debit.toFixed(2)}</td><td className={`p-2 text-sm text-right font-bold ${d.credit-d.debit>=0?'text-success':'text-error'}`}>SAR {(d.credit-d.debit).toFixed(2)}</td></tr>))}</tbody></table></TabsContent>

                <TabsContent value="all"><div className="max-h-96 overflow-y-auto"><table className="w-full"><thead><tr className="border-b sticky top-0 bg-white"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-left p-2 text-xs font-medium">Cat</th><th className="text-left p-2 text-xs font-medium">Description</th><th className="text-right p-2 text-xs font-medium">In</th><th className="text-right p-2 text-xs font-medium">Out</th></tr></thead>
                <tbody>{detail.transactions?.map((t, i) => (<tr key={i} className="border-b hover:bg-stone-50 text-xs"><td className="p-2">{t.date}</td><td className="p-2"><Badge variant="secondary" className="text-xs">{CAT_LABELS[t.category]||t.category}</Badge></td><td className="p-2 max-w-md truncate">{t.description}</td><td className="p-2 text-right text-success">{t.credit>0?`${t.credit.toFixed(2)}`:''}</td><td className="p-2 text-right text-error">{t.debit>0?`${t.debit.toFixed(2)}`:''}</td></tr>))}</tbody></table></div></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* POS Machine Manager */}
        <Dialog open={showPosManager} onOpenChange={setShowPosManager}>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="font-outfit">POS Machine → Branch Mapping</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">Link each POS machine number to a branch for accurate reconciliation</p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {/* Show machines from all statements */}
              {(() => {
                const allMachines = new Set();
                statements.forEach(s => { if (s.pos_machines) Object.keys(s.pos_machines).forEach(m => allMachines.add(m)); });
                // Also from detail
                if (detail?.pos_machines) Object.keys(detail.pos_machines).forEach(m => allMachines.add(m));
                const machines = [...allMachines];
                if (machines.length === 0) return <p className="text-center text-muted-foreground py-4">Upload a statement first to detect POS machines</p>;
                return machines.map(mid => {
                  const existing = posMachines.find(p => p.machine_id === mid);
                  return (
                    <div key={mid} className="flex gap-3 items-center p-3 border rounded-xl">
                      <span className="font-mono text-xs flex-1">{mid}</span>
                      <Select defaultValue={existing?.branch_id || "none"} onValueChange={(v) => savePosMapping(mid, v === "none" ? "" : v, "")}>
                        <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Select branch" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Unmapped</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  );
                });
              })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
