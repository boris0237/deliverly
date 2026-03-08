import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Navigation,
  Clock,
  Phone,
  User,
  Package,
  RefreshCw,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockDrivers, mockDeliveries } from '@/data/mock';

const TrackingPage = () => {
  const { t } = useTranslation();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onlineDrivers = mockDrivers.filter(d => d.status === 'active' || d.status === 'busy');
  const activeDeliveries = mockDeliveries.filter(d => 
    d.status === 'inTransit' || d.status === 'pickedUp' || d.status === 'assigned'
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {t('dashboard.tracking.title')}
          </h1>
          <p className="text-white/50">
            Suivez vos livreurs en temps réel
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className={`gap-2 ${showRoutes ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/5 border-white/10 text-white'}`}
            onClick={() => setShowRoutes(!showRoutes)}
          >
            <Navigation className="w-4 h-4" />
            Itinéraires
          </Button>
          <Button 
            variant="outline" 
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
            onClick={handleRefresh}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('dashboard.tracking.refresh')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{onlineDrivers.length}</div>
              <div className="text-xs text-white/50">{t('dashboard.tracking.drivers')}</div>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{activeDeliveries.length}</div>
              <div className="text-xs text-white/50">{t('dashboard.tracking.deliveries')}</div>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">28m</div>
              <div className="text-xs text-white/50">{t('dashboard.tracking.eta')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map and Drivers List */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 glass-card p-4 h-[500px] relative overflow-hidden">
          {/* Mock Map */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800">
            {/* Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }}
            />
            
            {/* Streets */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500">
              {/* Main roads */}
              <line x1="0" y1="250" x2="800" y2="250" stroke="rgba(255,255,255,0.1)" strokeWidth="20" />
              <line x1="400" y1="0" x2="400" y2="500" stroke="rgba(255,255,255,0.1)" strokeWidth="20" />
              <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <line x1="0" y1="400" x2="800" y2="400" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <line x1="200" y1="0" x2="200" y2="500" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <line x1="600" y1="0" x2="600" y2="500" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              
              {/* Routes */}
              {showRoutes && onlineDrivers.map((driver, i) => (
                <path
                  key={driver.id}
                  d={`M ${100 + i * 200} 400 Q ${150 + i * 200} 300 ${200 + i * 200} 250 T ${300 + i * 200} 150`}
                  fill="none"
                  stroke="rgba(255, 107, 0, 0.5)"
                  strokeWidth="3"
                  strokeDasharray="5,5"
                />
              ))}
              
              {/* Driver markers */}
              {onlineDrivers.map((driver, i) => (
                <g key={driver.id}>
                  <circle
                    cx={200 + i * 200}
                    cy={250}
                    r="15"
                    fill="#FF6B00"
                    className="cursor-pointer hover:r-18 transition-all"
                    onClick={() => setSelectedDriver(driver.id)}
                  >
                    <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text
                    x={200 + i * 200}
                    y={255}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    {driver.name.charAt(0)}
                  </text>
                </g>
              ))}
              
              {/* Delivery markers */}
              {activeDeliveries.slice(0, 3).map((delivery, i) => (
                <g key={delivery.id}>
                  <rect
                    x={280 + i * 150}
                    y={120 + i * 50}
                    width="20"
                    height="20"
                    fill="#3B82F6"
                    rx="4"
                  />
                  <text
                    x={290 + i * 150}
                    y={135 + i * 50}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                  >
                    P
                  </text>
                </g>
              ))}
            </svg>
          </div>
          
          {/* Map Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <Button variant="outline" size="icon" className="bg-card border-border hover:bg-white/10">
              <Layers className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 glass-card p-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-white/70">Livreur</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-white/70">Livraison</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drivers List */}
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            Livreurs en ligne
          </h3>
          <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar">
            {onlineDrivers.map((driver) => (
              <div 
                key={driver.id} 
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedDriver === driver.id 
                    ? 'bg-orange-500/20 border border-orange-500/30' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => setSelectedDriver(driver.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center">
                    <span className="text-white font-medium">{driver.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{driver.name}</div>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      <span className={`w-2 h-2 rounded-full ${
                        driver.status === 'active' ? 'bg-green-400' : 'bg-orange-400'
                      }`} />
                      {driver.status === 'active' ? 'Disponible' : 'En livraison'}
                    </div>
                  </div>
                </div>
                
                {selectedDriver === driver.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Phone className="w-4 h-4" />
                      {driver.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Navigation className="w-4 h-4" />
                      2.5 km de distance
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Clock className="w-4 h-4" />
                      15 min ETA
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;