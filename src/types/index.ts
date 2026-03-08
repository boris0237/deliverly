export type UserRole = 
  | 'superAdmin' 
  | 'admin' 
  | 'manager' 
  | 'stockManager' 
  | 'partnerManager' 
  | 'driver' 
  | 'accountant';

export type DeliveryStatus = 
  | 'pending' 
  | 'assigned' 
  | 'pickedUp' 
  | 'inTransit' 
  | 'delivered' 
  | 'failed' 
  | 'cancelled';

export type DriverStatus = 'active' | 'inactive' | 'busy' | 'offline';

export type PartnerType = 'restaurant' | 'shop' | 'pharmacy' | 'ecommerce' | 'other';

export type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'van' | 'truck';

export type ExpenseCategory = 'fuel' | 'maintenance' | 'salaries' | 'equipment' | 'other';

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'online';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences: {
    language: 'en' | 'fr';
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      inApp: boolean;
      whatsapp: boolean;
    };
  };
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: {
    open: string;
    close: string;
    days: number[];
  };
  settings: {
    defaultDeliveryFee: number;
    deliveryZones: DeliveryZone[];
    taxes: number;
    currency: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryZone {
  id: string;
  name: string;
  coordinates: [number, number][];
  deliveryFee: number;
  minOrderValue: number;
}

export interface Delivery {
  id: string;
  companyId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  gpsLocation?: {
    lat: number;
    lng: number;
  };
  orderValue: number;
  paymentMethod: PaymentMethod;
  deliveryFee: number;
  partnerId?: string;
  driverId?: string;
  notes?: string;
  status: DeliveryStatus;
  timeline: DeliveryTimelineEvent[];
  proofOfDelivery?: {
    signature?: string;
    photo?: string;
    notes?: string;
  };
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryTimelineEvent {
  id: string;
  status: DeliveryStatus;
  timestamp: Date;
  notes?: string;
  location?: {
    lat: number;
    lng: number;
  };
  performedBy?: string;
}

export interface Driver {
  id: string;
  companyId: string;
  userId?: string;
  name: string;
  email?: string;
  phone: string;
  vehicleType: VehicleType;
  licenseNumber?: string;
  status: DriverStatus;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  performance: {
    completedDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
    rating: number;
    totalEarnings: number;
  };
  documents?: {
    license?: string;
    insurance?: string;
    identity?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Partner {
  id: string;
  companyId: string;
  name: string;
  type: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
  commissionRate: number;
  balance: number;
  pricing?: {
    type: 'fixed' | 'package' | 'percentage' | 'zone';
    currency: string;
    useDefaultValue: boolean;
    fixedAmount: number;
    percentageValue: number;
    packagePlanId: string;
    packagePlanName: string;
    zoneId: string;
    zoneName: string;
  };
  logo?: string;
  isActive: boolean;
  settings?: {
    autoAssign: boolean;
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  category?: string;
  description?: string;
  price: number;
  stockQuantity: number;
  minStockLevel: number;
  partnerId?: string;
  warehouseLocation?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  type: 'entry' | 'exit' | 'transfer' | 'adjustment';
  quantity: number;
  reason?: string;
  reference?: string;
  performedBy: string;
  fromLocation?: string;
  toLocation?: string;
  createdAt: Date;
}

export interface Expense {
  id: string;
  companyId: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
  driverId?: string;
  partnerId?: string;
  description?: string;
  receipt?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  companyId: string;
  type: 'delivery' | 'driver' | 'inventory' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export interface Report {
  id: string;
  companyId: string;
  type: 'deliveries' | 'financial' | 'driver' | 'inventory' | 'partner';
  name: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  data: any;
  createdBy: string;
  createdAt: Date;
  shareToken?: string;
}

export interface DashboardStats {
  totalDeliveries: number;
  activeDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  totalRevenue: number;
  averageDeliveryTime: number;
  driverPerformance: {
    online: number;
    busy: number;
    offline: number;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'system';
  isDark: boolean;
}
