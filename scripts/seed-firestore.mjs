/**
 * data/csv の内容を Firestore に投入するスクリプト。
 *
 *   node scripts/seed-firestore.mjs            … 投入する
 *   node scripts/seed-firestore.mjs --dry-run  … 投入せず、作られるドキュメントの内容だけ表示する
 *
 * 事前準備（詳細は docs/DEPLOY.md）:
 *   1. Firebase コンソール → プロジェクトの設定 → サービス アカウント → 「新しい秘密鍵の生成」
 *   2. ダウンロードした JSON をリポジトリ直下に serviceAccountKey.json として置く（.gitignore 済み）
 *
 * 作られるデータ:
 *   timetables/{route_id}  … 路線の属性＋停車順＋発車時刻表を1ドキュメントに統合
 *   schoolPeriods/{時限}    … 授業の時限
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvDir = join(projectRoot, "data", "csv");
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT ?? join(projectRoot, "serviceAccountKey.json");
const dryRun = process.argv.includes("--dry-run");

/** ダブルクォートを考慮した最小限のCSVパーサー（src/lib/timetableData.ts と同じ挙動）。 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function readCsv(fileName) {
  const path = join(csvDir, fileName);
  if (!existsSync(path)) return null;
  return parseCSV(readFileSync(path, "utf8"));
}

function buildTimetableDocs() {
  const listRows = readCsv("timetable_list.csv");
  if (!listRows) throw new Error("data/csv/timetable_list.csv が見つかりません");
  const stopsRows = readCsv("route_stops_list.csv");
  if (!stopsRows) throw new Error("data/csv/route_stops_list.csv が見つかりません");

  // route_id → 停車順
  const stopsByRouteId = new Map();
  for (const row of stopsRows.slice(1)) {
    if (row.length < 4) continue;
    stopsByRouteId.set(
      row[0],
      row.slice(3).map((s) => s.trim()).filter((s) => s !== "")
    );
  }

  const docs = [];
  const warnings = [];

  // Header: route_id,交通機関種別,事業者名,路線名,方面,曜日,対応するcsv
  for (const row of listRows.slice(1)) {
    if (row.length < 7) continue;
    const [routeId, transportType, agencyName, routeName, direction, dayType, csvFileName] = row;

    const stops = stopsByRouteId.get(routeId);
    if (!stops) warnings.push(`${routeId}: route_stops_list.csv に停車順がありません`);

    const timetableRows = readCsv(csvFileName);
    if (!timetableRows || timetableRows.length === 0) {
      warnings.push(`${routeId}: 時刻表CSV「${csvFileName}」を読めませんでした（列なしで登録します）`);
    }

    const columns = timetableRows ? timetableRows[0] : [];
    if (new Set(columns).size !== columns.length) {
      warnings.push(`${routeId}: ${csvFileName} に同名の列があり、時刻が失われます`);
    }

    // 1便＝1マップ。列名をキーにするので "札幌着" / "札幌発" の区別もそのまま残る。
    // 空欄はキーごと省略し、読み出し側で "" に戻す。
    const departures = (timetableRows ?? []).slice(1).map((dataRow) => {
      const entry = {};
      columns.forEach((col, i) => {
        const value = (dataRow[i] ?? "").trim();
        if (value !== "") entry[col] = value;
      });
      return entry;
    });

    docs.push({
      id: routeId,
      data: {
        transportType,
        agencyName,
        routeName,
        direction,
        dayType,
        stops: stops ?? [],
        columns,
        departures,
      },
    });
  }

  return { docs, warnings };
}

function buildClassPeriodDocs() {
  const rows = readCsv("school_timetable.csv");
  if (!rows) throw new Error("data/csv/school_timetable.csv が見つかりません");

  // Header: 時間目,開始時刻,終了時刻
  return rows
    .slice(1)
    .filter((row) => row.length >= 3 && Number.isFinite(Number(row[0])))
    .map((row) => ({
      id: String(Number(row[0])),
      data: { period: Number(row[0]), startTime: row[1], endTime: row[2] },
    }));
}

async function main() {
  const { docs: timetableDocs, warnings } = buildTimetableDocs();
  const periodDocs = buildClassPeriodDocs();

  for (const warning of warnings) console.warn(`⚠️  ${warning}`);

  console.log(`timetables: ${timetableDocs.length} 件, schoolPeriods: ${periodDocs.length} 件`);
  for (const doc of timetableDocs) {
    console.log(
      `  timetables/${doc.id}  ${doc.data.routeName} ${doc.data.direction} ${doc.data.dayType}` +
        ` — 停留所 ${doc.data.stops.length} / 列 ${doc.data.columns.length} / 便 ${doc.data.departures.length}`
    );
  }

  if (dryRun) {
    console.log("\n--dry-run のため書き込みは行いませんでした。");
    console.log("先頭ドキュメントの内容:");
    console.log(JSON.stringify(timetableDocs[0], null, 2).slice(0, 1200));
    return;
  }

  if (!existsSync(keyPath)) {
    throw new Error(
      `サービスアカウントの鍵が見つかりません: ${keyPath}\n` +
        "Firebase コンソール → プロジェクトの設定 → サービス アカウント から生成して配置してください。"
    );
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  if (!serviceAccount.project_id) {
    throw new Error(
      `${keyPath} に project_id がありません。Firebase コンソールの「サービス アカウント」から生成した鍵か確認してください。`
    );
  }

  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  console.log(`\nプロジェクト ${serviceAccount.project_id} に書き込みます...`);
  const db = getFirestore();

  const batch = db.batch();
  for (const doc of timetableDocs) batch.set(db.collection("timetables").doc(doc.id), doc.data);
  for (const doc of periodDocs) batch.set(db.collection("schoolPeriods").doc(doc.id), doc.data);
  await batch.commit();

  console.log("\n✅ Firestore への投入が完了しました。");
}

main().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
});
