import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function normalizeIp(value) {
  if (typeof value !== 'string') throw new Error('Client IP is unavailable.');
  const ip = value.trim();
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6 || ip.includes('%')) throw new Error('Client IP is invalid.');
  const canonical = new URL('http://[' + ip + ']/').hostname.slice(1, -1).toLowerCase();
  if (canonical.startsWith('::ffff:')) {
    const pieces = canonical.slice(7).split(':');
    if (pieces.length === 2) {
      const a = parseInt(pieces[0], 16), b = parseInt(pieces[1], 16);
      return [a >> 8, a & 255, b >> 8, b & 255].join('.');
    }
  }
  return canonical;
}
export function clientIp(req) {
  // Only Vercel's platform-sanitized header is trusted in its managed runtime.
  // Direct/local servers ignore forwarding headers supplied by a client.
  if (process.env.VERCEL === '1') {
    const header = req.headers['x-forwarded-for'];
    if (typeof header !== 'string' || header.includes(',')) throw new Error('Trusted client IP is unavailable.');
    return normalizeIp(header);
  }
  return normalizeIp(req.socket?.remoteAddress);
}
export function ipQuotaKey(req) {
  const secret = process.env.IP_QUOTA_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('IP quota configuration is missing.');
  // Store a keyed digest, never the raw address. Changing the key resets IP buckets.
  return createHmac('sha256', secret).update('resume-trial-ip-v1:' + clientIp(req)).digest('hex');
}
