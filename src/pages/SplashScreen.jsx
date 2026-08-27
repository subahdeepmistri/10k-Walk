// Splash Screen with animated logo

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useUserStore from '../stores/userStore';
import { Footprints } from 'lucide-react';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { isLoaded, onboardingComplete } = useUserStore();

  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(() => {
      if (onboardingComplete) {
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [isLoaded, onboardingComplete, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] relative overflow-hidden">
      {/* Background gradient orbs */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
        style={{ background: 'var(--color-primary)' }}
        animate={{
          scale: [1, 1.3, 1],
          x: [-50, 50, -50],
          y: [-30, 30, -30],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-15 blur-[80px]"
        style={{ background: 'var(--color-secondary)' }}
        animate={{
          scale: [1.2, 1, 1.2],
          x: [30, -30, 30],
          y: [20, -40, 20],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="relative"
      >
        <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center glow-primary">
          <Footprints size={48} className="text-white" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-3xl gradient-primary"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      {/* App name */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-3xl font-bold mt-8 tracking-tight"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        <span className="text-[var(--color-primary)]">Walk</span>
        <span className="text-[var(--text)]">Tracker</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-[var(--text-secondary)] mt-2 text-sm"
      >
        Track every step of your journey
      </motion.p>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="flex gap-1.5 mt-12"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--color-primary)]"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
