const STEM_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

export function stemColorForIndex(index: number): string {
  return STEM_PALETTE[index % STEM_PALETTE.length] ?? '#6b7280';
}

export function basenameWithoutExt(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '');
  const without = base.replace(/\.[^.]+$/i, '');
  return without.trim() || base.trim() || 'Pista';
}

export function guessMimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lower.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  return 'application/octet-stream';
}

export function isAllowedAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'mp3' || ext === 'wav' || ext === 'm4a';
}

/**
 * Decodifica un blob en el `AudioContext` dado y devuelve la duración en ms.
 * Reutiliza el mismo contexto para varios archivos (menos overhead que un contexto por archivo).
 */
export async function decodeBlobDurationMs(blob: Blob, ctx: AudioContext): Promise<number> {
  const ab = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(ab.slice(0));
  const ms = Math.round(buffer.duration * 1000);
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error('Duración inválida o cero');
  }
  return ms;
}
