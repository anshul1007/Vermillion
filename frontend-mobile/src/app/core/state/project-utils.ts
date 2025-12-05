import { Injector, effect, inject, runInInjectionContext } from '@angular/core';
import { projectStore } from './project.store';

// Runs the provided callback whenever the project id changes. Returns a disposer.
export function onProjectChange(callback: (projectId: number | null) => void) {
  const injector = inject(Injector);
  let disposer: (() => void) | undefined;

  runInInjectionContext(injector, () => {
    const ref = effect(() => {
      const pid = projectStore.projectId();
      callback(pid);
    });

    disposer = () => {
      try {
        if (typeof ref === 'function') {
          (ref as unknown as Function)();
        } else if ((ref as any) && typeof (ref as any).destroy === 'function') {
          (ref as any).destroy();
        }
      } catch {
        // ignore cleanup errors
      }
    };
  });

  return () => {
    try {
      disposer && disposer();
    } catch {
      // ignore cleanup errors
    }
  };
}

// Helper to set the project by id using a projects list
export function selectProjectFromList(projects: Array<{ id: number; name: string }>, id: number) {
  const sel = projects.find((p) => p.id === id);
  projectStore.setProject(id, sel?.name ?? null);
}
