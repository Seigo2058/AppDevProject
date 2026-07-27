import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase（バックエンド）の初期化。
 *
 * 設定値は Vercel / .env.local の環境変数から読む。
 * NEXT_PUBLIC_ 付きの値はブラウザに露出するが、Firebase の Web API キーは
 * 公開前提の識別子なので問題ない（アクセス制御は Firestore のセキュリティルールで行う）。
 *
 * 環境変数が未設定のときは null を返し、アプリはローカル（localStorage）だけで動く。
 * これによりデプロイ直後や環境変数の設定漏れでも画面が落ちない。
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  // 開発時のホットリロードで多重初期化しないよう、既存インスタンスを再利用する。
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}
