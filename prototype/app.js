import { PLATFORMS, PLATFORM_IDS, countFor } from './src/limits.js';
import { composeAll, epLabel } from './src/compose.js';
import { nextPhrases } from './src/rotation.js';
import { guardStatus, findDuplicate, recordSent } from './src/guard.js';
import { intentUrl } from './src/intents.js';
import { renderCard } from './src/card.js';
import { parseNcode, isR18Url, fetchNarouWork } from './src/narou.js';
import { store, newId } from './src/storage.js';

const $ = (id) => document.getElementById(id);
const SITE_LABEL = { narou: '小説家になろう', kakuyomu: 'カクヨム', alphapolis: 'アルファポリス', pixiv: 'pixiv', kindle: 'Kindle', other: '' };

let works = store.loadWorks();
let history = store.loadHistory();
let rotation = store.loadRotation();
let settings = store.loadSettings();
let currentWorkId = '';
let currentPack = null; // { input, posts, phrases }

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function splitTags(s) {
  return String(s || '').split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);
}

// ---------- 作品 ----------
function readWorkForm() {
  return {
    id: currentWorkId || newId(),
    site: $('site').value,
    ncode: $('ncode').value.trim(),
    title: $('title').value.trim(),
    url: $('workUrl').value.trim(),
    writer: $('writer').value.trim(),
    synopsis: $('synopsis').value.trim(),
    tags: {
      x: splitTags($('tagsX').value),
      bluesky: splitTags($('tagsBluesky').value),
      threads: splitTags($('tagsThreads').value),
      misskey: splitTags($('tagsMisskey').value),
      mastodon: splitTags($('tagsMastodon').value),
    },
  };
}

function fillWorkForm(w) {
  $('site').value = w?.site || 'narou';
  $('ncode').value = w?.ncode || '';
  $('title').value = w?.title || '';
  $('workUrl').value = w?.url || '';
  $('writer').value = w?.writer || '';
  $('synopsis').value = w?.synopsis || '';
  $('tagsX').value = (w?.tags?.x || []).join(', ');
  $('tagsBluesky').value = (w?.tags?.bluesky || []).join(', ');
  $('tagsThreads').value = (w?.tags?.threads || []).join(', ');
  $('tagsMisskey').value = (w?.tags?.misskey || []).join(', ');
  $('tagsMastodon').value = (w?.tags?.mastodon || []).join(', ');
  toggleNarouBox();
}

function toggleNarouBox() {
  $('narouBox').classList.toggle('hidden', $('site').value !== 'narou');
}

function refreshWorkSelect() {
  const sel = $('workSelect');
  sel.innerHTML = '<option value="">（新しい作品）</option>';
  for (const w of works) {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.title || '（無題）';
    sel.appendChild(opt);
  }
  sel.value = currentWorkId;
}

function saveWork() {
  const w = readWorkForm();
  if (!w.title) {
    $('workStatus').textContent = '作品タイトルは必須です。';
    return null;
  }
  const idx = works.findIndex((x) => x.id === w.id);
  if (idx >= 0) works[idx] = w;
  else works.push(w);
  currentWorkId = w.id;
  store.saveWorks(works);
  settings = { ...settings, misskeyHost: $('misskeyHost').value.trim() || 'misskey.io', mastodonHost: $('mastodonHost').value.trim() };
  store.saveSettings(settings);
  refreshWorkSelect();
  $('workStatus').textContent = `保存しました：${w.title}`;
  return w;
}

async function fetchNarou() {
  const raw = $('ncode').value;
  const ncode = parseNcode(raw);
  const status = $('narouStatus');
  if (!ncode) {
    status.textContent = 'ncode の形式が違います（例: n1234ab）。';
    return;
  }
  status.textContent = 'なろう小説 API に問い合わせ中…';
  $('fetchNarou').disabled = true;
  try {
    const info = await fetchNarouWork(ncode, { r18: isR18Url(raw) });
    $('title').value = info.title;
    $('writer').value = info.writer;
    $('synopsis').value = info.story;
    $('workUrl').value = `https://${isR18Url(raw) ? 'novel18' : 'ncode'}.syosetu.com/${ncode}/`;
    if (info.epCount && !$('epNo').value) $('epNo').value = String(info.epCount);
    status.textContent = `取得しました（全 ${info.epCount} 話、最終掲載 ${info.lastUp}）。`;
  } catch (e) {
    status.textContent = `取得できませんでした（${e.message}）。手入力で続けてください。`;
  } finally {
    $('fetchNarou').disabled = false;
  }
}

// ---------- 生成 ----------
function readEpisode() {
  return {
    no: Number($('epNo').value) || 0,
    noTo: Number($('epNoTo').value) || 0,
    title: $('epTitle').value.trim(),
    url: $('epUrl').value.trim(),
    hook: $('hook').value.trim(),
    excerpt: $('excerpt').value,
  };
}

function generate() {
  const work = saveWork();
  if (!work) return;
  const ep = readEpisode();
  const kind = $('kind').value;
  const rot = nextPhrases(rotation[work.id] || {});
  rotation = { ...rotation, [work.id]: rot.state };
  store.saveRotation(rotation);
  const input = { kind, work, ep };
  const posts = composeAll(input, rot.phrases);
  currentPack = { input, posts, phrases: rot.phrases };
  renderPosts();
  drawCard();
  $('genStatus').textContent = `生成しました（冒頭句「${rot.phrases.opening}」）。文面は自由に編集できます。`;
}

function hostFor(id) {
  if (id === 'misskey') return settings.misskeyHost || 'misskey.io';
  if (id === 'mastodon') return settings.mastodonHost || '';
  return undefined;
}

function renderPosts() {
  const root = $('posts');
  root.innerHTML = '';
  if (!currentPack) {
    root.innerHTML = '<div class="hint">「告知パックを生成」を押すと、ここに SNS ごとの文面が並びます。</div>';
    return;
  }
  const { input, posts } = currentPack;
  for (const id of PLATFORM_IDS) {
    const p = PLATFORMS[id];
    const post = posts[id];
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.platform = id;

    const head = document.createElement('div');
    head.className = 'head';
    head.innerHTML = `<strong>${p.label}</strong><span class="count" data-role="count"></span>`;
    card.appendChild(head);

    const ta = document.createElement('textarea');
    ta.value = post.body;
    ta.dataset.role = 'body';
    ta.setAttribute('aria-label', `${p.label} 用の本文`);
    card.appendChild(ta);

    if (p.linkMode === 'reply') {
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.innerHTML = '<label>リプ用（本文を投稿したあと、自分の投稿に返信で貼る）</label>';
      const rta = document.createElement('textarea');
      rta.value = post.reply;
      rta.dataset.role = 'reply';
      rta.style.minHeight = '44px';
      sub.appendChild(rta);
      card.appendChild(sub);
    }

    const notice = document.createElement('div');
    notice.dataset.role = 'notice';
    card.appendChild(notice);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const copyBtn = mkBtn('本文をコピー', () => copyText(ta.value));
    const openBtn = mkBtn(`${p.label} で開く`, () => openIntent(id, ta.value));
    openBtn.dataset.role = 'open';
    openBtn.classList.add('primary');
    const sentBtn = mkBtn('投稿した', () => markSent(id, ta.value));
    sentBtn.dataset.role = 'sent';
    actions.append(copyBtn, openBtn, sentBtn);
    if (p.linkMode === 'reply') {
      actions.appendChild(mkBtn('リプ用をコピー', () => copyText(card.querySelector('[data-role="reply"]').value)));
    }
    card.appendChild(actions);

    if (p.note) {
      const note = document.createElement('div');
      note.className = 'hint';
      note.textContent = p.note;
      card.appendChild(note);
    }

    const update = () => {
      const c = countFor(id, ta.value);
      const cnt = card.querySelector('[data-role="count"]');
      cnt.textContent = `${c} / ${p.limit}`;
      cnt.classList.toggle('over', c > p.limit);
      openBtn.disabled = c > p.limit;
      updateNotice(card, id, ta.value, input.work.id);
    };
    ta.addEventListener('input', update);
    update();
    root.appendChild(card);
  }
}

function updateNotice(card, id, text, workId) {
  const p = PLATFORMS[id];
  const el = card.querySelector('[data-role="notice"]');
  const g = guardStatus(history, { workId, platform: id, windowHours: p.guardHours });
  const dup = findDuplicate(history, { platform: id, text });
  const msgs = [];
  if (!g.allowed) msgs.push(`この作品は ${p.label} に ${g.hoursAgo.toFixed(1)} 時間前に告知済みです（推奨 ${p.guardHours} 時間以上あける）。`);
  if (dup) msgs.push('直近 7 日に同じ文面を投稿しています。言い回しを変えるのがおすすめです。');
  if ((id === 'misskey' || id === 'mastodon') && !hostFor(id)) msgs.push('投稿先サーバーが未設定です（作品パネルの「投稿先サーバー」）。');
  el.className = msgs.length ? 'notice warn' : 'notice ok';
  el.textContent = msgs.length ? msgs.join(' ') : '投稿できます。';
}

function mkBtn(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'small';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch {
    toast('コピーできませんでした。手動で選択してください。');
  }
}

function openIntent(id, text) {
  const url = intentUrl(id, text, { host: hostFor(id) });
  if (!url) {
    toast('投稿先サーバーを設定してください');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function markSent(id, text) {
  if (!currentPack) return;
  const { input } = currentPack;
  history = recordSent(history, {
    workId: input.work.id,
    workTitle: input.work.title,
    platform: id,
    kind: input.kind,
    epLabel: epLabel(input.ep),
    text,
  });
  store.saveHistory(history);
  renderHistory();
  renderPosts();
  toast(`${PLATFORMS[id].label} に投稿済みとして記録しました`);
}

function renderHistory() {
  const ul = $('history');
  ul.innerHTML = '';
  const items = [...history].reverse().slice(0, 30);
  if (!items.length) {
    ul.innerHTML = '<li class="hint">まだ履歴はありません。</li>';
    return;
  }
  for (const h of items) {
    const li = document.createElement('li');
    const when = new Date(h.sentAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span class="when">${when}</span><span>${PLATFORMS[h.platform]?.label || h.platform}｜${h.workTitle || ''} ${h.epLabel || ''}</span>`;
    ul.appendChild(li);
  }
}

// ---------- 画像 ----------
function drawCard() {
  const canvas = $('card');
  const work = currentPack?.input.work || readWorkForm();
  const ep = currentPack?.input.ep || readEpisode();
  const res = renderCard(canvas, {
    template: $('tpl').value,
    size: $('size').value,
    theme: $('theme').value,
    title: work.title,
    writer: work.writer,
    epLabel: epLabel(ep),
    excerpt: ep.excerpt || $('excerpt').value,
    hook: ep.hook,
    site: SITE_LABEL[work.site] || '',
  });
  $('cardStatus').textContent = res.truncated ? '抜粋が長いため末尾を省略しました。' : '';
}

function downloadPng() {
  const canvas = $('card');
  const a = document.createElement('a');
  a.download = `promo-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function copyPng() {
  const canvas = $('card');
  canvas.toBlob(async (blob) => {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('画像をコピーしました');
    } catch {
      toast('この環境では画像コピーが使えないため、PNG を保存します');
      downloadPng();
    }
  }, 'image/png');
}

// ---------- インポート／エクスポート ----------
function exportJson() {
  const data = store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `promotion-assist-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importAll(JSON.parse(String(reader.result)));
      works = store.loadWorks();
      history = store.loadHistory();
      rotation = store.loadRotation();
      settings = store.loadSettings();
      currentWorkId = '';
      refreshWorkSelect();
      fillWorkForm(null);
      renderHistory();
      toast('読み込みました');
    } catch (e) {
      toast(`読み込めませんでした：${e.message}`);
    }
  };
  reader.readAsText(file);
}

// ---------- 初期化 ----------
function init() {
  $('misskeyHost').value = settings.misskeyHost || 'misskey.io';
  $('mastodonHost').value = settings.mastodonHost || '';
  refreshWorkSelect();
  fillWorkForm(null);
  renderHistory();
  renderPosts();
  drawCard();

  $('site').addEventListener('change', toggleNarouBox);
  $('workSelect').addEventListener('change', (e) => {
    currentWorkId = e.target.value;
    fillWorkForm(works.find((w) => w.id === currentWorkId) || null);
    $('workStatus').textContent = '';
  });
  $('deleteWork').addEventListener('click', () => {
    if (!currentWorkId) return;
    works = works.filter((w) => w.id !== currentWorkId);
    store.saveWorks(works);
    currentWorkId = '';
    refreshWorkSelect();
    fillWorkForm(null);
    toast('作品を削除しました');
  });
  $('saveWork').addEventListener('click', saveWork);
  $('fetchNarou').addEventListener('click', fetchNarou);
  $('generate').addEventListener('click', generate);
  for (const id of ['tpl', 'size', 'theme']) $(id).addEventListener('change', drawCard);
  $('excerpt').addEventListener('input', () => { if (!currentPack) drawCard(); });
  $('downloadPng').addEventListener('click', downloadPng);
  $('copyPng').addEventListener('click', copyPng);
  $('exportJson').addEventListener('click', exportJson);
  $('importBtn').addEventListener('click', () => $('importJson').click());
  $('importJson').addEventListener('change', (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
}

init();
