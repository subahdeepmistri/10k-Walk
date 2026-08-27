// Onboarding screens (3 slides + config)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Footprints, MapPin, Trophy, ChevronRight, Check } from 'lucide-react';
import useUserStore from '../stores/userStore';

const slides = [
  {
    icon: Footprints,
    title: 'Track Your Walks',
    description: 'Real-time GPS tracking with live metrics — distance, pace, steps, and calories burned.',
    gradient: 'from-indigo-500 to-violet-500',
    color: '#6366F1',
  },
  {
    icon: MapPin,
    title: 'Explore Your Routes',
    description: 'Beautiful interactive maps show your every route with detailed elevation and pace analysis.',
    gradient: 'from-emerald-500 to-cyan-500',
    color: '#10B981',
  },
  {
    icon: Trophy,
    title: 'Earn Achievements',
    description: 'Unlock badges, earn XP, and level up as you hit milestones and build walking streaks.',
    gradient: 'from-amber-500 to-orange-500',
    color: '#F59E0B',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding, updateSetting } = useUserStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [stepGoal, setStepGoal] = useState('10000');

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowSetup(true);
    }
  };

  const handleComplete = async () => {
    await updateSetting('weightKg', parseInt(weight) || 70);
    await updateSetting('heightCm', parseInt(height) || 170);
    await updateSetting('dailyStepGoal', parseInt(stepGoal) || 10000);
    // Persist all designed goals (including new cals) so rings on Home reflect the full system from day one
    await updateSetting('dailyDistanceGoal', 5000);
    await updateSetting('dailyDurationGoal', 45);
    await updateSetting('dailyCaloriesGoal', 300);
    await completeOnboarding();
    navigate('/', { replace: true });
  };

  if (showSetup) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col px-6 py-12 bg-[var(--bg)]"
      >
        <motion.div initial={{ y: 20 }} animate={{ y: 0 }}>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Quick Setup
          </h2>
          <p className="text-[var(--text-secondary)] mb-8">
            Let's personalize your experience
          </p>
        </motion.div>

        <div className="space-y-6 flex-1">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
              Weight (kg)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-lg focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              id="setup-weight"
            />
          </motion.div>

          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
              Height (cm)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-lg focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              id="setup-height"
            />
          </motion.div>

          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
              Daily Step Goal
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['5000', '8000', '10000'].map((goal) => (
                <button
                  key={goal}
                  onClick={() => setStepGoal(goal)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    stepGoal === goal
                      ? 'gradient-primary text-white'
                      : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  {parseInt(goal).toLocaleString()}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleComplete}
          className="w-full py-4 rounded-2xl gradient-primary text-white font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-8"
          id="setup-complete-btn"
        >
          <Check size={20} />
          Let's Go!
        </motion.button>
      </motion.div>
    );
  }

  const slide = slides[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] relative overflow-hidden">
      {/* Background glow */}
      <motion.div
        key={currentSlide}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[120px] opacity-20"
        style={{ background: slide.color }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.2 }}
        transition={{ duration: 0.5 }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center mb-10"
              style={{
                background: `linear-gradient(135deg, ${slide.color}33, ${slide.color}11)`,
                border: `2px solid ${slide.color}33`,
              }}
            >
              <SlideIcon size={56} style={{ color: slide.color }} />
            </div>

            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
              {slide.title}
            </h2>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-[280px]">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-8 pb-12">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <motion.div
              key={i}
              className="h-2 rounded-full"
              animate={{
                width: i === currentSlide ? 24 : 8,
                backgroundColor:
                  i === currentSlide ? slide.color : 'var(--border)',
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl gradient-primary text-white font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          id="onboarding-next-btn"
        >
          {currentSlide < slides.length - 1 ? (
            <>
              Next <ChevronRight size={20} />
            </>
          ) : (
            'Get Started'
          )}
        </button>

        {currentSlide < slides.length - 1 && (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full py-3 text-[var(--text-secondary)] text-sm mt-2"
            id="onboarding-skip-btn"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
