import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { BarChart3, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '@/lib/api';

const COUNTRIES = [
  "Saudi Arabia", "UAE", "Kuwait", "Bahrain", "Oman", "Qatar",
  "Egypt", "Jordan", "Lebanon", "Iraq", "Morocco", "Tunisia",
  "Pakistan", "India", "Bangladesh", "Philippines",
  "United States", "United Kingdom", "Canada", "Germany", "France",
];

const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe / Coffee Shop" },
  { value: "bakery", label: "Bakery" },
  { value: "catering", label: "Catering" },
  { value: "food_truck", label: "Food Truck" },
  { value: "retail", label: "Retail Store" },
  { value: "grocery", label: "Grocery / Supermarket" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "salon", label: "Salon / Spa" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "clinic", label: "Clinic / Medical" },
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "general", label: "General Business" },
  { value: "other", label: "Other" },
];

const CURRENCIES = [
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "KWD", label: "Kuwaiti Dinar (KWD)" },
  { code: "BHD", label: "Bahraini Dinar (BHD)" },
  { code: "OMR", label: "Omani Rial (OMR)" },
  { code: "QAR", label: "Qatari Riyal (QAR)" },
  { code: "EGP", label: "Egyptian Pound (EGP)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
];

export default function RegisterPage({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    admin_name: '', admin_email: '', password: '', confirm_password: '',
    company_name: '', company_name_ar: '', industry: 'restaurant', country: 'Saudi Arabia',
    city: '', address: '', phone: '', website: '',
    tax_number: '', commercial_reg: '', currency: 'SAR', plan: 'starter',
  });

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validateStep1 = () => {
    if (!form.admin_name || !form.admin_email || !form.password) {
      toast.error('Please fill in all required fields'); return false;
    }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.company_name || !form.country) { toast.error('Company name and country are required'); return false; }
    return true;
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const res = await api.post('/tenants/register', form);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setIsAuthenticated(true);
      toast.success('Account created! Welcome to SSC Track');
      navigate('/');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex" data-testid="register-page">
      {/* Left Panel */}
      <div className="hidden lg:flex w-[45%] bg-stone-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-16">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SSC Track</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">Start managing your business in minutes</h1>
          <p className="text-stone-400 mt-4 text-lg leading-relaxed">Complete POS, Accounting, Inventory, and HR — purpose-built for Middle East businesses.</p>
        </div>
        <div className="space-y-4">
          {['POS & Sales Tracking', 'Full Accounting Suite', 'Multi-Branch Management', 'VAT Compliant'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
              <span className="text-stone-300 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-400'}`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span className={`text-xs font-medium ${step >= s ? 'text-stone-800' : 'text-stone-400'}`}>
                  {s === 1 ? 'Account' : s === 2 ? 'Company' : 'Details'}
                </span>
                {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-orange-500' : 'bg-stone-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5" data-testid="step-1">
              <div><h2 className="text-2xl font-bold text-stone-800">Create your account</h2><p className="text-sm text-stone-500 mt-1">You'll be the admin of your organization</p></div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Full Name *</label><Input value={form.admin_name} onChange={e => updateForm('admin_name', e.target.value)} placeholder="Your full name" data-testid="admin-name" /></div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Email Address *</label><Input type="email" value={form.admin_email} onChange={e => updateForm('admin_email', e.target.value)} placeholder="admin@company.com" data-testid="admin-email" /></div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Password *</label><Input type="password" value={form.password} onChange={e => updateForm('password', e.target.value)} placeholder="Min 6 characters" data-testid="password" /></div>
              <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Confirm Password *</label><Input type="password" value={form.confirm_password} onChange={e => updateForm('confirm_password', e.target.value)} placeholder="Repeat password" data-testid="confirm-password" /></div>
              <Button onClick={() => validateStep1() && setStep(2)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6" data-testid="next-step-1">Continue <ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5" data-testid="step-2">
              <div><h2 className="text-2xl font-bold text-stone-800">Company Information</h2><p className="text-sm text-stone-500 mt-1">Tell us about your business</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="text-sm font-medium text-stone-600 block mb-1.5">Company Name (English) *</label><Input value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} placeholder="Your company name" data-testid="company-name" /></div>
                <div className="col-span-2"><label className="text-sm font-medium text-stone-600 block mb-1.5">Company Name (Arabic)</label><Input value={form.company_name_ar} onChange={e => updateForm('company_name_ar', e.target.value)} placeholder="اسم الشركة" dir="rtl" data-testid="company-name-ar" /></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Industry *</label><Select value={form.industry} onValueChange={v => updateForm('industry', v)}><SelectTrigger data-testid="industry-select"><SelectValue /></SelectTrigger><SelectContent>{INDUSTRIES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Country *</label><Select value={form.country} onValueChange={v => updateForm('country', v)}><SelectTrigger data-testid="country-select"><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">City</label><Input value={form.city} onChange={e => updateForm('city', e.target.value)} placeholder="City" data-testid="city" /></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Currency</label><Select value={form.currency} onValueChange={v => updateForm('currency', v)}><SelectTrigger data-testid="currency-select"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 py-6" data-testid="back-step-2"><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={() => validateStep2() && setStep(3)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6" data-testid="next-step-2">Continue <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5" data-testid="step-3">
              <div><h2 className="text-2xl font-bold text-stone-800">Additional Details</h2><p className="text-sm text-stone-500 mt-1">Optional but helps with compliance</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Phone Number</label><Input value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="+966 5XX XXX XXX" data-testid="phone" /></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Website</label><Input value={form.website} onChange={e => updateForm('website', e.target.value)} placeholder="https://..." data-testid="website" /></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Tax/VAT Registration Number</label><Input value={form.tax_number} onChange={e => updateForm('tax_number', e.target.value)} placeholder="VAT number" data-testid="tax-number" /></div>
                <div><label className="text-sm font-medium text-stone-600 block mb-1.5">Commercial Registration</label><Input value={form.commercial_reg} onChange={e => updateForm('commercial_reg', e.target.value)} placeholder="CR number" data-testid="commercial-reg" /></div>
                <div className="col-span-2"><label className="text-sm font-medium text-stone-600 block mb-1.5">Address</label><Input value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Street address" data-testid="address" /></div>
              </div>
              <div><label className="text-sm font-medium text-stone-600 block mb-3">Select Plan</label>
                <div className="grid grid-cols-3 gap-3">
                  {[{key:'starter',name:'Starter',price:'SAR 199/mo',desc:'1 branch, 5 users'},{key:'business',name:'Business',price:'SAR 499/mo',desc:'5 branches, 20 users'},{key:'enterprise',name:'Enterprise',price:'Custom',desc:'Unlimited'}].map(p => (
                    <button key={p.key} onClick={() => updateForm('plan', p.key)} className={`p-4 rounded-xl border-2 text-left transition-colors ${form.plan === p.key ? 'border-orange-500 bg-orange-50' : 'border-stone-200 hover:border-stone-300'}`} data-testid={`plan-${p.key}`}>
                      <p className="font-bold text-sm text-stone-800">{p.name}</p><p className="text-xs text-orange-600 font-semibold mt-1">{p.price}</p><p className="text-xs text-stone-400 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 py-6" data-testid="back-step-3"><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleRegister} disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6 disabled:opacity-50" data-testid="register-btn">{loading ? 'Creating...' : 'Create Account'}</Button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-stone-500 mt-6">Already have an account? <Link to="/login" className="text-orange-600 font-medium hover:underline">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
