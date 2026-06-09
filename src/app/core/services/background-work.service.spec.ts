import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AudioDecodeService } from './audio-decode.service';
import { AudioSessionCacheService } from './audio-session-cache.service';
import {
  BackgroundWorkAbortedError,
  BackgroundWorkService,
  isBackgroundWorkAborted,
} from './background-work.service';

describe('BackgroundWorkService', () => {
  let service: BackgroundWorkService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BackgroundWorkService,
        AudioSessionCacheService,
        AudioDecodeService,
      ],
    });
    service = TestBed.inject(BackgroundWorkService);
  });

  it('tracks active work and builds a status line', () => {
    const first = service.track('preload', 'Precargando setlist…');
    expect(service.isActive()).toBe(true);
    expect(service.statusLine()).toBe('Precargando setlist…');

    service.track('cache-warm', 'Precargando pack…');
    expect(service.statusLine()).toBe('2 procesos en segundo plano');

    first.release();
    expect(service.statusLine()).toBe('Precargando pack…');
  });

  it('resets the abort signal even when no tasks are active', () => {
    const signal = service.signal;
    service.cancelAll();
    expect(signal.aborted).toBe(true);
    expect(service.signal.aborted).toBe(false);
  });

  it('aborts in-flight work and clears session cache on cancelAll', () => {
    const cache = TestBed.inject(AudioSessionCacheService);
    const decode = TestBed.inject(AudioDecodeService);
    spyOn(decode, 'cancelAllPending').and.callThrough();
    spyOn(cache, 'clear').and.callThrough();
    spyOn(cache, 'clearPinnedProjectIds').and.callThrough();

    const handle = service.track('preload', 'Precargando…');
    const signal = service.signal;
    service.cancelAll();

    expect(signal.aborted).toBe(true);
    expect(decode.cancelAllPending).toHaveBeenCalled();
    expect(cache.clear).toHaveBeenCalled();
    expect(cache.clearPinnedProjectIds).toHaveBeenCalled();
    expect(service.isActive()).toBe(false);

    handle.release();
    expect(service.isActive()).toBe(false);
  });

  it('notifies cancel listeners', () => {
    const listener = jasmine.createSpy('listener');
    service.onCancel(listener);
    service.track('import', 'Importando…');
    service.cancelAll();
    expect(listener).toHaveBeenCalled();
  });

  it('detects aborted errors', () => {
    expect(isBackgroundWorkAborted(new BackgroundWorkAbortedError())).toBe(true);
    expect(isBackgroundWorkAborted(new Error('Cancelado'))).toBe(true);
    expect(isBackgroundWorkAborted(new Error('other'))).toBe(false);
  });
});
