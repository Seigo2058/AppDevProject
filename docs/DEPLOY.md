# デプロイ手順（GitHub → Vercel ＋ Firebase）

構成は次のとおり。

- **GitHub**: `Seigo2058/AppDevProject`（`main` が本番ブランチ）
- **Vercel**: アプリ本体のホスティング。`main` への push で自動デプロイ、PR ごとにプレビュー環境が作られる
- **Firebase**: バックエンド（Firestore / Authentication）。ホスティングには使わない

このアプリは全ページが静的生成（`next build` で 11 ルートすべて Static）で、データは `public/csv` からブラウザが直接読む。サーバー処理は現状ないので、Vercel の無料枠でそのまま動く。

---

## 1. Vercel で公開する

1. <https://vercel.com/signup> に GitHub アカウントでログイン
2. **Add New… → Project** から `Seigo2058/AppDevProject` を Import
3. 設定はすべて自動検出のままでよい
   - Framework Preset: `Next.js`
   - Build Command: `next build`（既定）
   - Output Directory: 既定のまま
   - Root Directory: `./`
4. **Environment Variables** に Firebase の値を登録（下の「2. Firebase」で取得。まだ無ければ後からでもよい）
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `PUPPETEER_SKIP_DOWNLOAD` = `1`（開発用の `puppeteer` が Chromium をダウンロードしてビルドが遅くなるのを防ぐ）
5. **Deploy** を押す。数分で `https://<プロジェクト名>.vercel.app` が発行される

以降は `main` に push（PR をマージ）するたびに自動で本番デプロイされる。

## 2. Firebase をバックエンドとして用意する

1. <https://console.firebase.google.com/> で **プロジェクトを追加**
2. プロジェクト内で **ウェブアプリ（`</>` アイコン）を追加**。「Firebase Hosting も設定する」のチェックは不要
3. 表示された `firebaseConfig` の値を、Vercel の環境変数（上記）と、ローカル用の `.env.local` に転記する
   ```bash
   cp .env.example .env.local
   # .env.local に値を貼り付ける
   ```
4. 使う機能を有効化する
   - **Firestore Database**: 「データベースの作成」→ ロケーション `asia-northeast1`（東京）→ **本番環境モード**で開始
   - **Authentication**: ログイン機能を使う場合のみ有効化
5. Firestore のセキュリティルールを設定する（本番モードは既定で全拒否なので、使う前に必ず設定が必要）

### 補足: API キーの扱い

`NEXT_PUBLIC_FIREBASE_API_KEY` はブラウザに露出するが、Firebase の Web API キーは「どのプロジェクトかを示す識別子」であり秘密情報ではない。アクセス制御は Firestore のセキュリティルールで行う。**サービスアカウントの秘密鍵（JSON）は絶対にリポジトリや `NEXT_PUBLIC_` 変数に入れない。**

### 現状のコードとの関係

`src/lib/firebase.ts` に初期化処理だけを用意してある（環境変数が未設定なら `null` を返すので、設定前でもアプリは動く）。マイルート・登録時刻表は今のところ `localStorage` に保存しており、Firestore はまだ使っていない。端末をまたいでデータを共有したくなった時点で、この初期化を使って移行する。

## 3. ローカルでの動作確認

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 本番と同じビルドを再現
```

## 4. 運用の流れ

```bash
git switch -c feat/xxx     # 作業ブランチを切る
# 変更 → コミット
git push -u origin feat/xxx
gh pr create --base main   # PR を作成（Vercel がプレビュー URL をコメントする）
# レビュー後 main にマージ → 本番へ自動デプロイ
```
