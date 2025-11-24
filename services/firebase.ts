import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4JFs35VZYKtHlekx5Ws1nDyZOFkjcP9o",
  authDomain: "qudrat-d3af8.firebaseapp.com",
  projectId: "qudrat-d3af8",
  storageBucket: "qudrat-d3af8.firebasestorage.app",
  messagingSenderId: "1045528725724",
  appId: "1:1045528725724:web:01428262909740982c8c19"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);