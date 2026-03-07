import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileBarChart, Plus, Play, Trash2, Edit, RefreshCw, Download, ArrowUpDown, Filter, Table, BarChart3 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const DATA_SOURCES = [
  { value: 'sales', label: 'Sales' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'supplier_payments', label: 'Supplier Payments' },
  { value: 'customers', label: 'Customers' },
  { value: 'employees', label: 'Employees' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'stock', label: 'Stock Items' },
  { value: 'activity_logs', label: 'Activity Logs' },
];

const COLUMN_OPTIONS = {
  sales: ['date', 'amount', 'discount', 'final_amount', 'payment_mode', 'sale_type', 'branch_id', 'customer_id', 'notes'],
  expenses: ['date', 'amount', 'category', 'description', 'payment_mode', 'branch_id', 'supplier_id'],
  supplier_payments: ['date', 'amount', 'supplier_name', 'payment_mode', 'branch_id', 'notes'],
  customers: ['name', 'phone', 'email', 'branch_id', 'current_credit', 'credit_limit', 'created_at'],
  employees: ['name', 'phone', 'email', 'job_title', 'salary', 'branch_id', 'status', 'created_at'],
  invoices: ['invoice_number', 'customer_name', 'total', 'vat_amount', 'grand_total', 'status', 'created_at'],
  stock: ['name', 'category', 'quantity', 'cost_price', 'selling_price', 'barcode', 'branch_id'],
  activity_logs: ['user_name', 'action', 'module', 'details', 'timestamp'],
};

const CHART_TYPES = [
  { value: '', label: 'No Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
];

function TemplateForm({ template, onSave, onCancel }) {
  const [form, setForm] = useState(template || {
    name: '', description: '', data_source: 'sales', columns: [], filters: {},
    group_by: '', sort_by: 'date', sort_order: 'desc', chart_type: '',
  });

  const availableColumns = COLUMN_OPTIONS[form.data_source] || [];

  const toggleColumn = (col) => {
    const cols = form.columns.includes(col)
      ? form.columns.filter(c => c !== col)
      : [...form.columns, col];
    setForm(f => ({ ...f, columns: cols }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    onSave(form);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Template Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Monthly Sales Summary" className="mt-1" data-testid="template-name" />
        </div>
        <div>
          <Label className="text-xs">Data Source *</Label>
          <Select value={form.data_source} onValueChange={v => setForm(f => ({ ...f, data_source: v, columns: [] }))}>
            <SelectTrigger className="mt-1" data-testid="template-source"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATA_SOURCES.map(ds => <SelectItem key={ds.value} value={ds.value}>{ds.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What this report is about..." className="mt-1 h-16" data-testid="template-desc" />
      </div>
      <div>
        <Label className="text-xs mb-2 block">Columns (leave empty for all)</Label>
        <div className="flex flex-wrap gap-1.5" data-testid="template-columns">
          {availableColumns.map(col => (
            <button key={col} onClick={() => toggleColumn(col)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                form.columns.includes(col)
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
              }`} data-testid={`col-${col}`}>
              {col.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Sort By</Label>
          <Select value={form.sort_by || ''} onValueChange={v => setForm(f => ({ ...f, sort_by: v }))}>
            <SelectTrigger className="mt-1 text-xs" data-testid="template-sort-by"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {availableColumns.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sort Order</Label>
          <Select value={form.sort_order} onValueChange={v => setForm(f => ({ ...f, sort_order: v }))}>
            <SelectTrigger className="mt-1 text-xs" data-testid="template-sort-order"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Group By</Label>
          <Select value={form.group_by || 'none'} onValueChange={v => setForm(f => ({ ...f, group_by: v === 'none' ? '' : v }))}>
            <SelectTrigger className="mt-1 text-xs" data-testid="template-group-by"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {availableColumns.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chart Type</Label>
          <Select value={form.chart_type || 'none'} onValueChange={v => setForm(f => ({ ...f, chart_type: v === 'none' ? '' : v }))}>
            <SelectTrigger className="mt-1 text-xs" data-testid="template-chart"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map(ct => <SelectItem key={ct.value || 'none'} value={ct.value || 'none'}>{ct.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Filter: Start Date</Label>
          <Input type="date" value={form.filters?.start_date || ''} className="mt-1"
            onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, start_date: e.target.value } }))}
            data-testid="template-start-date" />
        </div>
        <div>
          <Label className="text-xs">Filter: End Date</Label>
          <Input type="date" value={form.filters?.end_date || ''} className="mt-1"
            onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, end_date: e.target.value } }))}
            data-testid="template-end-date" />
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} data-testid="template-cancel">Cancel</Button>
        <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600" data-testid="template-save">Save Template</Button>
      </DialogFooter>
    </div>
  );
}

function ReportResults({ result, onClose }) {
  if (!result) return null;
  const { template, data, summary, total, truncated } = result;

  const exportCSV = () => {
    if (!data?.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${template.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{template.name}</h3>
          <p className="text-xs text-muted-foreground">{total} records {truncated ? '(showing first 500)' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} data-testid="export-csv">
            <Download size={12} className="mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
      {summary && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(summary).map(([k, v]) => (
            <Badge key={k} variant="outline" className="text-xs px-3 py-1">
              {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v}
            </Badge>
          ))}
        </div>
      )}
      {data?.length > 0 && (
        <div className="overflow-x-auto max-h-[400px] border rounded-lg">
          <table className="w-full text-xs" data-testid="report-results-table">
            <thead className="bg-stone-50 dark:bg-stone-800 sticky top-0 border-b">
              <tr>
                {Object.keys(data[0]).map(col => (
                  <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{col.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.slice(0, 100).map((row, i) => (
                <tr key={i} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                      {val === null || val === undefined ? '-' : typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportBuilderPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [runningId, setRunningId] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/report-templates');
      setTemplates(res.data || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async (form) => {
    try {
      if (editTemplate?.id) {
        await api.put(`/report-templates/${editTemplate.id}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/report-templates', form);
        toast.success('Template created');
      }
      setShowCreate(false);
      setEditTemplate(null);
      fetchTemplates();
    } catch {
      toast.error('Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report template?')) return;
    try {
      await api.delete(`/report-templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleRun = async (id) => {
    setRunningId(id);
    try {
      const res = await api.post(`/report-templates/${id}/run`, {});
      setRunResult(res.data);
    } catch {
      toast.error('Failed to run report');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="report-builder-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="report-builder-title">
              <FileBarChart className="text-orange-500" /> Report Builder
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Create, save, and run custom report templates</p>
          </div>
          <Button onClick={() => { setEditTemplate(null); setShowCreate(true); }} className="bg-orange-500 hover:bg-orange-600 rounded-full h-9 text-xs" data-testid="create-template-btn">
            <Plus size={14} className="mr-1" /> New Template
          </Button>
        </div>

        {/* Report result view */}
        {runResult && (
          <Card>
            <CardContent className="p-4">
              <ReportResults result={runResult} onClose={() => setRunResult(null)} />
            </CardContent>
          </Card>
        )}

        {/* Templates Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-orange-500" size={24} /></div>
        ) : templates.length === 0 && !runResult ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileBarChart size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="text-muted-foreground text-sm">No report templates yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="templates-grid">
            {templates.map(t => (
              <Card key={t.id} className="hover:shadow-md transition-shadow" data-testid={`template-card-${t.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-outfit">{t.name}</CardTitle>
                      <CardDescription className="text-[11px] mt-0.5">{t.description || 'No description'}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{(t.data_source || '').replace(/_/g, ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(t.columns || []).slice(0, 4).map(c => (
                      <Badge key={c} className="bg-stone-100 text-stone-600 text-[9px]">{c.replace(/_/g, ' ')}</Badge>
                    ))}
                    {(t.columns || []).length > 4 && <Badge className="bg-stone-100 text-stone-600 text-[9px]">+{t.columns.length - 4}</Badge>}
                    {!(t.columns || []).length && <span className="text-[10px] text-muted-foreground italic">All columns</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleRun(t.id)} disabled={runningId === t.id}
                      className="bg-orange-500 hover:bg-orange-600 h-7 text-[11px] flex-1" data-testid={`run-template-${t.id}`}>
                      {runningId === t.id ? <RefreshCw size={11} className="animate-spin mr-1" /> : <Play size={11} className="mr-1" />} Run
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => { setEditTemplate(t); setShowCreate(true); }} data-testid={`edit-template-${t.id}`}>
                      <Edit size={11} />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => handleDelete(t.id)} data-testid={`delete-template-${t.id}`}>
                      <Trash2 size={11} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Created by {t.created_by} on {new Date(t.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-outfit">{editTemplate?.id ? 'Edit' : 'Create'} Report Template</DialogTitle>
            </DialogHeader>
            <TemplateForm template={editTemplate} onSave={handleSave} onCancel={() => setShowCreate(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
