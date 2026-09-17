import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyArY-LP_dbVtScq35Ul_mmvsWPnoZHQ4iI",
  authDomain: "hs-sign.firebaseapp.com",
  projectId: "hs-sign",
  storageBucket: "hs-sign.firebasestorage.app",
  messagingSenderId: "727372301680",
  appId: "1:727372301680:web:56c28776aeaf3a2d297bb5",
  measurementId: "G-L6SQ7WDDS5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
