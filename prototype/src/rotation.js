// 言い回しローテーション。作品ごとに「最近使っていない候補」を選ぶ。

export const PHRASES = {
  opening: [
    '更新しました。',
    '今週分を公開しました。',
    'お待たせしました。',
    '新しい話ができました。',
    '続きを公開しました。',
    '本日更新です。',
  ],
  closing: [
    '続きはこちらから。',
    '読んでいただけたら嬉しいです。',
    '感想・ブクマが励みになります。',
    '今夜のお供にどうぞ。',
    'よろしければぜひ。',
    '少しずつ進んでいます。',
  ],
  closingReply: [
    '続きはリプ欄から。',
    'リンクはリプ欄に置いています。',
    'URL はリプ欄からどうぞ。',
  ],
};

/**
 * 使用履歴（インデックスの配列、末尾が最新）から、最も長く使っていない候補を返す。
 * 未使用の候補があればそれを優先。同順位はランダム。
 */
export function pickLeastRecent(pool, usage = [], rand = Math.random) {
  if (!pool || pool.length === 0) return -1;
  const lastUsedAt = new Array(pool.length).fill(-1);
  usage.forEach((idx, pos) => {
    if (idx >= 0 && idx < pool.length) lastUsedAt[idx] = pos;
  });
  const min = Math.min(...lastUsedAt);
  const candidates = lastUsedAt
    .map((v, i) => (v === min ? i : -1))
    .filter((i) => i >= 0);
  const choice = candidates[Math.floor(rand() * candidates.length) % candidates.length];
  return choice;
}

/**
 * 次に使う冒頭句・結び句を選び、更新後の state を返す。
 * state = { opening: number[], closing: number[], closingReply: number[] }
 */
export function nextPhrases(state = {}, { rand = Math.random } = {}) {
  const next = {
    opening: [...(state.opening || [])],
    closing: [...(state.closing || [])],
    closingReply: [...(state.closingReply || [])],
  };
  const pick = (key) => {
    const idx = pickLeastRecent(PHRASES[key], next[key], rand);
    next[key].push(idx);
    if (next[key].length > PHRASES[key].length * 2) next[key].shift();
    return PHRASES[key][idx];
  };
  return {
    phrases: {
      opening: pick('opening'),
      closing: pick('closing'),
      closingReply: pick('closingReply'),
    },
    state: next,
  };
}
