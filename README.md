# パッと見通学

北海道情報大学の学生向け 通学・時刻表サポートアプリ（Next.js 16 App Router / TypeScript / Tailwind CSS v4 / Firestore）。

## セットアップ

前提: Node.js 20.9 以上、npm（`package-lock.json` 管理。pnpm / yarn は不可）

```bash
npm install
npm run dev   # http://localhost:3000
```

時刻表・停留所・時限のデータは Firestore から読み込みます。同梱の `.env.local` があればそのまま動きます。無い場合は `.env.example` をコピーして `NEXT_PUBLIC_FIREBASE_*` を設定してください（未設定でも画面は開きますが、データは空になります）。

Firestore が空の場合は `data/csv` の CSV を投入します（サービスアカウント鍵を配置して `npm run seed`。詳細は [`docs/DEPLOY.md`](docs/DEPLOY.md)）。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm run start` | 本番ビルド / 起動 |
| `npm run lint` | ESLint |
| `npm run seed` | `data/csv` を Firestore へ投入（`-- --dry-run` で確認のみ） |

## 構成

| パス | 内容 |
| --- | --- |
| `src/app` | 画面（ホーム / 時間割 / ルート / 時刻表） |
| `src/components` | 画面をまたぐ共通コンポーネント |
| `src/lib` | Firestore アクセス、経路探索、時刻表・時間割のロジック |
| `data/csv` | Firestore への投入元データ（実行時には読みません） |
| `scripts/seed-firestore.mjs` | 投入スクリプト |
| `docs/DEPLOY.md` | Vercel / Firebase へのデプロイ手順 |

スマートフォン向けの画面設計です（幅 600px を超える環境では中央寄せ表示）。
