import { computed, inject, Injectable, signal } from '@angular/core';

import { AudioDecodeService } from './audio-decode.service';
import { AudioSessionCacheService } from './audio-session-cache.service';

export type BackgroundWorkKind = 'preload' | 'cache-warm' | 'import' | 'decode';

export interface BackgroundWorkTask {
  id: string;
  kind: BackgroundWorkKind;
  label: string;
}

export class BackgroundWorkAbortedError extends Error {
  override readonly name = 'BackgroundWorkAbortedError';

  constructor(message = 'Cancelado') {
    super(message);
  }
}

export function isBackgroundWorkAborted(error: unknown): boolean {
  return (
    error instanceof BackgroundWorkAbortedError ||
    (error instanceof Error && error.message === 'Cancelado')
  );
}

export interface BackgroundWorkHandle {
  release(): void;
  setLabel(label: string): void;
}

@Injectable({ providedIn: 'root' })
export class BackgroundWorkService {
  private readonly sessionCache = inject(AudioSessionCacheService);
  private readonly decode = inject(AudioDecodeService);

  private readonly tasks = signal<readonly BackgroundWorkTask[]>([]);
  private abortController = new AbortController();
  private readonly cancelListeners = new Set<() => void>();

  readonly activeTasks = this.tasks.asReadonly();
  readonly isActive = computed(() => this.tasks().length > 0);
  readonly statusLine = computed(() => {
    const active = this.tasks();
    if (active.length === 0) {
      return '';
    }
    if (active.length === 1) {
      return active[0]!.label;
    }
    return `${active.length} procesos en segundo plano`;
  });

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  track(kind: BackgroundWorkKind, label: string): BackgroundWorkHandle {
    const id = crypto.randomUUID();
    this.tasks.update((current) => [...current, { id, kind, label }]);
    return {
      release: () => {
        this.tasks.update((current) => current.filter((task) => task.id !== id));
      },
      setLabel: (nextLabel: string) => {
        this.tasks.update((current) =>
          current.map((task) => (task.id === id ? { ...task, label: nextLabel } : task)),
        );
      },
    };
  }

  throwIfAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new BackgroundWorkAbortedError();
    }
  }

  onCancel(listener: () => void): () => void {
    this.cancelListeners.add(listener);
    return () => {
      this.cancelListeners.delete(listener);
    };
  }

  /** Señal propia por operación; se cancela con Detener o al llamar `complete`. */
  beginOperation(): { signal: AbortSignal; complete: () => void } {
    const controller = new AbortController();
    const unlink = this.onCancel(() => controller.abort());
    return {
      signal: controller.signal,
      complete: unlink,
    };
  }

  cancelAll(): void {
    const hadActiveTasks = this.isActive();

    this.abortController.abort();
    this.abortController = new AbortController();

    if (hadActiveTasks) {
      this.decode.cancelAllPending();
      this.sessionCache.clear();
      this.sessionCache.clearPinnedProjectIds();
      this.tasks.set([]);
    }

    for (const listener of this.cancelListeners) {
      listener();
    }
  }
}
