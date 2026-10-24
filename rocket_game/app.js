import { MISSIONS, missionById, unlockedFor, objectiveText } from './src/missions.js';
import {
  DIAMETERS, DIAMETER_IDS, PROPELLANTS, ENGINES, BOOSTERS, ADAPTERS, WALLS, TANK_BASE, FAIRINGS, LES,
  TANK_LENGTH, FAIRING_LENGTH, G0, maxEngineCount, tankSpec,
} from './src/parts.js';
import { buildVehicle, validateProgram, burnoutTime } from './src/vehicle.js';
import { simulate, GUST_AOA, CN_ALPHA } from './src/sim.js';
import { PLANET } from './src/planet.js';
import { defaultDesign, defaultProgram, defaultStage, syncProgram } from './src/defaults.js';
import { renderRocket, marginClass } from './src/ui-rocket.js';
import { drawTrajectory, drawChart, orbitPoints } from './src/ui-flight.js';
import { store } from './src/storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('ja-JP', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
const t1 = (kg) => fmt(kg / 1000, 1);

const saved = store.load();
const state = {
  stars: saved.stars,
  work: saved.work,
  last: saved.last,
  missionId: '',
  tab: 'design',
  result: null,
  play: null,
};

function persist() { store.save(state); }

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

function missionUnlocked(i) {
  return i === 0 || (state.stars[MISSIONS[i - 1].id] || 0) > 0;
}

function starsHTML(n) {
  return `<span class="stars" aria-label="星 ${n} / 3">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('')}</span>`;
}

function renderMast() {
  const total = MISSIONS.reduce((a, m) => a + (state.stars[m.id] || 0), 0);
  const cleared = MISSIONS.filter((m) => (state.stars[m.id] || 0) > 0).length;
  $('mastStats').innerHTML = `<span>達成 ${cleared}/${MISSIONS.length}</span><span>★ ${total}/${MISSIONS.length * 3}</span>`;
}

// ---------- ミッション一覧 ----------
function renderMissions() {
  $('missionList').innerHTML = MISSIONS.map((m, i) => {
    const open = missionUnlocked(i);
    const s = state.stars[m.id] || 0;
    return `<li><button class="mission-card" type="button" data-mission="${m.id}" ${open ? '' : 'disabled'}>
      <div class="mc-top"><span class="mc-no">MISSION ${String(i + 1).padStart(2, '0')}</span>${starsHTML(s)}</div>
      <h2 class="mc-title">${esc(m.title)}</h2>
      <div class="mc-client">${esc(m.client)}</div>
      <div class="mc-obj">${esc(objectiveText(m))}</div>
      <div class="mc-meta"><span>${esc(m.payload.name)} ${t1(m.payload.mass)} t</span><span>予算 ${m.budget} 億円</span><span>${m.maxStages} 段まで</span></div>
      ${open ? '' : '<div class="mc-client">前のミッションを達成すると受注できます</div>'}
    </button></li>`;
  }).join('');
  renderMast();
}

function renderRules() {
  const gust = (GUST_AOA * 180 / Math.PI).toFixed(0);
  $('rulesBody').innerHTML = `
    <section><h3>舞台</h3><ul>
      <li>惑星ホーム: 半径 ${PLANET.radius / 1000} km、地表重力 ${G0} m/s²、自転なし。</li>
      <li>大気は高度 ${PLANET.atmosphereTop / 1000} km まで（スケールハイト ${PLANET.scaleHeight / 1000} km）。</li>
      <li>低軌道の周回速度は約 2,280 m/s。地上からの必要 Δv は損失込みで 4,000〜4,500 m/s。</li>
    </ul></section>
    <section><h3>機体の組み方</h3><ul>
      <li>段は下から積みます。上段は下段より太くできません。</li>
      <li>エンジンはタンクと同じ推進剤のもの。小さいエンジンは並べられます（S を M に 4 基、L に 9 基、M を L に 2 基）。</li>
      <li>フェアリングは最上段と同じか 1 クラス太いものまで。内径と収容長がペイロード（アダプタ込み）以上必要です。</li>
      <li>固体ブースターは第1段に 2 本か 4 本。第1段タンクはブースター長の 70% 以上必要です。</li>
      <li>費用が予算を超える機体は発注できません。</li>
    </ul></section>
    <section><h3>構造チェック（毎瞬）</h3>
      <p>各部品の下端で、圧縮荷重と曲げモーメントを許容値と比べます。1 つでも超えたら破壊です。</p>
      <p class="formula">圧縮 = 上の質量 × (推力 − 抗力) / 全質量 + 抗力</p>
      <p class="formula">曲げ = 動圧 × ${CN_ALPHA} × (突風 ${gust}° + 迎角) × 最大直径 × 上の長さ² / 2</p>
      <p>細長い機体ほど、太いフェアリングを載せるほど、最大動圧で曲げが厳しくなります。強化肉厚は質量 1.5 倍・強度 1.6 倍です。</p>
    </section>
    <section><h3>ペイロードの条件</h3><ul>
      <li>加速度（重力を除いた体感 G）が許容値を超えると損傷。</li>
      <li>フェアリング分離後、動圧が許容値を超えると空力加熱で損傷。</li>
      <li>フェアリングを分離しないまま終わると失敗（ペイロードが仕事を始められない）。</li>
    </ul></section>
    <section><h3>飛行計画（自動で実行）</h3><ul>
      <li>ピッチ開始高度から終了高度にかけて、鉛直から終了角まで機体を倒します（平方根カーブ）。</li>
      <li>qα 制限: 動圧 × 迎角がこの値を超えないよう、速度方向から外れる角度を抑えます。大きいほど早く倒せますが曲げが増えます。</li>
      <li>段ごとに燃焼時間とスロットル（最大 3 段階）を指定します。燃焼が終わると分離し、慣性飛行の後に次の段が点火します。</li>
      <li>円化噴射: 最上段が再着火できるなら、遠地点の何秒前から何秒燃やすかを指定します。飛行ログに必要 Δv と噴射時間の目安が出ます。</li>
    </ul></section>`;
}

// ---------- 作業画面 ----------
function work() {
  const m = missionById(state.missionId);
  if (!state.work[m.id]) {
    const design = defaultDesign(m);
    state.work[m.id] = { design, program: syncProgram(design, defaultProgram(m)) };
  }
  const w = state.work[m.id];
  syncProgram(w.design, w.program);
  return w;
}

function openMission(id) {
  state.missionId = id;
  state.last = id;
  state.result = null;
  stopPlayback();
  persist();
  $('viewMissions').hidden = true;
  $('viewWork').hidden = false;
  const m = missionById(id);
  $('workClient').textContent = `依頼主: ${m.client}`;
  $('workTitle').textContent = m.title;
  $('workBrief').textContent = m.brief;
  const p = m.payload;
  $('workReq').innerHTML = `
    <dt>目標</dt><dd>${esc(objectiveText(m))}</dd>
    <dt>ペイロード</dt><dd>${esc(p.name)}</dd>
    <dt>質量 / 寸法</dt><dd>${t1(p.mass)} t / ⌀${p.diameter} × ${p.length} m</dd>
    <dt>許容加速度</dt><dd>${p.maxG} G</dd>
    <dt>${p.exposed ? '外装' : '分離後の許容動圧'}</dt><dd>${p.exposed ? '耐熱外装（フェアリング不可）' : `${fmt(p.maxQExposed / 1000, 1)} kPa`}</dd>
    ${p.crew ? `<dt>乗員</dt><dd>${p.crew} 名（脱出塔必須）</dd>` : ''}
    ${p.needsDocking ? '<dt>特記</dt><dd>ドッキング機構付きアダプタ</dd>' : ''}
    <dt>段数 / 予算</dt><dd>${m.maxStages} 段まで / ${m.budget} 億円</dd>
    <dt>★2 / ★3</dt><dd>${m.costTargets[0]} / ${m.costTargets[1]} 億円以下</dd>`;
  renderDesignForm();
  renderPlanForm();
  renderCatalog();
  setTab('design');
  refresh();
  window.scrollTo(0, 0);
}

function showMissions() {
  stopPlayback();
  state.missionId = '';
  $('viewWork').hidden = true;
  $('viewMissions').hidden = false;
  renderMissions();
  window.scrollTo(0, 0);
}

function setTab(tab) {
  state.tab = tab;
  for (const [t, btn, pane] of [['design', 'tabDesign', 'paneDesign'], ['plan', 'tabPlan', 'panePlan'], ['flight', 'tabFlight', 'paneFlight']]) {
    $(btn).setAttribute('aria-selected', String(t === tab));
    $(pane).hidden = t !== tab;
  }
  if (tab === 'flight' && state.result) requestAnimationFrame(drawFlightFrame);
  refreshDrawing();
}

// ---------- 入力の読み書き ----------
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function inputHTML({ scope, path, label, value, unit = '', min, max, step = 1, scale = 1, attrs = '' }) {
  const v = value == null ? '' : +(value / scale).toFixed(4);
  return `<label class="field"><span>${label}</span><span class="unit-row"><input type="number" inputmode="decimal" data-scope="${scope}" data-path="${path}" data-scale="${scale}" value="${v}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} step="${step}" ${attrs}>${unit ? `<span class="unit">${unit}</span>` : ''}</span></label>`;
}
function selectHTML({ scope, path, label, value, options, rerender = true }) {
  return `<label class="field"><span>${label}</span><select data-scope="${scope}" data-path="${path}" ${rerender ? 'data-rerender="1"' : ''}>${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
}

function onFieldChange(e) {
  const el = e.target;
  if (!el.dataset || !el.dataset.path) return;
  const w = work();
  const target = el.dataset.scope === 'design' ? w.design : w.program;
  let value;
  if (el.type === 'checkbox') value = el.checked;
  else if (el.type === 'number') { value = el.value === '' ? NaN : Number(el.value) * Number(el.dataset.scale || 1); }
  else value = el.value;
  if (el.dataset.json) value = JSON.parse(value);
  setPath(target, el.dataset.path, value);
  if (el.dataset.scope === 'design') autoFix(w.design, el.dataset.path);
  persist();
  if (el.dataset.rerender && e.type === 'change') {
    if (el.dataset.scope === 'design') renderDesignForm(); else renderPlanForm();
    if (el.dataset.scope === 'design') renderPlanForm();
  }
  refresh();
}

// 推進剤や直径を変えたとき、合わなくなったエンジン・基数を合うものに寄せる
function autoFix(design, path) {
  const m = missionById(state.missionId);
  const un = unlockedFor(m.id);
  const match = path.match(/^stages\.(\d+)\.(diameter|prop|engine)$/);
  if (match) {
    const s = design.stages[+match[1]];
    const ok = (id) => ENGINES[id] && ENGINES[id].prop === s.prop && DIAMETERS[ENGINES[id].diameter].d <= DIAMETERS[s.diameter].d;
    if (!ok(s.engine)) {
      const cand = [...un.engines].filter(ok);
      if (cand.length) s.engine = cand[0];
    }
    if (ENGINES[s.engine] && DIAMETERS[ENGINES[s.engine].diameter].d <= DIAMETERS[s.diameter].d) {
      s.engineCount = Math.min(s.engineCount, maxEngineCount(s.diameter, ENGINES[s.engine].diameter));
    }
  }
  if (path === 'fairing.diameter' && design.fairing && design.fairing.diameter === '') design.fairing = null;
  if (path === 'boosters.type' && !design.boosters.type) design.boosters.count = 0;
  if (path === 'boosters.type' && design.boosters.type && !design.boosters.count) design.boosters.count = 2;
}

// ---------- 設計フォーム ----------
function renderDesignForm() {
  const m = missionById(state.missionId);
  const un = unlockedFor(m.id);
  const { design } = work();
  const dOpts = DIAMETER_IDS.filter((d) => un.diameters.has(d)).map((d) => ({ value: d, label: DIAMETERS[d].label }));
  const pOpts = Object.values(PROPELLANTS).filter((p) => un.props.has(p.id)).map((p) => ({ value: p.id, label: p.label }));
  const html = [];

  // ペイロード部
  const fairingOpts = [{ value: '', label: 'なし' }, ...dOpts];
  html.push(`<fieldset><legend><span class="legend-row"><span>ペイロード部</span></span></legend><div class="fields">
    ${selectHTML({ scope: 'design', path: 'adapter', label: 'ペイロードアダプタ', value: design.adapter, options: [...un.adapters].map((a) => ({ value: a, label: ADAPTERS[a].label })) })}
    ${m.payload.exposed ? '' : `${selectHTML({ scope: 'design', path: 'fairing.diameter', label: 'フェアリング直径', value: design.fairing ? design.fairing.diameter : '', options: fairingOpts })}
    ${design.fairing ? inputHTML({ scope: 'design', path: 'fairing.length', label: 'フェアリング円筒部', value: design.fairing.length, unit: 'm', min: FAIRING_LENGTH.min, max: FAIRING_LENGTH.max, step: FAIRING_LENGTH.step }) : ''}`}
    ${un.les ? `<label class="field check"><input type="checkbox" data-scope="design" data-path="les" data-rerender="1" ${design.les ? 'checked' : ''}><span>緊急脱出塔（${t1(LES.mass)} t）</span></label>` : ''}
  </div>
  ${m.payload.exposed ? '<p class="hint">このペイロードは耐熱外装付きのため、フェアリングなしで最上段に直接載せます。</p>' : ''}
  </fieldset>`);
  // 段（上から）
  for (let i = design.stages.length - 1; i >= 0; i--) {
    const s = design.stages[i];
    const eOpts = [...un.engines].filter((id) => ENGINES[id].prop === s.prop).map((id) => {
      const e = ENGINES[id];
      return { value: id, label: `${id} ${e.name}（${e.diameter}・${e.note}）` };
    });
    if (!eOpts.find((o) => o.value === s.engine)) eOpts.unshift({ value: s.engine, label: `${s.engine}（推進剤が合いません）` });
    const eng = ENGINES[s.engine];
    const maxN = eng && DIAMETERS[eng.diameter].d <= DIAMETERS[s.diameter].d ? maxEngineCount(s.diameter, eng.diameter) : 1;
    const tank = tankSpec(s.diameter, s.prop, Number(s.tankLength) || 0, s.wall);
    const canDelete = i === design.stages.length - 1 && design.stages.length > 1;
    html.push(`<fieldset><legend><span class="legend-row"><span><span class="stage-tag">第${i + 1}段</span> ${i === design.stages.length - 1 && design.stages.length > 1 ? '（最上段）' : ''}</span>
      ${canDelete ? `<button type="button" class="inline-btn" data-action="remove-stage">この段を外す</button>` : ''}</span></legend>
      <div class="fields">
        ${selectHTML({ scope: 'design', path: `stages.${i}.diameter`, label: '直径', value: s.diameter, options: dOpts })}
        ${selectHTML({ scope: 'design', path: `stages.${i}.prop`, label: '推進剤', value: s.prop, options: pOpts })}
        ${inputHTML({ scope: 'design', path: `stages.${i}.tankLength`, label: 'タンク長', value: s.tankLength, unit: 'm', min: TANK_LENGTH.min, max: TANK_LENGTH.max, step: TANK_LENGTH.step })}
        ${selectHTML({ scope: 'design', path: `stages.${i}.wall`, label: 'タンク肉厚', value: s.wall, options: Object.values(WALLS).map((w) => ({ value: w.id, label: w.label })) })}
        ${selectHTML({ scope: 'design', path: `stages.${i}.engine`, label: 'エンジン', value: s.engine, options: eOpts })}
        ${inputHTML({ scope: 'design', path: `stages.${i}.engineCount`, label: `基数（最大 ${maxN}）`, value: s.engineCount, unit: '基', min: 1, max: maxN, step: 1 })}
        ${i === 0 && un.boosters.size ? `${selectHTML({ scope: 'design', path: 'boosters.type', label: '固体ブースター', value: design.boosters.type, options: [{ value: '', label: 'なし' }, ...[...un.boosters].map((b) => ({ value: b, label: `${b} ${BOOSTERS[b].name}（${BOOSTERS[b].diameter}・${BOOSTERS[b].length} m）` }))] })}
          ${design.boosters.type ? selectHTML({ scope: 'design', path: 'boosters.count', label: '本数', value: design.boosters.count, options: [{ value: 2, label: '2 本' }, { value: 4, label: '4 本' }] }) : ''}` : ''}
      </div>
      <p class="hint data">推進剤 ${t1(tank.propMass)} t ・ タンク乾燥質量 ${t1(tank.dryMass)} t ・ 許容 圧縮 ${fmt(tank.axial / 1000)} kN / 曲げ ${fmt(tank.bend / 1000)} kN·m</p>
    </fieldset>`);
  }
  html.push(`<div class="btn-row">
    ${design.stages.length < m.maxStages ? '<button type="button" class="btn ghost small" data-action="add-stage">最上段の上に段を追加</button>' : ''}
    <button type="button" class="btn ghost small" data-action="reset-design">設計を初期状態に戻す</button>
    <button type="button" class="btn small" data-action="go-plan">飛行計画へ</button>
  </div>`);
  $('designForm').innerHTML = html.join('');
  // 数値の boosters.count は文字列で来るので数値に直す
  const bc = $('designForm').querySelector('[data-path="boosters.count"]');
  if (bc) bc.dataset.json = '1';
}

// ---------- 飛行計画フォーム ----------
function renderPlanForm() {
  const m = missionById(state.missionId);
  const { design, program } = work();
  const v = buildVehicle(design, m);
  const n = design.stages.length;
  const html = [];
  const pp = program.pitch;
  html.push(`<fieldset><legend>上昇誘導</legend><div class="fields">
    ${inputHTML({ scope: 'program', path: 'pitch.startAlt', label: 'ピッチ開始高度', value: pp.startAlt, unit: 'm', min: 100, max: 20000, step: 100 })}
    ${inputHTML({ scope: 'program', path: 'pitch.endAlt', label: 'ピッチ終了高度', value: pp.endAlt, unit: 'km', min: 1, max: 150, step: 1, scale: 1000 })}
    ${inputHTML({ scope: 'program', path: 'pitch.endAngle', label: '終了時の傾き（鉛直から）', value: pp.endAngle, unit: '°', min: 0, max: 90, step: 1 })}
    ${inputHTML({ scope: 'program', path: 'pitch.maxQAlpha', label: 'qα 制限', value: pp.maxQAlpha, unit: 'kPa·°', min: 0, max: 500, step: 5 })}
  </div><p class="hint">傾き 0° なら真上に上がります（観測ロケット向け）。qα 制限を上げると早く寝かせられますが、最大動圧付近の曲げが増えます。</p></fieldset>`);

  for (let i = 0; i < n; i++) {
    const p = program.stages[i];
    const st = v.stages[i];
    const minT = st ? Math.round(st.engine.minThrottle * 100) : 0;
    const bo = st ? burnoutTime(st, p) : NaN;
    const solid = i === 0 && v.boosters ? `<p class="hint">固体ブースター ${v.boosters.spec.id} × ${v.boosters.count} は点火と同時に燃え始め、約 ${fmt(v.boosters.burnTime, 0)} 秒で燃え尽きて自動で分離します（停止・スロットル不可）。</p>` : '';
    html.push(`<fieldset><legend><span class="legend-row"><span><span class="stage-tag">第${i + 1}段</span> ${st ? `${st.engine.id} × ${st.count}` : ''}</span>
      ${st ? `<button type="button" class="inline-btn" data-action="max-burn" data-stage="${i}">燃え尽きまで（${fmt(bo, 1)} 秒）</button>` : ''}</span></legend>
      <div class="fields">
        ${inputHTML({ scope: 'program', path: `stages.${i}.duration`, label: '燃焼時間', value: p.duration, unit: '秒', min: 0.1, step: 0.1 })}
        ${inputHTML({ scope: 'program', path: `stages.${i}.throttle`, label: `開始スロットル（${minT}〜100）`, value: p.throttle, unit: '%', min: minT, max: 100, step: 1 })}
        ${inputHTML({ scope: 'program', path: `stages.${i}.switchAt`, label: '切替 1（0 で使わない）', value: p.switchAt, unit: '秒後', min: 0, step: 1 })}
        ${inputHTML({ scope: 'program', path: `stages.${i}.throttle2`, label: '切替 1 後', value: p.throttle2, unit: '%', min: minT, max: 100, step: 1 })}
        ${inputHTML({ scope: 'program', path: `stages.${i}.switchAt2`, label: '切替 2（0 で使わない）', value: p.switchAt2, unit: '秒後', min: 0, step: 1 })}
        ${inputHTML({ scope: 'program', path: `stages.${i}.throttle3`, label: '切替 2 後', value: p.throttle3, unit: '%', min: minT, max: 100, step: 1 })}
        ${i < n - 1 ? inputHTML({ scope: 'program', path: `stages.${i}.coast`, label: '分離後、次段点火まで', value: p.coast, unit: '秒', min: 0, max: 600, step: 1 }) : ''}
        ${i > 0 ? selectHTML({ scope: 'program', path: `stages.${i}.guidance`, label: '姿勢', value: p.guidance, rerender: false, options: [{ value: 'program', label: '上昇誘導に従う' }, { value: 'prograde', label: '速度方向（プログラード）' }, { value: 'horizontal', label: '水平' }] }) : ''}
      </div>${solid}
    </fieldset>`);
  }

  const top = v.stages[n - 1];
  const c = program.circ;
  const canCirc = top && top.engine.ignitions >= 2;
  if (m.objective.type !== 'altitude') {
    html.push(`<fieldset><legend>円化噴射（最上段の再着火）</legend>
      <label class="field check"><input type="checkbox" data-scope="program" data-path="circ.enabled" data-rerender="1" ${c.enabled ? 'checked' : ''}><span>遠地点付近で再着火する ${top ? `（${top.engine.id}: 着火 ${top.engine.ignitions} 回まで）` : ''}</span></label>
      ${c.enabled ? `<div class="fields">
        ${inputHTML({ scope: 'program', path: 'circ.lead', label: '遠地点の何秒前に点火', value: c.lead, unit: '秒前', min: 0, max: 600, step: 1 })}
        ${inputHTML({ scope: 'program', path: 'circ.duration', label: '燃焼時間', value: c.duration, unit: '秒', min: 0.1, step: 0.1 })}
        ${inputHTML({ scope: 'program', path: 'circ.throttle', label: 'スロットル', value: c.throttle, unit: '%', min: top ? Math.round(top.engine.minThrottle * 100) : 0, max: 100, step: 1 })}
        ${selectHTML({ scope: 'program', path: 'circ.guidance', label: '姿勢', value: c.guidance, rerender: false, options: [{ value: 'horizontal', label: '水平' }, { value: 'prograde', label: '速度方向（プログラード）' }] })}
      </div><p class="hint">点火は遠地点の「何秒前」で指定します。燃焼時間の半分くらい前に点火すると、遠地点をはさんで燃やせます。</p>` : ''}
      ${!canCirc && c.enabled ? '<p class="hint">最上段のエンジンが再着火できません。真空用エンジンを選んでください。</p>' : ''}
    </fieldset>`);
  }

  html.push(`<fieldset><legend>分離</legend><div class="fields">
    ${design.fairing ? inputHTML({ scope: 'program', path: 'fairingAlt', label: 'フェアリング分離高度', value: program.fairingAlt, unit: 'km', min: 20, max: 200, step: 1, scale: 1000 }) : ''}
    ${design.les ? inputHTML({ scope: 'program', path: 'lesAlt', label: '脱出塔の投棄高度（25 km 以上）', value: program.lesAlt, unit: 'km', min: 25, max: 200, step: 1, scale: 1000 }) : ''}
  </div>${!design.fairing && !design.les ? '<p class="hint">分離するものはありません。</p>' : ''}</fieldset>`);

  html.push(`<div class="btn-row"><button type="button" class="btn" id="btnLaunch" data-action="launch">打ち上げ</button><span class="hint" id="launchNote"></span></div>`);
  $('planForm').innerHTML = html.join('');
}

// ---------- 見積もり・チェック ----------
function currentVehicle() {
  const m = missionById(state.missionId);
  const { design, program } = work();
  const v = buildVehicle(design, m);
  const pv = v.errors.length ? { errors: [], warnings: [] } : validateProgram(v, program, m);
  return { m, design, program, v, pv };
}

function analysisHTML(m, v) {
  const a = v.analysis;
  const rows = a.stages.map((s, i) => `<tr><td>第${i + 1}段</td><td class="num">${t1(s.m0)}</td><td class="num">${t1(s.propMass)}</td><td class="num">${fmt(s.dv)}</td><td class="num">${fmt(s.twr, 2)}</td><td class="num">${fmt(s.burnTime, 0)}</td></tr>`).join('');
  const pct = Math.min(100, (v.cost / m.budget) * 100);
  const slender = v.height / v.maxDiameter;
  return `<section class="card"><h2>性能見積もり</h2>
    <div class="table-wrap"><table><thead><tr><th>段</th><th>点火時 t</th><th>推進剤 t</th><th>Δv m/s</th><th>TWR</th><th>全開 秒</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="totals">
      <div class="total"><span>合計 Δv（真空）</span><b>${fmt(a.totalDv)} m/s</b></div>
      <div class="total"><span>離昇質量</span><b>${t1(a.liftoffMass)} t</b></div>
      <div class="total"><span>全長 / 全長÷直径</span><b>${fmt(v.height, 1)} m / ${fmt(slender, 1)}</b></div>
      <div class="total"><span>費用 / 予算</span><b>${fmt(v.cost, 1)} / ${m.budget} 億円</b>
        <div class="budget-bar" aria-hidden="true"><i class="${v.cost > m.budget ? 'over' : ''}" style="width:${pct}%"></i><span class="tick" style="left:${(m.costTargets[0] / m.budget) * 100}%"></span><span class="tick" style="left:${(m.costTargets[1] / m.budget) * 100}%"></span></div>
      </div>
    </div>
    <p class="hint">TWR は第1段が海面、上段が真空の値。Δv は真空比推力・全開噴射で、第1段にフェアリングと脱出塔を含めた概算です。予算バーの印は ★2・★3 の費用ライン。</p>
  </section>`;
}

function checksHTML(errors, warnings, readyText) {
  const items = [
    ...errors.map((e) => `<li class="err">${esc(e)}</li>`),
    ...warnings.map((w) => `<li class="warn">${esc(w)}</li>`),
  ];
  if (!errors.length) items.unshift(`<li class="ok"><span class="ready">${readyText}</span></li>`);
  return `<section class="card"><h2>制約チェック</h2><ul class="checks">${items.join('')}</ul></section>`;
}

function refresh() {
  if (!state.missionId) return;
  const { m, v, pv } = currentVehicle();
  $('analysis').innerHTML = analysisHTML(m, v) + checksHTML(v.errors, v.warnings, '機体の制約を満たしています');
  const allErr = [...v.errors, ...pv.errors];
  const planSide = [];
  planSide.push(checksHTML(allErr, [...v.warnings, ...pv.warnings], '打ち上げ可能です'));
  planSide.push(`<section class="card"><h2>入力の目安</h2><ul class="checks">
    ${v.stages.map((s, i) => `<li class="ok"><span>第${i + 1}段: 推進剤 ${t1(s.propMass)} t、全開なら ${fmt(s.propMass / s.mdotVac, 1)} 秒。最小スロットル ${Math.round(s.engine.minThrottle * 100)}%、着火 ${s.engine.ignitions} 回。</span></li>`).join('')}
    <li class="ok"><span>許容加速度 ${m.payload.maxG} G。機体が軽くなる段の終盤ほど加速度が上がります。</span></li>
    ${v.fairing ? `<li class="ok"><span>フェアリング許容動圧 ${fmt(v.fairing.maxQ / 1000)} kPa。分離後のペイロードは ${fmt(m.payload.maxQExposed / 1000, 1)} kPa まで。</span></li>` : ''}
  </ul></section>`);
  if (state.result && state.result.ok) {
    planSide.push(`<section class="card"><h2>前回の打ち上げ</h2><p>${state.result.success ? '達成' : esc(state.result.failure ? state.result.failure.message : '軌道条件を満たしませんでした')}</p>
      <ul class="checks">${state.result.events.filter((e) => e.kind === 'orbit').map((e) => `<li class="ok"><span class="data">T+${fmt(e.t, 1)}s ${esc(e.text)}</span></li>`).join('')}</ul></section>`);
  }
  $('planSide').innerHTML = planSide.join('');
  const btn = $('btnLaunch');
  if (btn) {
    btn.disabled = allErr.length > 0;
    $('launchNote').textContent = allErr.length ? `制約違反が ${allErr.length} 件あります` : `費用 ${fmt(v.cost, 1)} 億円`;
  }
  refreshDrawing();
}

function refreshDrawing() {
  if (!state.missionId) return;
  const { v } = currentVehicle();
  const showMargins = state.tab === 'flight' && state.result && state.result.ok;
  $('rocketView').innerHTML = renderRocket(v, { margins: showMargins ? state.result.margins : null });
  $('drawingDim').textContent = `全長 ${fmt(v.height, 1)} m ・ ${t1(v.analysis.liftoffMass)} t`;
  $('drawingNote').textContent = showMargins ? '色と % は飛行中の最大荷重比（100% で破壊）。' : '太い枠は強化肉厚のタンク。破線はフェアリング内のペイロード。';
}

// ---------- 部品カタログ ----------
function renderCatalog() {
  const m = missionById(state.missionId);
  const un = unlockedFor(m.id);
  const eng = [...un.engines].map((id) => ENGINES[id]);
  const kN = (n) => fmt(n / 1000);
  const engRows = eng.map((e) => `<tr><td>${e.id} ${e.name}</td><td>${e.diameter}</td><td>${PROPELLANTS[e.prop].short}</td><td class="num">${fmt(e.mass / 1000, 2)}</td><td class="num">${kN(e.thrustVac * e.ispSL / e.ispVac)} / ${kN(e.thrustVac)}</td><td class="num">${e.ispSL} / ${e.ispVac}</td><td class="num">${Math.round(e.minThrottle * 100)}%</td><td class="num">${e.ignitions}</td><td class="num">${e.cost}</td></tr>`).join('');
  const bRows = [...un.boosters].map((id) => { const b = BOOSTERS[id]; return `<tr><td>${b.id} ${b.name}</td><td>${b.diameter}</td><td class="num">${b.length}</td><td class="num">${t1(b.prop)} / ${t1(b.dry)}</td><td class="num">${kN(b.thrustVac * b.ispSL / b.ispVac)} / ${kN(b.thrustVac)}</td><td class="num">${b.ispSL} / ${b.ispVac}</td><td class="num">${b.cost}</td></tr>`; }).join('');
  const tRows = DIAMETER_IDS.filter((d) => un.diameters.has(d)).flatMap((d) => [...un.props].map((p) => {
    const t = tankSpec(d, p, 1, 'std');
    return `<tr><td>${d}</td><td>${PROPELLANTS[p].short}</td><td class="num">${fmt(t.propMass / 1000, 2)}</td><td class="num">${fmt(t.dryMass / 1000, 3)}</td><td class="num">${kN(t.axial)}</td><td class="num">${kN(t.bend)}</td><td class="num">${fmt(t.cost, 2)}</td></tr>`;
  })).join('');
  const fRows = DIAMETER_IDS.filter((d) => un.diameters.has(d)).map((d) => `<tr><td>${d}</td><td class="num">${fmt(DIAMETERS[d].d - 0.15, 2)}</td><td class="num">${fmt(FAIRINGS[d].massPerM / 1000, 2)}</td><td class="num">${fmt(DIAMETERS[d].d * 1.2, 1)}</td><td class="num">${kN(FAIRINGS[d].maxQ)}</td><td class="num">${FAIRINGS[d].costPerM}</td></tr>`).join('');
  $('catalogBody').innerHTML = `
    <div><h3>液体エンジン</h3><div class="table-wrap"><table><thead><tr><th>型式</th><th>直径</th><th>推進剤</th><th>質量 t</th><th>推力 海面/真空 kN</th><th>比推力 海面/真空 s</th><th>最小</th><th>着火</th><th>費用</th></tr></thead><tbody>${engRows}</tbody></table></div></div>
    ${bRows ? `<div><h3>固体ブースター（1 本あたり）</h3><div class="table-wrap"><table><thead><tr><th>型式</th><th>直径</th><th>長さ m</th><th>推進剤/乾燥 t</th><th>推力 海面/真空 kN</th><th>比推力 s</th><th>費用</th></tr></thead><tbody>${bRows}</tbody></table></div></div>` : ''}
    <div><h3>タンク（長さ 1 m・標準肉厚あたり。強化肉厚は質量 ×1.5、強度 ×1.6、費用 ×1.4）</h3><div class="table-wrap"><table><thead><tr><th>直径</th><th>推進剤</th><th>推進剤 t</th><th>乾燥 t</th><th>許容圧縮 kN</th><th>許容曲げ kN·m</th><th>費用</th></tr></thead><tbody>${tRows}</tbody></table></div></div>
    <div><h3>フェアリング（円筒部 1 m あたり。ノーズ長は直径 × 1.2）</h3><div class="table-wrap"><table><thead><tr><th>直径</th><th>内径 m</th><th>質量 t/m</th><th>ノーズ m</th><th>許容動圧 kPa</th><th>費用/m</th></tr></thead><tbody>${fRows}</tbody></table></div></div>
    <p class="hint">費用の単位は億円。段間部は下段と一緒に分離し、直径が変わる段間部は 1.5 倍の質量になります。</p>`;
}

// ---------- 打ち上げ ----------
function launch() {
  const { m, design, program } = currentVehicle();
  const r = simulate(design, program, m);
  if (r.aborted) { toast(r.errors[0]); return; }
  state.result = r;
  if (r.success) {
    const prev = state.stars[m.id] || 0;
    if (r.stars > prev) state.stars[m.id] = r.stars;
    persist();
  }
  $('flightEmpty').hidden = true;
  $('flightBody').hidden = false;
  setTab('flight');
  startPlayback();
  refresh();
  renderMast();
}

function poweredEnd(r) {
  let t = 0;
  for (const s of r.telemetry) if (s.thrust > 0) t = s.t;
  return Math.min(r.duration, t + 30);
}

function startPlayback() {
  stopPlayback();
  const r = state.result;
  state.play = { t: 0, idx: 0, running: false, last: 0, orbit: orbitPoints(r), xMax: poweredEnd(r), done: false };
  renderLog(0);
  renderVerdict(false);
  $('report').innerHTML = '';
  resumePlayback();
}

function playLoop(now) {
  const p = state.play;
  if (!p || !p.running) return;
  const dt = Math.min(0.1, (now - p.last) / 1000);
  p.last = now;
  const tel = state.result.telemetry;
  const cur = tel[p.idx];
  // 真空中の慣性飛行は 10 倍速で流す
  const coasting = cur && cur.thrust === 0 && cur.alt > PLANET.atmosphereTop;
  p.t += dt * Number($('playSpeed').value) * (coasting ? 10 : 1);
  while (p.idx < tel.length - 1 && tel[p.idx + 1].t <= p.t) p.idx++;
  drawFlightFrame();
  if (p.idx >= tel.length - 1) { finishPlayback(); return; }
  p.raf = requestAnimationFrame(playLoop);
}

function resumePlayback() {
  const p = state.play;
  p.running = true;
  p.last = performance.now();
  $('btnPlay').textContent = '一時停止';
  p.raf = requestAnimationFrame(playLoop);
}

function stopPlayback() {
  if (state.play && state.play.raf) cancelAnimationFrame(state.play.raf);
  if (state.play) state.play.running = false;
}

function finishPlayback() {
  const p = state.play;
  if (!p) return;
  stopPlayback();
  p.idx = state.result.telemetry.length - 1;
  p.t = state.result.duration;
  p.done = true;
  $('btnPlay').textContent = 'もう一度再生';
  drawFlightFrame();
  renderVerdict(true);
  renderReport();
}

function drawFlightFrame() {
  const r = state.result;
  const p = state.play;
  if (!r || !p || $('paneFlight').hidden) return;
  const tel = r.telemetry;
  const s = tel[p.idx] || tel[0];
  drawTrajectory($('trajCanvas'), r, p.idx, { orbit: p.orbit, showOrbit: p.done });
  $('hud').innerHTML = `T+ <b>${fmt(Math.min(p.t, r.duration), 1)}</b> s<br>高度 <b>${fmt(s.alt / 1000, 1)}</b> km<br>速度 <b>${fmt(s.v)}</b> m/s<br>動圧 <b>${fmt(s.q / 1000, 1)}</b> kPa<br>加速度 <b>${fmt(s.g, 2)}</b> G<br>第 <b>${s.si + 1}</b> 段 ・ ${fmt(s.mass / 1000, 1)} t`;
  const xs = tel.map((x) => x.t);
  const m = missionById(state.missionId);
  const cursor = p.done ? null : p.t;
  drawChart($('chAlt'), xs, tel.map((x) => x.alt / 1000), { label: '高度', unit: 'km', xMax: p.xMax, cursor });
  drawChart($('chVel'), xs, tel.map((x) => x.v), { label: '速度', unit: 'm/s', xMax: p.xMax, cursor });
  drawChart($('chQ'), xs, tel.map((x) => x.q / 1000), { label: '動圧', unit: 'kPa', xMax: p.xMax, cursor, limit: r.vehicle.fairing ? r.vehicle.fairing.maxQ / 1000 : null, digits: 0 });
  drawChart($('chG'), xs, tel.map((x) => x.g), { label: '加速度', unit: 'G', xMax: p.xMax, cursor, limit: m.payload.maxG, digits: 1 });
  renderLog(p.t);
}

function renderLog(t) {
  const r = state.result;
  $('flightLog').innerHTML = r.events.map((e) => `<li class="${e.kind}${e.t > t + 1e-6 ? ' pending' : ''}"><span class="t">T+${fmt(e.t, 1)}</span><span class="h">${fmt(e.alt / 1000, 1)} km</span><span class="x">${esc(e.text)}</span></li>`).join('');
}

function renderVerdict(final) {
  const r = state.result;
  const m = missionById(state.missionId);
  const el = $('verdict');
  if (!final) {
    el.className = 'verdict run';
    el.innerHTML = `<div><h2>飛行中</h2><p>飛行計画どおりに自動で飛んでいます。「最後まで」で結果へ進めます。</p></div>`;
    return;
  }
  const idx = MISSIONS.findIndex((x) => x.id === m.id);
  const next = MISSIONS[idx + 1];
  if (r.success) {
    el.className = 'verdict ok';
    el.innerHTML = `<div><h2>ミッション達成</h2><p>費用 ${fmt(r.vehicle.cost, 1)} 億円（★2: ${m.costTargets[0]} 以下、★3: ${m.costTargets[1]} 以下）</p>
      <div class="btn-row">${next ? `<button type="button" class="btn small" data-action="next-mission" data-mission="${next.id}">次のミッション「${esc(next.title)}」へ</button>` : ''}<button type="button" class="btn ghost small" data-action="go-design">設計を詰めて費用を下げる</button></div></div>${starsHTML(r.stars)}`;
  } else {
    el.className = 'verdict ng';
    const reason = r.failure ? `T+${fmt(r.failure.t, 1)} 秒・高度 ${fmt(r.failure.alt / 1000, 1)} km: ${r.failure.message}` : r.checks.filter((c) => !c.ok).map((c) => c.text).join(' / ');
    el.innerHTML = `<div><h2>失敗</h2><p>${esc(reason)}</p>
      <div class="btn-row"><button type="button" class="btn small" data-action="go-plan">飛行計画を直す</button><button type="button" class="btn ghost small" data-action="go-design">機体を直す</button></div></div>`;
  }
}

function adviceFor(r, m) {
  const out = [];
  const f = r.failure;
  if (f) {
    if (f.kind === 'structure' && f.message.includes('曲げ')) out.push('最大動圧付近の曲げで壊れました。qα 制限を下げる、序盤のスロットルを絞って動圧を下げる、該当タンクを強化肉厚にする、機体を短く太くする、のいずれかを試してください。');
    else if (f.kind === 'structure' && f.message.includes('圧縮')) out.push('加速度が大きく、上に載った質量の重みで潰れました。段の後半でスロットルを下げるか、該当部品を強化してください。');
    else if (f.kind === 'structure' && f.message.includes('動圧')) out.push('動圧がフェアリングの許容を超えました。低空で速度を出しすぎています。開始スロットルを下げましょう。');
    else if (f.kind === 'payload-g') out.push('ペイロードの許容加速度を超えました。推進剤が減った段の終盤ほど加速度が上がります。切替 1・2 でスロットルを段階的に下げてください。');
    else if (f.kind === 'payload-q') out.push('フェアリングを早く外しすぎました。分離高度を上げてください（目安は 55〜70 km）。');
    else if (f.kind === 'liftoff') out.push('推力が足りず浮き上がりません。エンジンを増やすか、機体を軽くしてください。');
    else if (f.kind === 'crash') out.push('上昇しきれずに落ちました。終了時の傾きを小さくする（立てる）か、上段の推力・Δv を増やしてください。');
    else if (f.kind === 'ignition') out.push('着火回数が足りません。再着火できるエンジンを選んでください。');
  } else if (!r.success) {
    const o = m.objective;
    const fin = r.final;
    if (o.type === 'orbit') {
      if (fin.periapsisAlt < o.minPeriapsis) out.push('近地点が足りません。円化噴射を長くするか、点火時刻（遠地点の何秒前）を見直してください。飛行ログの「噴射時間の目安」が参考になります。');
      if (!fin.bound || fin.apoapsisAlt > o.maxApoapsis) out.push('遠地点が高すぎます。最上段の最初の燃焼時間を短くするか、円化噴射を短く・スロットルを下げて微調整してください。');
      if (o.minApoapsis && fin.bound && fin.apoapsisAlt < o.minApoapsis) out.push('遠地点が低すぎます。最上段の最初の燃焼を長くしてください。');
    } else if (o.type === 'escape') out.push('脱出速度に届いていません。上段の Δv を増やす（タンクを伸ばす、液水エンジンにする）か、燃え尽きまで燃やしてください。');
    else if (o.type === 'altitude') out.push('高度が足りません。燃焼時間を伸ばすか、推進剤を増やしてください。');
    if (r.checks.some((c) => !c.ok && c.text.includes('フェアリング'))) out.push('フェアリング分離高度に届く前に飛行が終わりました。分離高度を下げてください。');
  }
  if (r.success && r.stars < 3) out.push(`★3 は費用 ${m.costTargets[1]} 億円以下。荷重比の低い部品は軽く・短くできる余地があります。`);
  return out;
}

function renderReport() {
  const r = state.result;
  const m = missionById(state.missionId);
  const labels = Object.fromEntries(r.vehicle.elements.map((e) => [e.key, e.label]));
  const rows = Object.entries(r.margins).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(labels[k] || k)}</td><td><span class="bar-cell"><span class="num">${Math.round(v * 100)}%</span><span class="mbar"><i class="${marginClass(v)}" style="width:${Math.min(100, v * 100)}%"></i></span></span></td></tr>`).join('');
  const checks = r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'err'}">${esc(c.text)}</li>`).join('');
  const advice = adviceFor(r, m);
  $('report').innerHTML = `
    ${checks ? `<section class="card"><h2>判定</h2><ul class="checks">${checks}</ul></section>` : ''}
    <section class="card"><h2>飛行中の最大値</h2><ul class="checks">
      <li class="${r.stats.maxQ > (r.vehicle.fairing ? r.vehicle.fairing.maxQ : Infinity) ? 'err' : 'ok'}"><span class="data">最大動圧 ${fmt(r.stats.maxQ / 1000, 1)} kPa（T+${fmt(r.stats.maxQt, 0)} s）</span></li>
      <li class="${r.stats.maxG > m.payload.maxG ? 'err' : 'ok'}"><span class="data">最大加速度 ${fmt(r.stats.maxG, 2)} G（許容 ${m.payload.maxG} G、T+${fmt(r.stats.maxGt, 0)} s）</span></li>
      <li class="ok"><span class="data">最高到達高度 ${fmt(r.stats.apex / 1000, 1)} km</span></li>
    </ul></section>
    <section class="card"><h2>部品ごとの最大荷重比</h2><div class="table-wrap"><table><tbody>${rows || '<tr><td>記録なし</td></tr>'}</tbody></table></div></section>
    ${advice.length ? `<section class="card"><h2>次の一手</h2><ul class="advice">${advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}`;
}

// ---------- イベント ----------
function onAction(e) {
  const el = e.target.closest('[data-action], [data-mission]');
  if (!el) return;
  const action = el.dataset.action;
  if (!action && el.dataset.mission) { openMission(el.dataset.mission); return; }
  const m = state.missionId ? missionById(state.missionId) : null;
  const w = m ? work() : null;
  switch (action) {
    case 'add-stage': {
      const top = w.design.stages[w.design.stages.length - 1];
      const un = unlockedFor(m.id);
      const vac = ['RK-40V', 'RK-10V', 'HL-20'].find((id) => un.engines.has(id) && ENGINES[id].prop === top.prop && DIAMETERS[ENGINES[id].diameter].d <= DIAMETERS[top.diameter].d);
      w.design.stages.push({ ...defaultStage(), diameter: top.diameter, prop: top.prop, engine: vac || top.engine, tankLength: Math.max(2, Math.round(top.tankLength / 3)) });
      syncProgram(w.design, w.program);
      if (vac && m.objective.type === 'orbit') w.program.circ.enabled = true;
      persist(); renderDesignForm(); renderPlanForm(); refresh();
      break;
    }
    case 'remove-stage':
      w.design.stages.pop();
      syncProgram(w.design, w.program);
      persist(); renderDesignForm(); renderPlanForm(); refresh();
      break;
    case 'reset-design': {
      const design = defaultDesign(m);
      state.work[m.id] = { design, program: syncProgram(design, defaultProgram(m)) };
      persist(); renderDesignForm(); renderPlanForm(); refresh();
      toast('設計を初期状態に戻しました');
      break;
    }
    case 'max-burn': {
      const i = +el.dataset.stage;
      const v = buildVehicle(w.design, m);
      const t = burnoutTime(v.stages[i], w.program.stages[i]);
      w.program.stages[i].duration = Math.floor(t * 10) / 10;
      persist(); renderPlanForm(); refresh();
      break;
    }
    case 'go-plan': setTab('plan'); window.scrollTo({ top: $('viewWork').offsetTop - 60 }); break;
    case 'go-design': setTab('design'); window.scrollTo({ top: $('viewWork').offsetTop - 60 }); break;
    case 'launch': launch(); break;
    case 'next-mission': openMission(el.dataset.mission); break;
    default: break;
  }
}

document.addEventListener('click', onAction);
$('designForm').addEventListener('change', onFieldChange);
$('designForm').addEventListener('input', (e) => { if (e.target.type === 'number') onFieldChange(e); });
$('planForm').addEventListener('change', onFieldChange);
$('planForm').addEventListener('input', (e) => { if (e.target.type === 'number') onFieldChange(e); });
$('designForm').addEventListener('submit', (e) => e.preventDefault());
$('planForm').addEventListener('submit', (e) => e.preventDefault());
$('home').addEventListener('click', showMissions);
$('tabDesign').addEventListener('click', () => setTab('design'));
$('tabPlan').addEventListener('click', () => setTab('plan'));
$('tabFlight').addEventListener('click', () => setTab('flight'));
$('btnPlay').addEventListener('click', () => {
  if (!state.result) return;
  const p = state.play;
  if (p && p.done) { startPlayback(); return; }
  if (p && p.running) { stopPlayback(); $('btnPlay').textContent = '再生'; }
  else if (p) resumePlayback();
});
$('btnSkip').addEventListener('click', () => { if (state.result) finishPlayback(); });
window.addEventListener('resize', () => { if (state.result && state.tab === 'flight') drawFlightFrame(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.result) drawFlightFrame(); });

renderRules();
renderMissions();
