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
import { LucidePencil, LucidePlay, LucideTrash2 } from '../../../../shared/icons/app-lucide-icons';
import { sortTracksByOrder } from '../../../../core/utils/track-order.util';
import { ProjectImportService } from '../../services/project-import.service';
import { ProjectStorageService } from '../../services/project-storage.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [RouterLink, LucidePlay, LucidePencil, LucideTrash2],
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

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

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
      !this.newProjectName().trim() ||
      this.selectedFiles().length === 0
    );
  }

  startRename(project: Project): void {
    this.renameError.set(null);
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
    if (this.isCreating()) {
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
    if (this.isCreating()) {
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
      await this.refreshProjects();
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    }
  }
}
