// Custom hook for Geolocation API with watchPosition

import { useEffect, useRef, useCallback } from 'react';

export function useGeolocation(onPosition, onError, options = {}) {
  const watchIdRef = useRef(null);
  const isWatchingRef = useRef(false);

  const defaultOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
    ...options,
  };

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      onError?.({ code: 0, message: 'Geolocation not supported' });
      return;
    }

    if (isWatchingRef.current) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        onPosition?.(position);
      },
      (error) => {
        onError?.(error);
      },
      defaultOptions
    );
    isWatchingRef.current = true;
  }, [onPosition, onError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      isWatchingRef.current = false;
    }
  }, []);

  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 0, message: 'Geolocation not supported' });
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, defaultOptions);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return { startWatching, stopWatching, getCurrentPosition };
}
