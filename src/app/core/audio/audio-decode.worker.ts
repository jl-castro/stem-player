/// <reference lib="webworker" />

import { audioBufferToPcm, getOfflineAudioContextConstructor } from './pcm-from-audio-buffer';
import type { DecodedPcm } from './decoded-pcm';

interface DecodeRequest {
  type: 'decode';
  id: string;
  arrayBuffer: ArrayBuffer;
}

interface DecodeSuccess {
  type: 'decoded';
  id: string;
  pcm: DecodedPcm;
}

interface DecodeUnsupported {
  type: 'unsupported';
  id: string;
}

interface DecodeError {
  type: 'error';
  id: string;
  message: string;
}

type DecodeResponse = DecodeSuccess | DecodeUnsupported | DecodeError;

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const msg = event.data;
  if (msg.type !== 'decode') {
    return;
  }

  const OfflineCtx = getOfflineAudioContextConstructor();
  if (!OfflineCtx) {
    const response: DecodeUnsupported = { type: 'unsupported', id: msg.id };
    self.postMessage(response satisfies DecodeResponse);
    return;
  }

  try {
    const offline = new OfflineCtx(1, 1, 44_100);
    const audioBuffer = await offline.decodeAudioData(msg.arrayBuffer.slice(0));
    const pcm = audioBufferToPcm(audioBuffer);
    const response: DecodeSuccess = { type: 'decoded', id: msg.id, pcm };
    self.postMessage(response satisfies DecodeResponse);
  } catch (e) {
    const response: DecodeError = {
      type: 'error',
      id: msg.id,
      message: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(response satisfies DecodeResponse);
  }
};
