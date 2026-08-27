// Zustand store for user preferences and settings
// Reads from dataStore (the single source of truth) instead of Dexie directly.

import { create } from 'zustand';
import useDataStore, {
  updateSetting as dsUpdateSetting,
} from '../application/stores/dataStore.js';

const useUserStore = create((set) => ({
  ...useDataStore.getState().settings,
  isLoaded: false,
  onboardingComplete: false,
  unlockedAchievements: [],
  xp: 0,

  // Hydrate from dataStore on app startup
  hydrateFromDataStore: () => {
    const { settings, isLoaded } = useDataStore.getState();
    if (isLoaded) {
      set({
        ...settings,
        isLoaded: true,
        onboardingComplete: settings.onboardingComplete || false,
        unlockedAchievements: settings.unlockedAchievements || [],
        xp: settings.xp || 0,
      });
    }
  },

  // Update a single setting — writes to dataStore (which persists via adapter)
  updateSetting: async (key, value) => {
    set({ [key]: value });
    await dsUpdateSetting(key, value);
  },

  // Unlock an achievement
  unlockAchievement: async (achievementId, xpReward) => {
    const { unlockedAchievements, xp } = useUserStore.getState();
    if (unlockedAchievements.includes(achievementId)) return;

    const newUnlocked = [...unlockedAchievements, achievementId];
    const newXp = xp + xpReward;

    set({ unlockedAchievements: newUnlocked, xp: newXp });
    await dsUpdateSetting('unlockedAchievements', newUnlocked);
    await dsUpdateSetting('xp', newXp);
  },

  // Complete onboarding
  completeOnboarding: async () => {
    set({ onboardingComplete: true });
    await dsUpdateSetting('onboardingComplete', true);
  },
}));

// Subscribe to dataStore SETTINGS changes only (not walks — walks don't affect userStore)
useDataStore.subscribe(
  (state) => state.settings,
  (next) => {
    if (!useDataStore.getState().isLoaded) return;
    const prev = useUserStore.getState();
    const changed = Object.keys(next).some((key) => prev[key] !== next[key]);
    if (changed) {
      useUserStore.setState({
        ...next,
        isLoaded: true,
        onboardingComplete: next.onboardingComplete || false,
        unlockedAchievements: next.unlockedAchievements || [],
        xp: next.xp || 0,
      });
    }
  }
);

export default useUserStore;
