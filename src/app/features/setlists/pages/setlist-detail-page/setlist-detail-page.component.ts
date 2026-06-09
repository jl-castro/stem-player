import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, from, switchMap, tap } from 'rxjs';

import type { Project, Setlist } from '../../../../core/models';
import {
  reorderSetlistEntriesInPlace,
  sortSetlistEntriesByOrder,
} from '../../../../core/utils/setlist-order.util';
import {
  LucideArrowLeft,
  LucideChevronDown,
  LucideGripVertical,
  LucidePlay,
  LucideTrash2,
} from '../../../../shared/icons/app-lucide-icons';
import type { PackPreloadStatus } from '../../services/setlist-preload.service';
import { SetlistPreloadService } from '../../services/setlist-preload.service';
import { SetlistStorageService } from '../../services/setlist-storage.service';
import { ProjectStorageService } from '../../../projects/services/project-storage.service';

@Component({
  selector: 'app-setlist-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    DragDropModule,
    LucideArrowLeft,
    LucideChevronDown,
    LucideGripVertical,
    LucidePlay,
    LucideTrash2,
  ],
  templateUrl: './setlist-detail-page.component.html',
  styleUrl: './setlist-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly setlistStorage = inject(SetlistStorageService);
  private readonly projectStorage = inject(ProjectStorageService);
  readonly setlistPreload = inject(SetlistPreloadService);

  readonly setlist = signal<Setlist | null>(null);
  readonly projects = signal<readonly Project[]>([]);
  readonly pageLoading = signal(true);
  readonly pageError = signal<string | null>(null);
  readonly editorError = signal<string | null>(null);
  readonly editorBusy = signal(false);
  readonly preloading = signal(false);
  readonly addPackId = signal('');
  readonly packPickerOpen = signal(false);

  @ViewChild('packPicker') private packPickerRef?: ElementRef<HTMLElement>;

  readonly setlistPreloadProgress = this.setlistPreload.setlistPreloadProgress;

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.pageLoading.set(true);
          this.pageError.set(null);
          this.editorError.set(null);
          this.addPackId.set('');
          this.packPickerOpen.set(false);
        }),
        switchMap((pm) => {
          const setlistId = pm.get('setlistId');
          if (!setlistId) {
            this.pageLoading.set(false);
            this.pageError.set('Falta el id del setlist.');
            return EMPTY;
          }
          return from(
            Promise.all([
              this.setlistStorage.getSetlistById(setlistId),
              this.projectStorage.listProjects(),
            ]),
          ).pipe(
            tap(([setlist, projectList]) => {
              if (!setlist) {
                this.pageError.set('Setlist no encontrado.');
                this.setlist.set(null);
              } else {
                this.setlist.set(setlist);
                this.projects.set(projectList);
                for (const entry of setlist.entries) {
                  this.setlistPreload.refreshStatusForPack(entry.packId);
                }
              }
              this.pageLoading.set(false);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  pageBusy(): boolean {
    return this.pageLoading() || this.editorBusy() || this.preloading();
  }

  sortedEntries(setlist: Setlist) {
    return sortSetlistEntriesByOrder(setlist.entries);
  }

  packName(packId: string): string {
    return this.projects().find((p) => p.id === packId)?.name ?? 'Pack eliminado';
  }

  preloadStatusLabel(packId: string): string {
    const map: Record<PackPreloadStatus, string> = {
      pending: 'Pendiente',
      loading: 'Precargando…',
      ready: 'Listo',
      error: 'Error',
    };
    return map[this.setlistPreload.getStatus(packId)];
  }

  packsAvailableToAdd(setlist: Setlist): Project[] {
    const used = new Set(setlist.entries.map((e) => e.packId));
    return this.projects().filter((p) => !used.has(p.id));
  }

  addPackLabel(): string {
    const id = this.addPackId();
    if (!id) {
      return 'Elegir pack…';
    }
    return this.packName(id);
  }

  togglePackPicker(event: Event): void {
    event.stopPropagation();
    if (this.editorBusy()) {
      return;
    }
    this.packPickerOpen.update((open) => !open);
  }

  selectPackToAdd(packId: string, event: Event): void {
    event.stopPropagation();
    this.addPackId.set(packId);
    this.packPickerOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.packPickerOpen()) {
      return;
    }
    const root = this.packPickerRef?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.packPickerOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.packPickerOpen.set(false);
    }
  }

  async onAddPack(setlistId: string): Promise<void> {
    const packId = this.addPackId();
    if (!packId || this.pageBusy()) {
      return;
    }
    const current = this.setlist();
    if (!current) {
      return;
    }
    this.editorBusy.set(true);
    this.editorError.set(null);
    try {
      const entries = sortSetlistEntriesByOrder(current.entries);
      entries.push({
        id: crypto.randomUUID(),
        packId,
        order: entries.length,
      });
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlist.set(updated);
      this.addPackId.set('');
      this.packPickerOpen.set(false);
      this.setlistPreload.refreshStatusForPack(packId);
    } catch (e) {
      this.editorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.editorBusy.set(false);
    }
  }

  async onRemoveEntry(setlistId: string, entryId: string): Promise<void> {
    if (this.pageBusy()) {
      return;
    }
    const current = this.setlist();
    if (!current) {
      return;
    }
    this.editorBusy.set(true);
    this.editorError.set(null);
    try {
      const entries = current.entries.filter((e) => e.id !== entryId);
      entries.forEach((e, i) => {
        e.order = i;
      });
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlist.set(updated);
    } catch (e) {
      this.editorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.editorBusy.set(false);
    }
  }

  async onEntryDrop(setlistId: string, event: CdkDragDrop<unknown>): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.pageBusy()) {
      return;
    }
    const current = this.setlist();
    if (!current) {
      return;
    }
    const entries = sortSetlistEntriesByOrder(current.entries).map((e) => ({ ...e }));
    reorderSetlistEntriesInPlace(entries, event.previousIndex, event.currentIndex);
    this.editorBusy.set(true);
    this.editorError.set(null);
    try {
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlist.set(updated);
    } catch (e) {
      this.editorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.editorBusy.set(false);
    }
  }

  async onPreload(): Promise<void> {
    const current = this.setlist();
    if (!current || this.pageBusy() || current.entries.length === 0) {
      return;
    }
    this.preloading.set(true);
    try {
      const result = await this.setlistPreload.warmSetlist(current);
      this.setlistPreload.setlistPreloadProgress.set({
        loaded: result.readyCount,
        total: result.total,
        label: this.setlistPreload.preloadCompleteMessage(result),
      });
      window.setTimeout(() => this.setlistPreload.clearSetlistPreloadProgress(), 4000);
    } finally {
      this.preloading.set(false);
    }
  }

  onPlay(): void {
    const current = this.setlist();
    if (!current) {
      return;
    }
    const entries = sortSetlistEntriesByOrder(current.entries);
    const first = entries[0];
    if (!first) {
      return;
    }
    void this.router.navigate(['/player', first.packId], {
      queryParams: { setlist: current.id, entry: 0 },
    });
  }
}
