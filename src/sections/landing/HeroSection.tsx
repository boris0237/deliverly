import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Users, Star } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Box, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

// Animated 3D Shapes
const FloatingShapes = () => {
  const sphereRef = useRef<THREE.Mesh>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      sphereRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      sphereRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
    }
    if (boxRef.current) {
      boxRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      boxRef.current.rotation.z = state.clock.elapsedTime * 0.1;
      boxRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4 + 1) * 0.2;
    }
    if (torusRef.current) {
      torusRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      torusRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      torusRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.3 + 2) * 0.25;
    }
  });

  return (
    <>
          
      {/* Additional small spheres */}
      <Sphere args={[0.3, 32, 32]} position={[4, -1, 1]}>
        <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.3} />
      </Sphere>
      <Sphere args={[0.2, 32, 32]} position={[-4, 2, -1]}>
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.3} />
      </Sphere>
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#FF6B00" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B5CF6" />
      <pointLight position={[0, 5, 5]} intensity={0.5} color="#3B82F6" />
    </>
  );
};

const HeroSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <FloatingShapes />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-[1]" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="w-full px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Deliverly</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">{t('landing.footer.features')}</a>
            <a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors">{t('landing.footer.documentation')}</a>
            <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors">{t('landing.footer.pricing')}</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Link href="/auth/login">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                {t('common.login')}
              </Button>
            </Link>
            <Link href="/auth/register" className="hidden sm:block">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                {t('common.register')}
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-6 lg:px-12 py-12">
          <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-white/70">{t('landing.hero.stats.deliveries')}: 10k+</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {t('landing.hero.title')}
              </h1>
              
              <p className="text-lg text-white/60 max-w-xl">
                {t('landing.hero.subtitle')}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link href="/auth/register">
                  <Button size="lg" className="btn-primary gap-2">
                    {t('landing.hero.ctaPrimary')}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="lg" variant="outline" className="btn-secondary gap-2">
                    {t('landing.hero.ctaSecondary')}
                  </Button>
                </Link>
              </div>
              
              {/* Stats */}
              <div className="flex flex-wrap gap-8 pt-8 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">+12.5%</div>
                    <div className="text-sm text-white/50">{t('landing.hero.stats.trend')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">500+</div>
                    <div className="text-sm text-white/50">{t('landing.hero.stats.activeUsers')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">4.9</div>
                    <div className="text-sm text-white/50">{t('landing.hero.stats.satisfaction')}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Content - Dashboard Preview */}
            <div className="hidden lg:block relative">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/30 via-purple-500/30 to-blue-500/30 rounded-3xl blur-2xl opacity-50" />
                
                {/* Dashboard Card */}
                <div className="relative glass-card p-6 space-y-6">
                  {/* Mock Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">{t('dashboard.overview.stats.totalDeliveries')}</div>
                      <div className="text-2xl font-bold text-white">1,284</div>
                      <div className="text-xs text-green-400 mt-1">+12%</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">{t('dashboard.overview.stats.activeDeliveries')}</div>
                      <div className="text-2xl font-bold text-white">42</div>
                      <div className="text-xs text-blue-400 mt-1">En cours</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-xs text-white/50 mb-1">{t('dashboard.overview.stats.totalRevenue')}</div>
                      <div className="text-2xl font-bold text-white">€45k</div>
                      <div className="text-xs text-green-400 mt-1">+8%</div>
                    </div>
                  </div>
                  
                  {/* Mock Chart */}
                  <div className="bg-white/5 rounded-xl p-4 h-40 flex items-end justify-between gap-2">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-orange-500 to-orange-400 rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  
                  {/* Mock Delivery List */}
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-white font-medium">DEL-{100 + i}</div>
                          <div className="text-xs text-white/50">12 Rue de Paris</div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs ${
                          i === 1 ? 'bg-green-500/20 text-green-400' :
                          i === 2 ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {i === 1 ? 'Livré' : i === 2 ? 'En cours' : 'Assigné'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
