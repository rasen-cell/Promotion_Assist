// 進行状況と設計の保存（ブラウザの localStorage。使えない環境では保存せずに動く）。
const KEY = 'rocket-bureau-v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 保存できなくても続行 */ }
}

export const store = {
  load() {
    const d = read();
    return { stars: d.stars || {}, work: d.work || {}, last: d.last || '' };
  },
  save(state) { write({ stars: state.stars, work: state.work, last: state.last }); },
  reset() { try { localStorage.removeItem(KEY); } catch { /* noop */ } },
};
