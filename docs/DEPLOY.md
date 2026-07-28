# デプロイ手順（GitHub → Vercel ＋ Firebase）

構成は次のとおり。

- **GitHub**: `Seigo2058/AppDevProject`（`main` が本番ブランチ）
- **Vercel**: アプリ本体のホスティング。`main` への push で自動デプロイ、PR ごとにプレビュー環境が作られる
- **Firebase**: バックエンド（Firestore）。時刻表・停留所・時限データの置き場。ホスティングには使わない

このアプリは全ページが静的生成（`next build` で 11 ルートすべて Static）で、データはブラウザから Firestore を直接読む。サーバー処理は現状ないので、Vercel の無料枠でそのまま動く。

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
4. **Firestore Database** を作成する: 「データベースの作成」→ ロケーション `asia-northeast1`（東京）→ **本番環境モード**で開始
5. セキュリティルールを設定する。リポジトリの `firestore.rules`（読み取りのみ許可・書き込み禁止）の内容を、コンソールの「ルール」タブに貼り付けて公開する
6. 次の「3. 時刻表データを Firestore に投入する」を実行する

> **重要**: このアプリは時刻表データを Firestore からのみ読む。投入が済むまで路線・時刻表・時間割の画面にはデータが出ない（画面は落ちず、空表示になる）。

### 補足: API キーの扱い

`NEXT_PUBLIC_FIREBASE_API_KEY` はブラウザに露出するが、Firebase の Web API キーは「どのプロジェクトかを示す識別子」であり秘密情報ではない。アクセス制御は Firestore のセキュリティルールで行う。**サービスアカウントの秘密鍵（JSON）は絶対にリポジトリや `NEXT_PUBLIC_` 変数に入れない。**

## 3. 時刻表データを Firestore に投入する

`public/csv` の CSV が投入元、Firestore がアプリの唯一のデータソース。CSV を更新したら投入し直す。

1. Firebase コンソール → **プロジェクトの設定 → サービス アカウント → 「新しい秘密鍵の生成」**
2. ダウンロードした JSON をリポジトリ直下に `serviceAccountKey.json` として置く（`.gitignore` 済み）
3. 実行する
   ```bash
   npm run seed -- --dry-run   # 何が作られるか確認するだけ（書き込みなし）
   npm run seed                # Firestore へ投入
   ```

### 保存されるデータ構造

```
timetables/{route_id}           … 18 件（路線×方面×曜日）
  transportType, agencyName, routeName, direction, dayType
  stops:      ["情報大学前", "野幌駅北口"]          … 停車順
  columns:    ["情報大学前", "野幌駅北口"]          … 時刻表の列名（JRは "札幌着"/"札幌発"）
  departures: [{ "情報大学前": "7:45", "野幌駅北口": "7:54" }, …]   … 1便＝1要素

schoolPeriods/{時限}             … 6 件
  period, startTime, endTime
```

`timetable_list.csv`・`route_stops_list.csv`・各時刻表 CSV を route_id 単位で 1 ドキュメントに統合している。アプリは起動後 1 回だけ `timetables` を丸ごと読み、以降はメモリにキャッシュする（`src/lib/firestoreData.ts`）。最大のドキュメントでも約 27 KB で、Firestore の 1 MB 制限に対して十分小さい。

### 現状のコードとの関係

時刻表・停留所・時限は Firestore から読む。マイルートと登録時刻表（お気に入り）は引き続き `localStorage` 保存で、端末をまたいだ共有が必要になった時点で Firestore へ移行する。

## 4. ローカルでの動作確認

```bash
npm install
cp .env.example .env.local   # Firebase の設定値を入れる（未設定だとデータが空になる）
npm run dev     # http://localhost:3000
npm run build   # 本番と同じビルドを再現
```

## 5. 運用の流れ

```bash
git switch -c feat/xxx     # 作業ブランチを切る
# 変更 → コミット
git push -u origin feat/xxx
gh pr create --base main   # PR を作成（Vercel がプレビュー URL をコメントする）
# レビュー後 main にマージ → 本番へ自動デプロイ
```
