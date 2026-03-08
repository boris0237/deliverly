import type { 
  User, 
  Company, 
  Delivery, 
  Driver, 
  Partner, 
  Product, 
  Expense,
  Notification,
  DashboardStats
} from '@/types';

export const mockUser: User = {
  id: '1',
  email: 'admin@deliverly.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  companyId: '1',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
  phone: '+33 6 12 34 56 78',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lastLoginAt: new Date(),
  preferences: {
    language: 'fr',
    theme: 'dark',
    notifications: {
      email: true,
      inApp: true,
      whatsapp: false
    }
  }
};

export const mockCompany: Company = {
  id: '1',
  name: 'Deliverly Demo',
  logo: '/logo.svg',
  address: '123 Rue de Paris, 75001 Paris',
  phone: '+33 1 23 45 67 89',
  email: 'contact@deliverly.com',
  businessHours: {
    open: '09:00',
    close: '18:00',
    days: [1, 2, 3, 4, 5]
  },
  settings: {
    defaultDeliveryFee: 5.99,
    deliveryZones: [],
    taxes: 20,
    currency: 'EUR'
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

export const mockDrivers: Driver[] = [
  {
    id: '1',
    companyId: '1',
    name: 'Jean Dupont',
    email: 'jean@deliverly.com',
    phone: '+33 6 11 22 33 44',
    vehicleType: 'motorcycle',
    licenseNumber: 'ABC123',
    status: 'active',
    currentLocation: {
      lat: 48.8566,
      lng: 2.3522,
      updatedAt: new Date()
    },
    performance: {
      completedDeliveries: 156,
      failedDeliveries: 3,
      averageDeliveryTime: 25,
      rating: 4.8,
      totalEarnings: 4500
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    companyId: '1',
    name: 'Marie Martin',
    email: 'marie@deliverly.com',
    phone: '+33 6 22 33 44 55',
    vehicleType: 'car',
    licenseNumber: 'DEF456',
    status: 'busy',
    currentLocation: {
      lat: 48.8600,
      lng: 2.3400,
      updatedAt: new Date()
    },
    performance: {
      completedDeliveries: 203,
      failedDeliveries: 5,
      averageDeliveryTime: 30,
      rating: 4.9,
      totalEarnings: 6200
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '3',
    companyId: '1',
    name: 'Pierre Bernard',
    email: 'pierre@deliverly.com',
    phone: '+33 6 33 44 55 66',
    vehicleType: 'bicycle',
    licenseNumber: 'GHI789',
    status: 'offline',
    performance: {
      completedDeliveries: 89,
      failedDeliveries: 2,
      averageDeliveryTime: 35,
      rating: 4.7,
      totalEarnings: 2800
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '4',
    companyId: '1',
    name: 'Sophie Petit',
    email: 'sophie@deliverly.com',
    phone: '+33 6 44 55 66 77',
    vehicleType: 'motorcycle',
    licenseNumber: 'JKL012',
    status: 'active',
    currentLocation: {
      lat: 48.8650,
      lng: 2.3600,
      updatedAt: new Date()
    },
    performance: {
      completedDeliveries: 178,
      failedDeliveries: 4,
      averageDeliveryTime: 28,
      rating: 4.6,
      totalEarnings: 5100
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

export const mockPartners: Partner[] = [
  {
    id: '1',
    companyId: '1',
    name: 'Le Gourmet Parisien',
    type: 'restaurant',
    email: 'contact@gourmetparisien.fr',
    phone: '+33 1 23 45 67 89',
    address: '15 Rue de la Paix, 75002 Paris',
    commissionRate: 15,
    balance: 2450.50,
    isActive: true,
    settings: {
      autoAssign: true,
      notificationPreferences: {
        email: true,
        sms: true,
        whatsapp: false
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    companyId: '1',
    name: 'PharmaPlus',
    type: 'pharmacy',
    email: 'contact@pharmaplus.fr',
    phone: '+33 1 34 56 78 90',
    address: '28 Avenue des Champs-Élysées, 75008 Paris',
    commissionRate: 12,
    balance: 1890.75,
    isActive: true,
    settings: {
      autoAssign: false,
      notificationPreferences: {
        email: true,
        sms: false,
        whatsapp: true
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '3',
    companyId: '1',
    name: 'TechStore',
    type: 'shop',
    email: 'contact@techstore.fr',
    phone: '+33 1 45 67 89 01',
    address: '42 Boulevard Haussmann, 75009 Paris',
    commissionRate: 18,
    balance: 3200.00,
    isActive: true,
    settings: {
      autoAssign: true,
      notificationPreferences: {
        email: true,
        sms: true,
        whatsapp: true
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '4',
    companyId: '1',
    name: 'Fashion Online',
    type: 'ecommerce',
    email: 'contact@fashiononline.fr',
    phone: '+33 1 56 78 90 12',
    address: '8 Rue du Commerce, 75015 Paris',
    commissionRate: 10,
    balance: 5670.25,
    isActive: true,
    settings: {
      autoAssign: true,
      notificationPreferences: {
        email: true,
        sms: false,
        whatsapp: false
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

export const mockDeliveries: Delivery[] = [
  {
    id: 'DEL-001',
    companyId: '1',
    customerName: 'Alice Moreau',
    customerPhone: '+33 6 55 66 77 88',
    address: '25 Rue de Rivoli, 75004 Paris',
    gpsLocation: { lat: 48.8550, lng: 2.3600 },
    orderValue: 45.50,
    paymentMethod: 'card',
    deliveryFee: 5.99,
    partnerId: '1',
    driverId: '1',
    notes: 'Appeler à l\'arrivée',
    status: 'inTransit',
    timeline: [
      { id: '1', status: 'pending', timestamp: new Date(Date.now() - 3600000), notes: 'Commande reçue' },
      { id: '2', status: 'assigned', timestamp: new Date(Date.now() - 3000000), notes: 'Assigné à Jean', performedBy: '1' },
      { id: '3', status: 'pickedUp', timestamp: new Date(Date.now() - 2400000), notes: 'Commande récupérée', performedBy: '1' },
      { id: '4', status: 'inTransit', timestamp: new Date(Date.now() - 1800000), notes: 'En route', performedBy: '1' }
    ],
    estimatedDeliveryTime: new Date(Date.now() + 900000),
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000)
  },
  {
    id: 'DEL-002',
    companyId: '1',
    customerName: 'Robert Lefebvre',
    customerPhone: '+33 6 66 77 88 99',
    address: '12 Place de la Concorde, 75008 Paris',
    gpsLocation: { lat: 48.8656, lng: 2.3212 },
    orderValue: 78.90,
    paymentMethod: 'cash',
    deliveryFee: 5.99,
    partnerId: '2',
    driverId: '2',
    status: 'pickedUp',
    timeline: [
      { id: '1', status: 'pending', timestamp: new Date(Date.now() - 7200000), notes: 'Commande reçue' },
      { id: '2', status: 'assigned', timestamp: new Date(Date.now() - 6600000), notes: 'Assigné à Marie', performedBy: '2' },
      { id: '3', status: 'pickedUp', timestamp: new Date(Date.now() - 5400000), notes: 'Commande récupérée', performedBy: '2' }
    ],
    estimatedDeliveryTime: new Date(Date.now() + 1800000),
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 5400000)
  },
  {
    id: 'DEL-003',
    companyId: '1',
    customerName: 'Claire Dubois',
    customerPhone: '+33 6 77 88 99 00',
    address: '55 Rue du Faubourg Saint-Honoré, 75008 Paris',
    gpsLocation: { lat: 48.8700, lng: 2.3200 },
    orderValue: 125.00,
    paymentMethod: 'online',
    deliveryFee: 0,
    partnerId: '3',
    status: 'delivered',
    timeline: [
      { id: '1', status: 'pending', timestamp: new Date(Date.now() - 14400000), notes: 'Commande reçue' },
      { id: '2', status: 'assigned', timestamp: new Date(Date.now() - 13800000), notes: 'Assigné à Jean', performedBy: '1' },
      { id: '3', status: 'pickedUp', timestamp: new Date(Date.now() - 12600000), notes: 'Commande récupérée', performedBy: '1' },
      { id: '4', status: 'inTransit', timestamp: new Date(Date.now() - 11400000), notes: 'En route', performedBy: '1' },
      { id: '5', status: 'delivered', timestamp: new Date(Date.now() - 9600000), notes: 'Livré', performedBy: '1' }
    ],
    proofOfDelivery: {
      signature: 'data:image/png;base64,signature',
      notes: 'Livré à la concierge'
    },
    actualDeliveryTime: new Date(Date.now() - 9600000),
    createdAt: new Date(Date.now() - 14400000),
    updatedAt: new Date(Date.now() - 9600000)
  },
  {
    id: 'DEL-004',
    companyId: '1',
    customerName: 'Michel Lambert',
    customerPhone: '+33 6 88 99 00 11',
    address: '3 Rue de la Roquette, 75011 Paris',
    gpsLocation: { lat: 48.8550, lng: 2.3750 },
    orderValue: 32.40,
    paymentMethod: 'card',
    deliveryFee: 5.99,
    partnerId: '1',
    status: 'pending',
    timeline: [
      { id: '1', status: 'pending', timestamp: new Date(Date.now() - 1800000), notes: 'Commande reçue' }
    ],
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 1800000)
  },
  {
    id: 'DEL-005',
    companyId: '1',
    customerName: 'Isabelle Roux',
    customerPhone: '+33 6 99 00 11 22',
    address: '78 Boulevard Saint-Germain, 75005 Paris',
    gpsLocation: { lat: 48.8500, lng: 2.3400 },
    orderValue: 89.99,
    paymentMethod: 'mobile',
    deliveryFee: 5.99,
    partnerId: '4',
    driverId: '4',
    status: 'assigned',
    timeline: [
      { id: '1', status: 'pending', timestamp: new Date(Date.now() - 5400000), notes: 'Commande reçue' },
      { id: '2', status: 'assigned', timestamp: new Date(Date.now() - 4800000), notes: 'Assigné à Sophie', performedBy: '4' }
    ],
    estimatedDeliveryTime: new Date(Date.now() + 3600000),
    createdAt: new Date(Date.now() - 5400000),
    updatedAt: new Date(Date.now() - 4800000)
  }
];

export const mockProducts: Product[] = [
  {
    id: '1',
    companyId: '1',
    name: 'Menu Burger Classic',
    sku: 'BUR-001',
    category: 'Burgers',
    description: 'Burger avec frites et boisson',
    price: 15.90,
    stockQuantity: 50,
    minStockLevel: 10,
    partnerId: '1',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    companyId: '1',
    name: 'Paracétamol 500mg',
    sku: 'MED-001',
    category: 'Médicaments',
    description: 'Boîte de 16 comprimés',
    price: 4.50,
    stockQuantity: 8,
    minStockLevel: 15,
    partnerId: '2',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '3',
    companyId: '1',
    name: 'iPhone 15 Pro Case',
    sku: 'ACC-001',
    category: 'Accessoires',
    description: 'Coque de protection',
    price: 29.99,
    stockQuantity: 25,
    minStockLevel: 5,
    partnerId: '3',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '4',
    companyId: '1',
    name: 'Robe d\'été fleurie',
    sku: 'VET-001',
    category: 'Vêtements',
    description: 'Robe légère pour l\'été',
    price: 59.90,
    stockQuantity: 0,
    minStockLevel: 5,
    partnerId: '4',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
];

export const mockExpenses: Expense[] = [
  {
    id: '1',
    companyId: '1',
    amount: 65.50,
    category: 'fuel',
    date: new Date(Date.now() - 86400000),
    driverId: '1',
    description: 'Plein d\'essence',
    createdBy: '1',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000)
  },
  {
    id: '2',
    companyId: '1',
    amount: 250.00,
    category: 'maintenance',
    date: new Date(Date.now() - 172800000),
    driverId: '2',
    description: 'Révision annuelle',
    createdBy: '1',
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 172800000)
  },
  {
    id: '3',
    companyId: '1',
    amount: 45.00,
    category: 'equipment',
    date: new Date(Date.now() - 259200000),
    description: 'Sac isotherme',
    createdBy: '1',
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 259200000)
  }
];

export const mockNotifications: Notification[] = [
  {
    id: '1',
    userId: '1',
    companyId: '1',
    type: 'delivery',
    title: 'Nouvelle livraison',
    message: 'Une nouvelle livraison a été créée: DEL-006',
    data: { deliveryId: 'DEL-006' },
    isRead: false,
    createdAt: new Date(Date.now() - 300000)
  },
  {
    id: '2',
    userId: '1',
    companyId: '1',
    type: 'inventory',
    title: 'Stock faible',
    message: 'Le produit Paracétamol 500mg est en stock faible',
    data: { productId: '2' },
    isRead: false,
    createdAt: new Date(Date.now() - 900000)
  },
  {
    id: '3',
    userId: '1',
    companyId: '1',
    type: 'delivery',
    title: 'Livraison terminée',
    message: 'La livraison DEL-003 a été marquée comme livrée',
    data: { deliveryId: 'DEL-003' },
    isRead: true,
    createdAt: new Date(Date.now() - 3600000)
  },
  {
    id: '4',
    userId: '1',
    companyId: '1',
    type: 'driver',
    title: 'Livreur en ligne',
    message: 'Jean Dupont est maintenant en ligne',
    data: { driverId: '1' },
    isRead: true,
    createdAt: new Date(Date.now() - 7200000)
  }
];

export const mockDashboardStats: DashboardStats = {
  totalDeliveries: 1284,
  activeDeliveries: 42,
  completedDeliveries: 1180,
  failedDeliveries: 62,
  totalRevenue: 45680.50,
  averageDeliveryTime: 28,
  driverPerformance: {
    online: 8,
    busy: 12,
    offline: 5
  }
};