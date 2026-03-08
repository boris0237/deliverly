import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, 
  Download, 
  Share2, 
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Users,
  Store,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

const ReportsPage = () => {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState('deliveries');
  const [dateRange, setDateRange] = useState('7d');

  const reportTypes = [
    { key: 'deliveries', label: t('dashboard.reports.types.deliveries'), icon: Package },
    { key: 'financial', label: t('dashboard.reports.types.financial'), icon: BarChart3 },
    { key: 'driver', label: t('dashboard.reports.types.driver'), icon: Users },
    { key: 'inventory', label: t('dashboard.reports.types.inventory'), icon: Boxes },
    { key: 'partner', label: t('dashboard.reports.types.partner'), icon: Store },
  ];

  const mockChartData = [
    { name: 'Lun', value: 45 },
    { name: 'Mar', value: 52 },
    { name: 'Mer', value: 48 },
    { name: 'Jeu', value: 61 },
    { name: 'Ven', value: 55 },
    { name: 'Sam', value: 67 },
    { name: 'Dim', value: 42 },
  ];

  const mockPieData = [
    { name: 'Livré', value: 1180, color: '#10B981' },
    { name: 'En cours', value: 42, color: '#3B82F6' },
    { name: 'Échoué', value: 62, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {t('dashboard.reports.title')}
          </h1>
          <p className="text-white/50">
            Générez et exportez vos rapports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
            <Share2 className="w-4 h-4" />
            {t('dashboard.reports.share')}
          </Button>
          <Button className="btn-primary gap-2">
            <Download className="w-4 h-4" />
            {t('dashboard.reports.export.pdf')}
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2">
        {reportTypes.map((report) => (
          <button
            key={report.key}
            onClick={() => setSelectedReport(report.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              selectedReport === report.key
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <report.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{report.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
          <Calendar className="w-4 h-4 text-white/40" />
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-transparent text-sm text-white outline-none"
          >
            <option value="7d" className="bg-card">7 derniers jours</option>
            <option value="30d" className="bg-card">30 derniers jours</option>
            <option value="90d" className="bg-card">3 derniers mois</option>
            <option value="1y" className="bg-card">Cette année</option>
          </select>
        </div>
        <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
          <Filter className="w-4 h-4" />
          Filtres
        </Button>
      </div>

      {/* Report Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            {reportTypes.find(r => r.key === selectedReport)?.label}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#FF6B00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            Répartition par statut
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={mockPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {mockPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-white/60">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-sm text-white/50">Total</span>
          </div>
          <div className="text-2xl font-bold text-white">1,284</div>
          <div className="text-sm text-green-400 mt-1">+12%</div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm text-white/50">Complété</span>
          </div>
          <div className="text-2xl font-bold text-white">1,180</div>
          <div className="text-sm text-green-400 mt-1">+8%</div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-white/50">Moyenne/jour</span>
          </div>
          <div className="text-2xl font-bold text-white">52</div>
          <div className="text-sm text-green-400 mt-1">+5%</div>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-white/50">Taux de succès</span>
          </div>
          <div className="text-2xl font-bold text-white">95%</div>
          <div className="text-sm text-green-400 mt-1">+2%</div>
        </div>
      </div>

      {/* Export Options */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Options d'export
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
            <FileText className="w-4 h-4" />
            {t('dashboard.reports.export.pdf')}
          </Button>
          <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
            <Download className="w-4 h-4" />
            {t('dashboard.reports.export.excel')}
          </Button>
          <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
            <Download className="w-4 h-4" />
            {t('dashboard.reports.export.csv')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;