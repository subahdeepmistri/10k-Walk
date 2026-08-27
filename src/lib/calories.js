// Calorie calculation based on walking MET values

/**
 * Estimate calories burned during walking
 * @param {number} weightKg - User weight in kg
 * @param {number} distanceKm - Distance walked in km
 * @param {number} durationMin - Duration in minutes
 * @param {number} speedKmh - Average speed in km/h
 * @returns {number} Estimated calories burned
 */
export function calculateCalories(weightKg, distanceKm, durationMin, speedKmh = 5) {
  // MET values for different walking speeds
  let met;
  if (speedKmh < 3) met = 2.0;       // Very slow walking
  else if (speedKmh < 4) met = 2.8;   // Slow walking
  else if (speedKmh < 5) met = 3.5;   // Normal walking
  else if (speedKmh < 6) met = 4.3;   // Brisk walking
  else if (speedKmh < 7) met = 5.0;   // Very brisk walking
  else met = 6.0;                      // Fast walking/light jog

  // Calories = MET × weight(kg) × time(hours)
  const durationHours = durationMin / 60;
  return Math.round(met * weightKg * durationHours);
}

/**
 * Estimate steps from distance
 * @param {number} distanceMeters - Distance in meters
 * @param {number} heightCm - User height in cm (for stride estimation)
 * @returns {number} Estimated step count
 */
export function estimateSteps(distanceMeters, heightCm = 170) {
  // Average stride length is roughly 0.415 × height
  const strideLength = (heightCm / 100) * 0.415;
  return Math.round(distanceMeters / strideLength);
}
