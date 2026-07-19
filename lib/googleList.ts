// Google Maps「已儲存清單」分享連結解析（伺服器端）。
// 沒有官方 API：跟隨短連結取得清單 token，再打 Maps 內部 entitylist/getlist 端點
// （公開分享的清單不需登入）。回應是 )]}' 前綴的巢狀陣列，欄位位置靠實測確認
// （2026-07-20，見 STATUS）。Google 若改版格式會解析失敗——擲出友善錯誤即可，屬預期風險。

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com',
]);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface GoogleListPlace {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null; // 清單內使用者加的備註
}

export interface GoogleListResult {
  title: string;
  places: GoogleListPlace[];
}

function extractToken(url: string): string | null {
  // 兩種已知格式：/maps/@/data=...!11m2!2s<token>!3e3、/maps/placelists/list/<token>
  const m = url.match(/!2s([A-Za-z0-9_-]{16,})!3e/) ?? url.match(/\/maps\/placelists\/list\/([A-Za-z0-9_-]{16,})/);
  return m?.[1] ?? null;
}

const asArr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const asStr = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const asNum = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export async function fetchGoogleMapsList(shareUrl: string): Promise<GoogleListResult> {
  let parsed: URL;
  try {
    parsed = new URL(shareUrl);
  } catch {
    throw new Error('這不是有效的網址');
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('請貼 Google Maps 的清單分享連結（maps.app.goo.gl/…）');
  }

  // 跟隨短連結重導向，從最終網址取清單 token
  const res = await fetch(parsed.toString(), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW,zh;q=0.9' },
    redirect: 'follow',
  });
  const token = extractToken(res.url) ?? extractToken(shareUrl);
  if (!token) {
    throw new Error('連結裡找不到清單——請確認分享的是「已儲存的清單」而不是單一地點');
  }

  const pb = `!1m4!1s${token}!2e1!3m1!1e1!2e2!3e2!4i500`.replace(/!/g, '%21');
  const listRes = await fetch(
    `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=zh-TW&gl=tw&pb=${pb}`,
    { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW,zh;q=0.9' } }
  );
  if (!listRes.ok) throw new Error(`Google 回應 ${listRes.status}，稍後再試`);
  const raw = await listRes.text();

  try {
    const data: unknown = JSON.parse(raw.replace(/^\)\]\}'\s*/, ''));
    const root = asArr(asArr(data)?.[0]);
    if (!root) throw new Error('empty');
    const title = asStr(root[4]) ?? '未命名清單';
    const rawItems = asArr(root[8]) ?? [];

    const places: GoogleListPlace[] = [];
    for (const rawItem of rawItems) {
      const item = asArr(rawItem);
      if (!item) continue;
      const name = asStr(item[2]);
      if (!name) continue;
      const place = asArr(item[1]);
      const coord = asArr(place?.[5]);
      places.push({
        name,
        address: asStr(place?.[4]),
        lat: asNum(coord?.[2]),
        lng: asNum(coord?.[3]),
        note: asStr(item[3]),
      });
    }
    if (places.length === 0) throw new Error('empty');
    return { title, places };
  } catch {
    throw new Error('無法解析這份清單——可能是空的、未公開分享，或 Google 改了格式');
  }
}
