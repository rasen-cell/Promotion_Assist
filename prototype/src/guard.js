// 告知間隔ガードと重複文面チェック。履歴は { workId, platform, text, sentAt(ms) } の配列。

export function guardStatus(history, { workId, platform, now = Date.now(), windowHours = 24 }) {
  const times = (history || [])
    .filter((h) => h.workId === workId && h.platform === platform && typeof h.sentAt === 'number')
    .map((h) => h.sentAt);
  if (times.length === 0) return { allowed: true, lastSentAt: null, hoursAgo: null, windowHours };
  const last = Math.max(...times);
  const hoursAgo = (now - last) / 36e5;
  return { allowed: hoursAgo >= windowHours, lastSentAt: last, hoursAgo, windowHours };
}

export function normalizeText(text) {
  return String(text || '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function findDuplicate(history, { platform, text, days = 7, now = Date.now() }) {
  const target = normalizeText(text);
  if (!target) return null;
  const since = now - days * 864e5;
  return (
    (history || []).find(
      (h) => h.platform === platform && h.sentAt >= since && normalizeText(h.text) === target,
    ) || null
  );
}

export function recordSent(history, entry, { now = Date.now(), max = 500 } = {}) {
  const next = [...(history || []), { ...entry, sentAt: entry.sentAt ?? now }];
  return next.length > max ? next.slice(next.length - max) : next;
}
