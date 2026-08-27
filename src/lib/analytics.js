import { getLocalDateString } from '../utils/formatters';

/**
 * Analytics and Streak calculations for WalkTracker
 */

/**
 * Calculates current streak (consecutive days with at least one walk)
 * Streak stays alive if user walked yesterday but not yet today.
 * All date math uses LOCAL calendar days.
 */
export function calculateStreak(walks) {
  if (!walks || walks.length === 0) return 0;
  
  // Extract unique dates of walks (already stored as local YYYY-MM-DD)
  const walkDates = [...new Set(walks.map(w => w.date))].sort().reverse();
  
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < walkDates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    const expectedDateStr = getLocalDateString(expectedDate);
    
    // Exception for the first check: if user hasn't walked today, 
    // the streak is still alive if they walked yesterday.
    if (i === 0 && walkDates[0] !== expectedDateStr) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      
      if (walkDates[0] === yesterdayStr) {
        streak++;
        // Offset the comparison chain so next iteration expects day before yesterday
        today.setDate(today.getDate() - 1); 
        continue;
      } else {
        break; // Streak is 0
      }
    }
    
    if (walkDates[i] === expectedDateStr) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate the last 7 days of activity for visual streak circles
 */
export function getWeeklyActivity(walks) {
  const result = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDateString(d);
    // Native weekday format: "Mon", "Tue" etc.
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Check if walk exists for this date
    const hasWalked = walks.some(w => w.date === dateStr);
    
    result.push({
      date: dateStr,
      day: dayName[0], // Extract first letter (S, M, T, W, T, F, S)
      fullDay: dayName,
      hasWalked
    });
  }
  
  return result;
}

/**
 * Calculate Personal Records (PRs) from an array of walks
 */
export function calculatePersonalRecords(walks) {
  if (!walks || walks.length === 0) return null;
  
  const records = {
    longestDistance: 0,
    longestDuration: 0,
    mostSteps: 0,
    mostCalories: 0,
    longestSingleWalk: 0,
    fastestPace: Infinity,
  };
  
  // Group by date for daily records
  const groupedByDate = walks.reduce((acc, walk) => {
    if (!acc[walk.date]) acc[walk.date] = { distance: 0, duration: 0, steps: 0, calories: 0 };
    acc[walk.date].distance += (walk.distance || 0);
    acc[walk.date].duration += (walk.duration || 0);
    acc[walk.date].steps += (walk.steps || 0);
    acc[walk.date].calories += (walk.calories || 0);
    return acc;
  }, {});
  
  // Find maximums for daily stats
  Object.values(groupedByDate).forEach(dayStats => {
    if (dayStats.distance > records.longestDistance) records.longestDistance = dayStats.distance;
    if (dayStats.duration > records.longestDuration) records.longestDuration = dayStats.duration;
    if (dayStats.steps > records.mostSteps) records.mostSteps = dayStats.steps;
    if (dayStats.calories > records.mostCalories) records.mostCalories = dayStats.calories;
  });
  
  // Find maximums for single walks
  walks.forEach(w => {
    if (w.distance > records.longestSingleWalk) records.longestSingleWalk = w.distance;
    
    // Calculate average pace (min/km or min/mi based on unit, stored in s and km/mi)
    // Only count walks over 1km/mi to avoid GPS jump artifacts inflating pace
    if (w.distance >= 1 && w.duration > 0) {
      const paceMinutesPerUnit = (w.duration / 60) / w.distance;
      if (paceMinutesPerUnit > 2 && paceMinutesPerUnit < records.fastestPace) {
        records.fastestPace = paceMinutesPerUnit;
      }
    }
  });

  if (records.fastestPace === Infinity) records.fastestPace = 0;

  return records;
}

/**
 * Prepare chart data for Recharts (aggregating by day)
 * period: 'week' (last 7 days), 'month' (last 30 days)
 */
export function getChartData(walks, period = 'week') {
  const days = period === 'week' ? 7 : 30;
  const result = [];
  const today = new Date();
  
  // Create template for the last `days` days (local calendar)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDateString(d);
    const displayLabel = period === 'week' 
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
    result.push({
      date: dateStr,
      name: displayLabel,
      distance: 0,
      steps: 0,
      calories: 0,
      duration: 0
    });
  }
  
  // Fill with walk data
  walks.forEach(walk => {
    const dayEntry = result.find(r => r.date === walk.date);
    if (dayEntry) {
      dayEntry.distance += (walk.distance || 0);
      dayEntry.steps += (walk.steps || 0);
      dayEntry.calories += (walk.calories || 0);
      dayEntry.duration += (walk.duration || 0);
    }
  });
  
  // Format duration into minutes for charts
  result.forEach(entry => {
    entry.duration = Math.round(entry.duration / 60);
    entry.distance = Number(entry.distance.toFixed(2));
    entry.calories = Math.round(entry.calories);
  });
  
  return result;
}
