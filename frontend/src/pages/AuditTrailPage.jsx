import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterModule, setFilterModule] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get(`/access-policies/delete-audit-log?page=${p}&limit=30`);
      setLogs(res.data.data || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  const filtered = logs.filter(log => {
    if (filterModule !== 'all' && log.module !== filterModule) return false;
    if (filterStatus === 'allowed' && !log.allowed) return false;
    if (filterStatus === 'denied' && log.allowed) return false;
    if (searchTerm && !log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.record_summary?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.module?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const modules = [...new Set(logs.map(l => l.module).filter(Boolean))];
  const stats = {
    total: logs.length,
    allowed: logs.filter(l => l.allowed).length,
    denied: logs.filter(l => !l.allowed).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="audit-trail-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="audit-trail-title">
              <Shield className="text-orange-500" /> Deletion Audit Trail
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Track all record deletion attempts across your organization</p>
          </div>
          <Button variant="outline" onClick={() => fetchLogs(page)} className="rounded-full h-8 text-xs" data-testid="refresh-audit">
            <RefreshCw size={12} className="mr-1" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3" data-testid="audit-stats">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Clock size={18} className="text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Total Attempts</p><p className="text-xl font-bold">{total}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle size={18} className="text-emerald-600" /></div>
              <div><p className="text-xs text-muted-foreground">Allowed</p><p className="text-xl font-bold text-emerald-700">{stats.allowed}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><XCircle size={18} className="text-red-600" /></div>
              <div><p className="text-xs text-muted-foreground">Denied</p><p className="text-xl font-bold text-red-700">{stats.denied}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by user, module, or description..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  data-testid="audit-search"
                />
              </div>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="w-[140px] h-9 text-xs" data-testid="audit-filter-module">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modules.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px] h-9 text-xs" data-testid="audit-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="allowed">Allowed</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-orange-500" size={24} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm" data-testid="no-audit-logs">No audit logs found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="audit-table">
                  <thead className="bg-stone-50 dark:bg-stone-800 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Module</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Record Date</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((log, i) => (
                      <tr key={i} className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 ${!log.allowed ? 'bg-red-50/30' : ''}`} data-testid={`audit-row-${i}`}>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium">{log.user_email}</div>
                          <div className="text-[10px] text-muted-foreground">{log.user_role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] capitalize">{(log.module || '').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[200px] truncate">{log.record_summary || '-'}</td>
                        <td className="px-4 py-3 text-xs">{log.record_date || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {log.allowed ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]" data-testid={`audit-status-${i}`}>Allowed</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-[10px]" data-testid={`audit-status-${i}`}>Denied</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between" data-testid="audit-pagination">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="audit-prev-page">
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="audit-next-page">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
