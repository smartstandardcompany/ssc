import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const REPORT_TYPES = {
  daily_sales: 'Daily Sales Summary',
  eod_summary: 'End-of-Day Summary',
  expense_summary: 'Expense Summary',
  low_stock: 'Low Stock Alert',
  branch_report: 'Branch Report',
  partner_pnl: 'Partner P&L',
};

export function WhatsAppSendDialog({ open, onClose, defaultType = 'daily_sales', branches = [], branchId = '' }) {
  const [phone, setPhone] = useState('');
  const [reportType, setReportType] = useState(defaultType);
  const [selectedBranch, setSelectedBranch] = useState(branchId);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState('');

  const handleSend = async () => {
    if (!phone) { toast.error('Enter a phone number'); return; }
    setSending(true);
    setPreview('');
    try {
      const res = await api.post('/whatsapp/send-to', {
        phone, report_type: reportType,
        branch_id: selectedBranch || null
      });
      toast.success(res.data.message);
      setPreview(res.data.preview || '');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Send failed');
    }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="whatsapp-send-dialog">
        <DialogHeader>
          <DialogTitle className="font-outfit flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send via WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Phone Number *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} 
              placeholder="+966XXXXXXXXX" className="h-10" data-testid="wa-phone-input" />
            <p className="text-xs text-muted-foreground mt-1">Include country code (e.g. +966 for Saudi Arabia)</p>
          </div>
          <div>
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="h-10" data-testid="wa-report-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(reportType === 'low_stock' || reportType === 'branch_report') && branches.length > 0 && (
            <div>
              <Label>Branch</Label>
              <Select value={selectedBranch || "all"} onValueChange={(v) => setSelectedBranch(v === "all" ? "" : v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="rounded-xl w-full" onClick={handleSend} disabled={sending} data-testid="wa-send-btn">
            {sending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Send size={14} className="mr-2" />}
            {sending ? 'Sending...' : 'Send Report'}
          </Button>
          {preview && (
            <div className="bg-stone-50 rounded-xl p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-1">Message Preview:</p>
              <pre className="text-xs whitespace-pre-wrap">{preview}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
