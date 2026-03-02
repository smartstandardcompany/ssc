import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Check if this is a forced change (from login redirect)
  const isForced = new URLSearchParams(window.location.search).get('forced') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/change-password', {
        current_password: isForced ? null : currentPassword,
        new_password: newPassword
      });
      toast.success('Password changed successfully');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-orange-50 dark:from-stone-950 dark:to-stone-900 p-4">
      <Card className="w-full max-w-md border-stone-100 shadow-xl" data-testid="change-password-card">
        <CardHeader className="text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isForced ? 'bg-amber-100' : 'bg-orange-100'}`}>
            {isForced ? (
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            ) : (
              <Lock className="w-8 h-8 text-orange-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-outfit">
            {isForced ? 'Password Change Required' : 'Change Password'}
          </CardTitle>
          <CardDescription>
            {isForced 
              ? 'Your administrator requires you to change your password before continuing.'
              : 'Enter your current password and choose a new one.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForced && (
              <div>
                <Label htmlFor="current">Current Password</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required={!isForced}
                  data-testid="current-password-input"
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                required
                minLength={6}
                data-testid="new-password-input"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                data-testid="confirm-password-input"
                className="mt-1"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg" data-testid="change-error">
                {error}
              </p>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-full" 
              disabled={loading}
              data-testid="change-password-button"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </Button>

            {!isForced && (
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
