import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Rocket, Building2, Users, Settings, Check, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';

const STEPS = [
  { id: 'branch', title: 'Create Your First Branch', icon: Building2, desc: 'Set up your main location' },
  { id: 'employee', title: 'Add Your First Employee', icon: Users, desc: 'Invite a team member' },
  { id: 'tax', title: 'Configure Tax Settings', icon: Settings, desc: 'Set up VAT for your region' },
];

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState({});

  const [branchForm, setBranchForm] = useState({ name: '', location: '', phone: '' });
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', phone: '', job_title: '', salary: '' });
  const [taxForm, setTaxForm] = useState({ name: 'VAT', rate: '15', type: 'vat', is_default: true });

  const handleCreateBranch = async () => {
    if (!branchForm.name) return toast.error('Branch name is required');
    setLoading(true);
    try {
      await api.post('/branches', branchForm);
      toast.success('Branch created!');
      setCompleted(p => ({ ...p, branch: true }));
      setStep(1);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!employeeForm.name) return toast.error('Employee name is required');
    setLoading(true);
    try {
      await api.post('/employees', { ...employeeForm, salary: parseFloat(employeeForm.salary) || 0 });
      toast.success('Employee added!');
      setCompleted(p => ({ ...p, employee: true }));
      setStep(2);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureTax = async () => {
    setLoading(true);
    try {
      await api.post('/accounting/tax-rates', { ...taxForm, rate: parseFloat(taxForm.rate) });
      toast.success('Tax configured!');
      setCompleted(p => ({ ...p, tax: true }));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to configure tax');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    try {
      await api.put('/tenants/onboarding', { onboarding_completed: true });
      toast.success('Setup complete! Welcome to SSC Track');
      navigate('/');
    } catch {
      navigate('/');
    }
  };

  const handleSkip = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4" data-testid="onboarding-wizard">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800" data-testid="onboarding-title">Let's Set Up Your Business</h1>
          <p className="text-sm text-stone-500 mt-1">Complete these steps to get the most out of SSC Track</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                completed[s.id] ? 'bg-emerald-500 text-white' :
                i === step ? 'bg-orange-500 text-white ring-4 ring-orange-100' :
                'bg-stone-100 text-stone-400'
              }`}>
                {completed[s.id] ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-1 ${completed[s.id] ? 'bg-emerald-400' : 'bg-stone-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="border-stone-100 shadow-sm" data-testid={`onboarding-step-${step}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="w-5 h-5 text-orange-500" />; })()}
              <div>
                <CardTitle className="text-lg">{STEPS[step].title}</CardTitle>
                <p className="text-xs text-stone-500">{STEPS[step].desc}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input data-testid="branch-name" placeholder="e.g. Main Branch" value={branchForm.name} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input data-testid="branch-location" placeholder="City / Area" value={branchForm.location} onChange={e => setBranchForm(p => ({ ...p, location: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input data-testid="branch-phone" placeholder="+966..." value={branchForm.phone} onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 rounded-full" disabled={loading} onClick={handleCreateBranch} data-testid="create-branch-btn">
                  {loading ? 'Creating...' : 'Create Branch'}
                </Button>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input data-testid="emp-name" placeholder="Full Name" value={employeeForm.name} onChange={e => setEmployeeForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input data-testid="emp-email" type="email" placeholder="email@company.com" value={employeeForm.email} onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input data-testid="emp-title" placeholder="e.g. Manager" value={employeeForm.job_title} onChange={e => setEmployeeForm(p => ({ ...p, job_title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Salary</Label>
                    <Input data-testid="emp-salary" type="number" placeholder="0" value={employeeForm.salary} onChange={e => setEmployeeForm(p => ({ ...p, salary: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 rounded-full" disabled={loading} onClick={handleCreateEmployee} data-testid="create-employee-btn">
                  {loading ? 'Adding...' : 'Add Employee'}
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tax Name</Label>
                    <Input data-testid="tax-name" value={taxForm.name} onChange={e => setTaxForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate (%)</Label>
                    <Input data-testid="tax-rate" type="number" value={taxForm.rate} onChange={e => setTaxForm(p => ({ ...p, rate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={taxForm.type} onValueChange={v => setTaxForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger data-testid="tax-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vat">VAT</SelectItem>
                      <SelectItem value="sales_tax">Sales Tax</SelectItem>
                      <SelectItem value="service_tax">Service Tax</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 rounded-full" disabled={loading} onClick={handleConfigureTax} data-testid="configure-tax-btn">
                  {loading ? 'Saving...' : 'Save Tax Settings'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="onboarding-back">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip} data-testid="onboarding-skip">
              <SkipForward className="w-4 h-4 mr-1" /> Skip
            </Button>
            {(step === 2 || Object.keys(completed).length === 3) && (
              <Button className="bg-emerald-500 hover:bg-emerald-600 rounded-full" onClick={handleFinishOnboarding} data-testid="finish-onboarding-btn">
                Finish Setup <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
