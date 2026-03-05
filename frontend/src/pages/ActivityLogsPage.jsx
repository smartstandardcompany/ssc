import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, User, Clock, Monitor, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const limit = 50;

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString()
      });
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const res = await api.get(`/activity-logs?${params.toString()}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/activity-logs/summary?days=7');
      setSummary(res.data);
    } catch {}
  };

  const handleFilter = () => {
    setPage(0);
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({ action: '', resource: '', user_id: '', start_date: '', end_date: '' });
    setPage(0);
    setTimeout(fetchLogs, 10);
  };

  const handleCleanup = async () => {
    if (!confirm('Delete logs older than 90 days?')) return;
    try {
      const res = await api.delete('/activity-logs/cleanup?days_to_keep=90');
      toast.success(`Deleted ${res.data.deleted_count} old logs`);
      fetchLogs();
      fetchSummary();
    } catch (err) {
      toast.error('Cleanup failed');
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'login': return 'bg-emerald-100 text-emerald-700';
      case 'logout': return 'bg-stone-100 text-stone-700';
      case 'create': return 'bg-blue-100 text-blue-700';
      case 'update': return 'bg-amber-100 text-amber-700';
      case 'delete': return 'bg-red-100 text-red-700';
      default: return 'bg-stone-100 text-stone-700';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="activity-logs-title">Activity Logs</h1>
            <p className="text-sm text-muted-foreground">Track user actions and system events</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchSummary(); }} data-testid="refresh-logs-btn">
              <RefreshCw size={14} className="mr-1" />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCleanup} className="text-red-600 hover:text-red-700" data-testid="cleanup-logs-btn">
              <Trash2 size={14} className="mr-1" />Cleanup Old
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-stone-100">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Logins (7d)</p>
                <p className="text-2xl font-bold font-outfit text-emerald-600">{summary.by_action?.login || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-stone-100">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Creates (7d)</p>
                <p className="text-2xl font-bold font-outfit text-blue-600">{summary.by_action?.create || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-stone-100">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Updates (7d)</p>
                <p className="text-2xl font-bold font-outfit text-amber-600">{summary.by_action?.update || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-stone-100">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Deletes (7d)</p>
                <p className="text-2xl font-bold font-outfit text-red-600">{summary.by_action?.delete || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-stone-100">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Action</Label>
                <Select value={filters.action || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, action: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[120px] h-9" data-testid="filter-action">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Resource</Label>
                <Select value={filters.resource || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, resource: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[130px] h-9" data-testid="filter-resource">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="auth">Auth</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="expenses">Expenses</SelectItem>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="suppliers">Suppliers</SelectItem>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="settings">Settings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" className="h-9 w-[140px]" value={filters.start_date} onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" className="h-9 w-[140px]" value={filters.end_date} onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))} />
              </div>
              <Button size="sm" onClick={handleFilter} data-testid="apply-log-filters">Apply</Button>
              <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="border-stone-100">
          <CardHeader className="py-3 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-outfit">Activity History</CardTitle>
              <span className="text-xs text-muted-foreground">{total} total entries</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Activity size={48} className="mx-auto mb-2 opacity-30" />
                <p>No activity logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="activity-logs-table">
                  <thead>
                    <tr className="bg-stone-50 border-b">
                      <th className="text-left p-3 font-medium">Timestamp</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">Resource</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Details</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-stone-50/50">
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-xs">
                            <Clock size={12} className="text-muted-foreground" />
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <User size={12} className="text-muted-foreground" />
                            <span className="text-xs truncate max-w-[150px]">{log.user_email}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${getActionColor(log.action)}`}>
                            {log.action?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs capitalize hidden sm:table-cell">{log.resource}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                          {log.resource_id && <span className="font-mono">ID: {log.resource_id.slice(0, 8)}...</span>}
                          {log.details && <span>{JSON.stringify(log.details).slice(0, 50)}...</span>}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Monitor size={12} />
                            {log.ip_address || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="prev-page"
                  >
                    <ChevronLeft size={14} />Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="next-page"
                  >
                    Next<ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
