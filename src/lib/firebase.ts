import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXWaRVS4HLQFs_x3QhvyuiR-rMf0I4lnA",
  authDomain: "gen-lang-client-0235333125.firebaseapp.com",
  projectId: "gen-lang-client-0235333125",
  storageBucket: "gen-lang-client-0235333125.firebasestorage.app",
  messagingSenderId: "470937977065",
  appId: "1:470937977065:web:d1dd0aeb2dca1d9d2b3078"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = getFirestore(app, "ai-studio-aidesignstudio-ec22dd56-13fc-49ee-8f79-8b752f0be1ba");
