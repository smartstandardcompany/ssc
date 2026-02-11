import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';

const TXN_TYPES = [
  { value: 'investment', label: 'Investment / Deposit', color: 'bg-success/20 text-success' },
  { value: 'withdrawal', label: 'Withdrawal', color: 'bg-error/20 text-error' },
  { value: 'profit_share', label: 'Profit Share', color: 'bg-warning/20 text-warning' },
  { value: 'expense', label: 'Expense', color: 'bg-info/20 text-info' },
  { value: 'other', label: 'Other', color: 'bg-stone-200 text-stone-700' },
];

export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [showTxnDialog, setShowTxnDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [branchFilter, setBranchFilter] = useState([]);
  const [partnerData, setPartnerData] = useState({ name: '', phone: '', email: '', share_percentage: '', notes: '' });
  const [txnData, setTxnData] = useState({ partner_id: '', transaction_type: 'investment', amount: '', payment_mode: 'cash', branch_id: '', description: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try {
      const [pR, tR, bR] = await Promise.all([api.get('/partners'), api.get('/partner-transactions'), api.get('/branches')]);
      setPartners(pR.data); setTransactions(tR.data); setBranches(bR.data);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  const handleAddPartner = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...partnerData, share_percentage: parseFloat(partnerData.share_percentage) || 0 };
      if (editingPartner) { await api.put(`/partners/${editingPartner.id}`, payload); toast.success('Updated'); }
      else { await api.post('/partners', payload); toast.success('Partner added'); }
      setShowPartnerDialog(false); setPartnerData({ name: '', phone: '', email: '', share_percentage: '', notes: '' }); setEditingPartner(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddTxn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/partner-transactions', { ...txnData, amount: parseFloat(txnData.amount), branch_id: txnData.branch_id || null, date: new Date(txnData.date).toISOString() });
      toast.success('Transaction recorded'); setShowTxnDialog(false); setTxnData({ partner_id: '', transaction_type: 'investment', amount: '', payment_mode: 'cash', branch_id: '', description: '', date: new Date().toISOString().split('T')[0] }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalInvested = partners.reduce((s, p) => s + (p.total_invested || 0), 0);
  const totalWithdrawn = partners.reduce((s, p) => s + (p.total_withdrawn || 0), 0);
  const filteredTxns = transactions.filter(t => branchFilter.length === 0 || branchFilter.includes(t.branch_id) || !t.branch_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2">Partners</h1>
            <p className="text-muted-foreground">Track partner investments, withdrawals & balances</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Dialog open={showPartnerDialog} onOpenChange={(o) => { setShowPartnerDialog(o); if (!o) { setEditingPartner(null); setPartnerData({ name: '', phone: '', email: '', share_percentage: '', notes: '' }); } }}>
              <DialogTrigger asChild><Button className="rounded-xl"><Plus size={16} className="mr-2" />Add Partner</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle className="font-outfit">{editingPartner ? 'Edit' : 'Add'} Partner</DialogTitle></DialogHeader>
                <form onSubmit={handleAddPartner} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name *</Label><Input value={partnerData.name} onChange={(e) => setPartnerData({ ...partnerData, name: e.target.value })} required /></div>
                    <div><Label>Share %</Label><Input type="number" step="0.1" value={partnerData.share_percentage} onChange={(e) => setPartnerData({ ...partnerData, share_percentage: e.target.value })} placeholder="0" /></div>
                    <div><Label>Phone</Label><Input value={partnerData.phone} onChange={(e) => setPartnerData({ ...partnerData, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={partnerData.email} onChange={(e) => setPartnerData({ ...partnerData, email: e.target.value })} /></div>
                  </div>
                  <Button type="submit" className="rounded-xl">{editingPartner ? 'Update' : 'Add'} Partner</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={showTxnDialog} onOpenChange={setShowTxnDialog}>
              <DialogTrigger asChild><Button variant="outline" className="rounded-xl"><DollarSign size={16} className="mr-2" />Transaction</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle className="font-outfit">Partner Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleAddTxn} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Partner *</Label><Select value={txnData.partner_id || "none"} onValueChange={(v) => setTxnData({ ...txnData, partner_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Type *</Label><Select value={txnData.transaction_type} onValueChange={(v) => setTxnData({ ...txnData, transaction_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TXN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Amount *</Label><Input type="number" step="0.01" value={txnData.amount} onChange={(e) => setTxnData({ ...txnData, amount: e.target.value })} required /></div>
                    <div><Label>Mode</Label><Select value={txnData.payment_mode} onValueChange={(v) => setTxnData({ ...txnData, payment_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                    <div><Label>Branch</Label><Select value={txnData.branch_id || "none"} onValueChange={(v) => setTxnData({ ...txnData, branch_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Overall" /></SelectTrigger><SelectContent><SelectItem value="none">Overall</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Date</Label><Input type="date" value={txnData.date} onChange={(e) => setTxnData({ ...txnData, date: e.target.value })} /></div>
                  </div>
                  <div><Label>Description</Label><Input value={txnData.description} onChange={(e) => setTxnData({ ...txnData, description: e.target.value })} /></div>
                  <Button type="submit" className="rounded-xl">Record Transaction</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Invested</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">SAR {totalInvested.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Withdrawn</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-error">SAR {totalWithdrawn.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Net Balance</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${totalInvested - totalWithdrawn >= 0 ? 'text-success' : 'text-error'}`}>SAR {(totalInvested - totalWithdrawn).toFixed(2)}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => (
            <Card key={p.id} className="border-stone-100 stat-card">
              <CardHeader><CardTitle className="font-outfit flex justify-between items-start">
                <div><span>{p.name}</span>{p.share_percentage > 0 && <Badge className="ml-2 bg-primary/20 text-primary">{p.share_percentage}%</Badge>}</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingPartner(p); setPartnerData({ name: p.name, phone: p.phone || '', email: p.email || '', share_percentage: p.share_percentage || '', notes: p.notes || '' }); setShowPartnerDialog(true); }} className="h-7"><Edit size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Delete?')) { await api.delete(`/partners/${p.id}`); fetchData(); } }} className="h-7 text-error"><Trash2 size={14} /></Button>
                </div>
              </CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between p-2 bg-success/10 rounded"><span className="text-xs flex items-center gap-1"><TrendingUp size={12} />Invested</span><span className="text-sm font-bold text-success">SAR {(p.total_invested || 0).toFixed(2)}</span></div>
                <div className="flex justify-between p-2 bg-error/10 rounded"><span className="text-xs flex items-center gap-1"><TrendingDown size={12} />Withdrawn</span><span className="text-sm font-bold text-error">SAR {(p.total_withdrawn || 0).toFixed(2)}</span></div>
                <div className="flex justify-between p-2 bg-primary/10 rounded border border-primary/20"><span className="text-xs font-medium">Balance</span><span className={`text-sm font-bold ${(p.balance || 0) >= 0 ? 'text-success' : 'text-error'}`}>SAR {(p.balance || 0).toFixed(2)}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTxns.length > 0 && (
          <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Recent Transactions</CardTitle></CardHeader><CardContent>
            <table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Partner</th><th className="text-left p-3 text-sm font-medium">Type</th><th className="text-left p-3 text-sm font-medium">Description</th><th className="text-left p-3 text-sm font-medium">Mode</th><th className="text-right p-3 text-sm font-medium">Amount</th><th className="text-right p-3 text-sm font-medium">Actions</th></tr></thead>
            <tbody>{filteredTxns.slice(0, 50).map(t => {
              const tc = TXN_TYPES.find(x => x.value === t.transaction_type);
              const isIn = t.transaction_type === 'investment';
              return (<tr key={t.id} className="border-b hover:bg-stone-50">
                <td className="p-3 text-sm">{format(new Date(t.date), 'MMM dd, yyyy')}</td>
                <td className="p-3 text-sm font-medium">{t.partner_name}</td>
                <td className="p-3"><Badge className={tc?.color || ''}>{tc?.label || t.transaction_type}</Badge></td>
                <td className="p-3 text-sm">{t.description || '-'}</td>
                <td className="p-3"><Badge variant="secondary" className="capitalize">{t.payment_mode}</Badge></td>
                <td className={`p-3 text-sm text-right font-bold ${isIn ? 'text-success' : 'text-error'}`}>{isIn ? '+' : '-'}SAR {t.amount.toFixed(2)}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Delete?')) { await api.delete(`/partner-transactions/${t.id}`); fetchData(); } }} className="h-7 text-error"><Trash2 size={12} /></Button></td>
              </tr>);
            })}</tbody></table>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
