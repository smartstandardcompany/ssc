import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, ShoppingCart, Store, Users, Truck, Receipt, BarChart3,
  LogOut, Shield, CreditCard, FileText, Tags, UserCheck, FileWarning, Bell,
  User as UserIcon, Settings, ArrowLeftRight, FileInput, AlertTriangle,
  Handshake, HelpCircle, Building2, Package, ChefHat, CalendarClock,
  ArrowDownUp, Activity, PackageCheck, ChevronDown, Menu, X, Zap,
  AlertCircle, Moon, Sun, Keyboard, Globe, UtensilsCrossed
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { navLabelToKey, LANGUAGES } from '@/lib/i18n';

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard' },
      { path: '/pos', icon: ShoppingCart, label: 'Quick Entry', perm: 'sales' },
      { path: '/pos-analytics', icon: Activity, label: 'Live Analytics', perm: 'dashboard', roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Finance',
    items: [
      { path: '/sales', icon: ShoppingCart, label: 'Sales', perm: 'sales' },
      { path: '/invoices', icon: FileInput, label: 'Invoices', perm: 'invoices' },
      { path: '/expenses', icon: Receipt, label: 'Expenses', perm: 'expenses' },
      { path: '/supplier-payments', icon: Receipt, label: 'Supplier Payments', perm: 'supplier_payments', roles: ['admin', 'manager'] },
      { path: '/cash-transfers', icon: ArrowLeftRight, label: 'Cash Transfers', perm: 'cash_transfers', roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'People',
    items: [
      { path: '/customers', icon: Users, label: 'Customers', perm: 'customers' },
      { path: '/suppliers', icon: Truck, label: 'Suppliers', perm: 'suppliers', roles: ['admin', 'manager'] },
      { path: '/employees', icon: UserCheck, label: 'Employees', perm: 'employees', roles: ['admin', 'manager'] },
      { path: '/leave-approvals', icon: Bell, label: 'Leave Approvals', perm: 'employees', roles: ['admin', 'manager'] },
      { path: '/schedule', icon: CalendarClock, label: 'Schedule', perm: 'shifts', roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Stock',
    items: [
      { path: '/stock', icon: Package, label: 'Inventory', perm: 'stock', roles: ['admin', 'manager'] },
      { path: '/transfers', icon: PackageCheck, label: 'Transfers', perm: 'stock', roles: ['admin', 'manager'] },
      { path: '/menu-items', icon: UtensilsCrossed, label: 'Menu Items', perm: 'stock', roles: ['admin', 'manager'] },
      { path: '/kitchen', icon: ChefHat, label: 'Kitchen', perm: 'kitchen' },
    ]
  },
  {
    label: 'Reports',
    items: [
      { path: '/analytics', icon: BarChart3, label: 'Analytics', perm: 'reports', roles: ['admin', 'manager'] },
      { path: '/visualizations', icon: Activity, label: 'Visualizations', perm: 'reports', roles: ['admin', 'manager'] },
      { path: '/reports', icon: BarChart3, label: 'Reports', perm: 'reports', roles: ['admin', 'manager'] },
      { path: '/credit-report', icon: CreditCard, label: 'Credit Report', perm: 'credit_report', roles: ['admin', 'manager'] },
      { path: '/supplier-report', icon: FileText, label: 'Supplier Report', perm: 'supplier_report', roles: ['admin', 'manager'] },
      { path: '/category-report', icon: Tags, label: 'Category Report', perm: 'reports', roles: ['admin', 'manager'] },
      { path: '/bank-statements', icon: FileText, label: 'Bank Statements', perm: 'reports', roles: ['admin'] },
      { path: '/reconciliation', icon: ArrowDownUp, label: 'Reconciliation', perm: 'reports', roles: ['admin'] },
    ]
  },
  {
    label: 'Assets',
    items: [
      { path: '/branches', icon: Store, label: 'Branches', perm: 'branches', roles: ['admin', 'manager'] },
      { path: '/documents', icon: FileWarning, label: 'Documents', perm: 'documents', roles: ['admin', 'manager'] },
      { path: '/fines', icon: AlertTriangle, label: 'Fines & Penalties', perm: 'fines', roles: ['admin', 'manager'] },
      { path: '/partners', icon: Handshake, label: 'Partners', perm: 'partners', roles: ['admin'] },
      { path: '/company-loans', icon: Building2, label: 'Company Loans', perm: 'partners', roles: ['admin'] },
    ]
  },
  {
    label: 'Admin',
    items: [
      { path: '/users', icon: Shield, label: 'Users', perm: 'users', roles: ['admin'] },
      { path: '/settings', icon: Settings, label: 'Settings', perm: 'settings', roles: ['admin'] },
      { path: '/help', icon: HelpCircle, label: 'Help & Guide' },
    ]
  },
];

function NavGroup({ group, userRole, userPerms, currentPath, onNavigate, t }) {
  const filteredItems = group.items.filter(item => {
    if (userRole === 'admin') return true;
    if (item.roles && !item.roles.includes(userRole || 'operator')) return false;
    if (userPerms.length > 0 && item.perm) return userPerms.includes(item.perm);
    return true;
  });

  const hasActive = filteredItems.some(i => i.path === currentPath);
  const [open, setOpen] = useState(hasActive);

  if (filteredItems.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        data-testid={`nav-group-${group.label.toLowerCase()}`}
        className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${hasActive ? 'text-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
      >
        {t(navLabelToKey[group.label] || group.label)}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 border-l-[3px] border-orange-500'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700 ml-[3px]'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                {t(navLabelToKey[item.label] || item.label)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ssc_dark_mode') === 'true');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { t, lang, setLang, isRTL } = useLanguage();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isEmployee = user.role === 'employee';
  const userPerms = user.permissions || [];

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications/unread-count');
        setUnreadCount(res.data.count);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isEmployee) return;
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/stock/alerts');
        setStockAlerts(res.data || []);
        if (res.data?.length > 0 && stockAlerts.length === 0) {
          toast.warning(`${res.data.length} item(s) below minimum stock level`, { duration: 5000 });
        }
      } catch {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('ssc_dark_mode', darkMode);
  }, [darkMode]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const shortcuts = {
      'd': '/', 'n': '/pos', 'p': '/pos', 's': '/sales', 'e': '/expenses',
      'i': '/stock', 'r': '/reports', 'a': '/analytics', 'v': '/visualizations', '?': 'shortcuts',
    };
    const target = shortcuts[e.key.toLowerCase()];
    if (target === 'shortcuts') { e.preventDefault(); setShowShortcuts(s => !s); }
    else if (target) { e.preventDefault(); navigate(target); }
  }, [navigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
    window.location.reload();
  };

  const employeeNav = [
    { path: '/my-portal', icon: UserIcon, label: 'My Portal' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
  ];

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="SSC" className="w-10 h-10 rounded-xl object-contain" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold font-outfit bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent" data-testid="app-title">SSC Track</h1>
            <p className="text-[10px] text-stone-400 truncate">{isEmployee ? 'Employee Portal' : 'Smart Standard Company'}</p>
          </div>
        </div>
      </div>

      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        {isEmployee ? (
          <div className="space-y-0.5">
            {employeeNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-orange-50 text-orange-700 border-l-[3px] border-orange-500' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700 ml-[3px]'}`}>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.label}
                  {item.path === '/notifications' && unreadCount > 0 && (
                    <Badge className="ml-auto bg-orange-500 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">{unreadCount}</Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          NAV_GROUPS.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              userRole={user.role}
              userPerms={userPerms}
              currentPath={location.pathname}
              onNavigate={() => setMobileOpen(false)}
              t={t}
            />
          ))
        )}
      </nav>

      <div className="p-3 border-t border-stone-100 bg-white dark:bg-stone-900 dark:border-stone-700">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate" data-testid="user-name">{user.name}</p>
            <p className="text-[10px] text-stone-400 truncate">{user.email}</p>
          </div>
          <Badge className="bg-orange-50 text-orange-600 border-orange-200 capitalize text-[10px] shrink-0">{user.role}</Badge>
        </div>
        <div className="flex gap-1.5 mb-1.5">
          <button onClick={() => setDarkMode(!darkMode)} data-testid="dark-mode-toggle" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 text-xs transition-colors">
            {darkMode ? <Sun size={12} /> : <Moon size={12} />}{darkMode ? t('light') : t('dark')}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="language-dropdown" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 text-xs transition-colors font-semibold">
                <Globe size={12} />{LANGUAGES.find(l => l.code === lang)?.flag || 'EN'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className={`cursor-pointer ${lang === l.code ? 'bg-orange-50 text-orange-600' : ''}`}>
                  <span className="font-bold mr-2">{l.flag}</span>{l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={() => setShowShortcuts(true)} data-testid="shortcuts-btn" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 text-xs transition-colors">
            <Keyboard size={12} />{t('shortcuts')}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button"
          className="w-full rounded-lg border-stone-200 text-stone-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 text-xs h-8 dark:border-stone-600 dark:text-stone-300">
          <LogOut size={14} className="mr-1.5" />{t('logout')}
        </Button>
      </div>
    </>
  );

  return (
    <div className={`flex min-h-screen bg-background ${darkMode ? 'dark' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-btn" className="p-1.5 rounded-lg hover:bg-stone-50">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-base font-bold font-outfit bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">SSC Track</span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="language-dropdown-mobile" className="p-1 text-stone-500 hover:text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1">
                <Globe size={14} />{LANGUAGES.find(l => l.code === lang)?.flag || 'EN'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className={`cursor-pointer ${lang === l.code ? 'bg-orange-50 text-orange-600' : ''}`}>
                  <span className="font-bold mr-2">{l.flag}</span>{l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={() => setDarkMode(!darkMode)} data-testid="dark-mode-toggle-mobile" className="p-1 text-stone-500 hover:text-stone-700 dark:text-stone-300">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {stockAlerts.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowStockAlerts(!showStockAlerts)} data-testid="stock-alerts-btn-mobile" className="relative p-1">
                <AlertCircle size={18} className="text-red-500" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{stockAlerts.length}</span>
              </button>
            </div>
          )}
          {unreadCount > 0 && (
            <Link to="/notifications" className="relative">
              <Bell size={18} className="text-stone-500" />
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
            </Link>
          )}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-[10px]">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - desktop */}
      <aside className={`hidden lg:flex lg:flex-col w-60 bg-white ${isRTL ? 'border-l' : 'border-r'} border-stone-100 fixed ${isRTL ? 'right-0' : 'left-0'} h-full overflow-hidden dark:bg-stone-900 dark:border-stone-700`}>
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside className={`lg:hidden fixed top-0 ${isRTL ? 'right-0' : 'left-0'} z-50 w-72 h-full bg-white ${isRTL ? 'border-l' : 'border-r'} border-stone-100 flex flex-col transform transition-transform duration-200 dark:bg-stone-900 dark:border-stone-700 ${mobileOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      <main className={`flex-1 ${isRTL ? 'lg:mr-60' : 'lg:ml-60'} bg-gradient-to-br from-[#FDFBF7] to-[#FFF8F0] dark:from-stone-900 dark:to-stone-800 pb-16 lg:pb-0`}>
        <div className="pt-14 lg:pt-0">
          {/* Stock Alerts Banner */}
          {stockAlerts.length > 0 && (
            <div className="bg-red-50 border-b border-red-100 px-4 lg:px-8 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <span className="text-sm text-red-700 font-medium truncate" data-testid="stock-alerts-banner">
                    {stockAlerts.length} {t('stock_alert_title')}
                  </span>
                </div>
                <button
                  onClick={() => setShowStockAlerts(!showStockAlerts)}
                  data-testid="stock-alerts-toggle"
                  className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap ml-2"
                >
                  {showStockAlerts ? t('stock_alert_hide') : t('stock_alert_view')}
                </button>
              </div>
              {showStockAlerts && (
                <div className="mt-2 max-h-48 overflow-y-auto" data-testid="stock-alerts-list">
                  <div className="grid gap-1">
                    {stockAlerts.map((a) => (
                      <div key={a.item_id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-1.5 border border-red-100" data-testid={`stock-alert-${a.item_id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-stone-800 truncate">{a.item_name}</span>
                          {a.category && <span className="text-stone-400">({a.category})</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-red-600 font-semibold">{a.current_balance} {a.unit}</span>
                          <span className="text-stone-400">min: {a.min_level}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link to="/stock" className="block text-center text-xs text-red-600 hover:text-red-800 font-medium mt-2 py-1">
                    {t('go_to_inventory')} →
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="p-4 lg:p-8">{children}</div>
        </div>
      </main>

      {/* Floating Quick Entry Button */}
      {location.pathname !== '/pos' && (
        <Link to="/pos" data-testid="floating-quick-entry"
          className="fixed bottom-20 right-6 z-50 w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform duration-200 lg:bottom-8 lg:right-8">
          <Zap size={22} strokeWidth={2.5} />
        </Link>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-700 flex items-center justify-around px-1 py-1.5 safe-area-bottom" data-testid="mobile-bottom-nav">
        {[
          { path: '/', icon: LayoutDashboard, label: 'Home' },
          { path: '/sales', icon: ShoppingCart, label: 'Sales' },
          { path: '/expenses', icon: Receipt, label: 'Expenses' },
          { path: '/stock', icon: Package, label: 'Stock' },
          { path: '/reports', icon: BarChart3, label: 'Reports' },
        ].map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-orange-600' : 'text-stone-400'}`}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-5" onClick={e => e.stopPropagation()} data-testid="shortcuts-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-outfit dark:text-white">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['D', 'Dashboard'], ['N / P', 'POS / Quick Entry'], ['S', 'Sales'],
                ['E', 'Expenses'], ['I', 'Inventory'], ['R', 'Reports'], ['A', 'Analytics'], ['V', 'Visualizations'], ['?', 'Show Shortcuts'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-700 last:border-0">
                  <span className="text-stone-600 dark:text-stone-300">{desc}</span>
                  <kbd className="bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded text-xs font-mono font-bold">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
