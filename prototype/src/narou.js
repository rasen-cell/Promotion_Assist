// なろう小説 API アダプタ（任意機能・隔離）。利用者の操作でのみ呼ぶ。
// 失敗・タイムアウト時は呼び出し側が手入力にフォールバックする。

export const NAROU_API = 'https://api.syosetu.com/novelapi/api/';
export const NAROU_R18_API = 'https://api.syosetu.com/novel18api/api/';

/** ncode または作品 URL から ncode（小文字）を取り出す。 */
export function parseNcode(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = s.match(/(?:^|\/)(n\d{4}[a-z]{1,2})(?:\/|$|\?|#)/i) || s.match(/^(n\d{4}[a-z]{1,2})$/i);
  return m ? m[1].toLowerCase() : null;
}

export function isR18Url(input) {
  return /novel18\.syosetu\.com/i.test(String(input || ''));
}

export function buildNarouUrl(ncode, { r18 = false, callback = null } = {}) {
  const base = r18 ? NAROU_R18_API : NAROU_API;
  const params = new URLSearchParams({
    out: callback ? 'jsonp' : 'json',
    ncode,
    of: 't-s-w-ga-gl-e-nt-nu',
    lim: '1',
  });
  if (callback) params.set('callback', callback);
  return `${base}?${params.toString()}`;
}

/** API 応答（配列。先頭は allcount）を作品情報に変換。項目が無くても落ちない。 */
export function normalizeNarouResponse(json) {
  if (!Array.isArray(json) || json.length < 2) return null;
  const row = json[1] || {};
  return {
    title: row.title || '',
    story: row.story || '',
    writer: row.writer || '',
    epCount: Number(row.general_all_no) || 0,
    lastUp: row.general_lastup || '',
    end: row.end === 0,               // 0 = 完結済, 1 = 連載中
    noveltype: Number(row.noveltype) || 0, // 1 = 連載, 2 = 短編
    updatedAt: row.novelupdated_at || '',
  };
}

/**
 * ブラウザから JSONP で取得（API は CORS ヘッダを返さない前提）。
 * 8 秒でタイムアウト。
 */
export function fetchNarouWork(ncode, { r18 = false, timeoutMs = 8000, doc = globalThis.document } = {}) {
  return new Promise((resolve, reject) => {
    if (!doc) return reject(new Error('document is not available'));
    const cb = `__narou_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = doc.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      delete globalThis[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    globalThis[cb] = (json) => {
      cleanup();
      const info = normalizeNarouResponse(json);
      if (!info || !info.title) return reject(new Error('not found'));
      resolve(info);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('network error'));
    };
    script.src = buildNarouUrl(ncode, { r18, callback: cb });
    doc.head.appendChild(script);
  });
}
