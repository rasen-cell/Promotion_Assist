// Canvas による宣伝画像の描画。縦書き冒頭カードと話数バナー。
// 外部ライブラリ・サーバーに依存しない。

export const THEMES = {
  paper: { id: 'paper', label: '和紙', bg1: '#f7f2e8', bg2: '#efe6d6', fg: '#2b2723', sub: '#6b6158', accent: '#8a5a2b', rule: 'rgba(43,39,35,0.18)' },
  night: { id: 'night', label: '夜', bg1: '#161a2b', bg2: '#0f1220', fg: '#eef0f7', sub: '#a9afc4', accent: '#7aa2ff', rule: 'rgba(238,240,247,0.18)' },
  sakura: { id: 'sakura', label: '桜', bg1: '#fff5f7', bg2: '#fbe4ea', fg: '#3a2a2e', sub: '#7c626a', accent: '#d46a8a', rule: 'rgba(58,42,46,0.18)' },
};

export const SIZES = {
  card: { id: 'card', label: '1200×630（リンクカード）', w: 1200, h: 630 },
  portrait: { id: 'portrait', label: '1080×1350（4:5）', w: 1080, h: 1350 },
};

export const FONT_STACK = '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho","BIZ UDMincho","IPAMincho","IPAGothic","Noto Sans JP",serif';

const ROTATE_RE = /[ー―‐−–—〜～…‥（）()［］\[\]｛｝{}「」『』【】〔〕《》〈〉＜＞<>＝=→←A-Za-z0-9ａ-ｚＡ-Ｚ０-９:：;；]/;
const PUNCT_RE = /[、。，．,.]/;
const SMALL_KANA_RE = /[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;

function graphemes(text) {
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      return Array.from(seg.segment(String(text)), (s) => s.segment);
    }
  } catch {
    /* fall through */
  }
  return Array.from(String(text));
}

/**
 * 縦書きでテキストを描く。右端 x から左へ列を進める。
 * 戻り値: { columns, truncated, lastX }
 */
export function drawVerticalText(ctx, text, opts) {
  const {
    x, top, bottom, fontSize, color, font = FONT_STACK, weight = 'normal',
    columnGap = 1.75, lineHeight = 1.12, maxColumns = Infinity, minX = -Infinity, ellipsis = true,
  } = opts;
  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const step = fontSize * lineHeight;
  const perColumn = Math.max(1, Math.floor((bottom - top) / step));
  const colStep = fontSize * columnGap;

  // 段落（改行）ごとに列を分ける
  const paragraphs = String(text).replace(/\r/g, '').split('\n');
  const cells = [];
  for (const para of paragraphs) {
    const gs = graphemes(para);
    if (gs.length === 0) {
      cells.push([]);
      continue;
    }
    for (let i = 0; i < gs.length; i += perColumn) cells.push(gs.slice(i, i + perColumn));
  }

  const available = Math.min(maxColumns, Math.floor((x - minX) / colStep) + 1);
  let truncated = false;
  let columns = cells;
  if (cells.length > available) {
    truncated = true;
    columns = cells.slice(0, Math.max(0, available));
    if (ellipsis && columns.length) {
      const last = columns[columns.length - 1];
      if (last.length >= perColumn) last[perColumn - 1] = '…';
      else last.push('…');
    }
  }

  let cx = x;
  for (const col of columns) {
    let cy = top + step / 2;
    for (const g of col) {
      if (ROTATE_RE.test(g)) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(g, 0, 0);
        ctx.restore();
      } else if (PUNCT_RE.test(g)) {
        ctx.fillText(g, cx + fontSize * 0.32, cy - fontSize * 0.32);
      } else if (SMALL_KANA_RE.test(g)) {
        ctx.fillText(g, cx + fontSize * 0.1, cy - fontSize * 0.08);
      } else {
        ctx.fillText(g, cx, cy);
      }
      cy += step;
    }
    cx -= colStep;
  }
  ctx.restore();
  return { columns: columns.length, truncated, lastX: cx + colStep };
}

function paintBackground(ctx, w, h, theme) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, theme.bg1);
  g.addColorStop(1, theme.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.rule;
  ctx.lineWidth = 2;
  const m = Math.round(Math.min(w, h) * 0.035);
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
}

function drawHorizontal(ctx, text, x, y, { size, color, weight = 'normal', align = 'left', maxWidth }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (maxWidth) ctx.fillText(text, x, y, maxWidth);
  else ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * spec = { template: 'excerpt'|'banner', size: 'card'|'portrait', theme: 'paper'|..,
 *          title, writer, epLabel, excerpt, site, hook }
 */
export function renderCard(canvas, spec) {
  const size = SIZES[spec.size] || SIZES.card;
  const theme = THEMES[spec.theme] || THEMES.paper;
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { w, h } = size;
  paintBackground(ctx, w, h, theme);

  const title = spec.title || '（無題）';
  const writer = spec.writer ? `${spec.writer}` : '';
  const epLabel = spec.epLabel || '';
  const site = spec.site || '';

  if (spec.template === 'banner') {
    const pad = Math.round(w * 0.07);
    const titleSize = Math.round(Math.min(w, h) * (size.id === 'portrait' ? 0.075 : 0.105));
    drawHorizontal(ctx, title, pad, h * 0.42, { size: titleSize, color: theme.fg, weight: 'bold', maxWidth: w - pad * 2 });
    if (epLabel) drawHorizontal(ctx, epLabel, pad, h * 0.42 + titleSize * 1.15, { size: Math.round(titleSize * 0.55), color: theme.accent, weight: 'bold' });
    if (spec.hook) drawHorizontal(ctx, spec.hook, pad, h * 0.42 + titleSize * 2.0, { size: Math.round(titleSize * 0.42), color: theme.sub, maxWidth: w - pad * 2 });
    const foot = [writer, site].filter(Boolean).join('　');
    if (foot) drawHorizontal(ctx, foot, w - pad, h - pad * 0.9, { size: Math.round(titleSize * 0.38), color: theme.sub, align: 'right' });
    return { template: 'banner', truncated: false };
  }

  // 縦書き冒頭カード
  const pad = Math.round(Math.min(w, h) * 0.085);
  const excerpt = (spec.excerpt || '').trim() || '（冒頭抜粋を入力すると、ここに縦書きで表示されます）';
  let result;
  if (size.id === 'portrait') {
    const fs = 34;
    const top = pad;
    const bottom = Math.round(h * 0.66);
    result = drawVerticalText(ctx, excerpt, { x: w - pad - fs / 2, top, bottom, fontSize: fs, color: theme.fg, minX: pad + fs / 2 });
    ctx.strokeStyle = theme.rule;
    ctx.beginPath();
    ctx.moveTo(pad, h * 0.70);
    ctx.lineTo(w - pad, h * 0.70);
    ctx.stroke();
    const titleSize = 52;
    drawHorizontal(ctx, title, pad, h * 0.70 + titleSize * 1.3, { size: titleSize, color: theme.fg, weight: 'bold', maxWidth: w - pad * 2 });
    if (epLabel) drawHorizontal(ctx, epLabel, pad, h * 0.70 + titleSize * 2.3, { size: 34, color: theme.accent, weight: 'bold' });
    const foot = [writer, site].filter(Boolean).join('　');
    if (foot) drawHorizontal(ctx, foot, w - pad, h - pad * 0.8, { size: 26, color: theme.sub, align: 'right' });
  } else {
    const fs = 30;
    const divider = Math.round(w * 0.40);
    result = drawVerticalText(ctx, excerpt, { x: w - pad - fs / 2, top: pad, bottom: h - pad, fontSize: fs, color: theme.fg, minX: divider + pad * 0.6 });
    ctx.strokeStyle = theme.rule;
    ctx.beginPath();
    ctx.moveTo(divider, pad * 0.9);
    ctx.lineTo(divider, h - pad * 0.9);
    ctx.stroke();
    const titleSize = 44;
    const t = drawVerticalText(ctx, title, { x: divider - pad * 0.9 - titleSize / 2, top: pad, bottom: h - pad * 2.4, fontSize: titleSize, color: theme.fg, weight: 'bold', maxColumns: 2, minX: pad * 2 });
    if (writer) drawVerticalText(ctx, writer, { x: t.lastX - titleSize * 1.25, top: pad + 8, bottom: h - pad * 2.4, fontSize: 24, color: theme.sub, maxColumns: 1, minX: pad });
    if (epLabel) drawHorizontal(ctx, epLabel, pad, h - pad - 30, { size: 30, color: theme.accent, weight: 'bold' });
    if (site) drawHorizontal(ctx, site, pad, h - pad + 4, { size: 20, color: theme.sub });
  }
  return { template: 'excerpt', truncated: !!result?.truncated };
}
