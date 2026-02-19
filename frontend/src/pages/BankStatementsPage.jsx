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
import { Upload, Trash2, Eye, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import { BranchFilter } from '@/components/BranchFilter';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];
const CAT_LABELS = { pos_sales: 'POS Sales', bank_fees: 'Bank Fees/VAT', internal_transfer: 'Internal Transfers', incoming_transfer: 'Incoming Transfers', salary: 'Salary', vat: 'VAT', other: 'Other' };

export default function BankStatementsPage() {
  const [statements, setStatements] = useState([]);
  const [branches, setBranches] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState({ bank_name: '', branch_id: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const [sR, bR] = await Promise.all([api.get('/bank-statements'), api.get('/branches')]); setStatements(sR.data); setBranches(bR.data); }
    catch {} finally { setLoading(false); }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('bank_name', uploadData.bank_name);
      form.append('branch_id', uploadData.branch_id || '');
      const res = await api.post('/bank-statements/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Parsed ${res.data.transactions_parsed} transactions!`);
      fetchData();
      // Auto open detail
      const detailRes = await api.get(`/bank-statements/${res.data.id}`);
      setDetail(detailRes.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const viewDetail = async (id) => {
    try { const res = await api.get(`/bank-statements/${id}`); setDetail(res.data); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div><h1 className="text-4xl font-bold font-outfit mb-2">Bank Statements</h1><p className="text-muted-foreground">Upload & analyze bank statements, match POS sales</p></div>
        </div>

        {/* Upload Section */}
        <Card className="border-stone-100 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div><Label>Bank Name</Label><Input value={uploadData.bank_name} onChange={(e) => setUploadData({...uploadData, bank_name: e.target.value})} placeholder="e.g., Alinma Bank" className="h-10" /></div>
              <div><Label>Branch</Label>
                <Select value={uploadData.branch_id || "none"} onValueChange={(v) => setUploadData({...uploadData, branch_id: v === "none" ? "" : v})}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="All / Company" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">All / Company</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Upload Statement (PDF or Excel)</Label>
                <label className="cursor-pointer">
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => handleUpload(e.target.files[0])} />
                  <Button className="w-full h-10 rounded-xl" disabled={uploading} asChild><span><Upload size={16} className="mr-2" />{uploading ? 'Parsing...' : 'Upload & Analyze'}</span></Button>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statements List */}
        <Card className="border-stone-100">
          <CardHeader><CardTitle className="font-outfit text-base">Uploaded Statements</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statements.map(s => (
                <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-stone-50 transition-all">
                  <div>
                    <div className="font-medium">{s.bank_name || 'Unknown Bank'} - {s.file_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.period} | {s.transaction_count} transactions</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right"><div className="text-sm text-success font-bold">+SAR {s.total_credit?.toFixed(2)}</div><div className="text-sm text-error">-SAR {s.total_debit?.toFixed(2)}</div></div>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => viewDetail(s.id)}><Eye size={14} className="mr-1" />View</Button>
                    <Button size="sm" variant="ghost" className="text-error" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/bank-statements/${s.id}`); fetchData(); }}}><Trash2 size={14} /></Button>
                  </div>
                </div>
              ))}
              {statements.length === 0 && <p className="text-center text-muted-foreground py-8">No statements uploaded. Upload a PDF or Excel bank statement above.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-outfit">{detail?.bank_name} - Statement Analysis</DialogTitle></DialogHeader>
            {detail && (
              <Tabs defaultValue="summary">
                <TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="categories">Categories</TabsTrigger><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="pos">POS Machines</TabsTrigger><TabsTrigger value="transactions">All Transactions</TabsTrigger></TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-success/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Total In</div><div className="text-lg font-bold text-success">SAR {detail.total_credit?.toFixed(2)}</div></div>
                    <div className="p-3 bg-error/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Total Out</div><div className="text-lg font-bold text-error">SAR {detail.total_debit?.toFixed(2)}</div></div>
                    <div className="p-3 bg-primary/10 rounded-xl text-center"><div className="text-xs text-muted-foreground">Net</div><div className="text-lg font-bold text-primary">SAR {(detail.total_credit - detail.total_debit)?.toFixed(2)}</div></div>
                    <div className="p-3 bg-stone-50 rounded-xl text-center"><div className="text-xs text-muted-foreground">Transactions</div><div className="text-lg font-bold">{detail.transaction_count}</div></div>
                  </div>
                  {detail.daily_summary?.length > 0 && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={detail.daily_summary}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{fontSize: 9}} /><YAxis tick={{fontSize: 10}} /><Tooltip formatter={(v) => `SAR ${v.toFixed(2)}`} /><Legend />
                        <Bar dataKey="credit" name="Money In" fill="#22C55E" radius={[4,4,0,0]} /><Bar dataKey="debit" name="Money Out" fill="#EF4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </TabsContent>

                <TabsContent value="categories" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      {detail.categories && Object.entries(detail.categories).map(([cat, data], i) => (
                        <div key={cat} className="flex justify-between items-center p-3 border-b">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background: COLORS[i % COLORS.length]}} /><span className="text-sm font-medium">{CAT_LABELS[cat] || cat}</span><Badge variant="secondary">{data.count}</Badge></div>
                          <div className="text-right"><span className="text-success text-sm mr-3">+SAR {data.credit.toFixed(2)}</span><span className="text-error text-sm">-SAR {data.debit.toFixed(2)}</span></div>
                        </div>
                      ))}
                    </div>
                    {detail.categories && (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart><Pie data={Object.entries(detail.categories).filter(([,d]) => d.credit > 0).map(([k,v]) => ({name: CAT_LABELS[k]||k, value: v.credit}))} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>{Object.keys(detail.categories).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `SAR ${v.toFixed(2)}`} /></PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="daily">
                  <table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-right p-2 text-xs font-medium">Money In</th><th className="text-right p-2 text-xs font-medium">Money Out</th><th className="text-right p-2 text-xs font-medium">Net</th></tr></thead>
                  <tbody>{detail.daily_summary?.map(d => (
                    <tr key={d.date} className="border-b hover:bg-stone-50"><td className="p-2 text-sm">{d.date}</td><td className="p-2 text-sm text-right text-success">SAR {d.credit.toFixed(2)}</td><td className="p-2 text-sm text-right text-error">SAR {d.debit.toFixed(2)}</td><td className={`p-2 text-sm text-right font-bold ${d.credit - d.debit >= 0 ? 'text-success' : 'text-error'}`}>SAR {(d.credit - d.debit).toFixed(2)}</td></tr>
                  ))}</tbody></table>
                </TabsContent>

                <TabsContent value="pos" className="space-y-3">
                  <p className="text-sm text-muted-foreground">POS machines found in statement. Map each to a branch.</p>
                  {detail.pos_machines && Object.entries(detail.pos_machines).map(([mid, data]) => (
                    <div key={mid} className="flex justify-between items-center p-3 border rounded-xl">
                      <div><div className="font-mono text-sm font-medium">{mid}</div><div className="text-xs text-muted-foreground">{data.count} transactions</div></div>
                      <div className="text-right"><div className="font-bold text-success">SAR {data.total.toFixed(2)}</div></div>
                    </div>
                  ))}
                  {(!detail.pos_machines || Object.keys(detail.pos_machines).length === 0) && <p className="text-center text-muted-foreground py-4">No POS machines detected</p>}
                </TabsContent>

                <TabsContent value="transactions">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full"><thead><tr className="border-b sticky top-0 bg-white"><th className="text-left p-2 text-xs font-medium">Date</th><th className="text-left p-2 text-xs font-medium">Category</th><th className="text-left p-2 text-xs font-medium">Description</th><th className="text-right p-2 text-xs font-medium">In</th><th className="text-right p-2 text-xs font-medium">Out</th></tr></thead>
                    <tbody>{detail.transactions?.map((t, i) => (
                      <tr key={i} className="border-b hover:bg-stone-50 text-xs"><td className="p-2">{t.date}</td><td className="p-2"><Badge variant="secondary" className="text-xs capitalize">{CAT_LABELS[t.category] || t.category}</Badge></td><td className="p-2 max-w-md truncate">{t.description}</td><td className="p-2 text-right text-success">{t.credit > 0 ? `SAR ${t.credit.toFixed(2)}` : ''}</td><td className="p-2 text-right text-error">{t.debit > 0 ? `SAR ${t.debit.toFixed(2)}` : ''}</td></tr>
                    ))}</tbody></table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
