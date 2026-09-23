// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXr2zq_93a3mAitdorlSfbaa6ew7UaEIU",
  authDomain: "font-collection.firebaseapp.com",
  projectId: "font-collection",
  storageBucket: "font-collection.firebasestorage.app",
  messagingSenderId: "975982591061",
  appId: "1:975982591061:web:9cfc5c55d9aa03f6dfe8dc"
};

// Initialize Firebase (Singleton pattern to prevent re-initialization in Next.js dev mode)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
const storage = getStorage(app);

export { db, storage };
