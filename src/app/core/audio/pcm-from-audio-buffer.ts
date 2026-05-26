import type { DecodedPcm } from './decoded-pcm';

export function audioBufferToPcm(audioBuffer: AudioBuffer): DecodedPcm {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch += 1) {
    channelData.push(audioBuffer.getChannelData(ch).slice());
  }
  const durationMs = Math.round(audioBuffer.duration * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Duración inválida o cero');
  }
  return {
    sampleRate: audioBuffer.sampleRate,
    length: audioBuffer.length,
    numberOfChannels: audioBuffer.numberOfChannels,
    channelData,
    durationMs,
  };
}

export function getAudioContextConstructor(): typeof AudioContext {
  const Ctx =
    typeof globalThis !== 'undefined'
      ? (globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctx) {
    throw new Error('Web Audio API is not available in this environment.');
  }
  return Ctx;
}

export function getOfflineAudioContextConstructor(): typeof OfflineAudioContext | null {
  const Offline =
    typeof globalThis !== 'undefined'
      ? (globalThis.OfflineAudioContext ??
        (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext)
      : undefined;
  return Offline ?? null;
}
