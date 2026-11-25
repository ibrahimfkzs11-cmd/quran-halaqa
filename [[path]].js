// Cloudflare Pages Functions — shared storage for "إدارة حلقة القرآن"
// يخدم كل مسارات /api/* . يتطلب ربط KV namespace باسم المتغير: DB
const J = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const COLS = ['excuses', 'notes'];

export async function onRequest({ request: req, env }) {
  const u = new URL(req.url);
  const kv = env.DB;
  if (!kv) return J({ error: 'KV binding "DB" is missing' }, 503);
  const parts = u.pathname.split('/').filter(Boolean); // ['api', ...]
  try {
    if (req.method === 'GET' && parts[1] === 'all') {
      const [core, ex, nt] = await Promise.all([
        kv.get('core', 'json'), kv.get('col:excuses', 'json'), kv.get('col:notes', 'json')
      ]);
      return J({ core: core || null, excuses: Object.values(ex || {}), notes: Object.values(nt || {}) });
    }
    if (req.method === 'PUT' && parts[1] === 'core') {
      const b = await req.text();
      if (b.length > 5000000) return J({ error: 'too large' }, 413);
      const o = JSON.parse(b);
      if (!o || typeof o !== 'object' || !o.mosque || !o.school) return J({ error: 'bad data' }, 400);
      await kv.put('core', b);
      return J({ ok: true });
    }
    if ((req.method === 'PUT' || req.method === 'PATCH') && parts[1] === 'col' && COLS.includes(parts[2]) && parts[3]) {
      const id = decodeURIComponent(parts[3]);
      if (id.length > 80) return J({ error: 'bad id' }, 400);
      const body = await req.json();
      if (!body || typeof body !== 'object') return J({ error: 'bad data' }, 400);
      const key = 'col:' + parts[2];
      const cur = (await kv.get(key, 'json')) || {};
      cur[id] = req.method === 'PUT' ? body : Object.assign({}, cur[id] || {}, body);
      await kv.put(key, JSON.stringify(cur));
      return J({ ok: true });
    }
    return J({ error: 'not found' }, 404);
  } catch (e) {
    return J({ error: String((e && e.message) || e) }, 500);
  }
}
