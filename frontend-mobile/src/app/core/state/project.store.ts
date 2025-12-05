import { signal } from '@angular/core';

export const PROJECT_STORAGE_KEY = 'current_project';

export class ProjectStore {
  projectId = signal<number | null>(null);
  projectName = signal<string | null>(null);

  constructor() {
    this.load();
  }

  setProject(id: number | null, name?: string | null) {
    this.projectId.set(id ?? null);
    this.projectName.set(name ?? null);
    if (id && id > 0) {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ id, name }));
    } else {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }

  clear() {
    this.projectId.set(null);
    this.projectName.set(null);
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  }

  private load() {
    try {
      const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.projectId.set(parsed.id ?? null);
        this.projectName.set(parsed.name ?? null);
      }
    } catch (e) {
      // ignore
    }
  }
}

export const projectStore = new ProjectStore();
