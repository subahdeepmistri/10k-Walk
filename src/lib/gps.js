// GPS utility functions for distance, smoothing, and pace calculations

/**
 * Haversine formula — calculates the great-circle distance between two points
 * @returns distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate speed in m/s between two GPS points
 */
export function calculateSpeed(p1, p2) {
  const distance = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  const timeDiff = (p2.timestamp - p1.timestamp) / 1000; // seconds
  if (timeDiff <= 0) return 0;
  return distance / timeDiff;
}

/**
 * Calculate pace in min/km
 */
export function calculatePace(speedMs) {
  if (speedMs <= 0) return 0;
  const speedKmH = speedMs * 3.6;
  return 60 / speedKmH; // minutes per km
}

/**
 * Simple moving average GPS smoothing
 * Filters out noisy GPS readings
 */
export function smoothGPSPoint(points, windowSize = 3) {
  if (points.length < windowSize) return points[points.length - 1];

  const window = points.slice(-windowSize);
  const avgLat = window.reduce((sum, p) => sum + p.lat, 0) / windowSize;
  const avgLng = window.reduce((sum, p) => sum + p.lng, 0) / windowSize;

  return {
    ...points[points.length - 1],
    lat: avgLat,
    lng: avgLng,
  };
}

/**
 * Filter GPS point based on accuracy threshold
 * @returns true if the point should be accepted
 */
export function isAccurateEnough(position, threshold = 30) {
  return position.coords.accuracy <= threshold;
}

/**
 * Calculate total distance from an array of GPS points
 * @returns distance in meters
 */
export function calculateTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return total;
}

/**
 * Get the center point of an array of GPS points
 */
export function getCenterPoint(points) {
  if (!points.length) return { lat: 0, lng: 0 };
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

/**
 * Get the bounding box of an array of GPS points
 */
export function getBounds(points) {
  if (!points.length) return null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  points.forEach(p => {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  });

  return [
    [minLat, minLng],
    [maxLat, maxLng]
  ];
}
