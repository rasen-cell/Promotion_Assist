const KEYS = {
  works: 'pa.v0.works',
  history: 'pa.v0.history',
  rotation: 'pa.v0.rotation',
  settings: 'pa.v0.settings',
};

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__pa_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const memory = new Map();

function read(key, fallback) {
  const s = safeStorage();
  try {
    const raw = s ? s.getItem(key) : memory.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const raw = JSON.stringify(value);
  const s = safeStorage();
  try {
    if (s) s.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw);
  }
}

export const store = {
  loadWorks: () => read(KEYS.works, []),
  saveWorks: (works) => write(KEYS.works, works),
  loadHistory: () => read(KEYS.history, []),
  saveHistory: (h) => write(KEYS.history, h),
  loadRotation: () => read(KEYS.rotation, {}),
  saveRotation: (r) => write(KEYS.rotation, r),
  loadSettings: () => read(KEYS.settings, { misskeyHost: 'misskey.io', mastodonHost: '' }),
  saveSettings: (s) => write(KEYS.settings, s),
  exportAll: () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    works: read(KEYS.works, []),
    history: read(KEYS.history, []),
    rotation: read(KEYS.rotation, {}),
    settings: read(KEYS.settings, {}),
  }),
  importAll: (data) => {
    if (!data || typeof data !== 'object') throw new Error('invalid data');
    if (Array.isArray(data.works)) write(KEYS.works, data.works);
    if (Array.isArray(data.history)) write(KEYS.history, data.history);
    if (data.rotation && typeof data.rotation === 'object') write(KEYS.rotation, data.rotation);
    if (data.settings && typeof data.settings === 'object') write(KEYS.settings, data.settings);
  },
};

export function newId() {
  return `w_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
