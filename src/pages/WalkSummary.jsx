// Walk Summary Screen — shown after completing a walk

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Clock, Footprints, Flame, Gauge, Mountain,
  Navigation, Trophy, Share2, ArrowLeft, TrendingUp,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { toPng } from 'html-to-image';
import Card from '../components/ui/Card';
import { getBounds } from '../lib/gps';
import useUserStore from '../stores/userStore';
import { checkAchievements } from '../lib/achievements';
import { getStreak } from '../application/stores/dataStore.js';
import {
  getWalkById,
  getTodayWalks,
  getWalks,
} from '../application/stores/dataStore.js';

import {
  formatDuration,
  formatDistance,
  formatPace,
  formatSpeed,
  formatNumber,
  formatTime,
  formatDate,
  getPaceZone,
} from '../utils/formatters';

function FitBoundsMap({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

export default function WalkSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { unit, unlockedAchievements, unlockAchievement } = useUserStore();
  const [walk, setWalk] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadWalk();
  }, [id]);

  const loadWalk = async () => {
    try {
      const walkData = getWalkById(Number(id));
      if (walkData) {
        setWalk(walkData);
        // Check for new achievements
        await checkForNewAchievements(walkData);
      }
    } catch (error) {
      console.error('Failed to load walk:', error);
    }
  };

  const checkForNewAchievements = async (walkData) => {
    try {
      const todayWalks = getTodayWalks();
      const allWalks = getWalks();
      const todaySteps = todayWalks.reduce((s, w) => s + (w.steps || 0), 0);
      const totalDistance = allWalks.reduce((s, w) => s + (w.distance || 0), 0);
      const totalCalories = allWalks.reduce((s, w) => s + (w.calories || 0), 0);

      const stats = {
        totalWalks: allWalks.length,
        todaySteps,
        totalDistance,
        totalCalories,
        streak: getStreak(),
      };

      const newlyUnlocked = checkAchievements(stats, walkData, unlockedAchievements);
      if (newlyUnlocked.length > 0) {
        setNewBadges(newlyUnlocked);
        for (const badge of newlyUnlocked) {
          await unlockAchievement(badge.id, badge.xp);
        }
      }
    } catch (error) {
      console.error('Achievement check failed:', error);
    }
  };

  const handleShare = async () => {
    try {
      setIsExporting(true);
      const targetNode = document.getElementById('walk-summary-card');
      
      // Allow DOM to process state removal of action buttons
      await new Promise(r => setTimeout(r, 100));
      
      const dataUrl = await toPng(targetNode, {
        quality: 0.95,
        backgroundColor: '#0F172A',
        pixelRatio: 2
      });
      
      setIsExporting(false);

      if (navigator.share) {
        const file = await (await fetch(dataUrl)).blob();
        await navigator.share({
          title: 'My WalkTracker Activity',
          text: `Check out my recent walk on WalkTracker!`,
          files: [new File([file], `walk-${walk.id}.png`, { type: 'image/png' })]
        });
      } else {
        const link = document.createElement('a');
        link.download = `walk-${walk.id}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Failed to export image', err);
      setIsExporting(false);
      alert('Failed to generate image. Please try again.');
    }
  };

  if (!walk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const routePath = (walk.points || []).map((p) => [p.lat, p.lng]);
  const bounds = getBounds(walk.points || []);
  const paceZone = getPaceZone(walk.averagePace);
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-8" id="walk-summary-card">
      {/* Header */}
      <div className="relative">
        {/* Map */}
        <div className="h-64 w-full">
          {routePath.length > 1 ? (
            <MapContainer
              center={routePath[0]}
              zoom={15}
              zoomControl={false}
              className="h-full w-full"
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
              {bounds && <FitBoundsMap bounds={bounds} />}
              <Polyline
                positions={routePath}
                pathOptions={{ color: '#6366F1', weight: 4, opacity: 0.9 }}
              />
              <CircleMarker
                center={routePath[0]}
                radius={6}
                pathOptions={{ fillColor: '#10B981', fillOpacity: 1, color: '#fff', weight: 2 }}
              />
              <CircleMarker
                center={routePath[routePath.length - 1]}
                radius={6}
                pathOptions={{ fillColor: '#EF4444', fillOpacity: 1, color: '#fff', weight: 2 }}
              />
            </MapContainer>
          ) : (
            <div className="h-full w-full bg-[var(--surface)] flex items-center justify-center">
              <MapPin size={40} className="text-[var(--text-secondary)] opacity-30" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" />

          {/* Back button */}
          {!isExporting && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/', { replace: true })}
              className="absolute top-12 left-5 z-[400] w-10 h-10 rounded-full bg-[var(--surface)] text-[var(--text)] flex items-center justify-center border border-[var(--border)]"
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 -mt-8 relative z-10">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
            Walk Complete! 🎉
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {formatDate(walk.date)} · {formatTime(walk.startTime)}
          </p>
        </motion.div>

        {/* Primary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mt-6"
        >
          <Card className="text-center py-5">
            <MapPin size={18} className="mx-auto mb-2 text-[var(--color-primary)]" />
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              {formatDistance(walk.distance, unit)}
            </p>
            <p className="text-[var(--text-secondary)] text-xs">{unit}</p>
          </Card>
          <Card className="text-center py-5">
            <Clock size={18} className="mx-auto mb-2 text-[var(--color-accent)]" />
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              {formatDuration(walk.duration)}
            </p>
            <p className="text-[var(--text-secondary)] text-xs">Duration</p>
          </Card>
          <Card className="text-center py-5">
            <Gauge size={18} className="mx-auto mb-2 text-[var(--color-success)]" />
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              {formatPace(walk.averagePace)}
            </p>
            <p className="text-[var(--text-secondary)] text-xs">min/{unit}</p>
          </Card>
        </motion.div>

        {/* Secondary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4"
        >
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <StatRow icon={Footprints} label="Steps" value={formatNumber(walk.steps)} color="var(--color-primary)" />
              <StatRow icon={Flame} label="Calories" value={`${formatNumber(walk.calories)} kcal`} color="var(--color-warning)" />
              <StatRow icon={Navigation} label="Avg Speed" value={`${formatSpeed(walk.averageSpeed)} km/h`} color="var(--color-secondary)" />
              <StatRow icon={TrendingUp} label="Max Speed" value={`${formatSpeed(walk.maxSpeed)} km/h`} color="var(--color-error)" />
              <StatRow icon={Mountain} label="Elev. Gain" value={`${Math.round(walk.elevationGain || 0)} m`} color="var(--color-accent)" />
              <StatRow icon={Mountain} label="Elev. Loss" value={`${Math.round(walk.elevationLoss || 0)} m`} color="var(--color-accent)" />
            </div>
          </Card>
        </motion.div>

        {/* Elevation Chart */}
        {walk.altitudePoints && walk.altitudePoints.length > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4"
          >
            <Card>
              <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
                Elevation Profile
              </h3>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={walk.altitudePoints}>
                  <defs>
                    <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="distance" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(val) => [`${Math.round(val)}m`, 'Altitude']}
                  />
                  <Area
                    type="monotone"
                    dataKey="altitude"
                    stroke="#6366F1"
                    fill="url(#elevGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        {/* New Achievements */}
        {newBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="mt-4"
          >
            <Card className="border-[var(--color-primary)] border-2 relative overflow-hidden">
              <div className="absolute inset-0 gradient-primary opacity-5" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={18} className="text-[var(--color-primary)]" />
                  <h3 className="font-semibold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
                    New Achievements! 🏆
                  </h3>
                </div>
                <div className="space-y-2">
                  {newBadges.map((badge) => (
                    <div key={badge.id} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--bg)]">
                      <span className="text-2xl">{badge.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{badge.name}</p>
                        <p className="text-[var(--text-secondary)] text-xs">{badge.description}</p>
                      </div>
                      <span className="ml-auto text-xs text-[var(--color-primary)] font-semibold">
                        +{badge.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Buttons */}
        {!isExporting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-4 mt-6"
          >
            <button
              onClick={handleShare}
              className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              <Share2 size={24} />
            </button>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="flex-1 py-4 rounded-2xl flex items-center justify-center gradient-primary text-white font-semibold text-lg active:scale-[0.98] transition-transform"
              id="summary-done-btn"
            >
              Done
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} style={{ color }} />
      <div>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}
