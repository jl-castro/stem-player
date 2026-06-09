import { provideZonelessChangeDetection } from '@angular/core';

import { TestBed } from '@angular/core/testing';



import type { Setlist } from '../../../core/models';

import { AudioSessionCacheService } from '../../../core/services/audio-session-cache.service';

import { ProjectStorageService } from '../../projects/services/project-storage.service';

import { PlayerPlaybackService } from '../../player/services/player-playback.service';

import { SetlistPreloadService } from './setlist-preload.service';



describe('SetlistPreloadService playback warm', () => {

  let service: SetlistPreloadService;

  let warmPackSpy: jasmine.Spy;



  const setlist: Setlist = {

    id: 'set-a',

    name: 'Test',

    entries: [

      { id: 'e1', packId: 'pack-1', order: 0 },

      { id: 'e2', packId: 'pack-2', order: 1 },

    ],

    createdAt: '2020-01-01',

    updatedAt: '2020-01-01',

  };



  beforeEach(() => {

    warmPackSpy = jasmine.createSpy('warmPackById').and.resolveTo('ready');

    TestBed.configureTestingModule({

      providers: [

        provideZonelessChangeDetection(),

        SetlistPreloadService,

        AudioSessionCacheService,

        { provide: ProjectStorageService, useValue: {} },

        {

          provide: PlayerPlaybackService,

          useValue: { isProjectWarm: () => false, isProjectCached: () => false },

        },

      ],

    });

    service = TestBed.inject(SetlistPreloadService);

    spyOn(service, 'warmPackById').and.callFake(warmPackSpy);

  });



  it('warms the next pack only after halfway while playing', () => {

    service.warmNextWhenHalfway(setlist, 0, 10_000, 30_000, true);

    expect(warmPackSpy).not.toHaveBeenCalled();



    service.warmNextWhenHalfway(setlist, 0, 15_000, 30_000, true);

    expect(warmPackSpy).toHaveBeenCalledWith('pack-2', 'pack-1');



    warmPackSpy.calls.reset();

    service.warmNextWhenHalfway(setlist, 0, 20_000, 30_000, true);

    expect(warmPackSpy).not.toHaveBeenCalled();

  });



  it('does not warm when paused', () => {

    service.warmNextWhenHalfway(setlist, 0, 20_000, 30_000, false);

    expect(warmPackSpy).not.toHaveBeenCalled();

  });



  it('clears cache when switching to another setlist context', () => {

    service.switchToSetlistContext('set-a');

    service.statusByPackId.set(new Map([['pack-1', 'ready']]));

    service.switchToSetlistContext('set-b');

    expect(service.statusByPackId().size).toBe(0);

  });

  it('counts as ready when the pack is already in session cache', () => {

    const cache = TestBed.inject(AudioSessionCacheService);

    cache.set('pack-2', 'fp', new Map([['t1', { length: 100, numberOfChannels: 2 } as AudioBuffer]]));

    service.statusByPackId.set(new Map([['pack-2', 'pending']]));

    expect(service.isReady('pack-2')).toBe(true);

    expect(service.getStatus('pack-2')).toBe('ready');

  });

});


