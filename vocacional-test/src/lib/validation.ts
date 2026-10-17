import { z } from 'zod';
import { allScoredQuestions, topics } from '../data/questions';

const answerKeys = allScoredQuestions.map(q => String(q.number));
const answersSchema = z.record(z.string(), z.string());
export const submissionSchema = z.object({
  participantCode: z.string().trim().max(80).optional().default(''),
  name: z.string().trim().min(1).max(160),
  age: z.union([z.literal(''), z.coerce.number().int().min(5).max(120)]).optional().default(''),
  responseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submissionId: z.uuid(),
  answers: answersSchema,
  selectedTopics: z.array(z.coerce.number().int().min(1).max(13)).max(3),
  openAnswers: z.object({ career_now: z.string().trim().max(2000), career_other: z.string().trim().max(2000), attraction: z.string().trim().max(4000) })
});

export function validateSubmission(input: unknown) {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map(i => i.message) };
  const data = parsed.data;
  const missing = answerKeys.filter(key => !data.answers[key]);
  if (missing.length) return { ok: false as const, errors: [`Faltan respuestas en los ítems: ${missing.join(', ')}`] };
  for (const q of allScoredQuestions) {
    const value = data.answers[String(q.number)];
    const valid = q.kind === 'scale' ? ['0','1','2','3'].includes(value) : q.kind === 'letter' ? ['A','B','C','D','E','F'].slice(0, q.number >= 82 ? 4 : 6).includes(value) : true;
    if (!valid) return { ok: false as const, errors: [`La respuesta del ítem ${q.number} no es válida.`] };
  }
  if (data.selectedTopics.some(topic => !topics[topic - 1])) return { ok: false as const, errors: ['Hay un tema seleccionado que no existe.'] };
  return { ok: true as const, data };
}
