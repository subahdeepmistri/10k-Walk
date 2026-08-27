import { create } from 'zustand';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../infrastructure/firebase.js';
import { startCloudSync, stopCloudSync } from '../infrastructure/cloudSync.js';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,

  initializeAuth: () => {
    if (!auth) {
      set({ isAuthenticated: false, isInitializing: false });
      return () => {};
    }

    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, isAuthenticated: !!user, isInitializing: false });
      if (user) {
        startCloudSync(user.uid);
      } else {
        stopCloudSync();
      }
    });

    return unsubscribe;
  },

  signInWithGoogle: async () => {
    if (!auth) {
      alert("Firebase is not configured yet! Please update src/lib/firebase.js with your keys.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  },

  logout: async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  }
}));

export default useAuthStore;
