import { describe, expect, it } from 'vitest';
import { allScoredQuestions } from '../src/data/questions';
import { validateSubmission } from '../src/lib/validation';

const base = () => ({ participantCode: 'TEST-001', name: 'Estudiante de prueba', age: '', responseDate: '2026-10-17', submissionId: '00000000-0000-4000-8000-000000000001', answers: Object.fromEntries(allScoredQuestions.map(q => [q.number, q.kind === 'scale' ? '2' : 'A'])), selectedTopics: [1, 4, 12], openAnswers: { career_now: 'Ingeniería', career_other: 'Diseño', attraction: 'Resolver problemas' } });

describe('validación del test vocacional', () => {
  it('acepta un envío completo', () => expect(validateSubmission(base()).ok).toBe(true));
  it('rechaza respuestas incompletas', () => { const data = base(); delete data.answers[1]; expect(validateSubmission(data).ok).toBe(false); });
  it('rechaza valores fuera de 0–3 en A/B', () => { const data = base(); data.answers[1] = '4'; expect(validateSubmission(data).ok).toBe(false); });
  it('rechaza letras fuera del rango en C', () => { const data = base(); data.answers[73] = 'G'; expect(validateSubmission(data).ok).toBe(false); });
  it('rechaza más de tres temas', () => { const data = base(); data.selectedTopics = [1,2,3,4]; expect(validateSubmission(data).ok).toBe(false); });
  it('acepta el código de participante vacío porque es opcional', () => { const data = base(); data.participantCode = ''; expect(validateSubmission(data).ok).toBe(true); });
  it('exige el nombre del participante', () => { const data = base(); data.name = ''; expect(validateSubmission(data).ok).toBe(false); });
});
