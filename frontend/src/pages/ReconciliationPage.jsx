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
import {
  CheckCircle, AlertTriangle, XCircle, Flag, ArrowDownUp, Search,
  Download, CheckCheck, TrendingUp, TrendingDown, Percent, Wand2, Link, Unlink
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_CONFIG = {
  matched: { label: 'Matched', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  mismatch: { label: 'Mismatch', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  bank_only: { label: 'Bank Only', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  app_only: { label: 'App Only', icon: XCircle, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
};

const FLAG_OPTIONS = [
  { value: '', label: 'No Flag' },
  { value: 'verified', label: 'Verified OK' },
  { value: 'investigate', label: 'Needs Investigation' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

function StatusPieChart({ summary }) {
  const total = (summary.matched_count || 0) + (summary.discrepancy_count || 0);
  if (total === 0) return null;
  const matchPct = Math.round(((summary.matched_count || 0) / total) * 100);
  const mismatchPct = 100 - matchPct;
  const circumference = 2 * Math.PI * 40;
  const matchLen = (matchPct / 100) * circumference;
  const mismatchLen = circumference - matchLen;

  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 100 100" className="transform -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" className="dark:stroke-stone-700" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="12"
          strokeDasharray={`${matchLen} ${circumference}`} strokeLinecap="round" />
        {mismatchPct > 0 && (
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="12"
            strokeDasharray={`${mismatchLen} ${circumference}`} strokeDashoffset={`-${matchLen}`} strokeLinecap="round" />
        )}
      </svg>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="dark:text-stone-300">Matched: {summary.matched_count || 0} ({matchPct}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="dark:text-stone-300">Issues: {summary.discrepancy_count || 0} ({mismatchPct}%)</span>
        </div>
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const { t } = useLanguage();
  const [statements, setStatements] = useState([]);
  const [selectedStmt, setSelectedStmt] = useState('');
  const [reconciliation, setReconciliation] = useState(null);
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [flagDialog, setFlagDialog] = useState(null);
  const [flagForm, setFlagForm] = useState({ flag: '', notes: '' });
  const [autoMatches, setAutoMatches] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchTab, setMatchTab] = useState('reconciliation'); // 'reconciliation' or 'auto-match'

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

  const handleStmtChange = (val) => { setSelectedStmt(val); loadReconciliation(val); loadAutoMatches(val); };

  const loadAutoMatches = async (stmtId) => {
    if (!stmtId) return;
    try {
      const { data } = await api.get(`/bank-statements/${stmtId}/matches`);
      setAutoMatches(data);
    } catch {}
  };

  const runAutoMatch = async () => {
    if (!selectedStmt) return;
    setMatchLoading(true);
    try {
      const { data } = await api.post(`/bank-statements/${selectedStmt}/auto-match?tolerance=5&date_range=3`);
      toast.success(`Auto-matched ${data.stats.auto_matched} transactions, ${data.stats.unmatched} unmatched`);
      setAutoMatches(prev => [...prev, ...data.matched]);
    } catch { toast.error('Auto-match failed'); }
    finally { setMatchLoading(false); }
  };

  const confirmMatch = async (matchId) => {
    try {
      await api.post(`/bank-statements/${selectedStmt}/matches/${matchId}/confirm`);
      setAutoMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'confirmed' } : m));
      toast.success('Match confirmed');
    } catch { toast.error('Failed to confirm'); }
  };

  const rejectMatch = async (matchId) => {
    try {
      await api.delete(`/bank-statements/${selectedStmt}/matches/${matchId}`);
      setAutoMatches(prev => prev.filter(m => m.id !== matchId));
      toast.success('Match rejected');
    } catch { toast.error('Failed to reject'); }
  };

  const saveFlag = async () => {
    if (!flagDialog || !selectedStmt) return;
    try {
      await api.post(`/bank-statements/${selectedStmt}/reconciliation/flag`, {
        row_key: flagDialog.row_key, flag: flagForm.flag, notes: flagForm.notes
      });
      setFlags(prev => ({ ...prev, [flagDialog.row_key]: { flag: flagForm.flag, notes: flagForm.notes } }));
      toast.success('Flag saved');
      setFlagDialog(null);
    } catch { toast.error('Failed to save flag'); }
  };

  const batchVerifyMatched = async () => {
    if (!selectedStmt || !reconciliation) return;
    const matchedRows = rows.filter(r => r.status === 'matched');
    let count = 0;
    for (const row of matchedRows) {
      const rowKey = `${row.deposit_date}|${row.branch}`;
      if (!flags[rowKey]?.flag) {
        try {
          await api.post(`/bank-statements/${selectedStmt}/reconciliation/flag`, {
            row_key: rowKey, flag: 'verified', notes: 'Auto-verified (batch)'
          });
          count++;
        } catch {}
      }
    }
    toast.success(`${count} rows verified`);
    loadReconciliation(selectedStmt);
  };

  const exportCSV = () => {
    if (!reconciliation) return;
    const headers = ['Deposit Date', 'Sale Date', 'Branch', 'Bank POS (SAR)', 'App Sales (SAR)', 'Difference', 'Diff %', 'Status', 'Flag'];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const rowKey = `${row.deposit_date}|${row.branch}`;
      const flag = flags[rowKey]?.flag || '';
      const diffPct = row.bank_amount > 0 ? ((row.difference / row.bank_amount) * 100).toFixed(1) : '0';
      csvRows.push([row.deposit_date, row.sale_date || '', row.branch, row.bank_amount, row.app_amount, row.difference, diffPct + '%', row.status, flag].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'reconciliation_export.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
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

  const verifiedCount = Object.values(flags).filter(f => f.flag === 'verified').length;
  const investigateCount = Object.values(flags).filter(f => f.flag === 'investigate').length;

  return (
    <DashboardLayout>
      <div className="space-y-5" data-testid="reconciliation-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-outfit dark:text-white" data-testid="reconciliation-title">Reconciliation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Match bank deposits against SSC Track sales</p>
          </div>
          {reconciliation && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runAutoMatch} disabled={matchLoading} data-testid="auto-match-btn" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                <Wand2 size={14} className="mr-1" />{matchLoading ? 'Matching...' : 'Auto-Match'}
              </Button>
              <Button variant="outline" size="sm" onClick={batchVerifyMatched} data-testid="batch-verify-btn">
                <CheckCheck size={14} className="mr-1" />Verify All Matched
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} data-testid="export-csv-btn">
                <Download size={14} className="mr-1" />Export CSV
              </Button>
            </div>
          )}
        </div>

        {/* Statement Selector */}
        <Card className="dark:bg-stone-900 dark:border-stone-700">
          <CardContent className="pt-5">
            <div className="flex items-end gap-4 flex-wrap">
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

        {/* Summary with Pie Chart */}
        {reconciliation && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="recon-summary">
                {[
                  { label: 'Bank POS Total', value: `SAR ${(summary.total_bank_pos || 0).toLocaleString()}`, color: 'text-blue-600', icon: TrendingUp },
                  { label: 'App Sales Total', value: `SAR ${(summary.total_app_sales || 0).toLocaleString()}`, color: 'text-emerald-600', icon: TrendingUp },
                  { label: 'Difference', value: `SAR ${(summary.total_difference || 0).toLocaleString()}`, color: summary.total_difference > 0 ? 'text-amber-600' : 'text-emerald-600', icon: TrendingDown },
                  { label: 'Verified', value: verifiedCount, color: 'text-emerald-600', icon: CheckCircle },
                  { label: 'Investigate', value: investigateCount, color: 'text-amber-600', icon: AlertTriangle },
                ].map((c, i) => (
                  <Card key={i} className="dark:bg-stone-900 dark:border-stone-700">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <c.icon size={13} className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                      </div>
                      <p className={`text-lg font-bold font-outfit ${c.color}`}>{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardContent className="pt-4 flex items-center justify-center">
                <StatusPieChart summary={summary} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Toggle */}
        {reconciliation && (
          <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-fit" data-testid="recon-tabs">
            <button onClick={() => setMatchTab('reconciliation')}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${matchTab === 'reconciliation' ? 'bg-white dark:bg-stone-700 shadow font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              POS Reconciliation ({rows.length})
            </button>
            <button onClick={() => setMatchTab('auto-match')}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${matchTab === 'auto-match' ? 'bg-white dark:bg-stone-700 shadow font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              <Link size={13} />Transaction Matches ({autoMatches.length})
            </button>
          </div>
        )}

        {/* Auto-Match Results */}
        {matchTab === 'auto-match' && reconciliation && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardContent className="p-0">
              {autoMatches.length === 0 ? (
                <div className="p-12 text-center">
                  <Wand2 size={40} className="mx-auto text-stone-300 mb-3" />
                  <p className="text-muted-foreground font-medium">No Auto-Matches Yet</p>
                  <p className="text-xs text-stone-400 mt-1">Click "Auto-Match" to match bank transactions to sales, expenses, and supplier payments</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="auto-match-table">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-800 border-y text-xs">
                        <th className="text-left p-2.5 font-medium">Bank Transaction</th>
                        <th className="text-right p-2.5 font-medium">Amount</th>
                        <th className="text-center p-2.5 font-medium">Match</th>
                        <th className="text-left p-2.5 font-medium">System Record</th>
                        <th className="text-right p-2.5 font-medium">Amount</th>
                        <th className="text-center p-2.5 font-medium">Confidence</th>
                        <th className="text-center p-2.5 font-medium">Status</th>
                        <th className="text-center p-2.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoMatches.map((m, idx) => (
                        <tr key={m.id} className={`border-b hover:bg-stone-50/50 ${m.status === 'confirmed' ? 'bg-emerald-50/30' : ''}`} data-testid={`match-row-${idx}`}>
                          <td className="p-2.5">
                            <p className="text-xs font-medium">{m.txn_date}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{m.txn_desc}</p>
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs">SAR {m.txn_amount?.toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            <Badge className={`text-[9px] ${m.match_type === 'sale' ? 'bg-emerald-500' : m.match_type === 'expense' ? 'bg-red-500' : 'bg-blue-500'}`}>
                              {m.match_type === 'sale' ? 'Sale' : m.match_type === 'expense' ? 'Expense' : 'Supplier'}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <p className="text-xs font-medium">{m.match_date}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{m.match_desc}</p>
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs">SAR {m.match_amount?.toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            <span className={`text-xs font-bold ${m.confidence >= 90 ? 'text-emerald-600' : m.confidence >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                              {m.confidence}%
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge variant="outline" className={`text-[9px] ${m.status === 'confirmed' ? 'border-emerald-300 text-emerald-600' : 'border-stone-300'}`}>
                              {m.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-center">
                            {m.status !== 'confirmed' ? (
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700" onClick={() => confirmMatch(m.id)} data-testid={`confirm-match-${idx}`}>
                                  <CheckCircle size={14} />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => rejectMatch(m.id)} data-testid={`reject-match-${idx}`}>
                                  <Unlink size={14} />
                                </Button>
                              </div>
                            ) : (
                              <CheckCircle size={14} className="text-emerald-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Table */}
        {loading && <div className="text-center py-8 text-muted-foreground">Loading reconciliation data...</div>}
        {matchTab === 'reconciliation' && !loading && reconciliation && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-outfit dark:text-white">
                {filteredRows.length} of {rows.length} rows
                {statusFilter !== 'all' && <Badge variant="outline" className="ml-2 text-xs">{statusFilter}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="recon-table">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-800 border-y border-stone-100 dark:border-stone-700">
                      <th className="text-left p-2.5 font-medium text-xs dark:text-stone-300">Deposit Date</th>
                      <th className="text-left p-2.5 font-medium text-xs dark:text-stone-300">Sale Date</th>
                      <th className="text-left p-2.5 font-medium text-xs dark:text-stone-300">Branch</th>
                      <th className="text-right p-2.5 font-medium text-xs dark:text-stone-300">Bank POS (SAR)</th>
                      <th className="text-right p-2.5 font-medium text-xs dark:text-stone-300">App Sales (SAR)</th>
                      <th className="text-right p-2.5 font-medium text-xs dark:text-stone-300">Difference</th>
                      <th className="text-right p-2.5 font-medium text-xs dark:text-stone-300">Diff %</th>
                      <th className="text-center p-2.5 font-medium text-xs dark:text-stone-300">Status</th>
                      <th className="text-center p-2.5 font-medium text-xs dark:text-stone-300">Flag</th>
                      <th className="text-center p-2.5 font-medium text-xs dark:text-stone-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.mismatch;
                      const Icon = cfg.icon;
                      const rowKey = `${row.deposit_date}|${row.branch}`;
                      const rowFlag = flags[rowKey];
                      const diffPct = row.bank_amount > 0 ? ((Math.abs(row.difference) / row.bank_amount) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className={`border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors ${row.status === 'mismatch' ? 'bg-amber-50/30 dark:bg-amber-900/10' : row.status === 'bank_only' || row.status === 'app_only' ? 'bg-red-50/20 dark:bg-red-900/10' : ''}`}
                          data-testid={`recon-row-${idx}`}>
                          <td className="p-2.5 font-mono text-xs dark:text-stone-300">{row.deposit_date}</td>
                          <td className="p-2.5 font-mono text-xs dark:text-stone-300">{row.sale_date || '-'}</td>
                          <td className="p-2.5 font-medium dark:text-stone-200">{row.branch}</td>
                          <td className="p-2.5 text-right font-mono dark:text-stone-300">{row.bank_amount?.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono dark:text-stone-300">{row.app_amount?.toLocaleString()}</td>
                          <td className={`p-2.5 text-right font-mono font-medium ${row.difference > 0 ? 'text-amber-600' : row.difference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {row.difference > 0 ? '+' : ''}{row.difference?.toLocaleString()}
                          </td>
                          <td className={`p-2.5 text-right font-mono text-xs ${parseFloat(diffPct) > 5 ? 'text-red-500 font-bold' : parseFloat(diffPct) > 1 ? 'text-amber-500' : 'text-stone-400'}`}>
                            {row.status === 'matched' ? '0%' : `${diffPct}%`}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                              <Icon size={11} />{cfg.label}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {rowFlag?.flag ? (
                              <Badge variant="outline" className={`text-[10px] ${rowFlag.flag === 'verified' ? 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400' : rowFlag.flag === 'investigate' ? 'border-amber-300 text-amber-600' : rowFlag.flag === 'resolved' ? 'border-blue-300 text-blue-600' : 'border-stone-300 text-stone-500'}`}>
                                {FLAG_OPTIONS.find(f => f.value === rowFlag.flag)?.label || rowFlag.flag}
                              </Badge>
                            ) : <span className="text-stone-300 dark:text-stone-600">-</span>}
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
                      <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">
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
          <Card className="dark:bg-stone-900 dark:border-stone-700 border-dashed border-2">
            <CardContent className="py-16 text-center">
              <ArrowDownUp size={40} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
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
                <div className="text-xs text-muted-foreground bg-stone-50 dark:bg-stone-800 p-2 rounded-lg">
                  <span className="font-medium dark:text-stone-200">{flagDialog.row.branch}</span> on {flagDialog.row.deposit_date}
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
                  <Button size="sm" className="flex-1" data-testid="save-flag-btn" onClick={saveFlag}>Save Flag</Button>
                  <Button size="sm" variant="outline" onClick={() => setFlagDialog(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
