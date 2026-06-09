import { Injectable } from '@angular/core';

import type { DecodedPcm } from '../audio/decoded-pcm';
import {
  audioBufferToPcm,
  getAudioContextConstructor,
} from '../audio/pcm-from-audio-buffer';

interface PendingDecode {
  resolve: (pcm: DecodedPcm) => void;
  reject: (err: Error) => void;
  arrayBuffer: ArrayBuffer;
}

@Injectable({ providedIn: 'root' })
export class AudioDecodeService {
  private worker: Worker | null = null;
  /** false cuando el worker no puede decodificar (p. ej. sin OfflineAudioContext). */
  private workerDecodeEnabled: boolean | null = null;
  private readonly pending = new Map<string, PendingDecode>();
  private nextId = 0;

  async decodeBlobToPcm(blob: Blob): Promise<DecodedPcm> {
    const arrayBuffer = await blob.arrayBuffer();
    return this.decodeArrayBufferToPcm(arrayBuffer);
  }

  async decodeArrayBufferToPcm(arrayBuffer: ArrayBuffer): Promise<DecodedPcm> {
    if (this.workerDecodeEnabled === false) {
      return this.decodeOnMainThread(arrayBuffer);
    }

    const id = `decode-${++this.nextId}`;
    const copy = arrayBuffer.slice(0);

    return new Promise<DecodedPcm>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, arrayBuffer: copy });
      try {
        const worker = this.getWorker();
        worker.postMessage({ type: 'decode', id, arrayBuffer: copy });
      } catch {
        this.pending.delete(id);
        void this.decodeOnMainThread(arrayBuffer).then(resolve).catch(reject);
      }
    });
  }

  /** Rechaza decodificaciones pendientes (p. ej. al detener procesos en segundo plano). */
  cancelAllPending(): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(new Error('Cancelado'));
    }
  }

  pcmToAudioBuffer(ctx: BaseAudioContext, pcm: DecodedPcm): AudioBuffer {
    const buffer = ctx.createBuffer(pcm.numberOfChannels, pcm.length, pcm.sampleRate);
    for (let ch = 0; ch < pcm.numberOfChannels; ch += 1) {
      buffer.copyToChannel(pcm.channelData[ch]!, ch);
    }
    return buffer;
  }

  private async decodeOnMainThread(arrayBuffer: ArrayBuffer): Promise<DecodedPcm> {
    const Ctx = getAudioContextConstructor();
    const ctx = new Ctx();
    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      return audioBufferToPcm(buffer);
    } finally {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../audio/audio-decode.worker', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (event: MessageEvent) => this.onWorkerMessage(event);
      this.worker.onerror = () => {
        this.workerDecodeEnabled = false;
        this.failoverPendingToMainThread();
      };
    }
    return this.worker;
  }

  private onWorkerMessage(event: MessageEvent): void {
    const data = event.data as {
      type: string;
      id: string;
      pcm?: DecodedPcm;
      message?: string;
    };
    const pending = this.pending.get(data.id);
    if (!pending) {
      return;
    }

    if (data.type === 'unsupported') {
      this.workerDecodeEnabled = false;
      this.pending.delete(data.id);
      void this.decodeOnMainThread(pending.arrayBuffer).then(pending.resolve).catch(pending.reject);
      return;
    }

    this.pending.delete(data.id);

    if (data.type === 'decoded' && data.pcm) {
      this.workerDecodeEnabled = true;
      pending.resolve(data.pcm);
      return;
    }
    if (data.type === 'error') {
      const msg = data.message ?? '';
      if (/OfflineAudioContext/i.test(msg)) {
        this.workerDecodeEnabled = false;
        void this.decodeOnMainThread(pending.arrayBuffer).then(pending.resolve).catch(pending.reject);
        return;
      }
      pending.reject(new Error(msg || 'Decodificación fallida'));
      return;
    }
    pending.reject(new Error('Respuesta desconocida del worker de audio.'));
  }

  private failoverPendingToMainThread(): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      void this.decodeOnMainThread(pending.arrayBuffer).then(pending.resolve).catch(pending.reject);
    }
  }
}
