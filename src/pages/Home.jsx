// Home Dashboard — premium redesign


import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play,
  Footprints,
  Flame,
  MapPin,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  Activity,
  Target,
} from 'lucide-react';
import ProgressRing from '../components/ui/ProgressRing';
import Card from '../components/ui/Card';
import { useMemo } from 'react';
import useUserStore from '../stores/userStore';
import useDataStore from '../application/stores/dataStore.js';
import {
  getTodaySnapshot,
  getStreak,
  getWeeklyActivity,
} from '../application/stores/dataStore.js';
import { formatDistance, formatDurationShort, formatNumber, formatTime, formatDate } from '../utils/formatters';
import { calculateLevel } from '../lib/achievements';

export default function Home() {
  const navigate = useNavigate();
  const { dailyStepGoal, dailyDistanceGoal, dailyDurationGoal, dailyCaloriesGoal, unit, xp } = useUserStore();
  const level = calculateLevel(xp);

  // Subscribe to walks so component re-renders when data changes
  const walks = useDataStore((s) => s.walks);

  // Memoize derived values — recomputes only when walks or settings change
  const settings = useMemo(() => ({ dailyStepGoal, dailyDistanceGoal, dailyDurationGoal, dailyCaloriesGoal }), [dailyStepGoal, dailyDistanceGoal, dailyDurationGoal, dailyCaloriesGoal]);
  const snapshot = useMemo(() => getTodaySnapshot(settings), [walks, settings]);
  const { totals: todayStats, progress, overallProgress, completedGoals: closedRings } = snapshot;
  const streak = useMemo(() => getStreak(), [walks]);
  const weeklyActivity = useMemo(() => getWeeklyActivity(), [walks]);
  const recentWalks = useMemo(() => walks.slice(0, 5), [walks]);

  // Ring progress values — already clamped to [0,1] by calculateGoalProgress
  const stepProgress = progress.steps;
  const distProgress = progress.distance;
  const timeProgress = progress.duration;
  const calProgress = progress.calories;

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good Morning' :
    now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] pb-24">
      {/* Clean, spacious header — less visual weight, excellent on phones */}
      <div className="pt-14 pb-6 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--text-secondary)] text-[13px] font-medium tracking-wide">{greeting}</p>
            <h1 className="text-display tracking-[-0.025em]" style={{ fontFamily: 'var(--font-heading)' }}>
              Dashboard
            </h1>
          </div>
          <button
            onClick={() => navigate('/achievements')}
            className="flex h-11 items-center gap-2 rounded-2xl card-elevated px-4 text-sm font-semibold active:scale-[0.985] focus-ring"
          >
            <Zap size={16} className="text-[var(--color-primary-light)]" />
            <span className="text-[var(--color-primary-light)]">Level {level.level}</span>
          </button>
        </div>
      </div>

      {/* Hero Progress — spacious, calm, premium. One clear section instead of many competing elements */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <div className="text-label text-[var(--text-secondary)]">TODAY</div>
            <div className="text-title tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Activity Rings</div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="rounded-full bg-[var(--color-primary)]/10 px-4 py-1.5 text-[12px] font-semibold text-[var(--color-primary)] active:bg-[var(--color-primary)]/15 focus-ring"
          >
            Edit goals
          </button>
        </div>

        {/* Beautiful 2x2 rings with generous breathing room — the heart of the experience, now calmer and more readable on small screens */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'steps', label: 'Steps', icon: Footprints, progress: stepProgress, value: formatNumber(todayStats.steps), goal: formatNumber(dailyStepGoal), accent: '#6366F1', color: stepProgress >= 1 ? 'var(--color-success)' : 'url(#ring-gradient-steps)' },
            { key: 'distance', label: 'Distance', icon: MapPin, progress: distProgress, value: formatDistance(todayStats.distance, unit), goal: formatDistance(dailyDistanceGoal || 5000, unit), suffix: unit, accent: '#06B6D4', color: distProgress >= 1 ? 'var(--color-success)' : '#06B6D4' },
            { key: 'duration', label: 'Active', icon: Clock, progress: timeProgress, value: formatDurationShort(todayStats.duration), goal: `${dailyDurationGoal || 45}m`, accent: '#10B981', color: timeProgress >= 1 ? 'var(--color-success)' : '#10B981' },
            { key: 'calories', label: 'Energy', icon: Flame, progress: calProgress, value: formatNumber(todayStats.calories), goal: formatNumber(dailyCaloriesGoal || 300), accent: '#F59E0B', color: calProgress >= 1 ? 'var(--color-success)' : '#F59E0B' },
          ].map((m, i) => {
            const Icon = m.icon;
            const isComplete = m.progress >= 1;
            return (
              <div
                key={i}
                onClick={() => navigate('/settings')}
                className="card-elevated rounded-3xl p-5 active:scale-[0.985] transition-transform focus-ring cursor-pointer"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: `${m.accent}15`, color: m.accent }}>
                      <Icon size={15} />
                    </div>
                    <span className="text-[13px] font-semibold tracking-wide text-[var(--text)]">{m.label}</span>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: isComplete ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                    {Math.round(m.progress * 100)}%
                  </span>
                </div>

                <div className="flex items-center justify-center py-1">
                  <ProgressRing progress={m.progress} size={108} strokeWidth={9} color={m.color} bgColor={isComplete ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.06)'}>
                    <div className="flex flex-col items-center">
                      <span className="text-[24px] font-extrabold leading-none tabular-nums tracking-tighter" style={{ fontFamily: 'var(--font-heading)' }}>{m.value}</span>
                      <span className="mt-0.5 text-[11px] text-[var(--text-secondary)]">of {m.goal}{m.suffix || ''}</span>
                    </div>
                  </ProgressRing>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clean, prominent overall status */}
        <div className="mt-4 flex justify-center">
          <div className="premium-pill flex items-center gap-2 text-[13px] font-semibold">
            <span>{closedRings}/4 closed</span>
            <span className="opacity-40">·</span>
            <span>{Math.round(overallProgress * 100)}% of daily goals</span>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[12px] text-[var(--text-secondary)]">Real GPS • step &amp; calorie estimates • active time</p>

        <svg width="0" height="0" className="absolute"><defs><linearGradient id="ring-gradient-steps" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366F1"/><stop offset="50%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#A78BFA"/></linearGradient></defs></svg>
      </div>

      {/* Streak — elegant, spacious, and encouraging. Larger elements, calm design */}
      <div className="mb-8">
        <Card className="py-6">
          <div className="mb-4 flex items-center gap-2 px-5">
            <Flame size={18} className={streak > 0 ? 'text-[#F59E0B]' : 'text-[var(--text-secondary)]'} />
            <div className="text-title tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{streak} day streak</div>
          </div>

          <div className="flex justify-between px-4">
            {weeklyActivity.map((day, ix) => {
              const isToday = ix === 6;
              return (
                <div key={day.date} className="flex flex-col items-center gap-1.5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-all ${day.hasWalked
                      ? 'bg-gradient-to-br from-[#10B981] to-[#047857] text-white shadow-sm'
                      : isToday
                      ? 'border-[1.5px] border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                      : 'bg-[var(--border)]/60 text-[var(--text-secondary)]'
                    }`}>
                    {day.hasWalked ? <Footprints size={15} /> : day.day}
                  </div>
                  <span className={`text-[11px] font-medium ${isToday ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>{day.day}</span>
                </div>
              );
            })}
          </div>

          {streak === 0 && (
            <p className="mt-3 px-5 text-center text-[13px] text-[var(--text-secondary)]">Walk today to begin your streak.</p>
          )}
        </Card>
      </div>

      {/* Strong, confident primary action */}
      <div className="mb-8 px-1">
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => navigate('/track')}
          className="btn-primary flex w-full items-center justify-center gap-3 rounded-3xl py-4 text-[16px] font-semibold shadow-lg focus-ring"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Play size={18} fill="white" className="ml-0.5" />
          </div>
          <span>Start Walking</span>
        </motion.button>
        <p className="mt-2 text-center text-[12px] text-[var(--text-secondary)]">Real GPS tracking • Auto-pause • 100% private</p>
      </div>

      {/* Light, useful supporting info — grouped to reduce clutter */}
      <div className="mb-8 space-y-3">
        {/* Quick totals — cleaner, more generous cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: MapPin, label: 'Distance', value: formatDistance(todayStats.distance, unit), color: '#818CF8' },
            { icon: Flame, label: 'Calories', value: formatNumber(todayStats.calories), color: '#FBBF24' },
            { icon: Clock, label: 'Duration', value: formatDurationShort(todayStats.duration), color: '#22D3EE' },
          ].map((stat, i) => (
            <Card key={i} className="flex flex-col items-center py-4">
              <stat.icon size={16} style={{ color: stat.color }} className="mb-1.5" />
              <div className="text-[17px] font-extrabold tabular-nums tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{stat.value}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Level — compact and beautiful */}
        <Card onClick={() => navigate('/achievements')} className="flex items-center gap-4 py-4">
          <ProgressRing progress={level.progress} size={56} strokeWidth={5} color="url(#level-gradient)">
            <span className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-heading)' }}>{level.level}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold">Level {level.level}</div>
              <div className="text-[12px] text-[var(--text-secondary)]">{formatNumber(level.currentXp)} / {formatNumber(level.xpForNextLevel)} XP</div>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-1.5 rounded-full bg-gradient-to-r from-[#6366F1] to-[#A78BFA]" style={{ width: `${level.progress * 100}%` }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity — clean, spacious list with excellent mobile ergonomics */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-title tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Recent</h2>
          {recentWalks.length > 0 && (
            <button onClick={() => navigate('/stats')} className="text-[13px] font-medium text-[var(--text-secondary)] active:text-[var(--text)]">
              See all
            </button>
          )}
        </div>

        {recentWalks.length === 0 ? (
          <Card className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
              <Footprints size={28} className="text-[var(--color-primary)]" />
            </div>
            <div className="text-title mb-1.5 tracking-tight">No walks yet</div>
            <p className="mx-auto max-w-[260px] text-[14px] text-[var(--text-secondary)]">Your first walk will update the rings and start your streak.</p>
            <button
              onClick={() => navigate('/track')}
              className="mt-5 rounded-2xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white active:opacity-90"
            >
              Start your first walk
            </button>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {recentWalks.slice(0, 3).map((walk) => (
              <Card
                key={walk.id}
                onClick={() => navigate(`/walk-summary/${walk.id}`)}
                className="flex items-center gap-4 py-3.5 active:scale-[0.985]"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl gradient-primary text-white">
                  <Footprints size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{formatDate(walk.date)}</span>
                    <span className="text-[13px] text-[var(--text-secondary)]">{formatTime(walk.startTime)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[14px] text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text)]">{formatDistance(walk.distance, unit)} {unit}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatDurationShort(walk.duration)}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatNumber(walk.steps)} steps</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[var(--text-secondary)] opacity-60" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
