import { PLATFORMS } from './limits.js';

function normalizeHost(host, fallback) {
  const h = String(host || fallback || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!h) return '';
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(h)) return '';
  return h;
}

/** 共有インテント URL を組み立てる。text は URL エンコードされる。 */
export function intentUrl(platformId, text, options = {}) {
  const p = PLATFORMS[platformId];
  if (!p) throw new Error(`unknown platform: ${platformId}`);
  const encoded = encodeURIComponent(String(text ?? ''));
  if (p.intent.base) {
    return `${p.intent.base}?${p.intent.param}=${encoded}`;
  }
  const host = normalizeHost(options.host, p.defaultHost);
  if (!host) return null;
  return `https://${host}${p.intent.path}?${p.intent.param}=${encoded}`;
}

export { normalizeHost };
