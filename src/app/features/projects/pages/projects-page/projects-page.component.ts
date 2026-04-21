import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Project } from '../../../../core/models';
import { ProjectImportService } from '../../services/project-import.service';
import { ProjectStorageService } from '../../services/project-storage.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  private readonly storage = inject(ProjectStorageService);
  private readonly importService = inject(ProjectImportService);

  readonly projects = signal<readonly Project[]>([]);
  readonly listError = signal<string | null>(null);

  readonly newProjectName = signal('');
  readonly selectedFiles = signal<File[]>([]);
  readonly createError = signal<string | null>(null);
  readonly isCreating = signal(false);

  readonly renamingId = signal<string | null>(null);
  readonly renameDraft = signal('');

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    void this.refreshProjects();
  }

  async refreshProjects(): Promise<void> {
    this.listError.set(null);
    try {
      const list = await this.storage.listProjects();
      this.projects.set(list);
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
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
    this.createError.set(null);
    this.isCreating.set(true);
    try {
      await this.importService.createProjectFromImportedFiles(
        this.newProjectName(),
        this.selectedFiles(),
      );
      this.newProjectName.set('');
      this.clearFileSelection();
      await this.refreshProjects();
    } catch (e) {
      this.createError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.isCreating.set(false);
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
    this.renamingId.set(project.id);
    this.renameDraft.set(project.name);
  }

  cancelRename(): void {
    this.renamingId.set(null);
    this.renameDraft.set('');
  }

  onRenameDraftInput(ev: Event): void {
    this.renameDraft.set((ev.target as HTMLInputElement).value);
  }

  async confirmRename(projectId: string): Promise<void> {
    const name = this.renameDraft().trim();
    if (!name) {
      return;
    }
    try {
      await this.storage.renameProject(projectId, name);
      this.cancelRename();
      await this.refreshProjects();
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    }
  }

  async onDeleteProject(project: Project): Promise<void> {
    const ok = window.confirm(`¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`);
    if (!ok) {
      return;
    }
    this.listError.set(null);
    try {
      await this.storage.deleteProject(project.id);
      await this.refreshProjects();
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    }
  }
}
