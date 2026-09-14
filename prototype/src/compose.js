import { PLATFORMS, countFor, graphemeLength, takeGraphemes } from './limits.js';

function epLabel(ep) {
  const from = Number(ep?.no) || 0;
  const to = Number(ep?.noTo) || 0;
  if (!from) return '';
  if (to && to > from) return `第${from}〜${to}話`;
  return `第${from}話`;
}

function mainLine(kind, work, ep) {
  const title = `『${work.title}』`;
  switch (kind) {
    case 'new':
      return `新作${title}を公開しました。`;
    case 'complete':
      return `${title}が完結しました。${ep?.noTo || ep?.no ? `全${ep.noTo || ep.no}話。` : ''}`;
    case 'update':
    default: {
      const label = epLabel(ep);
      const epTitle = ep?.title ? `「${ep.title}」` : '';
      return `${title}${label}${epTitle}を公開しました。`;
    }
  }
}

function formatTags(tags, max) {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .slice(0, max);
}

function assemble(parts) {
  return [parts.opening, parts.main, parts.hook, parts.closing, parts.tags, parts.url]
    .filter((s) => s && String(s).trim())
    .join('\n');
}

export function replyText(work, ep) {
  const url = ep?.url || work?.url || '';
  const label = epLabel(ep) || '作品';
  return `${label}はこちら → ${url}`;
}

/**
 * 1 つの SNS 向けに告知文を組み立てる。
 * input = { kind, work: {title,url,tags:{x:[],...}}, ep: {no,noTo,title,url,hook} }
 * phrases = { opening, closing, closingReply }
 */
export function composeFor(platformId, input, phrases = {}) {
  const p = PLATFORMS[platformId];
  if (!p) throw new Error(`unknown platform: ${platformId}`);
  const work = input.work || {};
  let ep = input.ep || {};
  const kind = input.kind || 'update';
  const url = ep.url || work.url || '';
  const tags = formatTags(work.tags?.[platformId], p.maxTags);
  const closing = p.linkMode === 'reply' ? phrases.closingReply || '' : phrases.closing || '';

  const parts = {
    opening: kind === 'update' ? phrases.opening || '' : '',
    main: mainLine(kind, work, ep),
    hook: String(ep.hook || '').trim(),
    closing,
    tags: tags.join(' '),
    url: p.linkMode === 'body' ? url : '',
  };

  const applied = [];
  const limit = p.limit;
  let text = assemble(parts);
  let count = countFor(platformId, text);

  // 段階的短縮：ひとこと → 結び → 冒頭 → タグ → 話タイトル
  const steps = [
    () => {
      if (!parts.hook) return false;
      const over = count - limit;
      const len = graphemeLength(parts.hook);
      const keep = len - over - 1;
      if (keep < 12) {
        parts.hook = '';
        applied.push('drop-hook');
      } else {
        parts.hook = `${takeGraphemes(parts.hook, keep)}…`;
        applied.push('trim-hook');
      }
      return true;
    },
    () => {
      if (!parts.closing) return false;
      parts.closing = '';
      applied.push('drop-closing');
      return true;
    },
    () => {
      if (!parts.opening) return false;
      parts.opening = '';
      applied.push('drop-opening');
      return true;
    },
    () => {
      if (!tags.length) return false;
      tags.pop();
      parts.tags = tags.join(' ');
      applied.push('trim-tags');
      return true;
    },
    () => {
      if (!ep.title) return false;
      parts.main = mainLine(kind, work, { ...ep, title: '' });
      ep = { ...ep, title: '' };
      applied.push('drop-ep-title');
      return true;
    },
  ];

  let guardCounter = 0;
  while (count > limit && guardCounter < 50) {
    guardCounter += 1;
    let changed = false;
    for (const step of steps) {
      if (step()) {
        changed = true;
        break;
      }
    }
    text = assemble(parts);
    count = countFor(platformId, text);
    if (!changed) break;
  }

  return {
    platform: platformId,
    body: text,
    reply: p.linkMode === 'reply' ? replyText(work, ep) : '',
    count,
    limit,
    ok: count <= limit,
    applied,
  };
}

export function composeAll(input, phrases, platformIds = Object.keys(PLATFORMS)) {
  const out = {};
  for (const id of platformIds) out[id] = composeFor(id, input, phrases);
  return out;
}

export { epLabel, mainLine, formatTags };
