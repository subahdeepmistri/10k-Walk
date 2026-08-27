import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * ⚠️ IMPORTANT:
 * You must replace these placeholder values with your actual Firebase project configuration.
 * Find this in Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration.
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase safely to prevent app crash with placeholder keys
let app = null;
let auth = null;
let db = null;
let googleProvider = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
} catch (error) {
  console.warn("Firebase not initialized correctly. Ensure you have added your config keys in src/lib/firebase.js");
}

export { auth, db, googleProvider };
