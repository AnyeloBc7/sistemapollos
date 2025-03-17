import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAk_0oQsneneXGUOiz2DDpP_rd2UcXvSlw",
  authDomain: "pollosaguadita.firebaseapp.com",
  projectId: "pollosaguadita",
  storageBucket: "pollosaguadita.firebasestorage.app",
  messagingSenderId: "286385673",
  appId: "1:286385673:web:41d94ae0e83a8472d27ad8",
  measurementId: "G-385TCVLPE3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };