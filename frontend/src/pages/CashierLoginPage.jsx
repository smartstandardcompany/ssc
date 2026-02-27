import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Lock, Mail } from 'lucide-react';
import api from '@/lib/api';

export default function CashierLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/cashier/login', { email, password });
      localStorage.setItem('cashier_token', data.access_token);
      localStorage.setItem('cashier_user', JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/cashier/pos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0" data-testid="cashier-login-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
            <Store size={32} className="text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold font-outfit text-stone-800">Cashier Login</CardTitle>
          <p className="text-sm text-muted-foreground">Restaurant POS System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cashier@company.com"
                  className="pl-10 h-12 rounded-xl"
                  data-testid="cashier-email"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-stone-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-12 rounded-xl"
                  data-testid="cashier-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base"
              disabled={loading}
              data-testid="cashier-login-btn"
            >
              {loading ? 'Signing in...' : 'Sign In to POS'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <a href="/login" className="text-sm text-orange-600 hover:underline">
              ← Back to Main Login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
