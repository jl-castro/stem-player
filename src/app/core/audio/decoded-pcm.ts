/** PCM plano transferido desde el worker de decode (copia de canales). */
export interface DecodedPcm {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  channelData: Float32Array[];
  durationMs: number;
}

export interface DecodeWorkerResult {
  pcm: DecodedPcm;
}

/** Suelta Float32Array del PCM tras crear el AudioBuffer (reduce pico de RAM). */
export function releaseDecodedPcm(pcm: DecodedPcm): void {
  pcm.channelData.length = 0;
}
