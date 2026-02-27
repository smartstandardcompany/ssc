import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, AlertTriangle, XCircle, Flag, MessageSquare, ArrowDownUp, Search, Filter } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_CONFIG = {
  matched: { label: 'Matched', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  mismatch: { label: 'Mismatch', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  bank_only: { label: 'Bank Only', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200' },
  app_only: { label: 'App Only', icon: XCircle, color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const FLAG_OPTIONS = [
  { value: '', label: 'No Flag' },
  { value: 'verified', label: 'Verified OK' },
  { value: 'investigate', label: 'Needs Investigation' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

export default function ReconciliationPage() {
  const [statements, setStatements] = useState([]);
  const [selectedStmt, setSelectedStmt] = useState('');
  const [reconciliation, setReconciliation] = useState(null);
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [flagDialog, setFlagDialog] = useState(null);
  const [flagForm, setFlagForm] = useState({ flag: '', notes: '' });

  useEffect(() => {
    api.get('/bank-statements').then(r => setStatements(r.data)).catch(() => {});
  }, []);

  const loadReconciliation = async (stmtId) => {
    if (!stmtId) return;
    setLoading(true);
    try {
      const [reconRes, flagsRes] = await Promise.all([
        api.get(`/bank-statements/${stmtId}/reconciliation`),
        api.get(`/bank-statements/${stmtId}/reconciliation/flags`)
      ]);
      setReconciliation(reconRes.data);
      setFlags(flagsRes.data);
    } catch { toast.error('Failed to load reconciliation'); }
    finally { setLoading(false); }
  };

  const handleStmtChange = (val) => {
    setSelectedStmt(val);
    loadReconciliation(val);
  };

  const saveFlag = async () => {
    if (!flagDialog || !selectedStmt) return;
    try {
      await api.post(`/bank-statements/${selectedStmt}/reconciliation/flag`, {
        row_key: flagDialog.row_key,
        flag: flagForm.flag,
        notes: flagForm.notes
      });
      setFlags(prev => ({ ...prev, [flagDialog.row_key]: { flag: flagForm.flag, notes: flagForm.notes } }));
      toast.success('Flag saved');
      setFlagDialog(null);
    } catch { toast.error('Failed to save flag'); }
  };

  const rows = reconciliation?.rows || [];
  const summary = reconciliation?.summary || {};

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return row.branch?.toLowerCase().includes(term) || row.deposit_date?.includes(term) || row.sale_date?.includes(term);
      }
      return true;
    });
  }, [rows, statusFilter, searchTerm]);

  const summaryCards = [
    { label: 'Bank POS Total', value: `SAR ${summary.total_bank_pos?.toLocaleString() || 0}`, color: 'text-blue-600' },
    { label: 'App Sales Total', value: `SAR ${summary.total_app_sales?.toLocaleString() || 0}`, color: 'text-emerald-600' },
    { label: 'Difference', value: `SAR ${summary.total_difference?.toLocaleString() || 0}`, color: summary.total_difference > 0 ? 'text-amber-600' : 'text-emerald-600' },
    { label: 'Matched', value: summary.matched_count || 0, color: 'text-emerald-600' },
    { label: 'Discrepancies', value: summary.discrepancy_count || 0, color: 'text-red-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5" data-testid="reconciliation-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-outfit" data-testid="reconciliation-title">Reconciliation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Match bank deposits against SSC Track sales</p>
          </div>
        </div>

        {/* Statement Selector */}
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-sm">
                <Label className="text-xs mb-1 block">Select Bank Statement</Label>
                <Select value={selectedStmt} onValueChange={handleStmtChange}>
                  <SelectTrigger data-testid="stmt-select" className="h-9"><SelectValue placeholder="Choose a statement..." /></SelectTrigger>
                  <SelectContent>
                    {statements.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.file_name || s.bank_name} ({s.period || 'N/A'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reconciliation && (
                <div className="flex gap-2 items-end">
                  <div>
                    <Label className="text-xs mb-1 block">Filter Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-36" data-testid="status-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="matched">Matched</SelectItem>
                        <SelectItem value="mismatch">Mismatch</SelectItem>
                        <SelectItem value="bank_only">Bank Only</SelectItem>
                        <SelectItem value="app_only">App Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-stone-400" />
                    <Input placeholder="Search branch or date..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 pl-8 w-52" data-testid="recon-search" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {reconciliation && (
          <div className="grid grid-cols-5 gap-3" data-testid="recon-summary">
            {summaryCards.map((c, i) => (
              <Card key={i} className="border-border">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-lg font-bold font-outfit ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reconciliation Table */}
        {loading && <div className="text-center py-8 text-muted-foreground">Loading reconciliation data...</div>}
        {!loading && reconciliation && (
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-outfit">
                {filteredRows.length} of {rows.length} rows
                {statusFilter !== 'all' && <Badge variant="outline" className="ml-2 text-xs">{statusFilter}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="recon-table">
                  <thead>
                    <tr className="bg-stone-50 border-y border-stone-100">
                      <th className="text-left p-2.5 font-medium text-xs">Deposit Date</th>
                      <th className="text-left p-2.5 font-medium text-xs">Sale Date</th>
                      <th className="text-left p-2.5 font-medium text-xs">Branch</th>
                      <th className="text-right p-2.5 font-medium text-xs">Bank POS (SAR)</th>
                      <th className="text-right p-2.5 font-medium text-xs">App Sales (SAR)</th>
                      <th className="text-right p-2.5 font-medium text-xs">Difference</th>
                      <th className="text-center p-2.5 font-medium text-xs">Status</th>
                      <th className="text-center p-2.5 font-medium text-xs">Flag</th>
                      <th className="text-center p-2.5 font-medium text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.mismatch;
                      const Icon = cfg.icon;
                      const rowKey = `${row.deposit_date}|${row.branch}`;
                      const rowFlag = flags[rowKey];
                      return (
                        <tr key={idx} className={`border-b border-stone-50 hover:bg-stone-50/50 transition-colors ${row.status === 'mismatch' ? 'bg-amber-50/30' : row.status === 'bank_only' || row.status === 'app_only' ? 'bg-red-50/20' : ''}`}
                          data-testid={`recon-row-${idx}`}>
                          <td className="p-2.5 font-mono text-xs">{row.deposit_date}</td>
                          <td className="p-2.5 font-mono text-xs">{row.sale_date || '-'}</td>
                          <td className="p-2.5 font-medium">{row.branch}</td>
                          <td className="p-2.5 text-right font-mono">{row.bank_amount?.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">{row.app_amount?.toLocaleString()}</td>
                          <td className={`p-2.5 text-right font-mono font-medium ${row.difference > 0 ? 'text-amber-600' : row.difference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {row.difference > 0 ? '+' : ''}{row.difference?.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                              <Icon size={11} />{cfg.label}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {rowFlag?.flag ? (
                              <Badge variant="outline" className={`text-[10px] ${rowFlag.flag === 'verified' ? 'border-emerald-300 text-emerald-600' : rowFlag.flag === 'investigate' ? 'border-amber-300 text-amber-600' : rowFlag.flag === 'resolved' ? 'border-blue-300 text-blue-600' : 'border-stone-300 text-stone-500'}`}>
                                {FLAG_OPTIONS.find(f => f.value === rowFlag.flag)?.label || rowFlag.flag}
                              </Badge>
                            ) : <span className="text-stone-300">-</span>}
                          </td>
                          <td className="p-2.5 text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`flag-btn-${idx}`}
                              onClick={() => {
                                setFlagDialog({ row_key: rowKey, row });
                                setFlagForm({ flag: rowFlag?.flag || '', notes: rowFlag?.notes || '' });
                              }}>
                              <Flag size={13} className={rowFlag?.flag ? 'text-orange-500' : 'text-stone-400'} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {rows.length === 0 ? 'Select a bank statement to view reconciliation' : 'No rows match the current filter'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedStmt && !loading && (
          <Card className="border-border border-dashed">
            <CardContent className="py-16 text-center">
              <ArrowDownUp size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="text-muted-foreground font-medium">Select a Bank Statement</p>
              <p className="text-xs text-stone-400 mt-1">Choose a statement above to compare bank deposits against SSC Track sales</p>
            </CardContent>
          </Card>
        )}

        {/* Flag Dialog */}
        <Dialog open={!!flagDialog} onOpenChange={(v) => !v && setFlagDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-outfit text-base">Flag Row</DialogTitle></DialogHeader>
            {flagDialog && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground bg-stone-50 p-2 rounded-lg">
                  <span className="font-medium">{flagDialog.row.branch}</span> on {flagDialog.row.deposit_date}
                  <br />Bank: SAR {flagDialog.row.bank_amount?.toLocaleString()} | App: SAR {flagDialog.row.app_amount?.toLocaleString()}
                </div>
                <div>
                  <Label className="text-xs">Flag Status</Label>
                  <Select value={flagForm.flag} onValueChange={(v) => setFlagForm({ ...flagForm, flag: v })}>
                    <SelectTrigger className="h-9" data-testid="flag-select"><SelectValue placeholder="Choose flag..." /></SelectTrigger>
                    <SelectContent>
                      {FLAG_OPTIONS.map(f => <SelectItem key={f.value || '__none'} value={f.value || '__none'}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={flagForm.notes} onChange={(e) => setFlagForm({ ...flagForm, notes: e.target.value })}
                    placeholder="Add notes about this row..." className="h-20 text-sm" data-testid="flag-notes" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-xl flex-1" data-testid="save-flag-btn" onClick={saveFlag}>Save Flag</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setFlagDialog(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
