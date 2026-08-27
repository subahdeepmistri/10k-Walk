// Zustand store for active tracking state

import { create } from 'zustand';
import { TRACKING_STATES } from '../utils/constants';
import { haversineDistance, calculatePace, smoothGPSPoint } from '../lib/gps';
import { calculateCalories, estimateSteps } from '../lib/calories';

const useTrackingStore = create((set, get) => ({
  // Tracking state
  status: TRACKING_STATES.IDLE,
  points: [],             // All GPS points [{lat, lng, timestamp, accuracy, speed, altitude}]
  rawPoints: [],          // Raw (unsmoothed) points for smoothing
  startTime: null,
  endTime: null,
  pausedTime: 0,          // Total time spent paused (ms)
  lastPauseStart: null,

  // Real-time metrics
  distance: 0,            // Total distance in meters
  currentSpeed: 0,        // Current speed in m/s
  averageSpeed: 0,        // Average speed in m/s
  currentPace: 0,         // Current pace in min/km
  averagePace: 0,         // Average pace in min/km
  steps: 0,
  calories: 0,
  maxSpeed: 0,
  elevationGain: 0,
  elevationLoss: 0,
  currentAltitude: 0,
  altitudePoints: [],     // [{distance, altitude}] for elevation chart

  // Settings used during tracking
  isAutoPaused: false,

  // Start tracking
  startTracking: () => {
    set({
      status: TRACKING_STATES.TRACKING,
      points: [],
      rawPoints: [],
      startTime: Date.now(),
      endTime: null,
      pausedTime: 0,
      lastPauseStart: null,
      distance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      currentPace: 0,
      averagePace: 0,
      steps: 0,
      calories: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      currentAltitude: 0,
      altitudePoints: [],
      isAutoPaused: false,
    });
  },

  // Pause tracking
  pauseTracking: () => {
    set({
      status: TRACKING_STATES.PAUSED,
      lastPauseStart: Date.now(),
    });
  },

  // Resume tracking
  resumeTracking: () => {
    const { lastPauseStart, pausedTime } = get();
    const additionalPause = lastPauseStart ? Date.now() - lastPauseStart : 0;
    set({
      status: TRACKING_STATES.TRACKING,
      pausedTime: pausedTime + additionalPause,
      lastPauseStart: null,
    });
  },

  // Stop tracking
  stopTracking: () => {
    const state = get();
    let finalPausedTime = state.pausedTime;
    if (state.lastPauseStart) {
      finalPausedTime += Date.now() - state.lastPauseStart;
    }
    set({
      status: TRACKING_STATES.STOPPED,
      endTime: Date.now(),
      pausedTime: finalPausedTime,
      lastPauseStart: null,
    });
  },

  // Reset tracking
  resetTracking: () => {
    set({
      status: TRACKING_STATES.IDLE,
      points: [],
      rawPoints: [],
      startTime: null,
      endTime: null,
      pausedTime: 0,
      lastPauseStart: null,
      distance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      currentPace: 0,
      averagePace: 0,
      steps: 0,
      calories: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      currentAltitude: 0,
      altitudePoints: [],
      isAutoPaused: false,
    });
  },

  // Add a new GPS point and recalculate metrics
  addPoint: (position, userWeight = 70, userHeight = 170) => {
    const state = get();
    if (state.status !== TRACKING_STATES.TRACKING) return;

    const newRawPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp || Date.now(),
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      altitude: position.coords.altitude,
    };

    const newRawPoints = [...state.rawPoints, newRawPoint];

    // Apply GPS smoothing
    const smoothedPoint = smoothGPSPoint(newRawPoints, 3);
    const newPoints = [...state.points, smoothedPoint];

    // Calculate distance increment
    let newDistance = state.distance;
    let newCurrentSpeed = 0;
    let newMaxSpeed = state.maxSpeed;
    let newElevationGain = state.elevationGain;
    let newElevationLoss = state.elevationLoss;
    let newAltitudePoints = [...state.altitudePoints];

    if (newPoints.length > 1) {
      const prev = newPoints[newPoints.length - 2];
      const curr = newPoints[newPoints.length - 1];
      const segmentDist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);

      // Only add distance if segment is reasonable (< 100m) to filter GPS jumps
      if (segmentDist < 100 && segmentDist > 0.5) {
        newDistance += segmentDist;
      }

      // Speed
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      if (timeDiff > 0 && segmentDist < 100) {
        newCurrentSpeed = segmentDist / timeDiff;
      }

      // Use native speed if available
      if (position.coords.speed != null && position.coords.speed >= 0) {
        newCurrentSpeed = position.coords.speed;
      }

      newMaxSpeed = Math.max(newMaxSpeed, newCurrentSpeed);

      // Elevation
      if (curr.altitude != null && prev.altitude != null) {
        const elevDiff = curr.altitude - prev.altitude;
        if (elevDiff > 0) newElevationGain += elevDiff;
        else newElevationLoss += Math.abs(elevDiff);
      }
    }

    // Altitude point for elevation chart
    if (smoothedPoint.altitude != null) {
      newAltitudePoints.push({
        distance: newDistance,
        altitude: smoothedPoint.altitude,
      });
    }

    // Calculate derived metrics
    const movingTime = Date.now() - state.startTime - state.pausedTime;
    const movingTimeMin = movingTime / 60000;
    const distanceKm = newDistance / 1000;
    const avgSpeedMs = movingTime > 0 ? newDistance / (movingTime / 1000) : 0;
    const avgSpeedKmh = avgSpeedMs * 3.6;
    const newSteps = estimateSteps(newDistance, userHeight);
    const newCalories = calculateCalories(userWeight, distanceKm, movingTimeMin, avgSpeedKmh);
    const newCurrentPace = calculatePace(newCurrentSpeed);
    const newAveragePace = calculatePace(avgSpeedMs);

    set({
      points: newPoints,
      rawPoints: newRawPoints,
      distance: newDistance,
      currentSpeed: newCurrentSpeed,
      averageSpeed: avgSpeedMs,
      currentPace: newCurrentPace,
      averagePace: newAveragePace,
      steps: newSteps,
      calories: newCalories,
      maxSpeed: newMaxSpeed,
      elevationGain: newElevationGain,
      elevationLoss: newElevationLoss,
      currentAltitude: smoothedPoint.altitude || 0,
      altitudePoints: newAltitudePoints,
    });
  },

  // Set auto-pause state
  setAutoPaused: (isPaused) => {
    set({ isAutoPaused: isPaused });
  },

  // Get the current walk data (for saving)
  getWalkData: () => {
    const state = get();
    let duration = 0;
    if (state.startTime) {
      const end = state.endTime || Date.now();
      duration = end - state.startTime - state.pausedTime;
    }
    return {
      points: state.points,
      startTime: state.startTime,
      endTime: state.endTime || Date.now(),
      distance: state.distance,
      duration,
      steps: state.steps,
      calories: state.calories,
      averageSpeed: state.averageSpeed,
      averagePace: state.averagePace,
      maxSpeed: state.maxSpeed,
      elevationGain: state.elevationGain,
      elevationLoss: state.elevationLoss,
      altitudePoints: state.altitudePoints,
    };
  },
}));

export default useTrackingStore;
