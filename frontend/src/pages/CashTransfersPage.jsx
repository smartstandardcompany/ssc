import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { DateFilter } from '@/components/DateFilter';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CashTransfersPage() {
  const { t } = useLanguage();
  const [transfers, setTransfers] = useState([]);
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [branchFilter, setBranchFilter] = useState([]);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });
  const [formData, setFormData] = useState({ from_branch_id: '', to_branch_id: '', amount: '', transfer_mode: 'cash', sender_name: '', receiver_name: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tRes, , eRes] = await Promise.all([api.get('/cash-transfers?limit=5000'), Promise.resolve({ data: [] }), api.get('/employees')]);
      setTransfers(tRes.data?.data || tRes.data || []); setEmployees(eRes.data?.data || eRes.data || []);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cash-transfers', { ...formData, amount: parseFloat(formData.amount), from_branch_id: formData.from_branch_id || null, to_branch_id: formData.to_branch_id || null, date: new Date(formData.date).toISOString() });
      toast.success('Cash transfer recorded');
      setShowDialog(false);
      setFormData({ from_branch_id: '', to_branch_id: '', amount: '', transfer_mode: 'cash', sender_name: '', receiver_name: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this transfer?')) {
      try { await api.delete(`/cash-transfers/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const filtered = transfers.filter(t => {
    if (branchFilter.length > 0 && !branchFilter.includes(t.from_branch_id) && !branchFilter.includes(t.to_branch_id)) return false;
    if (dateFilter.start && dateFilter.end) { const d = new Date(t.date); return d >= dateFilter.start && d <= dateFilter.end; }
    return true;
  });
  const totalTransferred = filtered.reduce((s, t) => s + t.amount, 0);
  
  // Company balance: incoming from branches - outgoing to branches
  const companyIncoming = transfers.filter(t => !t.to_branch_id && t.from_branch_id).reduce((s, t) => s + t.amount, 0);
  const companyOutgoing = transfers.filter(t => t.to_branch_id && !t.from_branch_id).reduce((s, t) => s + t.amount, 0);
  const companyCash = transfers.filter(t => !t.to_branch_id && t.from_branch_id && t.transfer_mode === 'cash').reduce((s, t) => s + t.amount, 0) - transfers.filter(t => t.to_branch_id && !t.from_branch_id && t.transfer_mode === 'cash').reduce((s, t) => s + t.amount, 0);
  const companyBank = transfers.filter(t => !t.to_branch_id && t.from_branch_id && t.transfer_mode === 'bank').reduce((s, t) => s + t.amount, 0) - transfers.filter(t => t.to_branch_id && !t.from_branch_id && t.transfer_mode === 'bank').reduce((s, t) => s + t.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="cash-transfers-title">Cash Transfers</h1>
            <p className="text-muted-foreground">Track cash movements between branches and office</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild><Button className="rounded-full" data-testid="add-transfer-btn"><Plus size={18} className="mr-2" />New Transfer</Button></DialogTrigger>
              <DialogContent data-testid="transfer-dialog">
                <DialogHeader><DialogTitle className="font-outfit">Record Cash Transfer</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>From</Label>
                      <Select value={formData.from_branch_id || "office"} onValueChange={(v) => setFormData({ ...formData, from_branch_id: v === "office" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="office">Company / Head Office</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>To</Label>
                      <Select value={formData.to_branch_id || "office"} onValueChange={(v) => setFormData({ ...formData, to_branch_id: v === "office" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="office">Company / Head Office</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Amount *</Label><Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required data-testid="transfer-amount" /></div>
                    <div><Label>Mode</Label>
                      <Select value={formData.transfer_mode} onValueChange={(v) => setFormData({ ...formData, transfer_mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank Transfer</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Sender Name *</Label><Input value={formData.sender_name} onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })} required placeholder="Employee who sends" data-testid="sender-name" /></div>
                    <div><Label>Receiver Name *</Label><Input value={formData.receiver_name} onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })} required placeholder="Employee who receives" data-testid="receiver-name" /></div>
                    <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
                    <div><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" /></div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="rounded-full" data-testid="submit-transfer">Record Transfer</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-stone-100 border-primary/30 bg-gradient-to-r from-primary/5 to-amber-50">
          <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Company / Head Office Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-white rounded-xl text-center"><div className="text-xs text-muted-foreground">From Branches</div><div className="text-lg font-bold text-success">SAR {companyIncoming.toFixed(2)}</div></div>
              <div className="p-3 bg-white rounded-xl text-center"><div className="text-xs text-muted-foreground">To Branches</div><div className="text-lg font-bold text-error">SAR {companyOutgoing.toFixed(2)}</div></div>
              <div className="p-3 bg-cash/10 rounded-xl text-center border border-cash/20"><div className="text-xs text-muted-foreground">Cash at Company</div><div className="text-lg font-bold text-cash">SAR {companyCash.toFixed(2)}</div></div>
              <div className="p-3 bg-bank/10 rounded-xl text-center border border-bank/20"><div className="text-xs text-muted-foreground">Bank at Company</div><div className="text-lg font-bold text-bank">SAR {companyBank.toFixed(2)}</div></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Move cash/bank from branches to Company or Company to branches using "New Transfer"</p>
          </CardContent>
        </Card>

        <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Transferred</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-primary"> SAR {totalTransferred.toFixed(2)}</div></CardContent></Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Transfers</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="transfers-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Date</th>
                  <th className="text-left p-3 font-medium text-sm">From</th>
                  <th className="text-center p-3 font-medium text-sm"></th>
                  <th className="text-left p-3 font-medium text-sm">To</th>
                  <th className="text-right p-3 font-medium text-sm">Amount</th>
                  <th className="text-left p-3 font-medium text-sm hidden sm:table-cell">Mode</th>
                  <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Sender</th>
                  <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Receiver</th>
                  <th className="text-left p-3 font-medium text-sm hidden lg:table-cell">Notes</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b border-border hover:bg-secondary/50" data-testid="transfer-row">
                      <td className="p-3 text-sm">{format(new Date(t.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-sm font-medium">{t.from_branch_name || 'Office'}</td>
                      <td className="p-3 text-center"><ArrowRight size={16} className="text-primary mx-auto" /></td>
                      <td className="p-3 text-sm font-medium">{t.to_branch_name || 'Office'}</td>
                      <td className="p-3 text-sm text-right font-bold"> SAR {t.amount.toFixed(2)}</td>
                      <td className="p-3 hidden sm:table-cell"><Badge variant="secondary" className="capitalize">{t.transfer_mode}</Badge></td>
                      <td className="p-3 text-sm hidden md:table-cell">{t.sender_name}</td>
                      <td className="p-3 text-sm hidden md:table-cell">{t.receiver_name}</td>
                      <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">{t.notes || '-'}</td>
                      <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => handleDelete(t.id)} className="h-8 text-error hover:text-error"><Trash2 size={14} /></Button></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No transfers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
