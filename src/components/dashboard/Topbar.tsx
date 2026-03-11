import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io, type Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Bell, 
  Menu,
  Check,
  Package,
  User,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { useDashboardStore, useAuthStore } from '@/store';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TopbarProps {
  sidebarOpen?: boolean;
  onSidebarToggle: () => void;
}

function haversineMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

const Topbar = ({ onSidebarToggle }: TopbarProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { notifications, unreadNotificationsCount, setNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead } =
    useDashboardStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastLocationSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const getAudioContext = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  };

  const playNotificationSound = async () => {
    try {
      if (!notificationAudioRef.current) {
        const audio = new Audio('/notification.mp3');
        audio.preload = 'auto';
        notificationAudioRef.current = audio;
      }
      const audio = notificationAudioRef.current;
      audio.currentTime = 0;
      await audio.play();
      return;
    } catch {
      // fallback to generated beep
    }
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.24);
    } catch {
      // ignore audio errors
    }
  };

  useEffect(() => {
    const unlock = () => {
      void getAudioContext();
      if (!notificationAudioRef.current) {
        const audio = new Audio('/notification.mp3');
        audio.preload = 'auto';
        notificationAudioRef.current = audio;
      } else {
        notificationAudioRef.current.load();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/dashboard/notifications?limit=20', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !isMounted) return;
        setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      } catch {
        // ignore: notification center remains empty
      }
    };
    void loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [setNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id || !user?.companyId) return;
    let socket: Socket | null = null;
    let isMounted = true;
    const setup = async () => {
      try {
        await fetch('/api/socket', { cache: 'no-store' });
        if (!isMounted) return;
        socket = io({
          path: '/api/socket_io',
          transports: ['websocket', 'polling'],
        });
        socket.on(
          'notifications:new',
          (event: {
            companyId: string;
            userId: string;
            notification: {
              id: string;
              userId: string;
              companyId: string;
              type: 'delivery' | 'driver' | 'inventory' | 'system';
              title: string;
              message: string;
              data?: Record<string, unknown>;
              isRead: boolean;
              createdAt: string;
            };
          }) => {
            if (!event?.notification || event.companyId !== user.companyId || event.userId !== user.id) return;
            addNotification({
              ...event.notification,
              createdAt: new Date(event.notification.createdAt),
            });
            void playNotificationSound();
          }
        );
      } catch {
        // ignore socket setup errors
      }
    };
    void setup();
    return () => {
      isMounted = false;
      if (socket) socket.disconnect();
    };
  }, [addNotification, user?.companyId, user?.id]);

  useEffect(() => {
    if (!user?.id || user.role !== 'driver') return;
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    let isMounted = true;
    let watchId: number | null = null;
    let lastAttemptAt = 0;

    const pushLocation = async (coords: GeolocationCoordinates, positionTimestamp: number) => {
      const latitude = Number(coords.latitude || 0);
      const longitude = Number(coords.longitude || 0);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const now = Date.now();
      const previous = lastLocationSentRef.current;
      if (previous) {
        const movedMeters = haversineMeters({ lat: previous.lat, lng: previous.lng }, { lat: latitude, lng: longitude });
        const elapsed = now - previous.at;
        if (movedMeters < 15 && elapsed < 30000) return;
      } else if (now - lastAttemptAt < 5000) {
        return;
      }
      lastAttemptAt = now;

      try {
        const response = await fetch('/api/dashboard/drivers/location', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude,
            longitude,
            accuracy: Number(coords.accuracy || 0),
            timestamp: new Date(positionTimestamp || now).toISOString(),
          }),
        });
        if (!isMounted || !response.ok) return;
        lastLocationSentRef.current = { lat: latitude, lng: longitude, at: now };
      } catch {
        // ignore location network errors
      }
    };

    const onSuccess = (position: GeolocationPosition) => {
      void pushLocation(position.coords, position.timestamp);
    };
    const onError = () => {
      // ignore permission/location errors silently
    };

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });

    return () => {
      isMounted = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.id, user?.role]);

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    markNotificationAsRead(notificationId);
    try {
      await fetch(`/api/dashboard/notifications/${notificationId}`, { method: 'PATCH' });
    } catch {
      // keep local UX responsive even if API fails
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    markAllNotificationsAsRead();
    try {
      await fetch('/api/dashboard/notifications', { method: 'PATCH' });
    } catch {
      // keep local UX responsive even if API fails
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Package className="w-4 h-4 text-blue-400" />;
      case 'driver':
        return <User className="w-4 h-4 text-green-400" />;
      case 'inventory':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <TrendingUp className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onSidebarToggle}
          className="lg:hidden w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Menu className="w-5 h-5 text-white/70" />
        </button>
        
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
          <Search className="w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 w-48"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <ThemeSwitcher />
        <LanguageSwitcher />
        
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="relative text-white/70 hover:text-white hover:bg-white/10"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center text-white font-medium">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card border-border p-0">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-semibold text-white">{t('common.notifications')}</h3>
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsAsRead}
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  {t('notifications.markAsRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-white/50">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleMarkNotificationAsRead(notification.id)}
                    className={cn(
                      'p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors',
                      !notification.isRead && 'bg-orange-500/5'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-white/30 mt-2">
                          {new Date(notification.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/5">
              <button className="w-full text-center text-sm text-orange-400 hover:text-orange-300 py-2">
                {t('notifications.viewAll')}
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-3 hover:bg-white/10"
            >
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt={user?.firstName}
                className="w-8 h-8 rounded-full bg-white/10"
              />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-white/50">{t(`dashboard.users.roles.${user?.role}`)}</p>
              </div>
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
            <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onSelect={() => router.push('/dashboard/settings')}>
              <Check className="w-4 h-4 mr-2" />
              {t('common.settings')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
