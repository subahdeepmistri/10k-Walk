// Achievements screen — premium redesign

import { motion } from 'framer-motion';
import { Trophy, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import ProgressRing from '../components/ui/ProgressRing';
import useUserStore from '../stores/userStore';
import { ACHIEVEMENTS, calculateLevel } from '../lib/achievements';

export default function Achievements() {
  const navigate = useNavigate();
  const { unlockedAchievements, xp } = useUserStore();
  const level = calculateLevel(xp);

  const unlockedCount = unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;
  const progress = totalCount > 0 ? unlockedCount / totalCount : 0;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] pb-28">
      {/* Header */}
      <div className="pt-14 pb-4 safe-top">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Achievements
          </h1>
          <p className="text-[var(--text-secondary)] text-sm font-medium mt-1">
            {unlockedCount} of {totalCount} unlocked
          </p>
        </motion.div>
      </div>

      {/* Level & Progress Combined */}
      <div className="mt-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-primary opacity-[0.03]" />
            <div className="relative flex items-center gap-5">
              <ProgressRing
                progress={level.progress}
                size={76}
                strokeWidth={5}
                color="url(#level-gradient)"
              >
                <span className="text-[26px] font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>
                  {level.level}
                </span>
              </ProgressRing>

              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="level-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#A78BFA" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                    Level {level.level}
                  </h2>
                  <Zap size={16} className="text-[var(--color-primary-light)]" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm mt-0.5">
                  {level.currentXp} / {level.xpForNextLevel} XP
                </p>
                <div className="w-full h-[6px] rounded-full bg-[var(--border)] mt-2.5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6366F1, #A78BFA)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${level.progress * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Overall Progress */}
      <div className="mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="flex items-center gap-5 py-5">
            <ProgressRing
              progress={progress}
              size={72}
              strokeWidth={5}
              color="var(--color-warning)"
            >
              <Trophy size={22} className="text-[#FBBF24]" />
            </ProgressRing>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {Math.round(progress * 100)}%
              </p>
              <p className="text-[var(--text-secondary)] text-sm">
                {totalCount - unlockedCount} badges remaining
              </p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Badges Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
          All Badges
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((achievement, i) => {
            const isUnlocked = unlockedAchievements.includes(achievement.id);

            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.04 }}
              >
                <Card
                  className={`text-center py-5 relative overflow-hidden ${
                    !isUnlocked ? 'opacity-40' : ''
                  }`}
                  glow={isUnlocked}
                >
                  {isUnlocked && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center"
                        style={{ boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)' }}
                      >
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </div>
                    </div>
                  )}
                  <div className="text-3xl mb-2">
                    {isUnlocked ? achievement.icon : '🔒'}
                  </div>
                  <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
                    {achievement.name}
                  </p>
                  <p className="text-[var(--text-secondary)] text-[11px] mt-1 leading-snug px-1">
                    {achievement.description}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2.5">
                    <Zap size={11} className="text-[var(--color-primary-light)]" />
                    <span className="text-[11px] text-[var(--color-primary-light)] font-bold">
                      {achievement.xp} XP
                    </span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
