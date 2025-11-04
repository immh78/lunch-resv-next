import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "my-firebase-9450e.firebaseapp.com",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAjcEIdV46fa6Kw3Hdyzf3No_3cXtScRLc",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://my-firebase-9450e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "my-firebase-9450e",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "my-firebase-9450e.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1025301057295",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1025301057295:web:18d2432b1614cc70e5387a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SGD1NQERQJ",
};

// Firebase 설정 검증
if (!firebaseConfig.apiKey) {
  throw new Error('Firebase API Key가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
}

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth 및 Database 인스턴스 생성
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;

