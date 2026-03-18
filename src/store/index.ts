import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  Delivery, 
  Driver, 
  Partner, 
  Product, 
  Notification,
  DashboardStats,
  AuthState,
  ThemeState
} from '@/types';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

// Auth Store
interface AuthStore extends AuthState {
  login: (user: User, token: string | null) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      token: null,
      login: (user, token) => set({ user, token, isAuthenticated: true, isLoading: false }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } as User : null
      })),
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: 'auth-storage'
    }
  )
);

// Theme Store
interface ThemeStore extends ThemeState {
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'light',
      isDark: false,
      toggleTheme: () => set((state) => {
        const newMode = state.mode === 'dark' ? 'light' : 'dark';
        return { mode: newMode, isDark: newMode === 'dark' };
      }),
      setTheme: (mode) => set({ mode, isDark: mode === 'dark' })
    }),
    {
      name: 'theme-storage'
    }
  )
);

// PWA Install Store
interface PwaInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  isPromptOpen: boolean;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setInstallable: (installable: boolean) => void;
  setInstalled: (installed: boolean) => void;
  openPrompt: () => void;
  closePrompt: () => void;
}

export const usePwaInstallStore = create<PwaInstallStore>((set) => ({
  deferredPrompt: null,
  isInstallable: false,
  isInstalled: false,
  isPromptOpen: false,
  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),
  setInstallable: (installable) => set({ isInstallable: installable }),
  setInstalled: (installed) => set({ isInstalled: installed }),
  openPrompt: () => set({ isPromptOpen: true }),
  closePrompt: () => set({ isPromptOpen: false }),
}));

// Dashboard Store
interface DashboardStore {
  stats: DashboardStats | null;
  recentDeliveries: Delivery[];
  topDrivers: Driver[];
  notifications: Notification[];
  unreadNotificationsCount: number;
  isLoading: boolean;
  setStats: (stats: DashboardStats) => void;
  setRecentDeliveries: (deliveries: Delivery[]) => void;
  setTopDrivers: (drivers: Driver[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  recentDeliveries: [],
  topDrivers: [],
  notifications: [],
  unreadNotificationsCount: 0,
  isLoading: false,
  setStats: (stats) => set({ stats }),
  setRecentDeliveries: (deliveries) => set({ recentDeliveries: deliveries }),
  setTopDrivers: (drivers) => set({ topDrivers: drivers }),
  setNotifications: (notifications) => set({ 
    notifications,
    unreadNotificationsCount: notifications.filter(n => !n.isRead).length
  }),
  addNotification: (notification) => set((state) => {
    const alreadyExists = state.notifications.some((item) => item.id === notification.id);
    if (alreadyExists) return state;
    const notifications = [notification, ...state.notifications];
    return {
      notifications,
      unreadNotificationsCount: notifications.filter(n => !n.isRead).length,
    };
  }),
  markNotificationAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ),
    unreadNotificationsCount: Math.max(0, state.unreadNotificationsCount - 1)
  })),
  markAllNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadNotificationsCount: 0
  })),
  setLoading: (loading) => set({ isLoading: loading })
}));

// Deliveries Store
interface DeliveriesStore {
  deliveries: Delivery[];
  selectedDelivery: Delivery | null;
  filters: {
    status?: string;
    dateRange?: { start: Date; end: Date };
    driverId?: string;
    partnerId?: string;
  };
  isLoading: boolean;
  setDeliveries: (deliveries: Delivery[]) => void;
  addDelivery: (delivery: Delivery) => void;
  updateDelivery: (id: string, data: Partial<Delivery>) => void;
  deleteDelivery: (id: string) => void;
  selectDelivery: (delivery: Delivery | null) => void;
  setFilters: (filters: DeliveriesStore['filters']) => void;
  setLoading: (loading: boolean) => void;
}

export const useDeliveriesStore = create<DeliveriesStore>((set) => ({
  deliveries: [],
  selectedDelivery: null,
  filters: {},
  isLoading: false,
  setDeliveries: (deliveries) => set({ deliveries }),
  addDelivery: (delivery) => set((state) => ({ 
    deliveries: [delivery, ...state.deliveries] 
  })),
  updateDelivery: (id, data) => set((state) => ({
    deliveries: state.deliveries.map(d => 
      d.id === id ? { ...d, ...data } : d
    )
  })),
  deleteDelivery: (id) => set((state) => ({
    deliveries: state.deliveries.filter(d => d.id !== id)
  })),
  selectDelivery: (delivery) => set({ selectedDelivery: delivery }),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ isLoading: loading })
}));

// Drivers Store
interface DriversStore {
  drivers: Driver[];
  selectedDriver: Driver | null;
  onlineDrivers: Driver[];
  isLoading: boolean;
  setDrivers: (drivers: Driver[]) => void;
  addDriver: (driver: Driver) => void;
  updateDriver: (id: string, data: Partial<Driver>) => void;
  deleteDriver: (id: string) => void;
  selectDriver: (driver: Driver | null) => void;
  updateDriverLocation: (id: string, location: { lat: number; lng: number }) => void;
  setLoading: (loading: boolean) => void;
}

export const useDriversStore = create<DriversStore>((set) => ({
  drivers: [],
  selectedDriver: null,
  onlineDrivers: [],
  isLoading: false,
  setDrivers: (drivers) => set({ drivers }),
  addDriver: (driver) => set((state) => ({ 
    drivers: [...state.drivers, driver] 
  })),
  updateDriver: (id, data) => set((state) => ({
    drivers: state.drivers.map(d => 
      d.id === id ? { ...d, ...data } : d
    )
  })),
  deleteDriver: (id) => set((state) => ({
    drivers: state.drivers.filter(d => d.id !== id)
  })),
  selectDriver: (driver) => set({ selectedDriver: driver }),
  updateDriverLocation: (id, location) => set((state) => ({
    drivers: state.drivers.map(d => 
      d.id === id ? { 
        ...d, 
        currentLocation: { ...location, updatedAt: new Date() } 
      } : d
    )
  })),
  setLoading: (loading) => set({ isLoading: loading })
}));

// Partners Store
interface PartnersStore {
  partners: Partner[];
  selectedPartner: Partner | null;
  isLoading: boolean;
  setPartners: (partners: Partner[]) => void;
  addPartner: (partner: Partner) => void;
  updatePartner: (id: string, data: Partial<Partner>) => void;
  deletePartner: (id: string) => void;
  selectPartner: (partner: Partner | null) => void;
  setLoading: (loading: boolean) => void;
}

export const usePartnersStore = create<PartnersStore>((set) => ({
  partners: [],
  selectedPartner: null,
  isLoading: false,
  setPartners: (partners) => set({ partners }),
  addPartner: (partner) => set((state) => ({ 
    partners: [...state.partners, partner] 
  })),
  updatePartner: (id, data) => set((state) => ({
    partners: state.partners.map(p => 
      p.id === id ? { ...p, ...data } : p
    )
  })),
  deletePartner: (id) => set((state) => ({
    partners: state.partners.filter(p => p.id !== id)
  })),
  selectPartner: (partner) => set({ selectedPartner: partner }),
  setLoading: (loading) => set({ isLoading: loading })
}));

// Inventory Store
interface InventoryStore {
  products: Product[];
  selectedProduct: Product | null;
  lowStockAlerts: Product[];
  isLoading: boolean;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  selectProduct: (product: Product | null) => void;
  updateStock: (productId: string, quantity: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  products: [],
  selectedProduct: null,
  lowStockAlerts: [],
  isLoading: false,
  setProducts: (products) => set({ 
    products,
    lowStockAlerts: products.filter(p => p.stockQuantity <= p.minStockLevel)
  }),
  addProduct: (product) => set((state) => {
    const products = [...state.products, product];
    return {
      products,
      lowStockAlerts: products.filter(p => p.stockQuantity <= p.minStockLevel)
    };
  }),
  updateProduct: (id, data) => set((state) => {
    const products = state.products.map(p => 
      p.id === id ? { ...p, ...data } : p
    );
    return {
      products,
      lowStockAlerts: products.filter(p => p.stockQuantity <= p.minStockLevel)
    };
  }),
  deleteProduct: (id) => set((state) => {
    const products = state.products.filter(p => p.id !== id);
    return {
      products,
      lowStockAlerts: products.filter(p => p.stockQuantity <= p.minStockLevel)
    };
  }),
  selectProduct: (product) => set({ selectedProduct: product }),
  updateStock: (productId, quantity) => set((state) => {
    const products = state.products.map(p => 
      p.id === productId ? { ...p, stockQuantity: quantity } : p
    );
    return {
      products,
      lowStockAlerts: products.filter(p => p.stockQuantity <= p.minStockLevel)
    };
  }),
  setLoading: (loading) => set({ isLoading: loading })
}));

// UI Store
interface UIStore {
  sidebarOpen: boolean;
  currentPage: string;
  modalOpen: boolean;
  modalContent: React.ReactNode | null;
  toast: {
    show: boolean;
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  };
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentPage: (page: string) => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  hideToast: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  currentPage: 'dashboard',
  modalOpen: false,
  modalContent: null,
  toast: {
    show: false,
    id: 0,
    message: '',
    type: 'info'
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),
  showToast: (message, type = 'info') => set({ 
    toast: { show: true, id: Date.now(), message, type } 
  }),
  hideToast: () => set((state) => ({
    toast: { ...state.toast, show: false, message: '' }
  }))
}));
