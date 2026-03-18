import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ChevronLeft, ChevronRight, LogOut, Package2, User, CreditCard, Building2, Mail } from 'lucide-react';
import { useAuthStore, useThemeStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

interface SuperAdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const SuperAdminSidebar = ({ isOpen, onToggle }: SuperAdminSidebarProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isDark } = useThemeStore();
  const { showToast } = useUIStore();

  const items = [
    { path: '/superadmin/overview', icon: LayoutDashboard, label: t('common.superAdminOverview') },
    { path: '/superadmin/companies', icon: Building2, label: t('common.companies') },
    { path: '/superadmin/billing-plans', icon: CreditCard, label: t('common.billingPlans') },
    { path: '/superadmin/campaigns', icon: Mail, label: t('common.campaigns') },
    { path: '/dashboard/profile', icon: User, label: t('common.profile') },
  ];

  const isActive = (path: string) => {
    const currentPath = pathname ?? '';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-white/5 z-50 transition-transform duration-300 lg:transition-all',
        isOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:translate-x-0 lg:w-20',
        'w-72'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        <Link href="/superadmin/overview" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
              src={'/img/icon.svg'}
              alt="Delivoo"
              className={'w-10 h-10 object-contain'}
            />
          </div>
          {isOpen && <span className="text-xl font-bold text-white"><img src={isDark ? "/img/delivoo_wordmark_dark.svg" : "/img/delivoo_wordmark_light.svg"} alt="Delivoo" className="h-10 object-contain" /></span>}
        </Link>
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          {isOpen ? <ChevronLeft className="w-4 h-4 text-white/60" /> : <ChevronRight className="w-4 h-4 text-white/60" />}
        </button>
      </div>

      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar py-4">
        <nav className="px-3 space-y-1">
          {items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                isActive(item.path)
                  ? 'bg-white/10 text-white border-l-2 border-orange-500'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive(item.path) ? 'text-orange-500' : 'group-hover:text-orange-400')} />
              {isOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-3">
          <div className={cn('p-3 rounded-xl bg-white/5 border border-white/5', !isOpen && 'flex justify-center')}>
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
                className="mt-4 w-full flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
              >
                <LogOut className="w-4 h-4" />
                {t('common.logout')}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SuperAdminSidebar;
