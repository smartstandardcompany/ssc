import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'license', label: 'License' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'permit', label: 'Permit' },
  { value: 'contract', label: 'Contract' },
  { value: 'employee_id', label: 'Employee ID' },
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({ name: '', document_type: 'license', document_number: '', related_to: '', issue_date: '', expiry_date: '', alert_days: 30, notes: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [docsRes, alertsRes] = await Promise.all([api.get('/documents'), api.get('/documents/alerts/upcoming')]);
      setDocuments(docsRes.data);
      setAlerts(alertsRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, alert_days: parseInt(formData.alert_days) || 30, issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : null, expiry_date: new Date(formData.expiry_date).toISOString() };
      if (editingDoc) { await api.put(`/documents/${editingDoc.id}`, payload); toast.success('Document updated'); }
      else { await api.post('/documents', payload); toast.success('Document added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({ name: doc.name, document_type: doc.document_type, document_number: doc.document_number || '', related_to: doc.related_to || '', issue_date: doc.issue_date ? new Date(doc.issue_date).toISOString().split('T')[0] : '', expiry_date: doc.expiry_date ? new Date(doc.expiry_date).toISOString().split('T')[0] : '', alert_days: doc.alert_days || 30, notes: doc.notes || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this document?')) {
      try { await api.delete(`/documents/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed to delete'); }
    }
  };

  const resetForm = () => { setFormData({ name: '', document_type: 'license', document_number: '', related_to: '', issue_date: '', expiry_date: '', alert_days: 30, notes: '' }); setEditingDoc(null); };

  const getStatusBadge = (doc) => {
    const status = doc.status;
    if (status === 'expired') return <Badge className="bg-error/20 text-error border-error/30"><XCircle size={12} className="mr-1" />Expired</Badge>;
    if (status === 'expiring_soon') return <Badge className="bg-warning/20 text-warning border-warning/30"><AlertTriangle size={12} className="mr-1" />Expiring Soon</Badge>;
    return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle size={12} className="mr-1" />Active</Badge>;
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const expiredCount = documents.filter(d => d.status === 'expired').length;
  const expiringCount = documents.filter(d => d.status === 'expiring_soon').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="documents-page-title">Documents</h1>
            <p className="text-muted-foreground">Track document expiry dates and get alerts</p>
          </div>
          <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="add-document-button"><Plus size={18} className="mr-2" />Add Document</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" data-testid="document-dialog">
              <DialogHeader><DialogTitle className="font-outfit">{editingDoc ? 'Edit' : 'Add'} Document</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Document Name *</Label><Input value={formData.name} data-testid="doc-name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                  <div><Label>Type *</Label>
                    <Select value={formData.document_type} onValueChange={(v) => setFormData({ ...formData, document_type: v })}>
                      <SelectTrigger data-testid="doc-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Document Number</Label><Input value={formData.document_number} onChange={(e) => setFormData({ ...formData, document_number: e.target.value })} /></div>
                  <div><Label>Related To</Label><Input value={formData.related_to} onChange={(e) => setFormData({ ...formData, related_to: e.target.value })} placeholder="Employee, Supplier, Branch..." /></div>
                  <div><Label>Issue Date</Label><Input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} /></div>
                  <div><Label>Expiry Date *</Label><Input type="date" value={formData.expiry_date} data-testid="doc-expiry" onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} required /></div>
                  <div><Label>Alert Before (days)</Label><Input type="number" value={formData.alert_days} onChange={(e) => setFormData({ ...formData, alert_days: e.target.value })} /></div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" data-testid="submit-document" className="rounded-full">{editingDoc ? 'Update' : 'Add'} Document</Button>
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Documents</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-primary">{documents.length}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-success">{documents.length - expiredCount - expiringCount}</div></CardContent></Card>
          <Card className="border-border bg-warning/5"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring Soon</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-warning">{expiringCount}</div></CardContent></Card>
          <Card className="border-border bg-error/5"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expired</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-error">{expiredCount}</div></CardContent></Card>
        </div>

        {alerts.length > 0 && (
          <Card className="border-border border-warning/50 bg-warning/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><AlertTriangle size={18} className="text-warning" />Expiry Alerts</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map(a => (
                  <div key={a.id + a.type} className={`flex justify-between items-center p-3 rounded-lg ${a.days_left < 0 ? 'bg-error/10 border border-error/30' : 'bg-warning/10 border border-warning/30'}`} data-testid="alert-item">
                    <div>
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-muted-foreground">Related: {a.related_to} | Expires: {format(new Date(a.expiry_date), 'MMM dd, yyyy')}</div>
                    </div>
                    <Badge className={a.days_left < 0 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>
                      {a.days_left < 0 ? `${Math.abs(a.days_left)}d overdue` : `${a.days_left}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="documents-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Document</th>
                  <th className="text-left p-3 font-medium text-sm">Type</th>
                  <th className="text-left p-3 font-medium text-sm">Number</th>
                  <th className="text-left p-3 font-medium text-sm">Related To</th>
                  <th className="text-left p-3 font-medium text-sm">Expiry Date</th>
                  <th className="text-center p-3 font-medium text-sm">Days Left</th>
                  <th className="text-center p-3 font-medium text-sm">Status</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id} className="border-b border-border hover:bg-secondary/50" data-testid="document-row">
                      <td className="p-3 text-sm font-medium">{doc.name}</td>
                      <td className="p-3"><Badge variant="secondary" className="capitalize">{doc.document_type.replace('_', ' ')}</Badge></td>
                      <td className="p-3 text-sm">{doc.document_number || '-'}</td>
                      <td className="p-3 text-sm">{doc.related_to || '-'}</td>
                      <td className="p-3 text-sm">{doc.expiry_date ? format(new Date(doc.expiry_date), 'MMM dd, yyyy') : '-'}</td>
                      <td className="p-3 text-center text-sm font-bold">
                        <span className={doc.days_until_expiry < 0 ? 'text-error' : doc.days_until_expiry <= 30 ? 'text-warning' : 'text-success'}>
                          {doc.days_until_expiry != null ? doc.days_until_expiry : '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center">{getStatusBadge(doc)}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(doc)} className="h-8"><Edit size={14} /></Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(doc.id)} className="h-8 text-error hover:text-error"><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No documents tracked yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
