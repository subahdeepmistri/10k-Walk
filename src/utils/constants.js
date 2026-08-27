// App-wide constants

export const DEFAULT_SETTINGS = {
  weightKg: 70,
  heightCm: 170,
  dailyStepGoal: 10000,
  dailyDistanceGoal: 5000, // meters (internal storage, display converts by unit)
  dailyDurationGoal: 45, // minutes of active walking
  dailyCaloriesGoal: 300, // kcal burned (harmonious with existing cals computation in lib/calories + store + summary/stats/achievements)
  unit: 'km', // 'km' or 'mi'
  theme: 'dark',
  autoPause: true,
  autoPauseSpeed: 0.3, // m/s
  gpsAccuracyThreshold: 30, // meters
  voiceFeedback: false,
};

export const TRACKING_STATES = {
  IDLE: 'idle',
  TRACKING: 'tracking',
  PAUSED: 'paused',
  STOPPED: 'stopped',
};

export const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'Home' },
  { path: '/track', label: 'Track', icon: 'Navigation' },
  { path: '/stats', label: 'Stats', icon: 'BarChart2' },
  { path: '/achievements', label: 'Awards', icon: 'Trophy' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
];
