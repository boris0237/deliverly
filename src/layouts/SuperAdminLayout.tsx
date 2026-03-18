import { useEffect, useState } from 'react';
import SuperAdminSidebar from '@/components/superadmin/SuperAdminSidebar';
import SuperAdminTopbar from '@/components/superadmin/SuperAdminTopbar';
import { cn } from '@/lib/utils';

const SuperAdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncSidebarState = (matches: boolean) => {
      setSidebarOpen(matches);
    };
    syncSidebarState(mediaQuery.matches);
    const onChange = (event: MediaQueryListEvent) => syncSidebarState(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <SuperAdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarOpen ? 'lg:ml-72' : 'lg:ml-20'
        )}
      >
        <SuperAdminTopbar onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 md:p-6 overflow-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
