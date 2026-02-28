import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Hash, ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function CashierLoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinChange = (value) => {
    // Only allow numbers and max 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setPin(numericValue);
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (pin.length < 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await api.post('/cashier/login', { pin });
      const posRole = data.user?.pos_role || 'both';
      
      // Check if user has cashier access
      if (posRole === 'waiter') {
        toast.error('This PIN is for waiter access only. Please use Waiter Mode.');
        setPin('');
        setLoading(false);
        return;
      }
      
      localStorage.setItem('cashier_token', data.access_token);
      localStorage.setItem('cashier_user', JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/cashier/pos');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Handle keypad input
  const handleKeypad = (num) => {
    if (num === 'clear') {
      setPin('');
    } else if (num === 'back') {
      setPin(pin.slice(0, -1));
    } else if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      // Auto-submit on 4 digits
      if (newPin.length === 4) {
        setTimeout(() => {
          handleLogin();
        }, 300);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-2xl border-0 overflow-hidden" data-testid="cashier-login-card">
        {/* Header */}
        <div className="bg-white p-6 text-center border-b">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
            <Store size={32} className="text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold font-outfit text-stone-800">Cashier Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your 4-digit PIN</p>
        </div>

        <CardContent className="p-6 bg-stone-50">
          {/* PIN Display */}
          <div className="mb-6">
            <div className="flex justify-center gap-3 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                    pin[i] 
                      ? 'bg-orange-500 border-orange-500 text-white' 
                      : 'bg-white border-stone-200'
                  }`}
                >
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Verifying...</span>
              </div>
            )}
          </div>

          {/* Number Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                type="button"
                variant="outline"
                className="h-14 text-xl font-bold bg-white hover:bg-orange-50 hover:border-orange-300 rounded-xl"
                onClick={() => handleKeypad(num.toString())}
                disabled={loading}
                data-testid={`keypad-${num}`}
              >
                {num}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-14 text-sm font-medium bg-red-50 hover:bg-red-100 border-red-200 text-red-600 rounded-xl"
              onClick={() => handleKeypad('clear')}
              disabled={loading}
              data-testid="keypad-clear"
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 text-xl font-bold bg-white hover:bg-orange-50 hover:border-orange-300 rounded-xl"
              onClick={() => handleKeypad('0')}
              disabled={loading}
              data-testid="keypad-0"
            >
              0
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 bg-stone-100 hover:bg-stone-200 rounded-xl"
              onClick={() => handleKeypad('back')}
              disabled={loading}
              data-testid="keypad-back"
            >
              <ArrowLeft size={20} />
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleLogin}
            className="w-full h-12 mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base"
            disabled={loading || pin.length < 4}
            data-testid="cashier-login-btn"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          {/* Links */}
          <div className="mt-4 flex justify-between text-xs">
            <a href="/login" className="text-orange-600 hover:underline flex items-center gap-1">
              <ArrowLeft size={12} />
              Main Login
            </a>
            <a href="/kds" className="text-stone-500 hover:underline">
              Kitchen Display →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
