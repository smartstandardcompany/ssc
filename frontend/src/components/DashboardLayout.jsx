import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Store, Users, Truck, Receipt, BarChart3,
  LogOut, Shield, CreditCard, FileText, Tags, UserCheck, FileWarning, Bell,
  User as UserIcon, Settings, ArrowLeftRight, FileInput, AlertTriangle,
  Handshake, HelpCircle, Building2, Package, ChefHat, CalendarClock,
  ArrowDownUp, Activity, PackageCheck, ChevronDown, Menu, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

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
      { path: '/kitchen', icon: ChefHat, label: 'Kitchen', perm: 'kitchen' },
    ]
  },
  {
    label: 'Reports',
    items: [
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

function NavGroup({ group, userRole, userPerms, currentPath, onNavigate }) {
  const filteredItems = group.items.filter(item => {
    if (userRole === 'admin') return true;
    if (item.roles && !item.roles.includes(userRole || 'operator')) return false;
    if (userPerms.length > 0 && item.perm) return userPerms.includes(item.perm);
    return true;
  });

  if (filteredItems.length === 0) return null;

  const hasActive = filteredItems.some(i => i.path === currentPath);
  const [open, setOpen] = useState(hasActive);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        data-testid={`nav-group-${group.label.toLowerCase()}`}
        className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${hasActive ? 'text-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
      >
        {group.label}
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
                {item.label}
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
            />
          ))
        )}
      </nav>

      <div className="p-3 border-t border-stone-100 bg-white">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate" data-testid="user-name">{user.name}</p>
            <p className="text-[10px] text-stone-400 truncate">{user.email}</p>
          </div>
          <Badge className="bg-orange-50 text-orange-600 border-orange-200 capitalize text-[10px] shrink-0">{user.role}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button"
          className="w-full rounded-lg border-stone-200 text-stone-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 text-xs h-8">
          <LogOut size={14} className="mr-1.5" />Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-btn" className="p-1.5 rounded-lg hover:bg-stone-50">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-base font-bold font-outfit bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">SSC Track</span>
        </div>
        <div className="flex items-center gap-2">
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
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-stone-100 fixed h-full overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside className={`lg:hidden fixed top-0 left-0 z-50 w-72 h-full bg-white border-r border-stone-100 flex flex-col transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      <main className="flex-1 lg:ml-60 bg-gradient-to-br from-[#FDFBF7] to-[#FFF8F0]">
        <div className="pt-14 lg:pt-0">
          <div className="p-4 lg:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
};
