// Bottom Navigation — premium redesign

import { NavLink, useLocation } from 'react-router-dom';
import { Home, Navigation, BarChart2, Trophy, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { NAV_ITEMS } from '../../utils/constants';

const icons = { Home, Navigation, BarChart2, Trophy, Settings };

export default function BottomNav() {
  const location = useLocation();

  // Hide nav during active tracking or walk summary
  if (location.pathname === '/track' || location.pathname.startsWith('/walk-summary')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[480px] mx-auto px-4 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div
          className="flex items-center justify-around rounded-2xl px-2 py-2"
          style={{
            background: 'rgba(12, 16, 33, 0.92)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.3), 0 0 60px rgba(99, 102, 241, 0.05)',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = icons[item.icon];
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 touch-target"
                id={`nav-${item.label.toLowerCase()}`}
              >
                {/* Active background glow */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-1 rounded-xl"
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}

                <Icon
                  size={20}
                  className={`relative z-10 transition-all duration-200 ${
                    isActive ? 'text-[#818CF8]' : 'text-[#5A6585]'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.5}
                />
                <span
                  className={`relative z-10 text-[10px] mt-0.5 font-semibold tracking-wide transition-all duration-200 ${
                    isActive ? 'text-[#818CF8]' : 'text-[#5A6585]'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
