import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Project } from '../../../../core/models';
import { sortTracksByOrder } from '../../../../core/utils/track-order.util';
import {
  LucideCheck,
  LucideList,
  LucidePencil,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '../../../../shared/icons/app-lucide-icons';
import { ProjectImportService } from '../../services/project-import.service';
import { ProjectStorageService } from '../../services/project-storage.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [
    RouterLink,
    LucideList,
    LucidePencil,
    LucideTrash2,
    LucideUpload,
    LucideCheck,
    LucideX,
  ],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  private readonly storage = inject(ProjectStorageService);
  private readonly importService = inject(ProjectImportService);

  readonly projects = signal<readonly Project[]>([]);
  readonly listLoading = signal(true);
  readonly listError = signal<string | null>(null);

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

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly addTracksInput = viewChild<ElementRef<HTMLInputElement>>('addTracksInput');

  constructor() {
    void this.refreshProjects();
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
    return this.isCreating() || this.tracksBusy();
  }

  startEditTracks(project: Project): void {
    if (this.pageBusy()) {
      return;
    }
    this.tracksError.set(null);
    this.cancelRename();
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
