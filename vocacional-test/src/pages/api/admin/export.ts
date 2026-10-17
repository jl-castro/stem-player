import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const expected = locals.runtime?.env?.ADMIN_EXPORT_TOKEN;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !token || token !== expected) return new Response('No autorizado', { status: 401 });
  const db = locals.runtime?.env?.DB;
  if (!db) return new Response('D1 no configurado', { status: 503 });
  const rows = await db.prepare('SELECT p.participant_code, p.name, p.age, p.response_date, p.submitted_at, a.item_number, a.answer FROM participants p JOIN answers a ON a.participant_id = p.id ORDER BY p.submitted_at, a.item_number').all();
  const csv = ['participant_code,name,age,response_date,submitted_at,item_number,answer', ...rows.results.map((r: any) => [r.participant_code,r.name,r.age,r.response_date,r.submitted_at,r.item_number,r.answer].map((v: any) => `"${String(v ?? '').replaceAll('"','""')}"`).join(','))].join('\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="respuestas-vocacional.csv"' } });
};
