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
