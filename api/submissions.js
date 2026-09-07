const ADMIN_USER = process.env.PBW_ADMIN_USER || 'pbwadventure';
const ADMIN_PASS = process.env.PBW_ADMIN_PASS || 'pbwadventure231100';
const KEY = 'pbwRegistrations2026';

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

async function getRows() {
  const result = await redis('/get/' + KEY);
  let rows = [];
  try { rows = result?.result ? JSON.parse(result.result) : []; } catch {}
  return Array.isArray(rows) ? rows : [];
}

async function saveRows(rows) {
  await redis('/set/' + KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(rows.slice(0, 1000)))
  });
}

function val(form, key) {
  return String(form.get(key) || '').trim();
}

function makeId() {
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeOrderCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `PBW-${y}${m}${day}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default async function handler(request) {
  try {
    if (request.method === 'POST') {
      const form = await request.formData();
      const adminManual = val(form, 'adminManual') === '1';

      if (adminManual && !authorized(request)) {
        return Response.json({ ok: false, message: 'Tidak berwenang' }, { status: 401 });
      }

      const row = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        orderId: val(form, 'orderCode') || makeOrderCode(),
        nama: val(form, 'nama'),
        lahir: val(form, 'lahir'),
        gender: val(form, 'gender'),
        trip: val(form, 'trip'),
        paket: val(form, 'paket'),
        mepo: val(form, 'mepo'),
        wa: val(form, 'wa'),
        wakeluarga: val(form, 'wakeluarga'),
        instagram: val(form, 'instagram'),
        email: val(form, 'email'),
        penyakit: val(form, 'penyakit'),
        penglihatan: val(form, 'penglihatan'),
        sumber: val(form, 'sumber'),
        pengalaman: val(form, 'pengalaman'),
        khusus: val(form, 'khusus'),
        tinggi: val(form, 'tinggi'),
        berat: val(form, 'berat'),
        source: adminManual ? 'admin' : 'website'
      };

      if (!row.nama || !row.trip || !row.paket || !row.mepo || !row.wa) {
        return Response.json({ ok: false, message: 'Nama, trip, paket, Mepo, dan nomor WhatsApp wajib diisi.' }, { status: 400 });
      }

      const rows = await getRows();
      rows.unshift(row);
      await saveRows(rows);

      return Response.json({ ok: true, id: row.id, orderId: row.orderId });
    }

    if (request.method === 'GET') {
      const u = new URL(request.url);

      if (u.searchParams.get('public') === '1') {
        const rows = await getRows();
        const participants = rows.map(x => ({
          nama: x.nama || '',
          mepo: x.mepo || '',
          paket: x.paket || '',
          trip: x.trip || '',
          createdAt: x.createdAt || ''
        })).filter(x => x.nama && x.mepo && x.trip);

        return Response.json(
          { ok: true, participants: participants.slice(0, 100) },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (!authorized(request)) {
        return Response.json({ ok: false, message: 'Tidak berwenang' }, { status: 401 });
      }

      return Response.json({ ok: true, registrations: await getRows() });
    }

    if (request.method === 'DELETE') {
      if (!authorized(request)) {
        return Response.json({ ok: false, message: 'Tidak berwenang' }, { status: 401 });
      }

      const u = new URL(request.url);
      const id = u.searchParams.get('id');
      if (!id) return Response.json({ ok: false, message: 'ID tidak ada' }, { status: 400 });

      const rows = await getRows();
      await saveRows(rows.filter(x => x.id !== id));
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, message: 'Method tidak didukung' }, { status: 405 });
  } catch (error) {
    return Response.json({ ok: false, message: error?.message || String(error) }, { status: 500 });
  }
}
