import { Injectable, signal } from '@angular/core';

/**
 * Mantiene la pantalla encendida vía Screen Wake Lock API mientras la reproducción lo requiere.
 * Si el navegador no soporta la API o falla la solicitud, la app sigue funcionando con normalidad.
 */
@Injectable({ providedIn: 'root' })
export class ScreenWakeLockService {
  readonly supported = signal(this.detectSupport());
  readonly active = signal(false);
  readonly error = signal<string | null>(null);

  private sentinel: WakeLockSentinel | null = null;
  private desired = false;
  private requestInFlight: Promise<void> | null = null;
  private onSentinelRelease: (() => void) | null = null;

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.desired) {
      void this.ensureAcquired();
    }
  };

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  /**
   * Indica si la pantalla debe permanecer activa (p. ej. cuando `status === 'playing'`).
   */
  async setDesired(shouldHold: boolean): Promise<void> {
    this.desired = shouldHold;
    if (!shouldHold) {
      await this.releaseLock();
      return;
    }
    await this.ensureAcquired();
  }

  /** Libera el lock y deja de intentar adquirirlo (p. ej. al salir del reproductor). */
  async releaseLock(): Promise<void> {
    this.desired = false;
    await this.releaseSentinel();
    this.active.set(false);
  }

  private detectSupport(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      typeof navigator.wakeLock?.request === 'function'
    );
  }

  private async ensureAcquired(): Promise<void> {
    if (!this.desired || !this.supported()) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    if (this.sentinel && !this.sentinel.released) {
      this.active.set(true);
      return;
    }
    if (this.requestInFlight) {
      return this.requestInFlight;
    }

    this.requestInFlight = this.requestLock().finally(() => {
      this.requestInFlight = null;
    });
    return this.requestInFlight;
  }

  private async requestLock(): Promise<void> {
    if (!this.desired || !this.supported()) {
      return;
    }

    try {
      const lock = await navigator.wakeLock!.request('screen');

      if (!this.desired) {
        await lock.release();
        return;
      }

      await this.releaseSentinel();
      this.attachSentinel(lock);
      this.error.set(null);
      this.active.set(true);
    } catch (e) {
      this.active.set(false);
      this.error.set(this.toErrorMessage(e));
    }
  }

  private attachSentinel(lock: WakeLockSentinel): void {
    this.sentinel = lock;
    this.onSentinelRelease = () => {
      this.active.set(false);
      this.sentinel = null;
      this.detachSentinelListener();

      if (this.desired && document.visibilityState === 'visible') {
        void this.ensureAcquired();
      }
    };
    lock.addEventListener('release', this.onSentinelRelease);
  }

  private detachSentinelListener(): void {
    if (this.sentinel && this.onSentinelRelease) {
      this.sentinel.removeEventListener('release', this.onSentinelRelease);
    }
    this.onSentinelRelease = null;
  }

  private async releaseSentinel(): Promise<void> {
    const current = this.sentinel;
    if (!current) {
      return;
    }

    this.detachSentinelListener();
    this.sentinel = null;

    if (!current.released) {
      try {
        await current.release();
      } catch {
        // Ignorar: el navegador puede haber liberado el lock ya.
      }
    }

    this.active.set(false);
  }

  private toErrorMessage(e: unknown): string {
    if (e instanceof DOMException) {
      return e.message || e.name;
    }
    if (e instanceof Error) {
      return e.message;
    }
    return String(e);
  }
}
