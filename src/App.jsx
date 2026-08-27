// Main App component with routing

import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BottomNav from './components/ui/BottomNav';
import useUserStore from './stores/userStore';
import useAuthStore from './stores/authStore';
import { useTheme } from './hooks/useTheme';
import { initDataStore } from './application/stores/dataStore.js';

// Eagerly loaded (critical path — user sees these first)
import SplashScreen from './pages/SplashScreen';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';

// Lazy-loaded (user navigates to these)
const Track = lazy(() => import('./pages/Track'));
const WalkSummary = lazy(() => import('./pages/WalkSummary'));
const Stats = lazy(() => import('./pages/Stats'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  const location = useLocation();
  const isLoaded = useUserStore((s) => s.isLoaded);
  const hydrateFromDataStore = useUserStore((s) => s.hydrateFromDataStore);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  useTheme();

  useEffect(() => {
    // Initialize the storage layer (runs legacy migration on first launch)
    // then hydrate userStore from the loaded settings.
    initDataStore().then(() => hydrateFromDataStore());
    const unsubscribeAuth = initializeAuth();
    return () => unsubscribeAuth();
  }, [hydrateFromDataStore, initializeAuth]);

  if (!isLoaded && location.pathname !== '/splash') {
    return null;
  }

  const hiddenNavPaths = ['/splash', '/onboarding', '/track'];
  const showNav = !hiddenNavPaths.includes(location.pathname) &&
    !location.pathname.startsWith('/walk-summary');

  // Full-screen routes that should NOT be constrained by the app frame
  const fullScreenPaths = ['/splash', '/onboarding', '/track'];
  const isFullScreen = fullScreenPaths.includes(location.pathname) ||
    location.pathname.startsWith('/walk-summary');

  return (
    <div className="relative w-full min-h-screen min-h-[100dvh] overflow-clip bg-[var(--bg)]">
      {/* Subtle ambient background — symmetrically placed to avoid visual imbalance */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#6366F1] opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-[#8B5CF6] opacity-[0.03] blur-[100px]" />
      </div>

      {/* Content: centered mobile-app frame for dashboard pages, full-bleed for immersive screens */}
      <div className={`relative z-10 w-full ${isFullScreen ? '' : 'max-w-[480px] mx-auto px-5'}`}>
        <AnimatePresence mode="wait">
          <Suspense fallback={null}>
            <Routes location={location} key={location.pathname}>
              <Route path="/splash" element={<SplashScreen />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Home />} />
              <Route path="/track" element={<Track />} />
              <Route path="/walk-summary/:id" element={<WalkSummary />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
        {showNav && <BottomNav />}
      </div>
    </div>
  );
}
