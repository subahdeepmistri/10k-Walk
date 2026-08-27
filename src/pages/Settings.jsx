// Settings — premium redesign

import { motion } from 'framer-motion';
import {
  Sun, Moon, Scale, Ruler, Target,
  Smartphone, Heart, Trash2, Bell,
} from 'lucide-react';
import Card from '../components/ui/Card';
import useUserStore from '../stores/userStore';
import useAuthStore from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';
import { clearAll as dsClearAll } from '../application/stores/dataStore.js';

export default function Settings() {
  const {
    weightKg, heightCm, dailyStepGoal, dailyDistanceGoal, dailyDurationGoal, dailyCaloriesGoal, unit, autoPause,
    updateSetting,
  } = useUserStore();
  const { theme, toggleTheme } = useTheme();
  
  const { user, isAuthenticated, signInWithGoogle, logout } = useAuthStore();

  const handleClearData = async () => {
    // Trustworthy: strongly warn + suggest export first (Stats has export)
    if (!confirm('This will delete ALL your walk data (local + any cached). Export first from Stats if you want a backup. Continue?')) return;
    await dsClearAll();
    window.location.reload();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] pb-28">
      {/* Header */}
      <div className="pt-14 pb-2 safe-top">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Settings
          </h1>
        </motion.div>
      </div>

      <div className="mt-4 space-y-6">
        {/* Account & Sync Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <SectionLabel label="Account & Sync" />
          <Card className="overflow-hidden">
            {!isAuthenticated ? (
              <div className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <h3 className="font-bold text-[15px] mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Cloud Sync Database</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Back up walks securely offline & across devices.</p>
                <button
                  onClick={signInWithGoogle}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all bg-white text-black active:scale-[0.98]"
                >
                  Continue with Google
                </button>
              </div>
            ) : (
              <div className="p-3">
                <div className="flex items-center gap-3 p-2 bg-[var(--bg)]/50 rounded-xl mb-3 border border-[var(--border)]">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-bold">
                      {user?.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{user?.displayName || 'Adventurer'}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.email}</p>
                  </div>
                  <div className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Local</span>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-2">Data stored locally. Export from Stats for backup.</p>
                <button
                  onClick={logout}
                  className="w-full py-2 rounded-xl text-sm font-bold text-white transition-all bg-red-500/10 active:bg-red-500/20"
                >
                  Log Out
                </button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Profile Section — modern inline inputs (replaces old prompts for premium consistent UX + direct impact on step/calorie estimates) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <SectionLabel label="Profile (affects estimates)" />
          <Card>
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818CF8' }}>
                    <Scale size={15} />
                  </div>
                  <span className="text-sm font-semibold truncate">Weight</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-sm font-medium text-right tabular-nums focus:outline-none focus:border-[var(--color-primary)]"
                    value={weightKg}
                    min={30}
                    max={250}
                    step={1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 30 && v <= 250) updateSetting('weightKg', v);
                    }}
                  />
                  <span className="text-xs text-[var(--text-secondary)] w-6">kg</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#22D3EE' }}>
                    <Ruler size={15} />
                  </div>
                  <span className="text-sm font-semibold truncate">Height</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-sm font-medium text-right tabular-nums focus:outline-none focus:border-[var(--color-primary)]"
                    value={heightCm}
                    min={100}
                    max={220}
                    step={1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 100 && v <= 220) updateSetting('heightCm', v);
                    }}
                  />
                  <span className="text-xs text-[var(--text-secondary)] w-6">cm</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-[var(--text-secondary)] mt-2 pl-1">Used for stride-based step estimates and MET calorie calculations.</p>
          </Card>
        </motion.div>

        {/* Goals — nice inline editor (no more blocking prompts). Unit-aware for distance. Directly controls the Activity Rings progress on Home. */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <SectionLabel label="Goals" />
          <Card>
            <div className="space-y-4 py-1">
              {[
                { key: 'dailyStepGoal', label: 'Daily Steps', val: dailyStepGoal, unitLabel: '', step: 500, min: 1000 },
                { key: 'dailyDistanceGoal', label: `Distance (${unit.toUpperCase()})`, val: (unit==='mi' ? ((dailyDistanceGoal||5000)/1609.344) : ((dailyDistanceGoal||5000)/1000) ), unitLabel: unit, step: 0.5, min: 0.5, isDist: true },
                { key: 'dailyDurationGoal', label: 'Active Minutes', val: (dailyDurationGoal||45), unitLabel: 'min', step: 5, min: 5 },
                { key: 'dailyCaloriesGoal', label: 'Calories', val: (dailyCaloriesGoal||300), unitLabel: 'kcal', step: 50, min: 50 },
              ].map((g, idx) => {
                const display = Math.round(g.val * (g.key.includes('Distance') ? 100 : 1)) / (g.key.includes('Distance') ? 100 : 1);
                return (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                        <Target size={15} />
                      </div>
                      <span className="text-sm font-semibold truncate">{g.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-sm font-medium text-right tabular-nums focus:outline-none focus:border-[var(--color-primary)]"
                        value={display}
                        min={g.min}
                        step={g.step}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          if (isNaN(raw) || raw < g.min) return;
                          let toStore = raw;
                          if (g.isDist) {
                            toStore = unit === 'mi' ? Math.round(raw * 1609.344) : Math.round(raw * 1000);
                          } else {
                            toStore = Math.round(raw);
                          }
                          updateSetting(g.key, toStore);
                        }}
                      />
                      {g.unitLabel && <span className="text-xs text-[var(--text-secondary)] w-8">{g.unitLabel}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-[var(--text-secondary)] mt-2 pl-1">These power the Activity Rings on Home. Changes apply immediately on save.</p>
          </Card>
        </motion.div>

        {/* Preferences */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <SectionLabel label="Preferences" />
          <Card>
            {/* Theme */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: theme === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: theme === 'dark' ? '#818CF8' : '#FBBF24' }}>
                  {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                </div>
                <span className="text-sm font-semibold">Theme</span>
              </div>
              <button
                onClick={toggleTheme}
                className="w-[52px] h-[30px] rounded-full relative transition-colors duration-300"
                style={{
                  background: theme === 'dark'
                    ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                    : '#CBD5E1',
                }}
                id="theme-toggle"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <motion.div
                  className="w-[22px] h-[22px] rounded-full bg-white absolute top-1"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                  animate={{ left: theme === 'dark' ? 26 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <Divider />

            {/* Units */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#22D3EE' }}>
                  <Smartphone size={16} />
                </div>
                <span className="text-sm font-semibold">Units</span>
              </div>
              <div className="flex gap-1 p-1 card-elevated rounded-xl">
                {['km', 'mi'].map((u) => (
                  <button
                    key={u}
                    onClick={() => updateSetting('unit', u)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      unit === u
                        ? 'text-white'
                        : 'text-[var(--text-secondary)]'
                    }`}
                    style={unit === u ? {
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    } : {}}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <Divider />

            {/* Auto-Pause */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#FBBF24' }}>
                  <Bell size={16} />
                </div>
                <span className="text-sm font-semibold">Auto-Pause</span>
              </div>
              <button
                onClick={() => updateSetting('autoPause', !autoPause)}
                className="w-[52px] h-[30px] rounded-full relative transition-colors duration-300"
                style={{
                  background: autoPause
                    ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                    : '#CBD5E1',
                }}
                aria-label={autoPause ? 'Disable auto-pause' : 'Enable auto-pause'}
              >
                <motion.div
                  className="w-[22px] h-[22px] rounded-full bg-white absolute top-1"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                  animate={{ left: autoPause ? 26 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Data */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <SectionLabel label="Data" />
          <Card>
            <button
              onClick={handleClearData}
              className="flex items-center gap-3.5 py-3 w-full text-left group"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#F87171' }}
              >
                <Trash2 size={16} />
              </div>
              <span className="text-sm font-semibold text-[#F87171] group-active:opacity-70">
                Clear All Data
              </span>
            </button>
          </Card>
        </motion.div>

        {/* About */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <Card className="text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: '0 6px 24px rgba(99, 102, 241, 0.3)' }}
            >
              <Heart size={26} className="text-white" />
            </div>
            <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
              WalkTracker
            </h3>
            <p className="text-[var(--text-secondary)] text-xs mt-1.5 font-medium">
              Version 1.0.0 · Made with ❤️
            </p>
            <p className="text-[var(--text-secondary)] text-xs mt-0.5 font-medium">
              Free forever. No ads. No tracking.
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function SectionLabel({ label }) {
  return (
    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 pl-1">
      {label}
    </p>
  );
}



function Divider() {
  return <div className="h-px bg-[var(--border)] my-0.5" />;
}
