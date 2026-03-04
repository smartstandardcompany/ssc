import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowRight, Check, X, PackageCheck, Trash2, ArrowLeftRight, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

export default function TransfersPage() {
  const { t } = useLanguage();
  const [transfers, setTransfers] = useState([]);
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [items, setItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ from_branch_id: '', to_branch_id: '', reason: '', notes: '', items: [{ item_id: '', quantity: '' }] });

  const fetchAll = async () => {
    try {
      const [tR, , iR] = await Promise.all([api.get('/stock-transfers'), Promise.resolve({ data: [] }), api.get('/items')]);
      setTransfers(tR.data); setItems(iR.data);
    } catch {}
  };

  useEffect(() => { fetchAll(); }, []);

  const pending = transfers.filter(t => t.status === 'pending');
  const approved = transfers.filter(t => t.status === 'approved');
  const history = transfers.filter(t => ['completed', 'rejected'].includes(t.status));

  const createTransfer = async () => {
    const validItems = form.items.filter(i => i.item_id && parseFloat(i.quantity) > 0);
    if (!form.from_branch_id || !form.to_branch_id) { toast.error('Select both branches'); return; }
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await api.post('/stock-transfers', { ...form, items: validItems.map(i => ({ item_id: i.item_id, quantity: parseFloat(i.quantity) })) });
      toast.success('Transfer request created');
      setShowCreate(false);
      setForm({ from_branch_id: '', to_branch_id: '', reason: '', notes: '', items: [{ item_id: '', quantity: '' }] });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const TransferCard = ({ t, showActions }) => (
    <Card className="border-stone-100 hover:shadow-sm transition-shadow" data-testid={`transfer-card-${t.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className={`text-xs border ${STATUS_STYLES[t.status]}`}>{t.status}</Badge>
            <span className="text-xs text-muted-foreground">{t.requested_at ? new Date(t.requested_at).toLocaleDateString('en-GB') : ''}</span>
          </div>
          <span className="text-xs text-muted-foreground">by {t.requested_by_name}</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-center p-2 bg-stone-50 rounded-lg">
            <p className="text-[10px] text-muted-foreground uppercase">From</p>
            <p className="text-sm font-bold">{t.from_branch_name}</p>
          </div>
          <ArrowRight size={18} className="text-stone-400 flex-shrink-0" />
          <div className="flex-1 text-center p-2 bg-stone-50 rounded-lg">
            <p className="text-[10px] text-muted-foreground uppercase">To</p>
            <p className="text-sm font-bold">{t.to_branch_name}</p>
          </div>
        </div>
        <div className="space-y-1 mb-3">
          {(t.items || []).map((item, i) => (
            <div key={i} className="flex justify-between text-xs bg-stone-50/50 px-2 py-1.5 rounded">
              <span className="font-medium">{item.item_name}</span>
              <span className="font-mono">{item.quantity} {item.unit || 'pc'}</span>
            </div>
          ))}
        </div>
        {t.reason && <p className="text-xs text-muted-foreground mb-2">Reason: {t.reason}</p>}
        {t.rejection_reason && <p className="text-xs text-red-600 mb-2">Rejected: {t.rejection_reason}</p>}
        {t.reviewed_by_name && <p className="text-[10px] text-muted-foreground">Reviewed by: {t.reviewed_by_name}</p>}
        {showActions && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {t.status === 'pending' && (
              <>
                <Button size="sm" className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600" data-testid="approve-btn"
                  onClick={async () => { try { await api.put(`/stock-transfers/${t.id}/approve`); toast.success('Approved'); fetchAll(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } }}>
                  <Check size={14} className="mr-1" />Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50" data-testid="reject-btn"
                  onClick={() => { setRejectDialog(t); setRejectReason(''); }}>
                  <X size={14} className="mr-1" />Reject
                </Button>
              </>
            )}
            {t.status === 'approved' && (
              <Button size="sm" className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-600" data-testid="complete-btn"
                onClick={async () => {
                  if (window.confirm('Complete transfer? This will adjust stock in both branches.')) {
                    try { await api.put(`/stock-transfers/${t.id}/complete`); toast.success('Transfer completed. Stock adjusted.'); fetchAll(); }
                    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
                  }
                }}>
                <PackageCheck size={14} className="mr-1" />Complete Transfer
              </Button>
            )}
            {(t.status === 'pending' || t.status === 'rejected') && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500"
                onClick={async () => { if (window.confirm('Delete?')) { try { await api.delete(`/stock-transfers/${t.id}`); fetchAll(); toast.success('Deleted'); } catch {} } }}>
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4" data-testid="transfers-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-outfit" data-testid="transfers-title">Inventory Transfers</h1>
            <p className="text-sm text-muted-foreground">Transfer stock between branches</p>
          </div>
          <Button className="rounded-xl" onClick={() => setShowCreate(true)} data-testid="new-transfer-btn">
            <Plus size={14} className="mr-1" />New Transfer
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-amber-100"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
            <p className="text-xl font-bold font-outfit text-amber-700">{pending.length}</p>
          </CardContent></Card>
          <Card className="border-blue-100"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium">Approved</p>
            <p className="text-xl font-bold font-outfit text-blue-700">{approved.length}</p>
          </CardContent></Card>
          <Card className="border-emerald-100"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-medium">Completed</p>
            <p className="text-xl font-bold font-outfit text-emerald-700">{transfers.filter(t => t.status === 'completed').length}</p>
          </CardContent></Card>
          <Card className="border-red-100"><CardContent className="p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">Rejected</p>
            <p className="text-xl font-bold font-outfit text-red-700">{transfers.filter(t => t.status === 'rejected').length}</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending"><Clock size={12} className="mr-1" />Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="grid grid-cols-2 gap-3" data-testid="pending-transfers">
              {pending.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No pending transfer requests</p>}
              {pending.map(t => <TransferCard key={t.id} t={t} showActions />)}
            </div>
          </TabsContent>

          <TabsContent value="approved">
            <div className="grid grid-cols-2 gap-3" data-testid="approved-transfers">
              {approved.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No approved transfers awaiting completion</p>}
              {approved.map(t => <TransferCard key={t.id} t={t} showActions />)}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="grid grid-cols-2 gap-3" data-testid="transfer-history">
              {history.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No transfer history</p>}
              {history.map(t => <TransferCard key={t.id} t={t} showActions={false} />)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Transfer Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg" data-testid="create-transfer-dialog">
            <DialogHeader><DialogTitle className="font-outfit">New Transfer Request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Source Branch (from)</Label>
                  <Select value={form.from_branch_id} onValueChange={(v) => setForm({ ...form, from_branch_id: v })}>
                    <SelectTrigger className="h-9" data-testid="from-branch"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Destination Branch (to)</Label>
                  <Select value={form.to_branch_id} onValueChange={(v) => setForm({ ...form, to_branch_id: v })}>
                    <SelectTrigger className="h-9" data-testid="to-branch"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{branches.filter(b => b.id !== form.from_branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1 block">Items</Label>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={item.item_id} onValueChange={(v) => {
                          const updated = [...form.items]; updated[i].item_id = v; setForm({ ...form, items: updated });
                        }}>
                          <SelectTrigger className="h-9 text-xs" data-testid={`item-select-${i}`}><SelectValue placeholder="Select item..." /></SelectTrigger>
                          <SelectContent>{items.map(it => <SelectItem key={it.id} value={it.id}>{it.name} ({it.unit || 'pc'})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Input type="number" placeholder="Qty" value={item.quantity}
                          onChange={(e) => { const updated = [...form.items]; updated[i].quantity = e.target.value; setForm({ ...form, items: updated }); }}
                          className="h-9 text-xs" data-testid={`item-qty-${i}`} />
                      </div>
                      {form.items.length > 1 && (
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => {
                          const updated = form.items.filter((_, idx) => idx !== i); setForm({ ...form, items: updated });
                        }}><X size={14} /></Button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => setForm({ ...form, items: [...form.items, { item_id: '', quantity: '' }] })}>
                    <Plus size={12} className="mr-1" />Add Item
                  </Button>
                </div>
              </div>

              <div><Label className="text-xs">Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why is this transfer needed?" className="h-9" data-testid="transfer-reason" /></div>
              <div><Label className="text-xs">Notes (optional)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." className="h-16 text-sm" /></div>

              <Button className="w-full rounded-xl" onClick={createTransfer} data-testid="submit-transfer-btn">
                <ArrowLeftRight size={14} className="mr-1" />Submit Transfer Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={!!rejectDialog} onOpenChange={(v) => !v && setRejectDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-outfit text-base">Reject Transfer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Reason for rejection</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this transfer being rejected?" className="h-20 text-sm" data-testid="reject-reason" /></div>
              <Button className="w-full rounded-xl bg-red-500 hover:bg-red-600" data-testid="confirm-reject-btn" onClick={async () => {
                try {
                  await api.put(`/stock-transfers/${rejectDialog.id}/reject`, { reason: rejectReason });
                  toast.success('Transfer rejected');
                  setRejectDialog(null); fetchAll();
                } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
              }}>Reject Transfer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
