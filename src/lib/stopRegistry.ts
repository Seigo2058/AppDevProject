// 自前CSV路線網の停留所名と、TransitAPI(OSMベース)上の対応地点との対応表。
// CSVの停留所をTransitAPIの「拡張路線」として扱うための土台情報。ここに座標/地点IDが
// 登録されている停留所だけが、TransitAPI区間との複合乗換(乗換候補地点)の対象になる。

// 停留所名の表記ゆれ（JR「野幌駅」とバス「野幌駅北口/南口」など、同一駅の異なる出入口・
// 異なるCSV上の呼び方）を吸収し、同じ地点として乗換検索できるようにする。
// 「厚別駅」(JR)と「厚別中央2条6丁目」(バス)のように、名前は似ていても実際には
// 離れた別地点のものは正規化後も別の文字列になるため誤って統合されない。
export function canonicalStopName(name: string): string {
  const stripped = name
    .replace(/\([^)]*\)/g, "")
    .replace(/(北口|南口|東口|西口)$/, "")
    .trim();

  // 表記ゆれ吸収辞書: TransitAPI/ユーザー入力の通称 → CSV上の正式名
  const ALIASES: Record<string, string> = {
    "新さっぽろ": "新札幌駅",
    "新さっぽろ駅": "新札幌駅",
    "新札幌": "新札幌駅",
    "おおあさ": "大麻駅",
    "大麻": "大麻駅",
  };
  return ALIASES[stripped] ?? stripped;
}

export const CAMPUS_CANONICAL_STOPS = new Set(["情報大学前", "eDCタワー前", "EDCタワー前"]);

export interface StopEndpoint {
  id: string;
  name: string;
}

// TransitAPIの https://api.transit.ls8h.com/api/v1/places/suggest?q=<停留所名> を
// 停留所ごとに照会し、江別・札幌近郊(lat 43.0〜43.1 / lon 141.3〜141.6)の駅・停留所を
// 優先して一意に解決した結果をハードコードしたもの（例: 「大麻駅」は同名の埼玉県「大麻生」が
// 上位にヒットするため地域フィルタが必要だった）。
// 新しいCSV路線の追加等で未登録の停留所名が増えた場合は、ここにエントリを追加するか、
// nullのままにしておけばその停留所はハイブリッド乗換候補から自動的に除外される。
const STOP_COORDINATES: Record<string, StopEndpoint | null> = {
  "野幌駅": { id: "geo:43.092349,141.529690", name: "野幌" },
  "大麻駅": { id: "geo:43.072335,141.497020", name: "大麻" },
  "新札幌駅": { id: "geo:43.038853,141.472170", name: "新札幌駅" },
  "厚別駅": { id: "geo:43.045042,141.462918", name: "厚別" },
  "札幌駅": { id: "geo:43.068767,141.350902", name: "札幌駅" },
  "若葉1丁目": { id: "jp-yutetsu-bus:S018100010700100", name: "若葉１丁目" },
  "厚別中央2条6丁目": { id: "jp-yutetsu-bus:S018100008000200", name: "厚別中央２条６丁目" },
  // 函館本線の拡張区間（岩見沢〜札幌）で新たに追加した駅
  "岩見沢駅": { id: "geo:43.204025,141.759745", name: "岩見沢駅" },
  "豊幌駅": { id: "geo:43.136023,141.623953", name: "豊幌" },
  "江別駅": { id: "geo:43.110887,141.557068", name: "江別駅" },
  "高砂駅": { id: "geo:43.100152,141.540788", name: "高砂" },
  "森林公園駅": { id: "geo:43.056462,141.481287", name: "森林公園駅" },
  "白石駅": { id: "geo:43.054852,141.413818", name: "白石" },
  "苗穂駅": { id: "geo:43.068532,141.373756", name: "苗穂" },
  "情報大学前": { id: "geo:43.077892,141.536019", name: "北海道情報大学" },
  "eDCタワー前": { id: "geo:43.077892,141.536019", name: "北海道情報大学" },
  "EDCタワー前": { id: "geo:43.077892,141.536019", name: "北海道情報大学" },
};

export function resolveStopEndpoint(canonicalName: string): StopEndpoint | null {
  return STOP_COORDINATES[canonicalName] ?? null;
}

// STOP_COORDINATESに登録済みの地点ID(TransitAPIのendpoint)からCSV停留所名への逆引き。
// 検索候補の中からCSV路線網の駅と同一の地点を、名前の表記ゆれ（全角/半角・「駅」の
// 有無等）に左右されずに厳密に判定するために使う。
const ENDPOINT_TO_STOP_NAME = new Map<string, string>(
  Object.entries(STOP_COORDINATES)
    .filter((entry): entry is [string, StopEndpoint] => entry[1] !== null)
    .map(([name, endpoint]) => [endpoint.id, name])
);

// 与えられたTransitAPIの地点ID(endpoint)が、CSV路線網に登録済みの停留所と同一地点かどうかを
// 判定する。一致すればそのCSV停留所の正規化名を返す。
export function findCsvStopNameByEndpoint(endpointId: string | undefined): string | null {
  if (!endpointId) return null;
  return ENDPOINT_TO_STOP_NAME.get(endpointId) ?? null;
}

// キャンパス自身を除いた、TransitAPI区間とCSV区間を組み合わせるハイブリッド乗換の
// 候補となり得るCSV停留所名の一覧（座標/地点IDが登録済みのもののみ）。
export function getHybridTransferCandidates(): string[] {
  return Object.keys(STOP_COORDINATES).filter(
    (name) => !CAMPUS_CANONICAL_STOPS.has(name) && STOP_COORDINATES[name] !== null
  );
}
