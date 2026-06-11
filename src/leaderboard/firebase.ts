import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase 초기화 — config 는 Vite 환경변수(VITE_FIREBASE_*, `.env`)에서 읽는다.
 * config 가 없으면(키 미설정) db=null → 글로벌 리더보드는 오프라인 폴백으로 동작.
 *
 * ⚠️ 이 키들은 "비밀"이 아니라 공개 식별자(프로젝트 주소)다. 클라이언트에 노출돼도
 *    접근 제어는 전적으로 Firestore Security Rules(`firestore.rules`)가 한다.
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

if (cfg.apiKey && cfg.projectId) {
  app = initializeApp(cfg as Record<string, string>);
  firestore = getFirestore(app);
} else {
  console.info('[RuleAdd] Firebase config 없음 — 글로벌 리더보드 오프라인(로컬 기록만).');
}

/** 글로벌 리더보드 사용 가능 여부(config 주입됨). */
export const isGlobalEnabled = firestore !== null;
/** Firestore 핸들 — 오프라인이면 null. */
export const db = firestore;
