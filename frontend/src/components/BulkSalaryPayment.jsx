import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, DollarSign, Users, Building2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export function BulkSalaryPayment({ onComplete }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    period: format(new Date(), 'MMM yyyy'),
    branch_id: '',
    payment_mode: 'bank',
    notes: 'Monthly salary payment',
    date: format(new Date(), 'yyyy-MM-dd'),
    selectedEmployees: []
  });
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open]);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data);
    } catch {}
  };

  const fetchPreview = async () => {
    setPreviewing(true);
    try {
      const params = new URLSearchParams();
      params.set('period', formData.period);
      if (formData.branch_id) params.set('branch_id', formData.branch_id);
      const res = await api.get(`/salary-payments/bulk-preview?${params.toString()}`);
      setPreview(res.data);
      setSelectAll(true);
      setFormData(f => ({ ...f, selectedEmployees: res.data.to_pay.map(e => e.id) }));
    } catch (err) {
      toast.error('Failed to load preview');
    } finally {
      setPreviewing(false);
    }
  };

  const getMonthOptions = () => {
    const months = [];
    for (let i = -2; i <= 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }
    return months;
  };

  const handleSubmit = async () => {
    if (!formData.period) {
      toast.error('Please select a period');
      return;
    }
    if (formData.selectedEmployees.length === 0) {
      toast.error('No employees selected');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/salary-payments/bulk', {
        period: formData.period,
        branch_id: formData.branch_id || null,
        payment_mode: formData.payment_mode,
        notes: formData.notes,
        date: new Date(formData.date).toISOString(),
        employee_ids: selectAll ? null : formData.selectedEmployees // null means all eligible
      });
      setResult(res.data);
      toast.success(`Paid ${res.data.summary.total_paid} employees - SAR ${res.data.summary.total_amount.toFixed(2)}`);
      if (onComplete) onComplete();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process payments');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (empId) => {
    setFormData(f => ({
      ...f,
      selectedEmployees: f.selectedEmployees.includes(empId)
        ? f.selectedEmployees.filter(id => id !== empId)
        : [...f.selectedEmployees, empId]
    }));
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setFormData(f => ({ ...f, selectedEmployees: [] }));
    } else {
      setSelectAll(true);
      setFormData(f => ({ ...f, selectedEmployees: preview?.to_pay?.map(e => e.id) || [] }));
    }
  };

  const resetDialog = () => {
    setPreview(null);
    setResult(null);
    setFormData({
      period: format(new Date(), 'MMM yyyy'),
      branch_id: '',
      payment_mode: 'bank',
      notes: 'Monthly salary payment',
      date: format(new Date(), 'yyyy-MM-dd'),
      selectedEmployees: []
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl" data-testid="bulk-salary-btn">
          <Users size={14} className="mr-1" /> {t('bulk_salary_title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="bulk-salary-dialog">
        <DialogHeader>
          <DialogTitle className="font-outfit flex items-center gap-2">
            <DollarSign size={20} className="text-primary" />
            {t('bulk_salary_title')}
          </DialogTitle>
        </DialogHeader>

        {/* Result View */}
        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-success/10 rounded-xl border border-success/30">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle size={20} />
                <span className="font-bold">{t('payment_completed')}!</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-success">{result.summary.total_paid}</p>
                  <p className="text-xs text-muted-foreground">{t('employees_to_pay')}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-2xl font-bold text-primary">SAR {result.summary.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t('total_amount')}</p>
                </div>
              </div>
            </div>

            {/* Branch Breakdown */}
            {Object.keys(result.branch_totals || {}).length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('by_branch')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(result.branch_totals).map(([branch, data]) => (
                      <div key={branch} className="flex justify-between items-center p-2 bg-secondary/50 rounded-lg">
                        <span className="text-sm font-medium">{branch}</span>
                        <div className="text-right">
                          <span className="text-sm">{data.count} employees</span>
                          <span className="text-sm font-bold ml-2">SAR {data.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skipped/Failed */}
            {(result.details.skipped?.length > 0 || result.details.failed?.length > 0) && (
              <Card className="border-border border-warning/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <AlertCircle size={14} className="text-warning" />
                    {t('skipped_failed')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.details.skipped?.map((emp, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-1.5 bg-warning/10 rounded">
                        <span>{emp.name}</span>
                        <Badge variant="outline" className="text-[10px]">{emp.reason}</Badge>
                      </div>
                    ))}
                    {result.details.failed?.map((emp, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-1.5 bg-error/10 rounded">
                        <span>{emp.name}</span>
                        <Badge className="bg-error/20 text-error text-[10px]">{t('failed')}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button className="w-full rounded-xl" onClick={() => { setOpen(false); resetDialog(); }}>
              {t('done')}
            </Button>
          </div>
        )}

        {/* Preview View */}
        {!result && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-center">
                <p className="text-2xl font-bold text-primary">{preview.to_pay_count}</p>
                <p className="text-xs text-muted-foreground">{t('to_pay')}</p>
              </div>
              <div className="p-3 bg-success/10 rounded-xl text-center">
                <p className="text-2xl font-bold text-success">{preview.already_paid_count}</p>
                <p className="text-xs text-muted-foreground">{t('already_paid')}</p>
              </div>
              <div className="p-3 bg-stone-100 rounded-xl text-center">
                <p className="text-2xl font-bold">SAR {preview.to_pay_total.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{t('total_amount')}</p>
              </div>
            </div>

            {/* Employee List */}
            {preview.to_pay?.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm">{t('employees_to_pay')} ({preview.to_pay_count})</CardTitle>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectAll} 
                        onCheckedChange={toggleSelectAll}
                        id="select-all"
                      />
                      <Label htmlFor="select-all" className="text-xs cursor-pointer">{t('select_all')}</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {preview.to_pay.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded-lg">
                        <Checkbox 
                          checked={selectAll || formData.selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                          id={`emp-${emp.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.branch_name}</p>
                        </div>
                        <span className="text-sm font-bold">SAR {emp.salary.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {preview.to_pay?.length === 0 && (
              <div className="p-6 text-center bg-success/10 rounded-xl">
                <CheckCircle size={32} className="mx-auto text-success mb-2" />
                <p className="text-sm font-medium">All employees already paid for {formData.period}!</p>
              </div>
            )}

            {/* Already Paid */}
            {preview.already_paid?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {preview.already_paid_count} already paid
                </summary>
                <div className="mt-2 p-2 bg-success/5 rounded-lg space-y-1">
                  {preview.already_paid.map((emp, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{emp.name}</span>
                      <span className="text-success">SAR {emp.salary.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Payment Options */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl">
              <div>
                <Label className="text-xs">Payment Mode</Label>
                <Select value={formData.payment_mode} onValueChange={(v) => setFormData(f => ({ ...f, payment_mode: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Payment Date</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} className="rounded-xl">
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading || (preview.to_pay_count === 0)}
                className="rounded-xl"
                data-testid="confirm-bulk-pay"
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <DollarSign size={14} className="mr-1" />}
                Pay {selectAll ? preview.to_pay_count : formData.selectedEmployees.length} Employees
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Initial Form */}
        {!result && !preview && (
          <div className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Bulk Payment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pay salaries to all eligible employees at once. This will create salary payments and corresponding expense records automatically.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Period *</Label>
                <Select value={formData.period} onValueChange={(v) => setFormData(f => ({ ...f, period: v }))}>
                  <SelectTrigger data-testid="bulk-period-select">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions().map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Branch (Optional)</Label>
                <Select value={formData.branch_id || "all"} onValueChange={(v) => setFormData(f => ({ ...f, branch_id: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Input 
                value={formData.notes} 
                onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment notes"
              />
            </div>

            <Button 
              onClick={fetchPreview} 
              disabled={previewing || !formData.period}
              className="w-full rounded-xl"
              data-testid="preview-bulk-pay"
            >
              {previewing ? <Loader2 size={14} className="animate-spin mr-1" /> : <Users size={14} className="mr-1" />}
              Preview & Select Employees
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
