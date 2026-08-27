// Achievements and XP system

export const ACHIEVEMENTS = [
  {
    id: 'first_walk',
    name: 'First Steps',
    description: 'Complete your first walk',
    icon: '👟',
    xp: 50,
    condition: (stats) => stats.totalWalks >= 1,
  },
  {
    id: 'walk_1km',
    name: 'Getting Moving',
    description: 'Walk 1 km in a single session',
    icon: '🚶',
    xp: 100,
    condition: (_, walk) => walk && walk.distance >= 1000,
  },
  {
    id: 'walk_5km',
    name: 'Five Alive',
    description: 'Walk 5 km in a single session',
    icon: '🏃',
    xp: 250,
    condition: (_, walk) => walk && walk.distance >= 5000,
  },
  {
    id: 'walk_10km',
    name: 'Distance Master',
    description: 'Walk 10 km in a single session',
    icon: '🏅',
    xp: 500,
    condition: (_, walk) => walk && walk.distance >= 10000,
  },
  {
    id: 'steps_5k',
    name: 'Step Counter',
    description: 'Reach 5,000 steps in a day',
    icon: '👣',
    xp: 100,
    condition: (stats) => stats.todaySteps >= 5000,
  },
  {
    id: 'steps_10k',
    name: 'Perfect 10K',
    description: 'Reach 10,000 steps in a day',
    icon: '🎯',
    xp: 300,
    condition: (stats) => stats.todaySteps >= 10000,
  },
  {
    id: 'streak_3',
    name: 'Consistency',
    description: 'Walk 3 days in a row',
    icon: '🔥',
    xp: 200,
    condition: (stats) => stats.streak >= 3,
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Walk 7 days in a row',
    icon: '⚡',
    xp: 500,
    condition: (stats) => stats.streak >= 7,
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Walk 30 days in a row',
    icon: '💎',
    xp: 2000,
    condition: (stats) => stats.streak >= 30,
  },
  {
    id: 'total_50km',
    name: 'Half Century',
    description: 'Walk a total of 50 km',
    icon: '🌍',
    xp: 500,
    condition: (stats) => stats.totalDistance >= 50000,
  },
  {
    id: 'total_100km',
    name: 'Century Club',
    description: 'Walk a total of 100 km',
    icon: '🏆',
    xp: 1000,
    condition: (stats) => stats.totalDistance >= 100000,
  },
  {
    id: 'calories_1000',
    name: 'Calorie Crusher',
    description: 'Burn 1,000 total calories',
    icon: '🔥',
    xp: 400,
    condition: (stats) => stats.totalCalories >= 1000,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start a walk before 7 AM',
    icon: '🌅',
    xp: 150,
    condition: (_, walk) => {
      if (!walk) return false;
      const hour = new Date(walk.startTime).getHours();
      return hour < 7;
    },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a walk after 9 PM',
    icon: '🌙',
    xp: 150,
    condition: (_, walk) => {
      if (!walk) return false;
      const hour = new Date(walk.endTime).getHours();
      return hour >= 21;
    },
  },
];

/**
 * Calculate level from XP
 */
export function calculateLevel(xp) {
  // Each level requires increasingly more XP
  // Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, etc.
  let level = 1;
  let xpNeeded = 100;
  let totalXpForLevel = 0;

  while (xp >= totalXpForLevel + xpNeeded) {
    totalXpForLevel += xpNeeded;
    level++;
    xpNeeded = level * 100;
  }

  return {
    level,
    currentXp: xp - totalXpForLevel,
    xpForNextLevel: xpNeeded,
    totalXp: xp,
    progress: (xp - totalXpForLevel) / xpNeeded,
  };
}

/**
 * Check which new achievements were unlocked
 */
export function checkAchievements(stats, walk, unlockedIds = []) {
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.includes(achievement.id)) continue;
    if (achievement.condition(stats, walk)) {
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}
