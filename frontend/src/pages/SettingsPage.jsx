import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageCircle, Bell, Send, Upload, Download, Database, Shield, Clock, Play, FileCheck, Camera, Wifi, WifiOff, Video, Users, AlertTriangle, ExternalLink, Link } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function BranchWaButtons() {
  const [br, setBr] = useState([]);
  useEffect(() => { api.get('/branches').then(r => setBr(r.data)).catch(() => {}); }, []);
  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" className="rounded-xl h-8 text-xs" onClick={async () => { try { const res = await api.post('/whatsapp/send-branch-report', {}); toast.success(res.data.message); } catch(e) { toast.error(e.response?.data?.detail || 'Failed'); } }}>All Branches</Button>
      {br.map(b => (
        <Button key={b.id} variant="outline" className="rounded-xl h-8 text-xs" onClick={async () => { try { const res = await api.post('/whatsapp/send-branch-report', { branch_id: b.id }); toast.success(res.data.message); } catch(e) { toast.error(e.response?.data?.detail || 'Failed'); } }}>{b.name}</Button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [emailSettings, setEmailSettings] = useState({ smtp_host: '', smtp_port: 587, username: '', password: '', from_email: '', use_tls: true });
  const [whatsappSettings, setWhatsappSettings] = useState({ account_sid: '', auth_token: '', phone_number: '', recipient_number: '', enabled: true });
  const [notifPrefs, setNotifPrefs] = useState({ email_daily_sales: false, email_document_expiry: true, email_leave_updates: false, whatsapp_daily_sales: false, whatsapp_document_expiry: false });
  const [companyInfo, setCompanyInfo] = useState({ company_name: 'Smart Standard Company', address_line1: '', address_line2: '', city: '', country: '', phone: '', email: '', cr_number: '', vat_number: '', vat_enabled: false, vat_rate: 15 });
  const [zatcaSettings, setZatcaSettings] = useState({
    enabled: false, environment: 'sandbox', otp: '',
    csid: '', csid_secret: '', production_csid: '', production_secret: '',
    certificate: '', private_key: '',
    auto_submit: false, invoice_counter: 1,
    csid_expiry: '', production_csid_expiry: '', expiry_alert_days: 30
  });
  const [zatcaStatus, setZatcaStatus] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [schedulerJobs, setSchedulerJobs] = useState([]);
  const [schedulerLogs, setSchedulerLogs] = useState([]);
  const [cctvSettings, setCctvSettings] = useState({
    hik_email: '', hik_password: '', hik_status: null,
    people_counting_enabled: true, motion_alerts_enabled: true,
    alert_sensitivity: 'medium', counting_interval: 5
  });
  const [monitoringConfig, setMonitoringConfig] = useState({
    enabled: false, interval_minutes: 5,
    cameras: [], features: ['people_counting', 'motion_detection'],
    notification_channels: ['in_app']
  });
  const [branches, setBranches] = useState([]);
  const [dvrs, setDvrs] = useState([]);
  const [newDVR, setNewDVR] = useState({
    branch_id: '', name: '', ip_address: '', port: 8000,
    username: 'admin', password: '', device_serial: '', is_cloud: true, channels: 4
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const [emailRes, waRes, prefRes, coRes, schedRes, logRes, hikRes, branchRes, dvrRes, monitorRes, zatcaRes, zatcaStatusRes] = await Promise.all([
        api.get('/settings/email').catch(() => ({ data: null })),
        api.get('/settings/whatsapp').catch(() => ({ data: null })),
        api.get('/settings/notifications').catch(() => ({ data: null })),
        api.get('/settings/company').catch(() => ({ data: null })),
        api.get('/scheduler/config').catch(() => ({ data: [] })),
        api.get('/scheduler/logs').catch(() => ({ data: [] })),
        api.get('/cctv/hik-connect/status').catch(() => ({ data: null })),
        api.get('/branches').catch(() => ({ data: [] })),
        api.get('/cctv/dvrs').catch(() => ({ data: [] })),
        api.get('/cctv/monitoring/config').catch(() => ({ data: null })),
        api.get('/settings/zatca').catch(() => ({ data: null })),
        api.get('/settings/zatca/status').catch(() => ({ data: null })),
      ]);
      if (emailRes.data) setEmailSettings(prev => ({ ...prev, ...emailRes.data }));
      if (waRes.data) setWhatsappSettings(prev => ({ ...prev, ...waRes.data }));
      if (prefRes.data) setNotifPrefs(prev => ({ ...prev, ...prefRes.data }));
      if (coRes.data) setCompanyInfo(prev => ({ ...prev, ...coRes.data }));
      if (schedRes.data) setSchedulerJobs(schedRes.data);
      if (logRes.data) setSchedulerLogs(logRes.data);
      if (hikRes.data) setCctvSettings(prev => ({ ...prev, hik_email: hikRes.data.email || '', hik_status: hikRes.data }));
      if (branchRes.data) setBranches(branchRes.data);
      if (dvrRes.data) setDvrs(dvrRes.data);
      if (monitorRes.data) setMonitoringConfig(prev => ({ ...prev, ...monitorRes.data }));
      if (zatcaRes.data) setZatcaSettings(prev => ({ ...prev, ...zatcaRes.data }));
      if (zatcaStatusRes.data) setZatcaStatus(zatcaStatusRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const saveEmail = async () => {
    try { await api.post('/settings/email', emailSettings); toast.success('Email settings saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const testEmailSend = async () => {
    try {
      const res = await api.post('/settings/email/test', { to_email: testEmail || undefined });
      toast.success(res.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Test failed'); }
  };

  const saveWhatsapp = async () => {
    try { await api.post('/settings/whatsapp', whatsappSettings); toast.success('WhatsApp settings saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const testWhatsapp = async () => {
    try {
      const res = await api.post('/settings/whatsapp/test');
      toast.success(res.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Test failed'); }
  };

  const savePrefs = async () => {
    try { await api.post('/settings/notifications', notifPrefs); toast.success('Preferences saved'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const sendDailyReport = async () => {
    try {
      const res = await api.post('/send-daily-report');
      toast.success(res.data.message);
      if (res.data.details) res.data.details.forEach(d => toast.info(d));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleLogoUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/settings/upload-logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
  };

  const saveHikConnect = async () => {
    try {
      await api.post('/cctv/hik-connect/auth', { email: cctvSettings.hik_email, password: cctvSettings.hik_password });
      toast.success('Hik-Connect credentials saved');
      fetchSettings();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const saveCctvSettings = async () => {
    try {
      await api.post('/cctv/settings', {
        people_counting_enabled: cctvSettings.people_counting_enabled,
        motion_alerts_enabled: cctvSettings.motion_alerts_enabled,
        alert_sensitivity: cctvSettings.alert_sensitivity,
        counting_interval: cctvSettings.counting_interval
      });
      toast.success('CCTV settings saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const addDVR = async () => {
    try {
      const branch = branches.find(b => b.id === newDVR.branch_id);
      await api.post('/cctv/dvrs', { ...newDVR, branch_name: branch?.name || '' });
      toast.success('DVR added successfully');
      setNewDVR({ branch_id: '', name: '', ip_address: '', port: 8000, username: 'admin', password: '', device_serial: '', is_cloud: true, channels: 4 });
      fetchSettings();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to add DVR'); }
  };

  const deleteDVR = async (dvrId) => {
    if (!confirm('Delete this DVR and all its cameras?')) return;
    try {
      await api.delete(`/cctv/dvrs/${dvrId}`);
      toast.success('DVR deleted');
      fetchSettings();
    } catch { toast.error('Failed to delete DVR'); }
  };

  const saveMonitoringConfig = async () => {
    try {
      await api.post('/cctv/monitoring/config', monitoringConfig);
      toast.success('Monitoring configuration saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
  };

  const runMonitoringNow = async () => {
    try {
      const res = await api.post('/cctv/monitoring/run');
      toast.success(res.data.message || 'Monitoring task queued');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to run'); }
  };

  const saveZatcaSettings = async () => {
    try {
      await api.post('/settings/zatca', zatcaSettings);
      toast.success('ZATCA settings saved successfully');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save ZATCA settings'); }
  };

  const testZatcaConnection = async () => {
    try {
      const res = await api.post('/settings/zatca/test');
      if (res.data.success) {
        toast.success(res.data.message || 'ZATCA connection successful');
      } else {
        toast.error(res.data.message || 'ZATCA connection failed');
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to test connection'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="settings-title">Settings</h1>
          <p className="text-muted-foreground">Configure email, WhatsApp, notifications & company settings</p>
        </div>

        <Tabs defaultValue="links">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="links"><Link size={14} className="mr-2" />Quick Links</TabsTrigger>
            <TabsTrigger value="email"><Mail size={14} className="mr-2" />Email</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageCircle size={14} className="mr-2" />WhatsApp</TabsTrigger>
            <TabsTrigger value="notifications"><Bell size={14} className="mr-2" />Alerts</TabsTrigger>
            <TabsTrigger value="zatca" data-testid="zatca-tab"><FileCheck size={14} className="mr-2" />ZATCA</TabsTrigger>
            <TabsTrigger value="import"><Upload size={14} className="mr-2" />Import Data</TabsTrigger>
            <TabsTrigger value="backup"><Database size={14} className="mr-2" />Backup</TabsTrigger>
            <TabsTrigger value="scheduler"><Clock size={14} className="mr-2" />Scheduler</TabsTrigger>
            <TabsTrigger value="cctv"><Camera size={14} className="mr-2" />CCTV</TabsTrigger>
            <TabsTrigger value="deploy"><Shield size={14} className="mr-2" />Deploy</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>

          {/* Quick Links Tab */}
          <TabsContent value="links">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-outfit">Quick Access Links</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Share these links with your staff to access their portals directly.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* POS Waiter Portal */}
                  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-500 rounded-lg">
                          <Users className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-emerald-800">POS / Waiter Portal</h3>
                          <p className="text-xs text-emerald-600 mt-1">For cashiers, waiters, and kitchen staff</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                              <code className="text-xs flex-1 text-emerald-700">{window.location.origin}/cashier-pos</code>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/cashier-pos`); toast.success('Link copied!');}}>
                                Copy
                              </Button>
                            </div>
                            <Button 
                              className="w-full bg-emerald-500 hover:bg-emerald-600" 
                              onClick={() => window.open('/cashier-pos', '_blank')}
                            >
                              <ExternalLink size={14} className="mr-2" /> Open POS Portal
                            </Button>
                          </div>
                          <p className="text-[10px] text-emerald-500 mt-2">Staff login with their PIN</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Employee Self-Service Portal */}
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <Users className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-blue-800">Employee Self-Service</h3>
                          <p className="text-xs text-blue-600 mt-1">For employees to view payslips, leaves, loans</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                              <code className="text-xs flex-1 text-blue-700">{window.location.origin}/my-portal</code>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/my-portal`); toast.success('Link copied!');}}>
                                Copy
                              </Button>
                            </div>
                            <Button 
                              className="w-full bg-blue-500 hover:bg-blue-600" 
                              onClick={() => window.open('/my-portal', '_blank')}
                            >
                              <ExternalLink size={14} className="mr-2" /> Open Employee Portal
                            </Button>
                          </div>
                          <p className="text-[10px] text-blue-500 mt-2">Employees login with email & password</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Kitchen Display */}
                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-500 rounded-lg">
                          <Bell className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-orange-800">Kitchen Display (KDS)</h3>
                          <p className="text-xs text-orange-600 mt-1">For kitchen staff to see incoming orders</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                              <code className="text-xs flex-1 text-orange-700">{window.location.origin}/kds</code>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/kds`); toast.success('Link copied!');}}>
                                Copy
                              </Button>
                            </div>
                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600" 
                              onClick={() => window.open('/kds', '_blank')}
                            >
                              <ExternalLink size={14} className="mr-2" /> Open KDS
                            </Button>
                          </div>
                          <p className="text-[10px] text-orange-500 mt-2">Kitchen PIN required</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Customer Order Status */}
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-500 rounded-lg">
                          <Clock className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-purple-800">Customer Order Status</h3>
                          <p className="text-xs text-purple-600 mt-1">Display for customers to see order progress</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border">
                              <code className="text-xs flex-1 text-purple-700">{window.location.origin}/order-status</code>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/order-status`); toast.success('Link copied!');}}>
                                Copy
                              </Button>
                            </div>
                            <Button 
                              className="w-full bg-purple-500 hover:bg-purple-600" 
                              onClick={() => window.open('/order-status', '_blank')}
                            >
                              <ExternalLink size={14} className="mr-2" /> Open Status Display
                            </Button>
                          </div>
                          <p className="text-[10px] text-purple-500 mt-2">No login required</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Email SMTP Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Configure your email server to send notifications. Common providers: Gmail (smtp.gmail.com:587), Outlook (smtp-mail.outlook.com:587), SendGrid (smtp.sendgrid.net:587)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>SMTP Host *</Label><Input value={emailSettings.smtp_host} placeholder="smtp.gmail.com" data-testid="smtp-host" onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })} /></div>
                  <div><Label>SMTP Port</Label><Input type="number" value={emailSettings.smtp_port} data-testid="smtp-port" onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })} /></div>
                  <div><Label>Username / Email *</Label><Input value={emailSettings.username} placeholder="your@email.com" data-testid="smtp-user" onChange={(e) => setEmailSettings({ ...emailSettings, username: e.target.value })} /></div>
                  <div><Label>Password / App Password *</Label><Input type="password" value={emailSettings.password} placeholder="••••••••" data-testid="smtp-pass" onChange={(e) => setEmailSettings({ ...emailSettings, password: e.target.value })} /></div>
                  <div><Label>From Email</Label><Input value={emailSettings.from_email} placeholder="noreply@company.com" onChange={(e) => setEmailSettings({ ...emailSettings, from_email: e.target.value })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={emailSettings.use_tls} onCheckedChange={(v) => setEmailSettings({ ...emailSettings, use_tls: v })} />
                      <Label>Use TLS</Label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveEmail} className="rounded-full" data-testid="save-email">Save Email Settings</Button>
                  <div className="flex gap-2 items-center">
                    <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" className="w-48 h-9" />
                    <Button variant="outline" onClick={testEmailSend} className="rounded-full" data-testid="test-email"><Send size={14} className="mr-2" />Send Test</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">WhatsApp (Twilio) Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Get your Twilio credentials from <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-primary underline">console.twilio.com</a>. Enable WhatsApp sandbox in Twilio first.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Account SID *</Label><Input value={whatsappSettings.account_sid} placeholder="ACxxxxxxxxxx" data-testid="twilio-sid" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, account_sid: e.target.value })} /></div>
                  <div><Label>Auth Token *</Label><Input type="password" value={whatsappSettings.auth_token} placeholder="••••••••" data-testid="twilio-token" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, auth_token: e.target.value })} /></div>
                  <div><Label>WhatsApp Number (from Twilio) *</Label><Input value={whatsappSettings.phone_number} placeholder="+14155238886" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, phone_number: e.target.value })} /></div>
                  <div><Label>Recipient Numbers * (comma-separated for multiple)</Label><Input value={whatsappSettings.recipient_number} placeholder="+966508235003, +966512345678" onChange={(e) => setWhatsappSettings({ ...whatsappSettings, recipient_number: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">Add multiple numbers separated by comma. Each person must join Twilio sandbox first.</p></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveWhatsapp} className="rounded-full" data-testid="save-whatsapp">Save WhatsApp Settings</Button>
                  <Button variant="outline" onClick={testWhatsapp} className="rounded-full" data-testid="test-whatsapp"><Send size={14} className="mr-2" />Send Test</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">Choose what notifications to send via email and WhatsApp</p>
                
                <div className="space-y-4">
                  <h3 className="font-medium text-sm flex items-center gap-2"><Mail size={16} />Email Notifications</h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_daily_sales} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_daily_sales: v })} /><Label>Daily Sales Summary</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_document_expiry} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_document_expiry: v })} /><Label>Document Expiry Alerts</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.email_leave_updates} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, email_leave_updates: v })} /><Label>Leave Request Updates</Label></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm flex items-center gap-2"><MessageCircle size={16} />WhatsApp Notifications</h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.whatsapp_daily_sales} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, whatsapp_daily_sales: v })} /><Label>Daily Sales Summary</Label></div>
                    <div className="flex items-center gap-3"><Checkbox checked={notifPrefs.whatsapp_document_expiry} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, whatsapp_document_expiry: v })} /><Label>Document Expiry Alerts</Label></div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={savePrefs} className="rounded-full" data-testid="save-prefs">Save Preferences</Button>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={sendDailyReport} className="rounded-xl" data-testid="send-report"><Send size={14} className="mr-2" />Daily Sales</Button>
                    <Button variant="outline" className="rounded-xl" onClick={async () => { try { const res = await api.post('/whatsapp/send-supplier-report'); toast.success(res.data.message); } catch(e) { toast.error(e.response?.data?.detail || 'Failed'); } }}><Send size={14} className="mr-2" />Supplier Report</Button>
                    <Button variant="outline" className="rounded-xl" onClick={async () => { try { const res = await api.post('/whatsapp/send-employee-report', {}); toast.success(res.data.message); } catch(e) { toast.error(e.response?.data?.detail || 'Failed'); } }}><Send size={14} className="mr-2" />Employee Report</Button>
                  </div>

                  <div className="mt-3">
                    <Label className="text-xs mb-2 block">Send Branch Report via WhatsApp</Label>
                    <BranchWaButtons />
                  </div>
                  <div className="mt-3 p-3 bg-stone-50 rounded-xl border">
                    <Label className="text-xs">Send Custom Message via WhatsApp</Label>
                    <div className="flex gap-2 mt-2">
                      <Input id="custom-wa-msg" placeholder="Type your message..." className="h-9" />
                      <Button variant="outline" className="rounded-xl h-9" onClick={async () => {
                        const msg = document.getElementById('custom-wa-msg').value;
                        if (!msg) { toast.error('Enter a message'); return; }
                        try { const res = await api.post('/whatsapp/send-custom', { message: msg }); toast.success(res.data.message); document.getElementById('custom-wa-msg').value = ''; } catch(e) { toast.error(e.response?.data?.detail || 'Failed'); }
                      }}><Send size={14} className="mr-1" />Send</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ZATCA Phase 2 Settings Tab */}
          <TabsContent value="zatca">
            <div className="space-y-6">
              {/* Overview Card */}
              <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <FileCheck size={20} className="text-orange-600" />
                    ZATCA Fatoora Integration (Phase 2)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure your ZATCA e-invoicing credentials for Phase 2 compliance. You need to register on the 
                    <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline mx-1">ZATCA Fatoora Portal</a>
                    to obtain your CSID (Cryptographic Stamp Identifier).
                  </p>
                  
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${zatcaSettings.enabled ? 'bg-success/20' : 'bg-stone-200'}`}>
                        <Shield size={18} className={zatcaSettings.enabled ? 'text-success' : 'text-stone-500'} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Enable ZATCA Phase 2</p>
                        <p className="text-xs text-muted-foreground">Enable automatic XML generation and QR code with digital signature</p>
                      </div>
                    </div>
                    <Switch
                      checked={zatcaSettings.enabled}
                      onCheckedChange={(v) => setZatcaSettings({ ...zatcaSettings, enabled: v })}
                      data-testid="zatca-phase2-toggle"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* CSID Expiry Alert Banner */}
              {zatcaStatus?.expiry_status && (
                <Card className={`border-2 ${
                  zatcaStatus.expiry_status.is_expired 
                    ? 'border-red-500 bg-red-50' 
                    : zatcaStatus.expiry_status.needs_renewal 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-green-500 bg-green-50'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${
                          zatcaStatus.expiry_status.is_expired 
                            ? 'bg-red-100' 
                            : zatcaStatus.expiry_status.needs_renewal 
                              ? 'bg-amber-100' 
                              : 'bg-green-100'
                        }`}>
                          {zatcaStatus.expiry_status.is_expired ? (
                            <AlertTriangle size={24} className="text-red-600" />
                          ) : zatcaStatus.expiry_status.needs_renewal ? (
                            <Clock size={24} className="text-amber-600" />
                          ) : (
                            <Shield size={24} className="text-green-600" />
                          )}
                        </div>
                        <div>
                          <h3 className={`font-semibold ${
                            zatcaStatus.expiry_status.is_expired 
                              ? 'text-red-800' 
                              : zatcaStatus.expiry_status.needs_renewal 
                                ? 'text-amber-800' 
                                : 'text-green-800'
                          }`}>
                            {zatcaStatus.expiry_status.is_expired 
                              ? '⚠️ CSID Expired!' 
                              : zatcaStatus.expiry_status.needs_renewal 
                                ? `⏰ CSID Expires in ${zatcaStatus.expiry_status.days_until_expiry} days`
                                : `✓ CSID Valid for ${zatcaStatus.expiry_status.days_until_expiry} days`
                            }
                          </h3>
                          <p className={`text-sm ${
                            zatcaStatus.expiry_status.is_expired 
                              ? 'text-red-600' 
                              : zatcaStatus.expiry_status.needs_renewal 
                                ? 'text-amber-600' 
                                : 'text-green-600'
                          }`}>
                            Expiry Date: {zatcaStatus.expiry_status.expiry_date}
                            {zatcaStatus.expiry_status.needs_renewal && !zatcaStatus.expiry_status.is_expired && (
                              <span className="ml-2">(Alerts active - {zatcaStatus.expiry_status.alert_days} days before expiry)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {(zatcaStatus.expiry_status.is_expired || zatcaStatus.expiry_status.needs_renewal) && (
                        <a 
                          href="https://fatoora.zatca.gov.sa/onboard" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`px-4 py-2 rounded-full font-medium text-white transition-colors ${
                            zatcaStatus.expiry_status.is_expired 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          Renew CSID Now
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Environment Selection */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit text-base">Environment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      className={`p-4 rounded-xl border-2 text-left transition-all ${zatcaSettings.environment === 'sandbox' ? 'border-orange-500 bg-orange-50' : 'border-stone-200 hover:border-stone-300'}`}
                      onClick={() => setZatcaSettings({ ...zatcaSettings, environment: 'sandbox' })}
                      data-testid="zatca-sandbox-btn"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${zatcaSettings.environment === 'sandbox' ? 'bg-orange-500' : 'bg-stone-300'}`} />
                        <span className="font-medium">Sandbox (Testing)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Use for development and testing. Invoices won't be submitted to ZATCA.</p>
                    </button>
                    <button
                      className={`p-4 rounded-xl border-2 text-left transition-all ${zatcaSettings.environment === 'production' ? 'border-success bg-success/5' : 'border-stone-200 hover:border-stone-300'}`}
                      onClick={() => setZatcaSettings({ ...zatcaSettings, environment: 'production' })}
                      data-testid="zatca-production-btn"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${zatcaSettings.environment === 'production' ? 'bg-success' : 'bg-stone-300'}`} />
                        <span className="font-medium">Production</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Live environment. Invoices will be submitted to ZATCA for clearance.</p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Credentials */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Shield size={18} />
                      CSID Credentials
                    </span>
                    <a 
                      href="https://fatoora.zatca.gov.sa/onboard" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100 transition-colors"
                    >
                      Get CSID from ZATCA Portal
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your CSID credentials obtained from the <a href="https://fatoora.zatca.gov.sa/onboard" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">ZATCA Fatoora Onboarding Portal</a>.
                  </p>

                  {zatcaSettings.environment === 'sandbox' ? (
                    <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        Sandbox Credentials
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">CSID (Sandbox)</Label>
                          <Input
                            value={zatcaSettings.csid}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, csid: e.target.value })}
                            placeholder="TUxTRDox..."
                            className="h-9 mt-1 font-mono text-xs"
                            data-testid="zatca-csid-sandbox"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">CSID Secret (Sandbox)</Label>
                          <Input
                            type="password"
                            value={zatcaSettings.csid_secret}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, csid_secret: e.target.value })}
                            placeholder="••••••••"
                            className="h-9 mt-1"
                            data-testid="zatca-secret-sandbox"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">CSID Expiry Date</Label>
                          <Input
                            type="date"
                            value={zatcaSettings.csid_expiry || ''}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, csid_expiry: e.target.value })}
                            className="h-9 mt-1"
                            data-testid="zatca-csid-expiry-sandbox"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">You'll receive alerts before expiry</p>
                        </div>
                        <div>
                          <Label className="text-xs">Alert Days Before Expiry</Label>
                          <Input
                            type="number"
                            value={zatcaSettings.expiry_alert_days || 30}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, expiry_alert_days: parseInt(e.target.value) || 30 })}
                            className="h-9 mt-1"
                            min={1}
                            max={90}
                            data-testid="zatca-alert-days"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Daily alerts until renewed</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        Production Credentials
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">CSID (Production)</Label>
                          <Input
                            value={zatcaSettings.production_csid}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, production_csid: e.target.value })}
                            placeholder="TUxTRDox..."
                            className="h-9 mt-1 font-mono text-xs"
                            data-testid="zatca-csid-production"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">CSID Secret (Production)</Label>
                          <Input
                            type="password"
                            value={zatcaSettings.production_secret}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, production_secret: e.target.value })}
                            placeholder="••••••••"
                            className="h-9 mt-1"
                            data-testid="zatca-secret-production"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">CSID Expiry Date</Label>
                          <Input
                            type="date"
                            value={zatcaSettings.production_csid_expiry || ''}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, production_csid_expiry: e.target.value })}
                            className="h-9 mt-1"
                            data-testid="zatca-csid-expiry-production"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">You'll receive alerts before expiry</p>
                        </div>
                        <div>
                          <Label className="text-xs">Alert Days Before Expiry</Label>
                          <Input
                            type="number"
                            value={zatcaSettings.expiry_alert_days || 30}
                            onChange={(e) => setZatcaSettings({ ...zatcaSettings, expiry_alert_days: parseInt(e.target.value) || 30 })}
                            className="h-9 mt-1"
                            min={1}
                            max={90}
                            data-testid="zatca-alert-days-prod"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Daily alerts until renewed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Certificate & Private Key (Advanced) */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-stone-800 flex items-center gap-2">
                      <span className="text-xs bg-stone-200 px-2 py-0.5 rounded">Advanced</span>
                      Certificate & Private Key (Optional)
                    </summary>
                    <div className="mt-4 space-y-4 p-4 bg-stone-50 rounded-xl">
                      <div>
                        <Label className="text-xs">Certificate (PEM format)</Label>
                        <textarea
                          value={zatcaSettings.certificate}
                          onChange={(e) => setZatcaSettings({ ...zatcaSettings, certificate: e.target.value })}
                          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                          className="w-full h-24 mt-1 p-2 text-xs font-mono border rounded-lg resize-none"
                          data-testid="zatca-certificate"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Private Key (PEM format)</Label>
                        <textarea
                          value={zatcaSettings.private_key}
                          onChange={(e) => setZatcaSettings({ ...zatcaSettings, private_key: e.target.value })}
                          placeholder="-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----"
                          className="w-full h-24 mt-1 p-2 text-xs font-mono border rounded-lg resize-none"
                          data-testid="zatca-private-key"
                        />
                      </div>
                    </div>
                  </details>
                </CardContent>
              </Card>

              {/* Invoice Settings */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit text-base">Invoice Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">Auto-submit to ZATCA</p>
                      <p className="text-xs text-muted-foreground">Automatically submit invoices to ZATCA after creation</p>
                    </div>
                    <Switch
                      checked={zatcaSettings.auto_submit}
                      onCheckedChange={(v) => setZatcaSettings({ ...zatcaSettings, auto_submit: v })}
                      data-testid="zatca-auto-submit"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Invoice Counter (ICV)</Label>
                      <Input
                        type="number"
                        value={zatcaSettings.invoice_counter}
                        onChange={(e) => setZatcaSettings({ ...zatcaSettings, invoice_counter: parseInt(e.target.value) || 1 })}
                        className="h-9 mt-1"
                        min={1}
                        data-testid="zatca-invoice-counter"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Sequential counter for invoice chain</p>
                    </div>
                    <div>
                      <Label className="text-xs">OTP (One-Time Password)</Label>
                      <Input
                        value={zatcaSettings.otp}
                        onChange={(e) => setZatcaSettings({ ...zatcaSettings, otp: e.target.value })}
                        placeholder="123456"
                        className="h-9 mt-1"
                        data-testid="zatca-otp"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Required for initial CSID generation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={saveZatcaSettings} className="rounded-full" data-testid="save-zatca-btn">
                      Save ZATCA Settings
                    </Button>
                    <Button variant="outline" onClick={testZatcaConnection} className="rounded-full" data-testid="test-zatca-btn">
                      <Shield size={14} className="mr-2" />
                      Test Connection
                    </Button>
                    <a
                      href="https://fatoora.zatca.gov.sa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100 transition-colors"
                    >
                      Open ZATCA Portal
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader>
                  <CardTitle className="font-outfit text-base flex items-center gap-2">
                    <AlertTriangle size={18} className="text-blue-600" />
                    ZATCA Phase 2 Complete Registration Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Prerequisites */}
                  <div className="p-4 bg-white rounded-xl border border-blue-100">
                    <h4 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">!</span>
                      Prerequisites
                    </h4>
                    <ul className="space-y-2 text-sm text-stone-600">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>Valid Commercial Registration (CR) number</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>Valid VAT Registration number (15 digits starting with 3)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>Authorized signatory access to ZATCA Fatoora Portal</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>Mobile phone for OTP verification</span>
                      </li>
                    </ul>
                  </div>

                  {/* Step by Step Guide */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-stone-800">Step-by-Step Registration Process</h4>
                    
                    {/* Step 1 */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-stone-800">Register on ZATCA Fatoora Portal</h5>
                          <p className="text-xs text-stone-500 mt-1">Create your taxpayer account on the official ZATCA e-invoicing platform</p>
                          <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Visit <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">fatoora.zatca.gov.sa</a></li>
                              <li>Click "Register" and select "Taxpayer Registration"</li>
                              <li>Enter your VAT number and verify via OTP</li>
                              <li>Complete your business profile information</li>
                              <li>Verify your email address</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-stone-800">Generate OTP for Device Onboarding</h5>
                          <p className="text-xs text-stone-500 mt-1">Get a One-Time Password to register your e-invoicing solution</p>
                          <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Log in to the Fatoora Portal</li>
                              <li>Go to "Onboarding & Management" → "EGS Units"</li>
                              <li>Click "Add New Unit/Device"</li>
                              <li>Generate an OTP (valid for 1 hour)</li>
                              <li>Copy the OTP and enter it in the field above</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-stone-800">Submit CSR and Receive CSID</h5>
                          <p className="text-xs text-stone-500 mt-1">Submit Certificate Signing Request to get your Cryptographic Stamp ID</p>
                          <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Our system will automatically generate a CSR for you</li>
                              <li>The CSR is submitted to ZATCA using your OTP</li>
                              <li>ZATCA returns a CSID (Compliance CSID for sandbox)</li>
                              <li>Enter the CSID in the credentials section above</li>
                              <li>The CSID is valid for a limited time - renew before expiry</li>
                            </ol>
                          </div>
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-700">
                              <strong>Note:</strong> Sandbox CSID is for testing. After successful testing, you'll receive a Production CSID.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">4</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-stone-800">Test in Sandbox Environment</h5>
                          <p className="text-xs text-stone-500 mt-1">Validate your integration before going live</p>
                          <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Keep environment set to "Sandbox"</li>
                              <li>Create test invoices in the system</li>
                              <li>Use the "Test Connection" button to verify</li>
                              <li>Check that XML and QR codes generate correctly</li>
                              <li>Verify invoice submission responses</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="p-4 bg-white rounded-xl border border-stone-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">5</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-stone-800">Request Production CSID</h5>
                          <p className="text-xs text-stone-500 mt-1">After successful sandbox testing, get your production credentials</p>
                          <div className="mt-3 p-3 bg-stone-50 rounded-lg">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Log in to Fatoora Portal</li>
                              <li>Go to "Onboarding & Management"</li>
                              <li>Select your device and request Production CSID</li>
                              <li>ZATCA reviews and approves (usually 24-48 hours)</li>
                              <li>Enter Production CSID in the fields above</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 6 */}
                    <div className="p-4 bg-white rounded-xl border border-green-200 bg-green-50/30">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">6</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-green-800">Go Live!</h5>
                          <p className="text-xs text-green-600 mt-1">Switch to production and start issuing compliant e-invoices</p>
                          <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside">
                              <li>Switch environment to "Production" above</li>
                              <li>Enable "Auto-submit to ZATCA" if desired</li>
                              <li>All new invoices will be automatically cleared with ZATCA</li>
                              <li>Monitor submission status in the invoices list</li>
                              <li>Keep your CSID renewed before expiry</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="font-semibold text-sm text-amber-800 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600" />
                      Important Notes
                    </h4>
                    <ul className="space-y-2 text-xs text-amber-700">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Invoice Types:</strong> Standard (B2B) invoices require buyer VAT number. Simplified (B2C) invoices don't.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Clearance vs Reporting:</strong> B2B invoices need real-time clearance. B2C invoices are reported within 24 hours.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Invoice Counter (ICV):</strong> Must be sequential and never reset. System manages this automatically.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>CSID Expiry:</strong> Production CSID expires after 1 year. Renew 30 days before expiry.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Support:</strong> For issues, contact ZATCA support at 19993 or visit the Fatoora Portal help section.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Quick Links */}
                  <div className="flex flex-wrap gap-2">
                    <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noopener noreferrer" 
                       className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100">
                      Fatoora Portal
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <a href="https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx" target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-full hover:bg-green-100">
                      ZATCA E-Invoicing Guide
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <a href="https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/TechnicalRequirements.aspx" target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-full hover:bg-purple-100">
                      Technical Requirements
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="company">
            <div className="space-y-6">
              {/* ZATCA Invoicing Toggle - Prominent */}
              <Card className="border-orange-200 bg-orange-50/30" data-testid="zatca-settings-card">
                <CardHeader className="pb-3">
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <FileCheck size={18} className="text-orange-600" />
                    ZATCA Invoicing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Enable or disable ZATCA-compliant VAT invoicing. When enabled, invoices will include VAT calculations and a QR code as required by Saudi tax authority.</p>
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-orange-100">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-800">Enable ZATCA VAT on Invoices</p>
                      <p className="text-xs text-stone-500 mt-0.5">Adds VAT line items and QR code to all generated invoices</p>
                    </div>
                    <Switch
                      checked={companyInfo.vat_enabled}
                      onCheckedChange={(v) => setCompanyInfo({ ...companyInfo, vat_enabled: v })}
                      data-testid="zatca-toggle"
                    />
                  </div>
                  {companyInfo.vat_enabled && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-orange-100">
                      <div>
                        <Label className="text-xs">VAT Rate (%)</Label>
                        <Input type="number" value={companyInfo.vat_rate} onChange={(e) => setCompanyInfo({ ...companyInfo, vat_rate: e.target.value })} className="h-9 mt-1" data-testid="vat-rate-input" />
                      </div>
                      <div>
                        <Label className="text-xs">VAT Registration Number</Label>
                        <Input value={companyInfo.vat_number} onChange={(e) => setCompanyInfo({ ...companyInfo, vat_number: e.target.value })} className="h-9 mt-1" placeholder="3xxxxxxxxx00003" data-testid="vat-number-input" />
                      </div>
                    </div>
                  )}
                  <Button onClick={async () => {
                    try { await api.post('/settings/company', companyInfo); toast.success('ZATCA settings saved'); }
                    catch { toast.error('Failed'); }
                  }} className="rounded-xl bg-orange-600 hover:bg-orange-700" data-testid="save-zatca-btn">Save ZATCA Settings</Button>
                </CardContent>
              </Card>

              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Company Information & Address</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">This information appears on letters, payslips, invoices and reports.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Label>Company Name</Label><Input value={companyInfo.company_name} onChange={(e) => setCompanyInfo({ ...companyInfo, company_name: e.target.value })} /></div>
                    <div><Label>Address Line 1</Label><Input value={companyInfo.address_line1} onChange={(e) => setCompanyInfo({ ...companyInfo, address_line1: e.target.value })} placeholder="Building, Street" /></div>
                    <div><Label>Address Line 2</Label><Input value={companyInfo.address_line2} onChange={(e) => setCompanyInfo({ ...companyInfo, address_line2: e.target.value })} placeholder="Area, District" /></div>
                    <div><Label>City</Label><Input value={companyInfo.city} onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })} /></div>
                    <div><Label>Country</Label><Input value={companyInfo.country} onChange={(e) => setCompanyInfo({ ...companyInfo, country: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={companyInfo.phone} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={companyInfo.email} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} /></div>
                    <div><Label>CR Number</Label><Input value={companyInfo.cr_number} onChange={(e) => setCompanyInfo({ ...companyInfo, cr_number: e.target.value })} placeholder="Commercial Registration" /></div>
                  </div>
                  <Button onClick={async () => {
                    try { await api.post('/settings/company', companyInfo); toast.success('Company info saved'); }
                    catch { toast.error('Failed'); }
                  }} className="rounded-xl">Save Company Info</Button>
                </CardContent>
              </Card>
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Company Logo</CardTitle></CardHeader>
                <CardContent>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
                    <Button variant="outline" className="rounded-xl" asChild><span><Upload size={14} className="mr-2" />Upload Logo</span></Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">Appears on payslips, letters and reports.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <div className="space-y-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Import Data from Excel/CSV</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Upload your existing data from Excel (.xlsx) or CSV files. Download the template first, fill in your data, then upload.</p>
                  
                  {['customers', 'suppliers', 'employees', 'items', 'branches', 'sales', 'expenses_import'].map(type => (
                    <div key={type} className="flex items-center justify-between p-4 border rounded-xl hover:bg-stone-50 transition-all">
                      <div>
                        <div className="font-medium capitalize text-sm">{type}</div>
                        <div className="text-xs text-muted-foreground">
                          {type === 'customers' && 'name, phone, email'}
                          {type === 'suppliers' && 'name, category, phone, email, credit_limit'}
                          {type === 'employees' && 'name, document_id, phone, email, position, salary'}
                          {type === 'items' && 'name, unit_price, category'}
                          {type === 'branches' && 'name, location'}
                          {type === 'sales' && 'date, sale_type, amount, discount, payment_mode, notes'}
                          {type === 'expenses_import' && 'date, category, description, amount, payment_mode'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={async () => {
                          try {
                            const res = await api.get(`/import/template/${type}`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([res.data]));
                            const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${type}_template.xlsx`);
                            document.body.appendChild(link); link.click(); link.remove();
                          } catch { toast.error('Failed'); }
                        }}><Download size={14} className="mr-1" />Template</Button>
                        <label className="cursor-pointer">
                          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0]; if (!file) return;
                            try {
                              toast.loading('Importing...');
                              const form = new FormData(); form.append('file', file); form.append('data_type', type);
                              const res = await api.post('/import/data', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                              toast.dismiss();
                              toast.success(res.data.message);
                              if (res.data.errors?.length > 0) toast.warning(`${res.data.errors.length} errors`);
                            } catch (err) { toast.dismiss(); toast.error(err.response?.data?.detail || 'Import failed'); }
                            e.target.value = '';
                          }} />
                          <Button size="sm" className="rounded-xl text-xs" asChild><span><Upload size={14} className="mr-1" />Upload</span></Button>
                        </label>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="backup">
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><Database size={18} />Database Backup</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Download a complete backup of all your data as a JSON file. Save it to OneDrive, Google Drive, or any safe location.</p>
                  <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                    <div className="flex items-start gap-3">
                      <Shield size={20} className="text-success mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">What's included in backup:</p>
                        <p className="text-xs text-muted-foreground mt-1">All users, branches, customers, suppliers, sales, invoices, expenses, employees, salary payments, leaves, documents, categories, cash transfers, items, recurring expenses, settings, and notifications.</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={async () => {
                    try {
                      toast.loading('Generating backup...');
                      const res = await api.get('/backup/database', { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `dataentry_backup_${new Date().toISOString().slice(0,10)}.json`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      toast.dismiss();
                      toast.success('Backup downloaded! Save it to OneDrive or safe location.');
                    } catch { toast.dismiss(); toast.error('Backup failed'); }
                  }} className="rounded-full" data-testid="download-backup-btn">
                    <Download size={18} className="mr-2" />Download Full Backup
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader><CardTitle className="font-outfit">MongoDB Atlas Setup Guide</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">For production deployment, use MongoDB Atlas (free tier available):</p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Go to <a href="https://www.mongodb.com/atlas" target="_blank" rel="noreferrer" className="text-primary underline">mongodb.com/atlas</a> and create a free account</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Create a free cluster (M0 - 512MB free forever)</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Click "Connect" then "Connect your application"</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Copy the connection string</li>
                    <li className="flex gap-2"><span className="font-bold text-primary">5.</span> Set it as MONGO_URL in your deployment environment</li>
                  </ol>
                  <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                    <p className="text-xs text-info">MongoDB Atlas free tier includes automatic daily backups, so your data is always safe!</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scheduler">
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-outfit">Automated Report Scheduler</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure automated WhatsApp/Email reports. Make sure WhatsApp and/or Email are configured first.</p>
                  <div className="space-y-3" data-testid="scheduler-jobs">
                    {schedulerJobs.map(job => (
                      <div key={job.job_type} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-xl bg-stone-50/50" data-testid={`scheduler-job-${job.job_type}`}>
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <Checkbox checked={job.enabled} onCheckedChange={async (v) => {
                            try {
                              await api.put(`/scheduler/config/${job.job_type}`, { enabled: v });
                              setSchedulerJobs(prev => prev.map(j => j.job_type === job.job_type ? { ...j, enabled: v } : j));
                              toast.success(v ? 'Enabled' : 'Disabled');
                            } catch { toast.error('Failed'); }
                          }} />
                          <div>
                            <p className="font-medium text-sm">{job.label || job.job_type}</p>
                            <p className="text-xs text-muted-foreground">{job.job_type.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-0 sm:ml-auto flex-wrap">
                          {/* Day selector for weekly */}
                          {job.job_type === 'weekly_digest' && (
                            <select className="h-8 text-xs border rounded-lg px-2 bg-white"
                              value={job.day_of_week || 'sun'}
                              onChange={async (e) => {
                                try {
                                  await api.put(`/scheduler/config/${job.job_type}`, { day_of_week: e.target.value });
                                  setSchedulerJobs(prev => prev.map(j => j.job_type === job.job_type ? { ...j, day_of_week: e.target.value } : j));
                                } catch { toast.error('Failed'); }
                              }}>
                              {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                            </select>
                          )}
                          {/* Day selector for monthly */}
                          {job.job_type === 'monthly_digest' && (
                            <select className="h-8 text-xs border rounded-lg px-2 bg-white"
                              value={job.day || 1}
                              onChange={async (e) => {
                                try {
                                  await api.put(`/scheduler/config/${job.job_type}`, { day: parseInt(e.target.value) });
                                  setSchedulerJobs(prev => prev.map(j => j.job_type === job.job_type ? { ...j, day: parseInt(e.target.value) } : j));
                                } catch { toast.error('Failed'); }
                              }}>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Day {d}</option>)}
                            </select>
                          )}
                          <Label className="text-xs">Time:</Label>
                          <Input type="time" className="h-8 w-28 text-xs" value={`${String(job.hour || 0).padStart(2,'0')}:${String(job.minute || 0).padStart(2,'0')}`}
                            onChange={async (e) => {
                              const [h, m] = e.target.value.split(':').map(Number);
                              try {
                                await api.put(`/scheduler/config/${job.job_type}`, { hour: h, minute: m });
                                setSchedulerJobs(prev => prev.map(j => j.job_type === job.job_type ? { ...j, hour: h, minute: m } : j));
                              } catch { toast.error('Failed'); }
                            }} data-testid={`scheduler-time-${job.job_type}`} />
                          <div className="flex gap-1">
                            {['whatsapp', 'email'].map(ch => (
                              <button key={ch} type="button" className={`px-2 py-1 text-[10px] rounded-md border ${(job.channels || []).includes(ch) ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-stone-200 text-stone-400'}`}
                                onClick={async () => {
                                  const channels = (job.channels || []).includes(ch) ? (job.channels || []).filter(c => c !== ch) : [...(job.channels || []), ch];
                                  try {
                                    await api.put(`/scheduler/config/${job.job_type}`, { channels });
                                    setSchedulerJobs(prev => prev.map(j => j.job_type === job.job_type ? { ...j, channels } : j));
                                  } catch { toast.error('Failed'); }
                                }}>
                                {ch === 'whatsapp' ? 'WA' : 'Email'}
                              </button>
                            ))}
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" data-testid={`trigger-${job.job_type}`}
                            onClick={async () => {
                              try {
                                await api.post(`/scheduler/trigger/${job.job_type}`);
                                toast.success(`${job.label} triggered`);
                                const logRes = await api.get('/scheduler/logs');
                                setSchedulerLogs(logRes.data);
                              } catch { toast.error('Failed to trigger'); }
                            }}>
                            <Play size={10} className="mr-1" />Test
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {schedulerLogs.length > 0 && (
                <Card className="border-border">
                  <CardHeader><CardTitle className="font-outfit text-sm">Recent Scheduler Logs</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="scheduler-logs">
                      {schedulerLogs.slice(0, 20).map((log, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs p-2 border-b border-stone-50">
                          <Badge variant="outline" className={`text-[10px] ${log.status === 'completed' ? 'border-emerald-300 text-emerald-600' : log.status === 'error' ? 'border-red-300 text-red-600' : 'border-stone-300'}`}>
                            {log.status}
                          </Badge>
                          <span className="font-medium">{log.job_type?.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground ml-auto">{log.triggered_at ? new Date(log.triggered_at).toLocaleString() : ''}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cctv">
            <div className="space-y-6">
              {/* Hik-Connect Configuration */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <Wifi size={18} />
                    Hik-Connect Cloud Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Connect your Hikvision account to access cloud-connected DVRs. This is the same account you use in the Hik-Connect mobile app.</p>
                  
                  {cctvSettings.hik_status?.connected && (
                    <div className="p-3 bg-success/10 rounded-xl border border-success/30 flex items-center gap-2">
                      <Wifi size={16} className="text-success" />
                      <span className="text-sm font-medium text-success">Connected</span>
                      <span className="text-xs text-muted-foreground ml-2">{cctvSettings.hik_status.email}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Hik-Connect Email</Label>
                      <Input 
                        value={cctvSettings.hik_email} 
                        onChange={(e) => setCctvSettings({ ...cctvSettings, hik_email: e.target.value })}
                        placeholder="your@email.com"
                        data-testid="hik-email"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input 
                        type="password" 
                        value={cctvSettings.hik_password} 
                        onChange={(e) => setCctvSettings({ ...cctvSettings, hik_password: e.target.value })}
                        placeholder="••••••••"
                        data-testid="hik-password"
                      />
                    </div>
                  </div>
                  <Button onClick={saveHikConnect} className="rounded-full" data-testid="save-hik">
                    <Wifi size={14} className="mr-2" />Save Hik-Connect Credentials
                  </Button>
                </CardContent>
              </Card>

              {/* DVR Management */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <Video size={18} />
                    DVR/NVR Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Add your DVRs here. For local network DVRs, provide IP address. For cloud DVRs, provide device serial number.</p>
                  
                  {/* Existing DVRs */}
                  {dvrs.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Configured DVRs ({dvrs.length})</Label>
                      {dvrs.map(dvr => (
                        <div key={dvr.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Video size={18} className="text-primary" />
                            <div>
                              <p className="text-sm font-medium">{dvr.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {dvr.branch_name} • {dvr.camera_count || dvr.channels} cameras • {dvr.is_cloud ? 'Cloud' : dvr.ip_address}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="text-error" onClick={() => deleteDVR(dvr.id)}>Delete</Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New DVR */}
                  <div className="p-4 border rounded-xl bg-stone-50 space-y-4">
                    <h3 className="font-medium text-sm">Add New DVR</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Branch *</Label>
                        <Select value={newDVR.branch_id} onValueChange={(v) => setNewDVR({ ...newDVR, branch_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                          <SelectContent>
                            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>DVR Name *</Label>
                        <Input value={newDVR.name} onChange={(e) => setNewDVR({ ...newDVR, name: e.target.value })} placeholder="Main Store DVR" />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant={newDVR.is_cloud ? "default" : "outline"} 
                        size="sm" 
                        className="flex-1 rounded-xl"
                        onClick={() => setNewDVR({ ...newDVR, is_cloud: true })}
                      >
                        <Wifi size={14} className="mr-1" /> Cloud (Hik-Connect)
                      </Button>
                      <Button 
                        variant={!newDVR.is_cloud ? "default" : "outline"} 
                        size="sm" 
                        className="flex-1 rounded-xl"
                        onClick={() => setNewDVR({ ...newDVR, is_cloud: false })}
                      >
                        <Video size={14} className="mr-1" /> Local IP
                      </Button>
                    </div>

                    {newDVR.is_cloud ? (
                      <div>
                        <Label>Device Serial Number</Label>
                        <Input value={newDVR.device_serial} onChange={(e) => setNewDVR({ ...newDVR, device_serial: e.target.value })} placeholder="DS-7208HQHI-K1 (found on DVR label)" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>IP Address *</Label>
                          <Input value={newDVR.ip_address} onChange={(e) => setNewDVR({ ...newDVR, ip_address: e.target.value })} placeholder="192.168.1.100" />
                        </div>
                        <div>
                          <Label>Port</Label>
                          <Input type="number" value={newDVR.port} onChange={(e) => setNewDVR({ ...newDVR, port: parseInt(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Username</Label>
                          <Input value={newDVR.username} onChange={(e) => setNewDVR({ ...newDVR, username: e.target.value })} />
                        </div>
                        <div>
                          <Label>Password</Label>
                          <Input type="password" value={newDVR.password} onChange={(e) => setNewDVR({ ...newDVR, password: e.target.value })} />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Number of Channels</Label>
                      <Select value={String(newDVR.channels)} onValueChange={(v) => setNewDVR({ ...newDVR, channels: parseInt(v) })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[4, 8, 16, 32].map(n => <SelectItem key={n} value={String(n)}>{n} Channels</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={addDVR} disabled={!newDVR.branch_id || !newDVR.name} className="rounded-full">
                      Add DVR
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AI Features */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <Users size={18} />
                    AI Features Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure AI-powered features for your CCTV system.</p>

                  <div className="space-y-4">
                    {/* People Counting */}
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-lg"><Users size={18} className="text-success" /></div>
                        <div>
                          <p className="text-sm font-medium">People Counting</p>
                          <p className="text-xs text-muted-foreground">AI counts people entering and exiting your stores</p>
                        </div>
                      </div>
                      <Switch 
                        checked={cctvSettings.people_counting_enabled} 
                        onCheckedChange={(v) => setCctvSettings({ ...cctvSettings, people_counting_enabled: v })}
                      />
                    </div>

                    {cctvSettings.people_counting_enabled && (
                      <div className="ml-6 p-3 border-l-2 border-primary/30 space-y-3">
                        <div>
                          <Label className="text-xs">Counting Interval (minutes)</Label>
                          <Select value={String(cctvSettings.counting_interval)} onValueChange={(v) => setCctvSettings({ ...cctvSettings, counting_interval: parseInt(v) })}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 min</SelectItem>
                              <SelectItem value="5">5 min</SelectItem>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Motion Alerts */}
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-lg"><AlertTriangle size={18} className="text-warning" /></div>
                        <div>
                          <p className="text-sm font-medium">Motion Detection Alerts</p>
                          <p className="text-xs text-muted-foreground">Get alerts when motion is detected after hours</p>
                        </div>
                      </div>
                      <Switch 
                        checked={cctvSettings.motion_alerts_enabled} 
                        onCheckedChange={(v) => setCctvSettings({ ...cctvSettings, motion_alerts_enabled: v })}
                      />
                    </div>

                    {cctvSettings.motion_alerts_enabled && (
                      <div className="ml-6 p-3 border-l-2 border-warning/30 space-y-3">
                        <div>
                          <Label className="text-xs">Alert Sensitivity</Label>
                          <Select value={cctvSettings.alert_sensitivity} onValueChange={(v) => setCctvSettings({ ...cctvSettings, alert_sensitivity: v })}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button onClick={saveCctvSettings} className="rounded-full">
                    Save AI Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Scheduled AI Monitoring */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <Clock size={18} />
                    Scheduled AI Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure automatic AI monitoring that runs at regular intervals. Requires camera frames to be uploaded or direct camera access.</p>

                  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Clock size={18} className="text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium">Enable Scheduled Monitoring</p>
                        <p className="text-xs text-muted-foreground">Automatically analyze camera feeds at set intervals</p>
                      </div>
                    </div>
                    <Switch 
                      checked={monitoringConfig.enabled} 
                      onCheckedChange={(v) => setMonitoringConfig({ ...monitoringConfig, enabled: v })}
                      data-testid="monitoring-enabled"
                    />
                  </div>

                  {monitoringConfig.enabled && (
                    <div className="space-y-4 p-4 border rounded-xl bg-white">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Monitoring Interval</Label>
                          <Select value={String(monitoringConfig.interval_minutes)} onValueChange={(v) => setMonitoringConfig({ ...monitoringConfig, interval_minutes: parseInt(v) })}>
                            <SelectTrigger data-testid="monitoring-interval">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Every 1 minute</SelectItem>
                              <SelectItem value="5">Every 5 minutes</SelectItem>
                              <SelectItem value="15">Every 15 minutes</SelectItem>
                              <SelectItem value="30">Every 30 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs mb-2 block">Features to Enable</Label>
                        <div className="flex flex-wrap gap-2">
                          {['people_counting', 'motion_detection', 'object_detection'].map(feature => (
                            <button
                              key={feature}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                monitoringConfig.features.includes(feature)
                                  ? 'bg-primary text-white'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                              onClick={() => {
                                const features = monitoringConfig.features.includes(feature)
                                  ? monitoringConfig.features.filter(f => f !== feature)
                                  : [...monitoringConfig.features, feature];
                                setMonitoringConfig({ ...monitoringConfig, features });
                              }}
                            >
                              {feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs mb-2 block">Alert Notification Channels</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'in_app', label: 'In-App', icon: Bell },
                            { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                            { id: 'email', label: 'Email', icon: Mail }
                          ].map(channel => (
                            <button
                              key={channel.id}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                                monitoringConfig.notification_channels.includes(channel.id)
                                  ? 'bg-primary text-white'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                              onClick={() => {
                                const channels = monitoringConfig.notification_channels.includes(channel.id)
                                  ? monitoringConfig.notification_channels.filter(c => c !== channel.id)
                                  : [...monitoringConfig.notification_channels, channel.id];
                                setMonitoringConfig({ ...monitoringConfig, notification_channels: channels });
                              }}
                            >
                              <channel.icon size={12} />
                              {channel.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={saveMonitoringConfig} className="rounded-full">
                          Save Monitoring Config
                        </Button>
                        <Button variant="outline" onClick={runMonitoringNow} className="rounded-full">
                          <Play size={14} className="mr-1" /> Run Now
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <h3 className="font-medium text-sm mb-2">How to Find Your DVR Serial Number</h3>
                  <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                    <li>Look at the sticker on your DVR/NVR device</li>
                    <li>Or open the Hik-Connect mobile app → Device Management → Select your device → Device Info</li>
                    <li>The serial number looks like: DS-7208HQHI-K1</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-3">
                    <strong>Note:</strong> For live streaming via cloud, full API access requires Hikvision Partner registration at <a href="https://tpp.hikvision.com" target="_blank" rel="noreferrer" className="text-primary underline">tpp.hikvision.com</a>. 
                    For immediate viewing, use local IP connection or the Hik-Connect mobile app.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="deploy">
            <div className="space-y-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Deploy to Your Website</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Follow these steps to deploy SSC Track on your own website/server:</p>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 1: Save Code to GitHub</h3>
                      <p className="text-xs text-muted-foreground">In the Emergent chat, click <strong>"Save to Github"</strong> button. This pushes all your code to a GitHub repository.</p>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 2: Setup MongoDB Atlas (Free)</h3>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Go to <a href="https://www.mongodb.com/atlas" target="_blank" rel="noreferrer" className="text-primary underline">mongodb.com/atlas</a></li>
                        <li>Create free account → Create free cluster (M0)</li>
                        <li>Click Connect → Get connection string</li>
                        <li>Whitelist your server IP (or 0.0.0.0/0 for any)</li>
                      </ol>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 3: Deploy (Choose One)</h3>
                      <div className="space-y-3 mt-2">
                        <div className="p-3 bg-white rounded-lg border border-primary/30">
                          <div className="font-medium text-xs flex items-center gap-2"><Badge className="bg-primary text-white">Recommended</Badge> Railway.app (Fastest & Easiest)</div>
                          <ol className="text-xs text-muted-foreground mt-2 ml-4 list-decimal space-y-1">
                            <li>Go to <a href="https://railway.app" target="_blank" rel="noreferrer" className="text-primary underline">railway.app</a> → Sign in with GitHub</li>
                            <li>Click "New Project" → "Deploy from GitHub Repo"</li>
                            <li>Select your repo → It auto-detects the Dockerfile</li>
                            <li>Add environment variables (see Step 4 below)</li>
                            <li>Railway gives you a URL like <code className="bg-stone-200 px-1 rounded">ssctrack.up.railway.app</code></li>
                            <li>In <strong>GoDaddy DNS</strong>: Add a CNAME record pointing your subdomain to Railway URL</li>
                          </ol>
                          <p className="text-xs mt-2 text-primary font-medium">Cost: ~$5/month. Your data is safe on MongoDB Atlas.</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="font-medium text-xs">GoDaddy VPS / Any VPS (Full Control)</div>
                          <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal space-y-1">
                            <li>Get a Linux VPS (GoDaddy, DigitalOcean, or Hetzner — $5-10/mo)</li>
                            <li>SSH into server: <code className="bg-stone-200 px-1 rounded">ssh root@your-server-ip</code></li>
                            <li>Install Docker: <code className="bg-stone-200 px-1 rounded">curl -fsSL https://get.docker.com | sh</code></li>
                            <li>Clone repo: <code className="bg-stone-200 px-1 rounded">git clone your-repo-url && cd your-repo</code></li>
                            <li>Create <code className="bg-stone-200 px-1 rounded">.env</code> file with your settings</li>
                            <li>Build & run: <code className="bg-stone-200 px-1 rounded">docker build -t ssctrack . && docker run -d -p 80:80 --env-file .env ssctrack</code></li>
                            <li>In <strong>GoDaddy DNS</strong>: Add an A record pointing your domain to server IP</li>
                          </ol>
                        </div>
                        <div className="p-3 bg-white rounded-lg border">
                          <div className="font-medium text-xs">Render.com (Free Tier Available)</div>
                          <ol className="text-xs text-muted-foreground mt-1 ml-4 list-decimal space-y-1">
                            <li>Go to <a href="https://render.com" target="_blank" rel="noreferrer" className="text-primary underline">render.com</a> → Connect GitHub</li>
                            <li>Create "Web Service" from your repo</li>
                            <li>Set environment variables → Deploy</li>
                            <li>Add custom domain in Render dashboard</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Step 4: Set Environment Variables</h3>
                      <div className="bg-stone-800 text-stone-100 p-3 rounded-lg text-xs font-mono space-y-1 mt-2">
                        <p>MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/ssctrack</p>
                        <p>DB_NAME=ssctrack</p>
                        <p>SECRET_KEY=your-secret-key-here</p>
                        <p>REACT_APP_BACKEND_URL=https://yourdomain.com</p>
                        <p># Optional - for WhatsApp:</p>
                        <p>TWILIO_ACCOUNT_SID=your-sid</p>
                        <p>TWILIO_AUTH_TOKEN=your-token</p>
                        <p>TWILIO_PHONE_NUMBER=+1234567890</p>
                        <p># Optional - for Invoice OCR:</p>
                        <p>EMERGENT_LLM_KEY=your-key</p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">GoDaddy Domain Setup</h3>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Login to <a href="https://dcc.godaddy.com" target="_blank" rel="noreferrer" className="text-primary underline">GoDaddy Domain Manager</a></li>
                        <li>Select your domain → DNS → Manage Records</li>
                        <li><strong>For Railway/Render:</strong> Add CNAME record → Name: <code className="bg-stone-200 px-1 rounded">app</code> → Value: <code className="bg-stone-200 px-1 rounded">your-app.up.railway.app</code></li>
                        <li><strong>For VPS:</strong> Add A record → Name: <code className="bg-stone-200 px-1 rounded">app</code> → Value: <code className="bg-stone-200 px-1 rounded">your-server-ip</code></li>
                        <li>Wait 10-30 min for DNS to propagate</li>
                        <li>Your app will be live at <code className="bg-stone-200 px-1 rounded">app.yourdomain.com</code></li>
                      </ol>
                    </div>
                    
                    <div className="p-4 border rounded-xl bg-orange-50 border-orange-200">
                      <h3 className="font-semibold text-sm mb-2 text-orange-800">Step 5: Import Your Data</h3>
                      <p className="text-xs text-orange-700">After deploying, go to Settings → Import Data tab to upload your existing data from Excel files.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit">Install App on Phones (PWA)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">SSC Track is a Progressive Web App — employees can install it like a native app on their phones. No app store needed!</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">Android (Chrome)</h3>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Open your app URL in Chrome browser</li>
                        <li>Login with their account</li>
                        <li>Tap the <strong>3 dots menu</strong> (top right)</li>
                        <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                        <li>Confirm → App icon appears on home screen</li>
                      </ol>
                    </div>
                    <div className="p-4 border rounded-xl bg-stone-50">
                      <h3 className="font-semibold text-sm mb-2">iPhone (Safari)</h3>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Open your app URL in <strong>Safari</strong> (must be Safari)</li>
                        <li>Login with their account</li>
                        <li>Tap the <strong>Share button</strong> (square with arrow)</li>
                        <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                        <li>Confirm → App icon appears on home screen</li>
                      </ol>
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
                    <p className="text-xs"><strong>Tip:</strong> Create employee accounts in Users page with appropriate permissions. Each employee logs in with their own account and only sees the modules they have access to (Sales, Kitchen, etc.)</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
