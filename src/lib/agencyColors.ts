/**
 * 交通事業者ごとの表示色（コーポレートカラー）。
 * ホームの登録時刻カードの事業者名と、遅延情報モーダルのアイコンで共通に使う。
 */
const AGENCY_COLORS: Record<string, string> = {
  "JR北海道バス": "#142547", // 青（紺）
  "北海道中央バス": "#dc5e5e", // 赤
  "JR北海道": "#78b176", // 緑
  "札幌市営地下鉄": "#000000",
};

// 「JR北海道バス」が「JR北海道」に先にマッチしないよう、長い名前から照合する
const AGENCY_NAMES = Object.keys(AGENCY_COLORS).sort((a, b) => b.length - a.length);

/** 事業者名に対応する色。未知の事業者はブランドの緑にフォールバックする。 */
export function getAgencyColor(agencyName: string): string {
  const matched = AGENCY_NAMES.find(name => agencyName.includes(name));
  return matched ? AGENCY_COLORS[matched] : "#89c986";
}
