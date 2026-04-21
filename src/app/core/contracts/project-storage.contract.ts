import type { Project } from '../models';

/**
 * Persistencia local de proyectos (IndexedDB u otro). Solo contrato; la implementación concreta hará el I/O.
 */
export interface ProjectStoragePort {
  listProjects(): Promise<readonly Project[]>;

  getProjectById(id: string): Promise<Project | null>;

  saveProject(project: Project): Promise<void>;

  renameProject(id: string, name: string): Promise<void>;

  deleteProject(id: string): Promise<void>;
}
