// SNS ごとの上限・計測方式・共有インテント URL の定義。
// 仕様変更があった場合はこのファイルだけを直す。

export const PLATFORMS = {
  x: {
    id: 'x',
    label: 'X',
    limit: 280,           // 加重カウント（全角 2、半角 1、URL 23）
    counter: 'x',
    linkMode: 'reply',    // 本文に URL を置かず、リプ用テキストを別生成
    maxTags: 3,
    guardHours: 12,
    intent: { base: 'https://x.com/intent/post', param: 'text' },
    note: '外部リンク付き投稿はリーチが下がるため、URL はリプ欄に。画像はインテントで添付できないので手で貼る。',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    limit: 300,           // 書記素クラスタ
    counter: 'grapheme',
    linkMode: 'body',
    maxTags: 3,
    guardHours: 24,
    intent: { base: 'https://bsky.app/intent/compose', param: 'text' },
    note: 'URL を本文末尾に置くとコンポーザーでリンクカードを付けられる。',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    limit: 500,
    counter: 'codepoint',
    linkMode: 'body',
    maxTags: 1,           // Threads はタグ 1 個運用が一般的
    guardHours: 24,
    intent: { base: 'https://www.threads.net/intent/post', param: 'text' },
    note: '画像には説明テキストを添える。1 日 1 投稿が推奨。',
  },
  misskey: {
    id: 'misskey',
    label: 'Misskey',
    limit: 3000,          // サーバー設定に依存（misskey.io は 3,000）
    counter: 'codepoint',
    linkMode: 'body',
    maxTags: 3,
    guardHours: 24,
    hostRequired: true,
    defaultHost: 'misskey.io',
    intent: { path: '/share', param: 'text' },
    note: 'サーバーごとに上限が違う。R18 は CW を付ける。',
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    limit: 500,           // URL は 23 文字換算
    counter: 'mastodon',
    linkMode: 'body',
    maxTags: 3,
    guardHours: 24,
    hostRequired: true,
    defaultHost: 'mastodon.social',
    intent: { path: '/share', param: 'text' },
    note: '',
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS);

const URL_RE = /https?:\/\/[^\s]+/g;

function isLightCodePoint(cp) {
  return (
    cp <= 0x10ff ||
    (cp >= 0x2000 && cp <= 0x200d) ||
    (cp >= 0x2010 && cp <= 0x201f) ||
    (cp >= 0x2032 && cp <= 0x2037)
  );
}

/** X の加重カウント。URL は 23、全角・絵文字は 2、それ以外は 1。 */
export function xWeightedLength(text) {
  let total = 0;
  const rest = String(text).replace(URL_RE, () => {
    total += 23;
    return '';
  });
  for (const ch of rest) {
    total += isLightCodePoint(ch.codePointAt(0)) ? 1 : 2;
  }
  return total;
}

let segmenter = null;
function getSegmenter() {
  if (segmenter !== null) return segmenter;
  try {
    segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
      : false;
  } catch {
    segmenter = false;
  }
  return segmenter;
}

/** 書記素クラスタ数（Bluesky）。Intl.Segmenter が無ければコードポイント数に退避。 */
export function graphemeLength(text) {
  const seg = getSegmenter();
  if (!seg) return codepointLength(text);
  let n = 0;
  for (const _ of seg.segment(String(text))) n += 1;
  return n;
}

export function codepointLength(text) {
  return Array.from(String(text)).length;
}

/** Mastodon：URL は 23 文字換算、その他はコードポイント。 */
export function mastodonLength(text) {
  let total = 0;
  const rest = String(text).replace(URL_RE, () => {
    total += 23;
    return '';
  });
  return total + codepointLength(rest);
}

export function countFor(platformId, text) {
  const p = PLATFORMS[platformId];
  if (!p) throw new Error(`unknown platform: ${platformId}`);
  switch (p.counter) {
    case 'x':
      return xWeightedLength(text);
    case 'grapheme':
      return graphemeLength(text);
    case 'mastodon':
      return mastodonLength(text);
    default:
      return codepointLength(text);
  }
}

/** 書記素単位で先頭 n 個を取り出す（切り詰め用）。 */
export function takeGraphemes(text, n) {
  const seg = getSegmenter();
  if (!seg) return Array.from(String(text)).slice(0, n).join('');
  const out = [];
  for (const s of seg.segment(String(text))) {
    if (out.length >= n) break;
    out.push(s.segment);
  }
  return out.join('');
}
