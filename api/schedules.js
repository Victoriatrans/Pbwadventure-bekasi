const ADMIN_USER = process.env.PBW_ADMIN_USER || 'pbwadventure';
const ADMIN_PASS = process.env.PBW_ADMIN_PASS || 'pbwadventure231100';
const KEY = 'pbwSchedules2026';

function authorized(request) {
  return request.headers.get('x-admin-user') === ADMIN_USER &&
    request.headers.get('x-admin-pass') === ADMIN_PASS;
}

async function redis(path, options = {}) {
  const url = String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash/Redis belum diatur.');
  const r = await fetch(url + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function readSchedules() {
  const result = await redis('/get/' + KEY);
  try { return result?.result ? JSON.parse(result.result) : []; } catch { return []; }
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const schedules = await readSchedules();
      return Response.json({ ok: true, schedules: Array.isArray(schedules) ? schedules : [] }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    if (request.method === 'POST') {
      if (!authorized(request)) return Response.json({ ok: false, message: 'Tidak berwenang' }, { status: 401 });
      const body = await request.json();
      const schedules = Array.isArray(body?.schedules) ? body.schedules : [];
      await redis('/set/' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.stringify(schedules))
      });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, message: 'Method tidak didukung' }, { status: 405 });
  } catch (error) {
    return Response.json({ ok: false, message: error?.message || String(error) }, { status: 500 });
  }
}
