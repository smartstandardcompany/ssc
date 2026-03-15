import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Paintbrush, Upload, Eye, RotateCcw } from 'lucide-react';

export default function BrandingPage() {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await api.get('/branding');
      setBranding(res.data);
    } catch { toast.error('Failed to load branding'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/branding', branding);
      toast.success('Branding updated!');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/branding/upload-logo', formData);
      setBranding(b => ({ ...b, logo_url: res.data.logo_url }));
      toast.success('Logo uploaded!');
    } catch { toast.error('Upload failed'); }
  };

  const handleReset = () => {
    setBranding({
      primary_color: '#f97316', accent_color: '#d97706', sidebar_color: '#1c1917',
      logo_url: '', app_name: 'SSC Track', tagline: 'Business Management Platform',
      login_bg_color: '#ea580c', hide_powered_by: false,
    });
  };

  const update = (key, val) => setBranding(b => ({ ...b, [key]: val }));

  if (loading || !branding) {
    return <DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-1" data-testid="branding-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="branding-title">
              <Paintbrush className="w-6 h-6 text-orange-500" /> White-Label Branding
            </h1>
            <p className="text-sm text-stone-500 mt-1">Customize your app's look and feel</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} data-testid="reset-branding"><RotateCcw className="w-4 h-4 mr-1" />Reset</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 rounded-full" onClick={handleSave} disabled={saving} data-testid="save-branding">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Logo */}
        <Card className="border-stone-100" data-testid="logo-section">
          <CardHeader className="pb-3"><CardTitle className="text-base">Logo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center bg-stone-50 overflow-hidden">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Upload className="w-6 h-6 text-stone-300" />
                )}
              </div>
              <div>
                <Label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-sm font-medium text-stone-700 transition-colors">
                  <Upload className="w-4 h-4" /> Upload Logo
                </Label>
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} data-testid="logo-upload" />
                <p className="text-xs text-stone-400 mt-2">PNG or SVG, max 2MB recommended</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Name */}
        <Card className="border-stone-100" data-testid="app-name-section">
          <CardHeader className="pb-3"><CardTitle className="text-base">App Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>App Name</Label>
                <Input data-testid="app-name-input" value={branding.app_name || ''} onChange={e => update('app_name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tagline</Label>
                <Input data-testid="tagline-input" value={branding.tagline || ''} onChange={e => update('tagline', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Hide "Powered by SSC Track"</Label>
                <p className="text-xs text-stone-400">Remove branding from login page</p>
              </div>
              <Switch checked={branding.hide_powered_by || false} onCheckedChange={v => update('hide_powered_by', v)} data-testid="hide-powered-by" />
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card className="border-stone-100" data-testid="colors-section">
          <CardHeader className="pb-3"><CardTitle className="text-base">Brand Colors</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'primary_color', label: 'Primary' },
                { key: 'accent_color', label: 'Accent' },
                { key: 'sidebar_color', label: 'Sidebar' },
                { key: 'login_bg_color', label: 'Login BG' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={branding[key] || '#000000'} onChange={e => update(key, e.target.value)} className="w-10 h-10 rounded-lg border border-stone-200 cursor-pointer" data-testid={`color-${key}`} />
                    <Input value={branding[key] || ''} onChange={e => update(key, e.target.value)} className="font-mono text-xs h-9" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-stone-100" data-testid="preview-section">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4 text-orange-500" />Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden border border-stone-200 flex h-48">
              <div className="w-48 p-4 text-white text-sm" style={{ backgroundColor: branding.sidebar_color }}>
                <div className="flex items-center gap-2 mb-4">
                  {branding.logo_url && <img src={branding.logo_url} alt="" className="w-6 h-6 rounded" />}
                  <span className="font-bold text-xs">{branding.app_name}</span>
                </div>
                <div className="space-y-2">
                  {['Dashboard', 'Sales', 'Expenses', 'Settings'].map(item => (
                    <div key={item} className="px-3 py-1.5 rounded text-xs opacity-70 hover:opacity-100" style={item === 'Dashboard' ? { backgroundColor: branding.primary_color } : {}}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 p-4 bg-stone-50">
                <div className="text-sm font-bold text-stone-700 mb-2">Dashboard</div>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 rounded-lg bg-white border border-stone-100">
                    <div className="text-xs text-stone-400">Revenue</div>
                    <div className="text-lg font-bold" style={{ color: branding.primary_color }}>$12,500</div>
                  </div>
                  <div className="flex-1 p-3 rounded-lg text-white" style={{ backgroundColor: branding.primary_color }}>
                    <div className="text-xs opacity-80">Profit</div>
                    <div className="text-lg font-bold">$4,200</div>
                  </div>
                </div>
                <button className="mt-3 px-4 py-1.5 rounded-full text-white text-xs font-medium" style={{ backgroundColor: branding.accent_color }}>
                  View Report
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
