import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Router, RouterLink } from '@angular/router';

import type { Project, Setlist } from '../../../../core/models';
import {
  reorderSetlistEntriesInPlace,
  sortSetlistEntriesByOrder,
} from '../../../../core/utils/setlist-order.util';
import { sortTracksByOrder } from '../../../../core/utils/track-order.util';
import {
  LucideCheck,
  LucideGripVertical,
  LucideList,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '../../../../shared/icons/app-lucide-icons';
import type { PackPreloadStatus } from '../../../setlists/services/setlist-preload.service';
import { SetlistPreloadService } from '../../../setlists/services/setlist-preload.service';
import { SetlistStorageService } from '../../../setlists/services/setlist-storage.service';
import { ProjectImportService } from '../../services/project-import.service';
import { ProjectStorageService } from '../../services/project-storage.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [
    RouterLink,
    DragDropModule,
    LucideList,
    LucidePencil,
    LucideTrash2,
    LucideUpload,
    LucideCheck,
    LucideX,
    LucidePlus,
    LucidePlay,
    LucideGripVertical,
  ],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  private readonly storage = inject(ProjectStorageService);
  private readonly importService = inject(ProjectImportService);
  private readonly setlistStorage = inject(SetlistStorageService);
  readonly setlistPreload = inject(SetlistPreloadService);
  private readonly router = inject(Router);

  readonly projects = signal<readonly Project[]>([]);
  readonly setlists = signal<readonly Setlist[]>([]);
  readonly listLoading = signal(true);
  readonly setlistsLoading = signal(true);
  readonly listError = signal<string | null>(null);
  readonly setlistsError = signal<string | null>(null);

  readonly newProjectName = signal('');
  readonly selectedFiles = signal<File[]>([]);
  readonly createError = signal<string | null>(null);
  readonly isCreating = signal(false);
  readonly createPhase = signal<'idle' | 'decoding' | 'persisting'>('idle');

  readonly createPhaseMessage = computed(() => {
    switch (this.createPhase()) {
      case 'decoding':
        return 'Analizando archivos…';
      case 'persisting':
        return 'Guardando en el dispositivo…';
      default:
        return '';
    }
  });

  readonly showCreateHint = computed(
    () => !this.isCreating() && (this.createDisabled() || this.createError() !== null),
  );

  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');
  readonly renameError = signal<string | null>(null);

  readonly editingTracksId = signal<string | null>(null);
  readonly tracksBusy = signal(false);
  readonly tracksPhase = signal<'idle' | 'decoding' | 'persisting'>('idle');
  readonly tracksError = signal<string | null>(null);

  readonly tracksPhaseMessage = computed(() => {
    switch (this.tracksPhase()) {
      case 'decoding':
        return 'Analizando archivos…';
      case 'persisting':
        return 'Guardando en el dispositivo…';
      default:
        return '';
    }
  });

  readonly newSetlistName = signal('');
  readonly setlistCreateError = signal<string | null>(null);
  readonly isCreatingSetlist = signal(false);
  readonly editingSetlistId = signal<string | null>(null);
  readonly setlistRenameId = signal<string | null>(null);
  readonly setlistRenameDraft = signal('');
  readonly setlistRenameError = signal<string | null>(null);
  readonly setlistEditorError = signal<string | null>(null);
  readonly setlistEditorBusy = signal(false);
  readonly setlistPreloadingId = signal<string | null>(null);
  readonly addPackToSetlistId = signal('');

  readonly setlistPreloadProgress = this.setlistPreload.setlistPreloadProgress;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly addTracksInput = viewChild<ElementRef<HTMLInputElement>>('addTracksInput');

  constructor() {
    void this.refreshProjects();
    void this.refreshSetlists();
  }

  async refreshProjects(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);
    try {
      const list = await this.storage.listProjects();
      this.projects.set(
        list.map((p) => ({
          ...p,
          tracks: sortTracksByOrder(p.tracks),
        })),
      );
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.listLoading.set(false);
    }
  }

  onNewNameInput(ev: Event): void {
    this.newProjectName.set((ev.target as HTMLInputElement).value);
    this.createError.set(null);
  }

  onFilesSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    this.selectedFiles.set(list);
    this.createError.set(null);
  }

  clearFileSelection(): void {
    this.selectedFiles.set([]);
    const el = this.fileInput()?.nativeElement;
    if (el) {
      el.value = '';
    }
  }

  async onCreateProject(): Promise<void> {
    if (this.createDisabled()) {
      return;
    }
    this.createError.set(null);
    this.createPhase.set('decoding');
    this.isCreating.set(true);
    try {
      await this.importService.createProjectFromImportedFiles(
        this.newProjectName(),
        this.selectedFiles(),
        (phase) => this.createPhase.set(phase),
      );
      this.newProjectName.set('');
      this.clearFileSelection();
      await this.refreshProjects();
    } catch (e) {
      this.createError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.isCreating.set(false);
      this.createPhase.set('idle');
    }
  }

  createDisabled(): boolean {
    return (
      this.isCreating() ||
      this.tracksBusy() ||
      !this.newProjectName().trim() ||
      this.selectedFiles().length === 0
    );
  }

  pageBusy(): boolean {
    return (
      this.isCreating() ||
      this.tracksBusy() ||
      this.isCreatingSetlist() ||
      this.setlistEditorBusy() ||
      this.setlistPreloadingId() !== null
    );
  }

  async refreshSetlists(): Promise<void> {
    this.setlistsLoading.set(true);
    this.setlistsError.set(null);
    try {
      const list = await this.setlistStorage.listSetlists();
      this.setlists.set(list);
      for (const setlist of list) {
        for (const entry of setlist.entries) {
          this.setlistPreload.refreshStatusForPack(entry.packId);
        }
      }
    } catch (e) {
      this.setlistsError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.setlistsLoading.set(false);
    }
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

  setlistEntryCount(setlist: Setlist): number {
    return setlist.entries.length;
  }

  packsAvailableToAdd(setlist: Setlist): Project[] {
    const used = new Set(setlist.entries.map((e) => e.packId));
    return this.projects().filter((p) => !used.has(p.id));
  }

  onNewSetlistNameInput(ev: Event): void {
    this.newSetlistName.set((ev.target as HTMLInputElement).value);
    this.setlistCreateError.set(null);
  }

  async onCreateSetlist(): Promise<void> {
    const name = this.newSetlistName().trim();
    if (!name || this.pageBusy()) {
      return;
    }
    this.setlistCreateError.set(null);
    this.isCreatingSetlist.set(true);
    try {
      await this.setlistStorage.createSetlist(name);
      this.newSetlistName.set('');
      await this.refreshSetlists();
    } catch (e) {
      this.setlistCreateError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.isCreatingSetlist.set(false);
    }
  }

  startEditSetlist(setlist: Setlist): void {
    if (this.pageBusy()) {
      return;
    }
    this.cancelSetlistRename();
    this.cancelEditTracks();
    this.cancelRename();
    this.setlistEditorError.set(null);
    this.addPackToSetlistId.set('');
    this.editingSetlistId.set(setlist.id);
  }

  cancelEditSetlist(): void {
    this.editingSetlistId.set(null);
    this.setlistEditorError.set(null);
    this.addPackToSetlistId.set('');
  }

  editingSetlist(): Setlist | null {
    const id = this.editingSetlistId();
    if (!id) {
      return null;
    }
    return this.setlists().find((s) => s.id === id) ?? null;
  }

  onAddPackSelect(ev: Event): void {
    this.addPackToSetlistId.set((ev.target as HTMLSelectElement).value);
  }

  async onAddPackToSetlist(setlistId: string): Promise<void> {
    const packId = this.addPackToSetlistId();
    if (!packId || this.pageBusy()) {
      return;
    }
    const setlist = this.setlists().find((s) => s.id === setlistId);
    if (!setlist) {
      return;
    }
    this.setlistEditorBusy.set(true);
    this.setlistEditorError.set(null);
    try {
      const entries = sortSetlistEntriesByOrder(setlist.entries);
      entries.push({
        id: crypto.randomUUID(),
        packId,
        order: entries.length,
      });
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlists.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      this.addPackToSetlistId.set('');
      this.setlistPreload.refreshStatusForPack(packId);
    } catch (e) {
      this.setlistEditorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.setlistEditorBusy.set(false);
    }
  }

  async onRemoveSetlistEntry(setlistId: string, entryId: string): Promise<void> {
    if (this.pageBusy()) {
      return;
    }
    const setlist = this.setlists().find((s) => s.id === setlistId);
    if (!setlist) {
      return;
    }
    this.setlistEditorBusy.set(true);
    this.setlistEditorError.set(null);
    try {
      const entries = setlist.entries.filter((e) => e.id !== entryId);
      entries.forEach((e, i) => {
        e.order = i;
      });
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlists.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      this.setlistEditorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.setlistEditorBusy.set(false);
    }
  }

  async onSetlistEntryDrop(setlistId: string, event: CdkDragDrop<unknown>): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.pageBusy()) {
      return;
    }
    const setlist = this.setlists().find((s) => s.id === setlistId);
    if (!setlist) {
      return;
    }
    const entries = sortSetlistEntriesByOrder(setlist.entries).map((e) => ({ ...e }));
    reorderSetlistEntriesInPlace(entries, event.previousIndex, event.currentIndex);
    this.setlistEditorBusy.set(true);
    this.setlistEditorError.set(null);
    try {
      const updated = await this.setlistStorage.saveSetlistEntries(setlistId, entries);
      this.setlists.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      this.setlistEditorError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.setlistEditorBusy.set(false);
    }
  }

  async onPreloadSetlist(setlist: Setlist): Promise<void> {
    if (this.pageBusy() || setlist.entries.length === 0) {
      return;
    }
    this.setlistPreloadingId.set(setlist.id);
    try {
      await this.setlistPreload.warmSetlist(setlist);
      await this.refreshSetlists();
    } finally {
      this.setlistPreloadingId.set(null);
      this.setlistPreload.clearSetlistPreloadProgress();
    }
  }

  onPlaySetlist(setlist: Setlist): void {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const first = entries[0];
    if (!first) {
      return;
    }
    void this.router.navigate(['/player', first.packId], {
      queryParams: { setlist: setlist.id, entry: 0 },
    });
  }

  startSetlistRename(setlist: Setlist): void {
    if (this.pageBusy()) {
      return;
    }
    this.cancelEditSetlist();
    this.setlistRenameError.set(null);
    this.setlistRenameId.set(setlist.id);
    this.setlistRenameDraft.set(setlist.name);
  }

  cancelSetlistRename(): void {
    this.setlistRenameId.set(null);
    this.setlistRenameDraft.set('');
    this.setlistRenameError.set(null);
  }

  onSetlistRenameDraftInput(ev: Event): void {
    this.setlistRenameDraft.set((ev.target as HTMLInputElement).value);
    this.setlistRenameError.set(null);
  }

  async confirmSetlistRename(setlistId: string): Promise<void> {
    const name = this.setlistRenameDraft().trim();
    if (!name) {
      this.setlistRenameError.set('El nombre no puede estar vacío.');
      return;
    }
    if (this.pageBusy()) {
      return;
    }
    try {
      await this.setlistStorage.renameSetlist(setlistId, name);
      this.cancelSetlistRename();
      await this.refreshSetlists();
    } catch (e) {
      this.setlistRenameError.set(e instanceof Error ? e.message : String(e));
    }
  }

  async onDeleteSetlist(setlist: Setlist): Promise<void> {
    if (this.pageBusy()) {
      return;
    }
    const ok = window.confirm(`¿Eliminar el setlist «${setlist.name}»?`);
    if (!ok) {
      return;
    }
    try {
      await this.setlistStorage.deleteSetlist(setlist.id);
      if (this.editingSetlistId() === setlist.id) {
        this.cancelEditSetlist();
      }
      if (this.setlistRenameId() === setlist.id) {
        this.cancelSetlistRename();
      }
      await this.refreshSetlists();
    } catch (e) {
      this.setlistsError.set(e instanceof Error ? e.message : String(e));
    }
  }

  startEditTracks(project: Project): void {
    if (this.pageBusy()) {
      return;
    }
    this.tracksError.set(null);
    this.cancelRename();
    this.cancelEditSetlist();
    this.editingTracksId.set(project.id);
  }

  cancelEditTracks(): void {
    this.editingTracksId.set(null);
    this.tracksError.set(null);
    this.tracksPhase.set('idle');
    const el = this.addTracksInput()?.nativeElement;
    if (el) {
      el.value = '';
    }
  }

  async onAddTracksSelected(ev: Event, projectId: string): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length || this.pageBusy()) {
      return;
    }

    this.tracksError.set(null);
    this.tracksPhase.set('decoding');
    this.tracksBusy.set(true);
    try {
      await this.importService.addTracksToProject(projectId, files, (phase) =>
        this.tracksPhase.set(phase),
      );
      await this.refreshProjects();
    } catch (e) {
      this.tracksError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.tracksBusy.set(false);
      this.tracksPhase.set('idle');
    }
  }

  async onRemoveTrack(project: Project, trackId: string): Promise<void> {
    if (this.pageBusy()) {
      return;
    }

    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) {
      return;
    }

    const ok = window.confirm(`¿Quitar «${track.displayName}» de «${project.name}»?`);
    if (!ok) {
      return;
    }

    this.tracksError.set(null);
    this.tracksBusy.set(true);
    try {
      await this.importService.removeTrackFromProject(project.id, trackId);
      await this.refreshProjects();
    } catch (e) {
      this.tracksError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.tracksBusy.set(false);
    }
  }

  canRemoveTrack(project: Project, trackId: string): boolean {
    const tracksWithAudio = project.tracks.filter((t) => t.storedAssetKey);
    const target = project.tracks.find((t) => t.id === trackId);
    if (!target?.storedAssetKey) {
      return true;
    }
    return tracksWithAudio.length > 1;
  }

  startRename(project: Project): void {
    if (this.pageBusy()) {
      return;
    }
    this.renameError.set(null);
    this.cancelEditTracks();
    this.cancelEditSetlist();
    this.renamingId.set(project.id);
    this.renameDraft.set(project.name);
  }

  cancelRename(): void {
    this.renamingId.set(null);
    this.renameDraft.set('');
    this.renameError.set(null);
  }

  onRenameDraftInput(ev: Event): void {
    this.renameDraft.set((ev.target as HTMLInputElement).value);
    this.renameError.set(null);
  }

  async confirmRename(projectId: string): Promise<void> {
    const name = this.renameDraft().trim();
    if (!name) {
      this.renameError.set('El nombre no puede estar vacío.');
      return;
    }
    if (this.pageBusy()) {
      return;
    }
    this.renameError.set(null);
    try {
      await this.storage.renameProject(projectId, name);
      this.cancelRename();
      await this.refreshProjects();
    } catch (e) {
      this.renameError.set(e instanceof Error ? e.message : String(e));
    }
  }

  async onDeleteProject(project: Project): Promise<void> {
    if (this.pageBusy()) {
      return;
    }
    const ok = window.confirm(`¿Eliminar «${project.name}»? No se puede deshacer.`);
    if (!ok) {
      return;
    }
    this.listError.set(null);
    try {
      await this.storage.deleteProject(project.id);
      if (this.renamingId() === project.id) {
        this.cancelRename();
      }
      if (this.editingTracksId() === project.id) {
        this.cancelEditTracks();
      }
      await this.refreshProjects();
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    }
  }
}
