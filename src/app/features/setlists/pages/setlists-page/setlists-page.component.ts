import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { Setlist } from '../../../../core/models';
import { sortSetlistEntriesByOrder } from '../../../../core/utils/setlist-order.util';
import {
  LucideCheck,
  LucideList,
  LucidePencil,
  LucidePlay,
  LucideTrash2,
  LucideX,
} from '../../../../shared/icons/app-lucide-icons';
import { SetlistPreloadService } from '../../services/setlist-preload.service';
import { SetlistStorageService } from '../../services/setlist-storage.service';

@Component({
  selector: 'app-setlists-page',
  standalone: true,
  imports: [
    RouterLink,
    LucideList,
    LucidePencil,
    LucidePlay,
    LucideTrash2,
    LucideCheck,
    LucideX,
  ],
  templateUrl: './setlists-page.component.html',
  styleUrl: './setlists-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistsPageComponent {
  private readonly setlistStorage = inject(SetlistStorageService);
  readonly setlistPreload = inject(SetlistPreloadService);
  private readonly router = inject(Router);

  readonly setlists = signal<readonly Setlist[]>([]);
  readonly listLoading = signal(true);
  readonly listError = signal<string | null>(null);

  readonly newSetlistName = signal('');
  readonly createError = signal<string | null>(null);
  readonly isCreating = signal(false);

  readonly renameId = signal<string | null>(null);
  readonly renameDraft = signal('');
  readonly renameError = signal<string | null>(null);

  constructor() {
    void this.refreshSetlists();
  }

  async refreshSetlists(): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);
    try {
      const list = await this.setlistStorage.listSetlists();
      this.setlists.set(list);
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.listLoading.set(false);
    }
  }

  pageBusy(): boolean {
    return this.isCreating();
  }

  setlistEntryCount(setlist: Setlist): number {
    return setlist.entries.length;
  }

  onNewSetlistNameInput(ev: Event): void {
    this.newSetlistName.set((ev.target as HTMLInputElement).value);
    this.createError.set(null);
  }

  async onCreateSetlist(): Promise<void> {
    const name = this.newSetlistName().trim();
    if (!name || this.pageBusy()) {
      return;
    }
    this.createError.set(null);
    this.isCreating.set(true);
    try {
      const created = await this.setlistStorage.createSetlist(name);
      this.newSetlistName.set('');
      await this.refreshSetlists();
      void this.router.navigate(['/setlists', created.id]);
    } catch (e) {
      this.createError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.isCreating.set(false);
    }
  }

  onPlaySetlist(setlist: Setlist): void {
    const entries = sortSetlistEntriesByOrder(setlist.entries);
    const first = entries[0];
    if (!first) {
      return;
    }
    this.setlistPreload.switchToSetlistContext(setlist.id);
    void this.router.navigate(['/player', first.packId], {
      queryParams: { setlist: setlist.id, entry: 0 },
    });
  }

  startRename(setlist: Setlist): void {
    this.renameId.set(setlist.id);
    this.renameDraft.set(setlist.name);
    this.renameError.set(null);
  }

  cancelRename(): void {
    this.renameId.set(null);
    this.renameDraft.set('');
    this.renameError.set(null);
  }

  onRenameDraftInput(ev: Event): void {
    this.renameDraft.set((ev.target as HTMLInputElement).value);
    this.renameError.set(null);
  }

  async confirmRename(setlistId: string): Promise<void> {
    const name = this.renameDraft().trim();
    if (!name) {
      this.renameError.set('El nombre no puede estar vacío.');
      return;
    }
    if (this.pageBusy()) {
      return;
    }
    try {
      await this.setlistStorage.renameSetlist(setlistId, name);
      this.cancelRename();
      await this.refreshSetlists();
    } catch (e) {
      this.renameError.set(e instanceof Error ? e.message : String(e));
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
      this.setlistPreload.invalidateSetlistCacheIfActive(setlist.id);
      await this.setlistStorage.deleteSetlist(setlist.id);
      if (this.renameId() === setlist.id) {
        this.cancelRename();
      }
      await this.refreshSetlists();
    } catch (e) {
      this.listError.set(e instanceof Error ? e.message : String(e));
    }
  }
}
