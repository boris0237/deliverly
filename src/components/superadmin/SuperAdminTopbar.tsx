import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Menu, User } from 'lucide-react';
import { useAuthStore } from '@/store';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { fallbackAvatarUrl, getAvatarUrl } from '@/lib/avatar';

interface SuperAdminTopbarProps {
  onSidebarToggle: () => void;
}

const SuperAdminTopbar = ({ onSidebarToggle }: SuperAdminTopbarProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/5 bg-[hsl(var(--sidebar-background))]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10" onClick={onSidebarToggle}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-sm text-white/60">{t('common.superAdminOverview')}</h1>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 hover:bg-white/10">
              <img
                src={getAvatarUrl(user)}
                alt={user?.firstName}
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.src = fallbackAvatarUrl(user?.email);
                }}
                className="w-8 h-8 rounded-full bg-white/10"
              />
              <span className="hidden md:inline text-sm text-white">{user?.firstName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <div className="p-3 border-b border-white/5">
              <p className="font-medium text-white">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-white/50">{user?.email}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onSelect={() => router.push('/dashboard/profile')}>
              <User className="w-4 h-4 mr-2" />
              {t('common.profile')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default SuperAdminTopbar;
