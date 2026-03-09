import { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck, AlertTriangle, AlertCircle, Info, Scan, Wrench, CheckCircle2,
  Loader2, ChevronDown, ChevronRight, RefreshCw, Zap
} from 'lucide-react';

const SEVERITY_CONFIG = {
  high: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  medium: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  low: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
};

const TYPE_CONFIG = {
  missing_final_amount: { label: 'Missing Final Amount', desc: 'Sales with null final_amount — totals may be incorrect', fixable: true },
  payment_mismatch: { label: 'Payment Mismatch', desc: 'Payment details total differs from sale amount', fixable: false },
  unusual_mode: { label: 'Unusual Payment Mode', desc: 'Non-standard payment modes like "card" or "discount"', fixable: true },
};

export default function DataIntegrityPage() {
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState({});
  const [bulkFixing, setBulkFixing] = useState({});
  const [expandedTypes, setExpandedTypes] = useState({});
  const [confirmBulk, setConfirmBulk] = useState(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await api.get('/data-integrity/scan');
      setScanResult(res.data);
      toast.success(`Scan complete: ${res.data.summary.total_issues} issues found`);
    } catch {
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  const fixIssue = async (issue) => {
    setFixing(prev => ({ ...prev, [issue.id]: true }));
    try {
      const body = { issue_type: issue.type, sale_id: issue.sale_id };
      if (issue.type === 'missing_final_amount') body.fix_value = issue.fix_value;
      if (issue.type === 'unusual_mode') {
        body.fix_mode = issue.fix_value;
        const idx = parseInt(issue.id.split('_').pop());
        body.payment_index = isNaN(idx) ? 0 : idx;
      }
      const res = await api.post('/data-integrity/fix', body);
      if (res.data.success) {
        toast.success(res.data.message);
        setScanResult(prev => ({
          ...prev,
          issues: prev.issues.filter(i => i.id !== issue.id),
          summary: {
            ...prev.summary,
            total_issues: prev.summary.total_issues - 1,
            by_type: { ...prev.summary.by_type, [issue.type]: (prev.summary.by_type[issue.type] || 1) - 1 },
            by_severity: { ...prev.summary.by_severity, [issue.severity]: (prev.summary.by_severity[issue.severity] || 1) - 1 },
          },
        }));
      } else {
        toast.error(res.data.error || 'Fix failed');
      }
    } catch {
      toast.error('Fix failed');
    } finally {
      setFixing(prev => ({ ...prev, [issue.id]: false }));
    }
  };

  const bulkFix = async (issueType) => {
    setBulkFixing(prev => ({ ...prev, [issueType]: true }));
    setConfirmBulk(null);
    try {
      const res = await api.post('/data-integrity/fix-all', { issue_type: issueType });
      if (res.data.success) {
        toast.success(`Fixed ${res.data.fixed_count} records`);
        await runScan();
      } else {
        toast.error(res.data.error || 'Bulk fix failed');
      }
    } catch {
      toast.error('Bulk fix failed');
    } finally {
      setBulkFixing(prev => ({ ...prev, [issueType]: false }));
    }
  };

  const toggleType = (type) => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const grouped = scanResult ? Object.entries(
    scanResult.issues.reduce((acc, i) => { (acc[i.type] = acc[i.type] || []).push(i); return acc; }, {})
  ) : [];

  const s = scanResult?.summary;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="data-integrity-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="data-integrity-title">
              Data Integrity Checker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Scan and fix data quality issues across your records</p>
          </div>
          <Button onClick={runScan} disabled={scanning} className="bg-orange-500 hover:bg-orange-600 rounded-lg" data-testid="scan-btn">
            {scanning ? <Loader2 size={16} className="animate-spin mr-2" /> : <Scan size={16} className="mr-2" />}
            {scanning ? 'Scanning...' : 'Run Scan'}
          </Button>
        </div>

        {/* No scan yet */}
        {!scanResult && !scanning && (
          <Card className="border-dashed border-2 border-stone-200" data-testid="no-scan-placeholder">
            <CardContent className="py-16 text-center">
              <ShieldCheck size={48} className="mx-auto mb-4 text-stone-300" />
              <h3 className="font-semibold text-lg text-stone-600 mb-2">Ready to Scan</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Click "Run Scan" to check all your sales records for missing data, mismatched payments, and unusual entries.
              </p>
              <Button onClick={runScan} variant="outline" className="rounded-lg" data-testid="scan-btn-cta">
                <Zap size={14} className="mr-2" /> Start Integrity Check
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scanning skeleton */}
        {scanning && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl border bg-stone-50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Results */}
        {scanResult && !scanning && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="integrity-summary">
              <Card className={`border card-enter ${s.total_issues === 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Issues</p>
                  <p className={`text-2xl font-bold font-outfit ${s.total_issues === 0 ? 'text-emerald-700' : 'text-orange-700'}`} data-testid="total-issues">
                    {s.total_issues}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.total_sales_scanned} records scanned</p>
                </CardContent>
              </Card>
              <Card className={`border card-enter ${s.by_severity.high > 0 ? 'border-red-200 bg-red-50/50' : 'border-stone-100'}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-red-600 uppercase tracking-wider">High Severity</p>
                  <p className="text-2xl font-bold font-outfit text-red-700" data-testid="high-issues">{s.by_severity.high}</p>
                </CardContent>
              </Card>
              <Card className={`border card-enter ${s.by_severity.medium > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-stone-100'}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wider">Medium</p>
                  <p className="text-2xl font-bold font-outfit text-amber-700" data-testid="medium-issues">{s.by_severity.medium}</p>
                </CardContent>
              </Card>
              <Card className={`border card-enter ${s.by_severity.low > 0 ? 'border-blue-200 bg-blue-50/50' : 'border-stone-100'}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-blue-600 uppercase tracking-wider">Low</p>
                  <p className="text-2xl font-bold font-outfit text-blue-700" data-testid="low-issues">{s.by_severity.low}</p>
                </CardContent>
              </Card>
            </div>

            {/* All clear */}
            {s.total_issues === 0 && (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500" />
                  <h3 className="text-lg font-semibold text-emerald-700">All Clear!</h3>
                  <p className="text-sm text-emerald-600 mt-1">No data integrity issues found. Your records are clean.</p>
                </CardContent>
              </Card>
            )}

            {/* Issues grouped by type */}
            {grouped.map(([type, issues]) => {
              const conf = TYPE_CONFIG[type] || { label: type, desc: '', fixable: false };
              const expanded = expandedTypes[type];
              const firstSev = issues[0]?.severity || 'low';
              const sevConf = SEVERITY_CONFIG[firstSev];

              return (
                <Card key={type} className={`border ${sevConf.border} overflow-hidden`} data-testid={`issue-group-${type}`}>
                  <CardHeader className={`pb-3 ${sevConf.bg} cursor-pointer`} onClick={() => toggleType(type)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            {conf.label}
                            <Badge className={`text-[9px] ${sevConf.badge} border-0`}>{issues.length}</Badge>
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{conf.desc}</p>
                        </div>
                      </div>
                      {conf.fixable && issues.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] rounded-lg border-stone-300 hover:bg-white"
                          disabled={bulkFixing[type]}
                          onClick={(e) => { e.stopPropagation(); setConfirmBulk(type); }}
                          data-testid={`bulk-fix-${type}`}
                        >
                          {bulkFixing[type] ? <Loader2 size={12} className="animate-spin mr-1" /> : <Wrench size={12} className="mr-1" />}
                          Fix All ({issues.length})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {expanded && (
                    <CardContent className="pt-3 pb-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs table-striped" data-testid={`issue-table-${type}`}>
                          <thead>
                            <tr className="border-b border-stone-100">
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Branch</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Issue</th>
                              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Fix</th>
                              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {issues.map((issue) => (
                              <tr key={issue.id} className="border-b border-stone-50 last:border-0">
                                <td className="py-2 px-3 text-stone-600 whitespace-nowrap">{issue.date}</td>
                                <td className="py-2 px-3 text-stone-600">{issue.branch}</td>
                                <td className="py-2 px-3 text-stone-700">{issue.description}</td>
                                <td className="py-2 px-3 text-muted-foreground text-[11px]">{issue.suggested_fix}</td>
                                <td className="py-2 px-3 text-right">
                                  {conf.fixable && issue.fix_value !== null && issue.fix_value !== undefined ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                      disabled={fixing[issue.id]}
                                      onClick={() => fixIssue(issue)}
                                      data-testid={`fix-${issue.id}`}
                                    >
                                      {fixing[issue.id] ? <Loader2 size={10} className="animate-spin" /> : <Wrench size={10} className="mr-1" />}
                                      Fix
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">Manual review</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Rescan button */}
            {s.total_issues > 0 && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={runScan} className="rounded-lg text-xs" data-testid="rescan-btn">
                  <RefreshCw size={12} className="mr-1.5" /> Rescan After Fixes
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk fix confirmation dialog */}
      <AlertDialog open={!!confirmBulk} onOpenChange={() => setConfirmBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Fix</AlertDialogTitle>
            <AlertDialogDescription>
              This will automatically fix all "{TYPE_CONFIG[confirmBulk]?.label}" issues.
              {confirmBulk === 'missing_final_amount' && ' Each sale will have final_amount set to (amount - discount).'}
              {confirmBulk === 'unusual_mode' && ' "card" will be changed to "bank" and "discount" entries will be removed.'}
              <br /><br />
              This action modifies your database records. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkFix(confirmBulk)} className="bg-orange-500 hover:bg-orange-600">
              Fix All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
