// Importar as funções essenciais do Firebase diretamente da Web (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Suas chaves copiadas do painel
const firebaseConfig = {
  apiKey: "AIzaSyBponxc51KLUb3GNBuVZgUQ-TRI3qd-zvI",
  authDomain: "armarios-gremio.firebaseapp.com",
  databaseURL: "https://armarios-gremio-default-rtdb.firebaseio.com",
  projectId: "armarios-gremio",
  storageBucket: "armarios-gremio.firebasestorage.app",
  messagingSenderId: "1011340582434",
  appId: "1:1011340582434:web:53b7a48e088df0d29c347b"
};

// Inicializar o Firebase e exportar os serviços para usarmos em outras páginas
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const API_BASE_URL = "https://backend-g3e.vercel.app";
