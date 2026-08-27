// Live Walk Tracking Screen — the core feature

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  Navigation,
  Crosshair,
  ChevronDown,
  MapPin,
  Footprints,
  Flame,
  Gauge,
  Clock,
  Mountain,
  ArrowLeft,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import useTrackingStore from '../stores/trackingStore';
import useUserStore from '../stores/userStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { useWakeLock } from '../hooks/useWakeLock';
import { TRACKING_STATES } from '../utils/constants';
import {
  formatDuration,
  formatDurationShort,
  formatDistance,
  formatPace,
  formatSpeed,
  formatNumber,
  getPaceZone,
} from '../utils/formatters';
import { useMemo } from 'react';
import useDataStore from '../application/stores/dataStore.js';
import { saveWalk, getTodaySnapshot } from '../application/stores/dataStore.js';

// Map controller component to handle dynamic center/zoom
function MapController({ center, shouldFollow }) {
  const map = useMap();
  useEffect(() => {
    if (center && shouldFollow) {
      map.setView(center, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, shouldFollow, map]);
  return null;
}

export default function Track() {
  const navigate = useNavigate();
  const {
    status,
    points,
    distance,
    currentSpeed,
    averageSpeed,
    currentPace,
    averagePace,
    steps,
    calories,
    maxSpeed,
    startTime,
    pausedTime,
    elevationGain,
    currentAltitude,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addPoint,
    resetTracking,
    getWalkData,
  } = useTrackingStore();

  const { weightKg, heightCm, unit, autoPause, autoPauseSpeed, dailyStepGoal, dailyDistanceGoal, dailyDurationGoal, dailyCaloriesGoal } = useUserStore();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const [currentPosition, setCurrentPosition] = useState(null);
  const [followUser, setFollowUser] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gpsError, setGpsError] = useState(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const timerRef = useRef(null);
  const autoPauseTimerRef = useRef(null);

  // Base today stats from dataStore — memoized because this recomputes on every GPS tick
  const walks = useDataStore((s) => s.walks);
  const baseToday = useMemo(() => getTodaySnapshot().totals, [walks]);

  // GPS callbacks
  const handlePosition = useCallback(
    (position) => {
      setGpsError(null);
      const { latitude, longitude } = position.coords;
      setCurrentPosition([latitude, longitude]);

      if (status === TRACKING_STATES.TRACKING) {
        addPoint(position, weightKg, heightCm);
      }

      // Light auto-pause (makes the designed feature in constants/userStore/Track refs actually run).
      // Uses incoming native speed (or 0). Short delay to avoid twitchy pauses. Clears on movement.
      const spd = (position.coords.speed != null && position.coords.speed >= 0) ? position.coords.speed : 0;
      const threshold = autoPauseSpeed || 0.3;
      if (autoPause && status === TRACKING_STATES.TRACKING && spd < threshold) {
        if (!autoPauseTimerRef.current) {
          autoPauseTimerRef.current = setTimeout(() => {
            pauseTracking();
            autoPauseTimerRef.current = null;
          }, 3500);
        }
      } else if (autoPauseTimerRef.current) {
        clearTimeout(autoPauseTimerRef.current);
        autoPauseTimerRef.current = null;
      }
    },
    [status, addPoint, weightKg, heightCm, autoPause, autoPauseSpeed, pauseTracking]
  );

  const handleGPSError = useCallback((error) => {
    setGpsError(error.message || 'GPS Error');
  }, []);

  const { startWatching, stopWatching, getCurrentPosition } = useGeolocation(
    handlePosition,
    handleGPSError
  );

  // Timer for elapsed time
  useEffect(() => {
    if (status === TRACKING_STATES.TRACKING) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime - pausedTime);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status, startTime, pausedTime]);

  // Get initial position on mount
  useEffect(() => {
    getCurrentPosition()
      .then((pos) => {
        setCurrentPosition([pos.coords.latitude, pos.coords.longitude]);
      })
      .catch((err) => setGpsError(err.message));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(autoPauseTimerRef.current);
    };
  }, []);

  // Handle Start
  const handleStart = async () => {
    startTracking();
    startWatching();
    await requestWakeLock();
    setFollowUser(true);
  };

  // Handle Pause
  const handlePause = () => {
    pauseTracking();
  };

  // Handle Resume
  const handleResume = () => {
    resumeTracking();
  };

  // Handle Stop
  const handleStop = async () => {
    stopTracking();
    stopWatching();
    await releaseWakeLock();

    // Save walk data — bulletproof guard + clear user feedback
    const walkData = getWalkData();
    if (walkData.distance > 10) {
      // Only save if walked at least 10m (prevents junk in daily aggregates / protocol)
      try {
        const walkId = await saveWalk(walkData);
        navigate(`/walk-summary/${walkId}`, { replace: true });
      } catch (error) {
        console.error('Failed to save walk:', error);
        // Do not lose the user: show actionable message and go home (data is lost only on this failure; rare)
        alert('Could not save this walk due to a storage issue. Your progress was tracked but not persisted. Please try again or restart the app.');
        resetTracking();
        navigate('/', { replace: true });
      }
    } else {
      // Explicit: tiny walks (<10m) are intentionally discarded to protect the integrity of your daily rings/streaks
      resetTracking();
      navigate('/', { replace: true });
    }
  };

  // Handle back button
  const handleBack = () => {
    if (status === TRACKING_STATES.IDLE) {
      navigate(-1);
    }
  };

  // Map path for polyline
  const routePath = points.map((p) => [p.lat, p.lng]);
  const mapCenter = currentPosition || [20.5937, 78.9629]; // Default to India center

  const paceZone = getPaceZone(currentPace);

  // Live daily progress derived from base (prior today) + current live store outputs (the "entire system" running right now)
  const liveSteps = baseToday.steps + steps;
  const liveDist = baseToday.distance + distance;
  const liveDurMin = (baseToday.duration + elapsedTime) / 60000;
  const liveCals = baseToday.calories + calories;

  const liveStepP = dailyStepGoal > 0 ? Math.min(1, liveSteps / dailyStepGoal) : 0;
  const liveDistP = dailyDistanceGoal > 0 ? Math.min(1, liveDist / dailyDistanceGoal) : 0;
  const liveDurP = dailyDurationGoal > 0 ? Math.min(1, liveDurMin / dailyDurationGoal) : 0;
  const liveCalP = dailyCaloriesGoal > 0 ? Math.min(1, liveCals / dailyCaloriesGoal) : 0;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[var(--bg)]">
      {/* MAP */}
      <div className="absolute inset-0 z-0">
        {currentPosition ? (
          <MapContainer
            center={mapCenter}
            zoom={17}
            zoomControl={false}
            className="h-full w-full"
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <MapController center={currentPosition} shouldFollow={followUser} />

            {/* Route polyline */}
            {routePath.length > 1 && (
              <Polyline
                positions={routePath}
                pathOptions={{
                  color: '#6366F1',
                  weight: 5,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}

            {/* Start marker */}
            {routePath.length > 0 && (
              <CircleMarker
                center={routePath[0]}
                radius={8}
                pathOptions={{
                  fillColor: '#10B981',
                  fillOpacity: 1,
                  color: '#fff',
                  weight: 3,
                }}
              />
            )}

            {/* Current position marker */}
            {currentPosition && (
              <>
                <CircleMarker
                  center={currentPosition}
                  radius={8}
                  pathOptions={{
                    fillColor: '#6366F1',
                    fillOpacity: 1,
                    color: '#fff',
                    weight: 3,
                  }}
                />
                {status === TRACKING_STATES.TRACKING && (
                  <CircleMarker
                    center={currentPosition}
                    radius={20}
                    pathOptions={{
                      fillColor: '#6366F1',
                      fillOpacity: 0.15,
                      color: '#6366F1',
                      weight: 1,
                      opacity: 0.3,
                    }}
                  />
                )}
              </>
            )}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <Navigation
                size={40}
                className="mx-auto mb-3 text-[var(--color-primary)] animate-pulse"
              />
              <p className="text-[var(--text-secondary)]">Acquiring GPS signal...</p>
              {gpsError && (
                <p className="text-[var(--color-error)] text-sm mt-2">{gpsError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 z-10 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          {status === TRACKING_STATES.IDLE && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleBack}
              className="w-10 h-10 rounded-full glass flex items-center justify-center"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}

          {status !== TRACKING_STATES.IDLE && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-full px-4 py-2 flex items-center gap-2"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  status === TRACKING_STATES.TRACKING
                    ? 'bg-[var(--color-success)] animate-pulse'
                    : 'bg-[var(--color-warning)]'
                }`}
              />
              <span className="text-sm font-medium">
                {status === TRACKING_STATES.TRACKING ? 'Tracking' : 'Paused'}
              </span>
            </motion.div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setFollowUser(!followUser)}
              className={`w-10 h-10 rounded-full glass flex items-center justify-center ${
                followUser ? 'text-[var(--color-primary)]' : 'text-[var(--text-secondary)]'
              }`}
              aria-label={followUser ? 'Stop following' : 'Follow location'}
            >
              <Crosshair size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* METRICS PANEL */}
      <AnimatePresence>
        {status !== TRACKING_STATES.IDLE && showMetrics && (
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            className="absolute bottom-0 left-0 right-0 z-10"
          >
            <div className="glass rounded-t-3xl px-5 pt-4 pb-6 safe-bottom">
              {/* Collapse handle */}
              <button
                onClick={() => setShowMetrics(false)}
                className="w-10 h-1 rounded-full bg-[var(--text-secondary)] opacity-30 mx-auto block mb-4"
              />

              {/* Timer */}
              <div className="text-center mb-4">
                <p className="text-4xl font-bold tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
                  {formatDuration(elapsedTime)}
                </p>
                {currentPace > 0 && currentPace < 60 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: paceZone.color }}
                    />
                    <span className="text-xs" style={{ color: paceZone.color }}>
                      {paceZone.label} pace
                    </span>
                  </div>
                )}
              </div>

              {/* Modern elegant daily progress (larger readable text, no tiny 8-9px from prior, matches new premium system) */}
              {(status !== TRACKING_STATES.IDLE) && (
                <div className="mb-4 px-1">
                  <div className="text-label text-[var(--text-secondary)] mb-1.5">Daily goals (live)</div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    {[
                      { label: 'Steps', p: liveStepP, val: formatNumber(liveSteps), goal: formatNumber(dailyStepGoal) },
                      { label: 'Dist', p: liveDistP, val: formatDistance(liveDist, unit), goal: formatDistance(dailyDistanceGoal||5000, unit) },
                      { label: 'Time', p: liveDurP, val: formatDurationShort((baseToday.duration + elapsedTime)), goal: `${dailyDurationGoal||45}m` },
                      { label: 'Cals', p: liveCalP, val: formatNumber(liveCals), goal: formatNumber(dailyCaloriesGoal||300) },
                    ].map((g, i) => (
                      <div key={i} className="min-w-0">
                        <div className="flex justify-between text-[var(--text-secondary)] mb-0.5">
                          <span className="font-semibold truncate text-sm">{g.label}</span>
                          <span className="font-mono tabular-nums text-sm">{Math.round(g.p*100)}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--border)] rounded overflow-hidden">
                          <div className="h-1.5 bg-[var(--color-primary)] transition-all" style={{ width: `${g.p*100}%` }} />
                        </div>
                        <div className="text-small text-[var(--text-secondary)] mt-0.5 truncate">{g.val} / {g.goal}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics grid (larger modern text, better hierarchy matching new system) */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <MetricItem
                  icon={MapPin}
                  label="Distance"
                  value={formatDistance(distance, unit)}
                  suffix={unit}
                  color="var(--color-primary)"
                />
                <MetricItem
                  icon={Gauge}
                  label="Pace"
                  value={formatPace(averagePace)}
                  suffix={`min/${unit}`}
                  color="var(--color-success)"
                />
                <MetricItem
                  icon={Footprints}
                  label="Steps"
                  value={formatNumber(steps)}
                  color="var(--color-accent)"
                />
                <MetricItem
                  icon={Flame}
                  label="Calories"
                  value={formatNumber(calories)}
                  suffix="kcal"
                  color="var(--color-warning)"
                />
                <MetricItem
                  icon={Navigation}
                  label="Speed"
                  value={`${formatSpeed(currentSpeed)} / ${formatSpeed(maxSpeed)}`}
                  suffix="km/h"
                  color="var(--color-secondary)"
                />
                <MetricItem
                  icon={Mountain}
                  label="Elevation"
                  value={Math.round(elevationGain)}
                  suffix="m ↑"
                  color="var(--color-accent)"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6">
                {status === TRACKING_STATES.TRACKING ? (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handlePause}
                      className="w-16 h-16 rounded-full bg-[var(--color-warning)] flex items-center justify-center shadow-lg"
                      id="pause-btn"
                      aria-label="Pause tracking"
                    >
                      <Pause size={28} className="text-white" fill="white" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowStopConfirm(true)}
                      className="w-14 h-14 rounded-full bg-[var(--color-error)] flex items-center justify-center shadow-lg"
                      id="stop-btn"
                      aria-label="Stop tracking"
                    >
                      <Square size={22} className="text-white" fill="white" />
                    </motion.button>
                  </>
                ) : (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handleResume}
                      className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-lg glow-primary"
                      id="resume-btn"
                      aria-label="Resume tracking"
                    >
                      <Play size={28} className="text-white ml-1" fill="white" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowStopConfirm(true)}
                      className="w-14 h-14 rounded-full bg-[var(--color-error)] flex items-center justify-center shadow-lg"
                      id="finish-btn"
                      aria-label="Finish walk"
                    >
                      <Square size={22} className="text-white" fill="white" />
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed metrics indicator */}
      {status !== TRACKING_STATES.IDLE && !showMetrics && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setShowMetrics(true)}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-6 py-3 flex items-center gap-3 safe-bottom"
        >
          <span className="font-bold">{formatDistance(distance, unit)} {unit}</span>
          <span className="text-[var(--text-secondary)]">|</span>
          <span className="font-mono">{formatDuration(elapsedTime)}</span>
          <ChevronDown size={16} className="rotate-180" />
        </motion.button>
      )}

      {/* START BUTTON (idle state) */}
      {status === TRACKING_STATES.IDLE && currentPosition && (
        <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center safe-bottom">
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStart}
            className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center shadow-2xl glow-primary relative"
            id="start-tracking-btn"
          >
            <motion.div
              className="absolute inset-0 rounded-full gradient-primary"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <Play size={40} className="text-white ml-1 relative z-10" fill="white" />
          </motion.button>
        </div>
      )}

      {/* STOP CONFIRMATION MODAL */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center"
            onClick={() => setShowStopConfirm(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--surface)] rounded-t-3xl p-6 w-full max-w-lg safe-bottom"
            >
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                Finish Walk?
              </h3>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                You've walked {formatDistance(distance, unit)} {unit} in {formatDuration(elapsedTime)}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStopConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] font-medium"
                >
                  Continue
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 py-3 rounded-xl bg-[var(--color-error)] text-white font-medium"
                  id="confirm-stop-btn"
                >
                  Finish Walk
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Metric item component (modern larger text matching new design system)
function MetricItem({ icon: Icon, label, value, suffix, color }) {
  return (
    <div className="text-center">
      <Icon size={16} style={{ color }} className="mx-auto mb-1.5" />
      <p className="text-[17px] font-extrabold leading-none tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        {value}
      </p>
      <p className="text-[var(--text-secondary)] text-small mt-0.5">
        {suffix && <span>{suffix} · </span>}
        {label}
      </p>
    </div>
  );
}
