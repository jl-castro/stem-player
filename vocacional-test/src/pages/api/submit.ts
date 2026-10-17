import type { APIRoute } from 'astro';
import { validateSubmission } from '../../lib/validation';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const result = validateSubmission(body);
    if (!result.ok) return new Response(JSON.stringify({ error: result.errors.join(' ') }), { status: 400, headers: { 'content-type': 'application/json' } });
    const { data } = result;
    const db = locals.runtime?.env?.DB;
    if (!db) return new Response(JSON.stringify({ error: 'La base D1 no está configurada en este entorno.' }), { status: 503, headers: { 'content-type': 'application/json' } });
    const participantId = crypto.randomUUID();
    const participantCode = data.participantCode || `AUTO-${participantId}`;
    const submittedAt = new Date().toISOString();
    await db.prepare('INSERT INTO participants (id, participant_code, name, age, response_date, submitted_at, submission_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(participantId, participantCode, data.name, data.age === '' ? null : data.age, data.responseDate, submittedAt, data.submissionId).run();
    const answers = Object.entries(data.answers).map(([item, answer]) => db.prepare('INSERT INTO answers (participant_id, item_number, answer, created_at) VALUES (?, ?, ?, ?)').bind(participantId, Number(item), answer, submittedAt));
    answers.push(db.prepare('INSERT INTO answers (participant_id, item_number, answer, created_at) VALUES (?, 81, ?, ?)').bind(participantId, JSON.stringify(data.selectedTopics), submittedAt));
    answers.push(...Object.entries(data.openAnswers).map(([key, value]) => db.prepare('INSERT INTO answers (participant_id, item_number, answer, created_at) VALUES (?, ?, ?, ?)').bind(participantId, -(['career_now','career_other','attraction'].indexOf(key) + 1), value, submittedAt)));
    await db.batch(answers);
    return new Response(JSON.stringify({ ok: true, submissionId: data.submissionId }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes('UNIQUE') ? 'Este código de participante o identificador de envío ya fue registrado.' : 'No se pudo guardar la respuesta.';
    return new Response(JSON.stringify({ error: message }), { status: error instanceof Error && error.message.includes('UNIQUE') ? 409 : 500, headers: { 'content-type': 'application/json' } });
  }
};
