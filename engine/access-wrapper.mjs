import Kitesurf from './index.js';
export * from './index.js';
const HOST = 'kitesurf.nikanesalamat.ir';
const ISSUER = 'https://sahebkarami.cloudflareaccess.com';
const AUD = '215fbd7aa99f6a3524b1b9a138ad0ccbbb91561ed7ac2be05140bc78c168f182';
const USER = 'OWNER_EMAIL@example.com'; // ← ایمیل مجاز Cloudflare Access خودت
let keyData;
const decode = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), (ch) => ch.charCodeAt(0));
const fromJson = (s) => JSON.parse(new TextDecoder().decode(decode(s)));
const validIssuers = new Set([ISSUER, new URL(ISSUER).host]);
function appCookie(request) {
  for (const crumb of (request.headers.get('Cookie') ?? '').split(';')) {
    const part = crumb.trim();
    if (part.startsWith('CF_Authorization=')) return part.slice('CF_Authorization='.length);
  }
}
async function verifyAccessToken(token) {
  if (!token) return 'missing-token';
  try {
    if (token.length > 16000) return 'format';
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return 'format';
    const h = fromJson(parts[0]); const c = fromJson(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (h.alg !== 'RS256' || typeof h.kid !== 'string') return 'algorithm';
    if (!validIssuers.has(c.iss)) return 'issuer';
    if (!(c.aud === AUD || (Array.isArray(c.aud) && c.aud.includes(AUD)))) return 'audience';
    if (!Number.isFinite(c.exp) || c.exp <= now || (c.nbf !== undefined && (!Number.isFinite(c.nbf) || c.nbf > now))) return 'expiry';
    if (c.type !== 'app' || typeof c.sub !== 'string' || !c.sub) return 'not-an-app-user';
    // Access applies the exact email policy before issuing an app token for this AUD.
    // Keep the additional check whenever an email claim is supplied by the IdP.
    if (c.email != null && (typeof c.email !== 'string' || c.email.toLowerCase() !== USER)) return 'identity';
    let key = keyData?.keys.get(h.kid);
    if (!keyData || keyData.expires <= now || (!key && keyData.refreshed + 60 < now)) {
      const res = await fetch(ISSUER + '/cdn-cgi/access/certs', {redirect:'error',signal:AbortSignal.timeout(8000)});
      if (!res.ok) return 'key-service';
      const {keys} = await res.json();
      if (!Array.isArray(keys)) return 'key-service';
      const mapped = new Map();
      for (const k of keys) if (k.kty === 'RSA' && (k.alg === undefined || k.alg === 'RS256') && typeof k.kid === 'string') {
        mapped.set(k.kid, await crypto.subtle.importKey('jwk', k, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']));
      }
      keyData = {keys:mapped,expires:now+300,refreshed:now}; key = mapped.get(h.kid);
    }
    if (!key) return 'unknown-key';
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0]+'.'+parts[1])) ? 'ok' : 'signature';
  } catch { return 'verification-error'; }
}
export default class PrivateKitesurf extends Kitesurf {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== HOST || url.protocol !== 'https:') return new Response('Not found', {status:404});
    const header = request.headers.get('Cf-Access-Jwt-Assertion');
    const cookie = appCookie(request);
    const assertion = await verifyAccessToken(header);
    const session = assertion !== 'ok' && cookie && cookie !== header ? await verifyAccessToken(cookie) : assertion;
    if (session !== 'ok') {
      // Log reason codes only. Never include headers, cookies, tokens, addresses, or URLs.
      console.warn('Kitesurf Access check failed', { assertion, session, hasCookie: Boolean(cookie), hasAssertion: Boolean(header) });
      return new Response('Access denied by Kitesurf', {status:403, headers:{'cache-control':'no-store'}});
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      if (url.pathname === '/' && request.method === 'GET' && !url.search) return Response.redirect(new URL('/?inspect=1',url),302);
      if (url.pathname.startsWith('/inspector/') || url.pathname.startsWith('/fonts/')) return this.env.FONT_ASSETS.fetch(request);
    }
    return super.fetch(request);
  }
}
