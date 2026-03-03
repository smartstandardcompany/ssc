import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage({ setIsAuthenticated }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authLogin = useAuthStore(s => s.login);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await authLogin(email, password);
      
      // Check if password change is required
      if (data.must_change_password) {
        toast.info('Please change your password');
        setIsAuthenticated(true);
        navigate('/change-password?forced=true');
        return;
      }
      
      toast.success('Login successful!');
      setIsAuthenticated(true);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #E8501A 0%, #F5841F 50%, #F5A623 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <img src="/logo.png" alt="SSC" className="h-28 object-contain mb-8 drop-shadow-2xl" />
          <h1 className="text-4xl font-bold font-outfit tracking-tight">SSC Track</h1>
          <p className="text-lg mt-3 text-white/80 text-center max-w-md">Smart Standard Company<br/>Business Management Platform</p>
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            <div><div className="text-3xl font-bold font-outfit">Sales</div><p className="text-sm text-white/70 mt-1">& Invoices</p></div>
            <div><div className="text-3xl font-bold font-outfit">HR</div><p className="text-sm text-white/70 mt-1">& Payroll</p></div>
            <div><div className="text-3xl font-bold font-outfit">Reports</div><p className="text-sm text-white/70 mt-1">& Analytics</p></div>
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#FDFBF7]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/logo.png" alt="SSC" className="h-16 object-contain" />
          </div>
          <Card className="border-stone-100 shadow-xl shadow-orange-500/5" data-testid="login-card">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="text-2xl font-bold font-outfit">Welcome back</CardTitle>
              <CardDescription>Sign in to your SSC Track account</CardDescription>
            </CardHeader>
            <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              data-testid="login-button"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/25 transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm space-y-2">
            <div>
              <Link to="/forgot-password" className="text-orange-600 hover:underline font-medium" data-testid="forgot-password-link">
                Forgot password?
              </Link>
            </div>
            <div>
              <span className="text-stone-400">Don't have an account? </span>
              <Link to="/register" className="text-orange-600 hover:underline font-medium" data-testid="register-link">
                Sign up
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
