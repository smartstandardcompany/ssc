import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Paintbrush, Upload, Save, RefreshCw, Eye } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function WhiteLabelingPage() {
  const [branding, setBranding] = useState({
    primary_color: '#f97316',
    accent_color: '#d97706',
    sidebar_color: '#1c1917',
    logo_url: '',
    favicon_url: '',
    app_name: 'SSC Track',
    tagline: 'Business Management Platform',
    login_bg_color: '#ea580c',
    hide_powered_by: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

  useEffect(() => { fetchBranding(); }, []);

  const fetchBranding = async () => {
    try {
      const res = await api.get('/branding');
      setBranding(prev => ({ ...prev, ...res.data }));
    } catch {}
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/branding', branding);
      toast.success('White-label settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/branding/upload-logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBranding(prev => ({ ...prev, logo_url: res.data.logo_url }));
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const set = (key, val) => setBranding(prev => ({ ...prev, [key]: val }));

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="white-label-page">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="white-label-title">
            <Paintbrush className="text-orange-500" />
            White-Label Branding
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize your platform's look and feel for your organization
          </p>
        </div>

        {/* Live Preview */}
        <Card className="border-orange-200 overflow-hidden">
          <div className="flex items-center gap-3 p-4" style={{ backgroundColor: branding.sidebar_color }}>
            {branding.logo_url ? (
              <img src={`${API_BASE}${branding.logo_url}`} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white/10" data-testid="preview-logo" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: branding.primary_color }}>
                {branding.app_name?.charAt(0) || 'S'}
              </div>
            )}
            <div>
              <p className="font-bold text-white text-sm" data-testid="preview-app-name">{branding.app_name}</p>
              <p className="text-white/60 text-xs">{branding.tagline}</p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
            <Eye size={14} className="text-stone-400" />
            <span className="text-xs text-stone-500">Live preview of sidebar header</span>
            <div className="ml-auto flex gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: branding.primary_color }} title="Primary" />
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: branding.accent_color }} title="Accent" />
              <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: branding.login_bg_color }} title="Login BG" />
            </div>
          </div>
        </Card>

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Upload size={18} /> Platform Logo</CardTitle>
            <CardDescription>This logo appears in the sidebar and login screen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {branding.logo_url ? (
                <img src={`${API_BASE}${branding.logo_url}`} alt="Logo" className="w-20 h-20 rounded-xl object-contain bg-stone-50 border shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs">No logo</div>
              )}
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" data-testid="logo-upload-input" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="upload-logo-btn">
                  {uploading ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Upload size={14} className="mr-1" />}
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Recommended 200x200px.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Naming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>App Name</Label>
                <Input value={branding.app_name} onChange={e => set('app_name', e.target.value)} data-testid="app-name-input" />
              </div>
              <div className="space-y-1">
                <Label>Tagline</Label>
                <Input value={branding.tagline} onChange={e => set('tagline', e.target.value)} data-testid="tagline-input" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Paintbrush size={18} /> Color Scheme</CardTitle>
            <CardDescription>Define your brand colors across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: 'primary_color', label: 'Primary Color' },
                { key: 'accent_color', label: 'Accent Color' },
                { key: 'sidebar_color', label: 'Sidebar Color' },
                { key: 'login_bg_color', label: 'Login Background' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={branding[key]} onChange={e => set(key, e.target.value)} className="w-12 h-10 p-1 cursor-pointer" data-testid={`color-${key}`} />
                    <Input value={branding[key]} onChange={e => set(key, e.target.value)} className="flex-1 font-mono text-sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-stone-800">Hide "Powered by SSC Track"</p>
                <p className="text-xs text-stone-500">Remove the branding footer from all pages</p>
              </div>
              <Switch checked={branding.hide_powered_by} onCheckedChange={v => set('hide_powered_by', v)} data-testid="hide-powered-by-toggle" />
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={fetchBranding} data-testid="reset-btn">
            <RefreshCw size={14} className="mr-1" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-white-label-btn">
            {saving ? <RefreshCw className="animate-spin mr-1" size={14} /> : <Save size={14} className="mr-1" />}
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
