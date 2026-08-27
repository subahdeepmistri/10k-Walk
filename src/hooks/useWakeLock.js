// Wake Lock API hook to prevent screen from sleeping during tracking

import { useState, useRef, useCallback, useEffect } from 'react';

export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsLocked(false);
      });

      return true;
    } catch (err) {
      console.error('Wake Lock request failed:', err);
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsLocked(false);
      } catch (err) {
        console.error('Wake Lock release failed:', err);
      }
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isLocked) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return { isLocked, requestWakeLock, releaseWakeLock };
}
