import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Shield, Globe, Zap, Users, Receipt, TrendingUp, ChevronRight, Check, ArrowRight, Building2, Clock, Star } from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3, title: 'Financial Dashboard',
    desc: 'Real-time revenue trends, expense breakdown, cash flow monitoring, and profit analysis across all branches.',
  },
  {
    icon: Receipt, title: 'Bills & Invoicing',
    desc: 'Create professional bills with line items, VAT calculations, payment tracking, and multi-currency support.',
  },
  {
    icon: TrendingUp, title: 'Profit & Loss',
    desc: 'Comprehensive P&L statements with branch filtering, date ranges, and detailed expense breakdowns.',
  },
  {
    icon: Building2, title: 'Multi-Branch',
    desc: 'Manage multiple branches with centralized reporting, branch-specific analytics, and employee assignments.',
  },
  {
    icon: Shield, title: 'Role-Based Access',
    desc: 'Granular permissions — give each team member exactly the access they need. Accounting module is separately grantable.',
  },
  {
    icon: Globe, title: 'Middle East Ready',
    desc: '15% VAT for Saudi, multi-currency (SAR, AED, KWD, BHD, OMR), Arabic support, and regional compliance.',
  },
];

const MODULES = [
  { name: 'Point of Sale (POS)', items: ['Touch-friendly cashier interface', 'Menu scheduling by day/time', 'Kitchen display system', 'Printer management'] },
  { name: 'Accounting', items: ['Chart of Accounts', 'Journal Entries', 'Balance Sheet', 'Tax/VAT Settings', 'Multi-Currency'] },
  { name: 'Finance', items: ['Sales tracking', 'Expense management', 'Bills & invoicing', 'Supplier payments', 'Cash transfers'] },
  { name: 'Operations', items: ['Inventory management', 'Supplier management', 'Employee management', 'HR & payroll'] },
  { name: 'Analytics', items: ['Financial dashboard', 'Profit & Loss reports', 'Menu analytics', 'Performance reports'] },
];

const PRICING = [
  {
    name: 'Starter', price: '199', currency: 'SAR', period: '/mo',
    features: ['1 Branch', 'POS & Sales', 'Basic Reports', 'Up to 5 Users', 'Email Support'],
    highlighted: false,
  },
  {
    name: 'Business', price: '499', currency: 'SAR', period: '/mo',
    features: ['Up to 5 Branches', 'Full Accounting Module', 'Advanced Analytics', 'Up to 20 Users', 'Priority Support', 'Multi-Currency'],
    highlighted: true,
  },
  {
    name: 'Enterprise', price: 'Custom', currency: '', period: '',
    features: ['Unlimited Branches', 'All Modules', 'Custom Integrations', 'Unlimited Users', 'Dedicated Support', 'White-Label Option'],
    highlighted: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Nav */}
      <nav className="border-b border-stone-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-stone-800">SSC Track</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm text-stone-600 hover:text-stone-800 transition-colors">Features</a>
            <a href="#modules" className="text-sm text-stone-600 hover:text-stone-800 transition-colors">Modules</a>
            <a href="#pricing" className="text-sm text-stone-600 hover:text-stone-800 transition-colors">Pricing</a>
            <button onClick={() => navigate('/login')}
              className="text-sm font-medium text-stone-700 hover:text-stone-900 transition-colors" data-testid="nav-login">
              Sign In
            </button>
            <button onClick={() => navigate('/login')}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-semibold transition-colors" data-testid="nav-get-started">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">Built for Middle East Businesses</span>
          </div>
          <h1 className="text-5xl font-bold text-stone-900 leading-tight tracking-tight">
            The Complete <span className="text-orange-500">Business Management</span> Platform
          </h1>
          <p className="text-lg text-stone-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            POS, Accounting, Inventory, HR, and Analytics — all in one platform.
            Purpose-built for restaurants and retail businesses in the Middle East with VAT compliance and multi-currency support.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <button onClick={() => navigate('/login')}
              className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2" data-testid="hero-start-btn">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#modules"
              className="border border-stone-300 hover:border-stone-400 text-stone-700 px-8 py-3.5 rounded-full text-sm font-semibold transition-colors">
              View Modules
            </a>
          </div>
          <div className="flex items-center justify-center gap-8 mt-10 text-sm text-stone-400">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> VAT compliant</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-stone-50 border-y border-stone-100">
        <div className="max-w-5xl mx-auto grid grid-cols-4 gap-8 text-center px-6">
          {[
            { val: '50+', label: 'Active Businesses' },
            { val: '200+', label: 'Branches Managed' },
            { val: '1M+', label: 'Transactions Processed' },
            { val: '99.9%', label: 'Uptime' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-stone-800">{s.val}</p>
              <p className="text-sm text-stone-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-stone-900">Everything You Need to Run Your Business</h2>
            <p className="text-stone-500 mt-3 max-w-xl mx-auto">From daily sales to year-end reporting, SSC Track handles it all.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="border border-stone-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-200 transition-all group" data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, '-')}`}>
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                  <f.icon className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-bold text-stone-800 mb-2">{f.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-20 px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-stone-900">Modular Architecture</h2>
            <p className="text-stone-500 mt-3 max-w-xl mx-auto">Each module is independently accessible. Grant customers exactly the features they need.</p>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {MODULES.map(m => (
              <div key={m.name} className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-md transition-shadow" data-testid={`module-${m.name.toLowerCase().replace(/\s/g, '-')}`}>
                <h3 className="text-sm font-bold text-stone-800 mb-3">{m.name}</h3>
                <ul className="space-y-2">
                  {m.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-stone-500">
                      <Check className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-stone-900">Simple, Transparent Pricing</h2>
            <p className="text-stone-500 mt-3">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {PRICING.map(plan => (
              <div key={plan.name} className={`rounded-2xl border-2 p-8 ${plan.highlighted ? 'border-orange-500 bg-orange-50 shadow-lg relative' : 'border-stone-200 bg-white'}`} data-testid={`pricing-${plan.name.toLowerCase()}`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-stone-800">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  {plan.currency && <span className="text-sm text-stone-500">{plan.currency}</span>}
                  <span className="text-4xl font-bold text-stone-900">{plan.price}</span>
                  {plan.period && <span className="text-sm text-stone-500">{plan.period}</span>}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                      <Check className="w-4 h-4 text-orange-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/login')}
                  className={`w-full mt-8 py-3 rounded-full text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`} data-testid={`pricing-${plan.name.toLowerCase()}-btn`}>
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-stone-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Transform Your Business?</h2>
          <p className="text-stone-400 mt-4">Join businesses across the Middle East that trust SSC Track for their daily operations.</p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="px-5 py-3 rounded-full bg-white/10 border border-stone-700 text-white placeholder-stone-500 w-80 text-sm focus:outline-none focus:border-orange-500"
              data-testid="cta-email" />
            <button onClick={() => navigate('/login')}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full text-sm font-semibold transition-colors" data-testid="cta-start-btn">
              Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-stone-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-stone-800">SSC Track</span>
          </div>
          <p className="text-xs text-stone-400">&copy; {new Date().getFullYear()} SSC Track. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
