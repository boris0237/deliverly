import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  Store,
  Boxes,
  Receipt,
  FileText,
  HandCoins,
  MapPin,
  MessageCircle,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Package2
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { setCurrentPage, showToast } = useUIStore();
  const isDriver = user?.role === 'driver';

  const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('common.dashboard') },
    { path: '/dashboard/deliveries', icon: Package, label: t('common.deliveries') },
    { path: '/dashboard/drivers', icon: Users, label: t('common.drivers') },
    { path: '/dashboard/partners', icon: Store, label: t('common.partners') },
    { path: '/dashboard/inventory', icon: Boxes, label: t('common.inventory') },
    { path: '/dashboard/expenses', icon: Receipt, label: t('common.expenses') },
    { path: '/dashboard/reports', icon: FileText, label: t('common.reports') },
    { path: '/dashboard/remittances', icon: HandCoins, label: t('common.remittances') },
    { path: '/dashboard/tracking', icon: MapPin, label: t('common.tracking') },
    { path: '/dashboard/whatsapp-assistant', icon: MessageCircle, label: t('common.whatsappAssistant') },
  ];

  const adminNavItems = [
    { path: '/dashboard/users', icon: UserCog, label: t('common.users') },
    { path: '/dashboard/settings', icon: Settings, label: t('common.settings') },
  ];
  const visibleMainNavItems = isDriver
    ? mainNavItems.filter((item) => item.path === '/dashboard/deliveries' || item.path === '/dashboard/reports')
    : mainNavItems;
  const visibleAdminNavItems = isDriver ? [] : adminNavItems;

  const handleNavClick = (label: string) => {
    setCurrentPage(label);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  const isActive = (path: string) => {
    const currentPath = pathname ?? "";
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-white/5 z-50 transition-transform duration-300 lg:transition-all',
        isOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:translate-x-0 lg:w-20',
        'w-72'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          {isOpen && (
            <span className="text-xl font-bold text-white">Deliverly</span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/60" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar py-4">
        {/* Main Navigation */}
        <nav className="px-3 space-y-1">
          {visibleMainNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => handleNavClick(item.label)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                isActive(item.path)
                  ? 'bg-white/10 text-white border-l-2 border-orange-500'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 flex-shrink-0',
                isActive(item.path) ? 'text-orange-500' : 'group-hover:text-orange-400'
              )} />
              {isOpen && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        {isOpen && visibleAdminNavItems.length > 0 && (
          <div className="mx-4 my-4 border-t border-white/5" />
        )}

        {/* Admin Navigation */}
        <nav className="px-3 space-y-1">
          {visibleAdminNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => handleNavClick(item.label)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                isActive(item.path)
                  ? 'bg-white/10 text-white border-l-2 border-orange-500'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 flex-shrink-0',
                isActive(item.path) ? 'text-orange-500' : 'group-hover:text-orange-400'
              )} />
              {isOpen && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* User Profile */}
        <div className="mt-auto px-3">
          <div className={cn(
            'p-3 rounded-xl bg-white/5 border border-white/5',
            !isOpen && 'flex justify-center'
          )}>
            <div className="flex items-center gap-3">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt={user?.firstName}
                className="w-10 h-10 rounded-full bg-white/10"
              />
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-white/50 truncate">{user?.email}</p>
                </div>
              )}
            </div>
            {isOpen && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/auth/logout', { method: 'POST' });
                    if (!response.ok) {
                      showToast(t('errors.auth.LOGOUT_FAILED'), 'error');
                      return;
                    }
                    logout();
                    router.push('/auth/login');
                  } catch {
                    showToast(t('errors.network'), 'error');
                  }
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('common.logout')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
