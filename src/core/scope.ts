
import { Atom, Store, Scope } from "./types"

export function scope(store: Store): Scope {
  const scopeCleanups: (() => void)[] = [];
  let pendingBatch: Set<() => void> | null = null;

  const get = <T>(atom: Atom<T>): T | undefined => {
    let entry = atom.instances.get(store);
    if (!entry) {
      // Initialize atom from its factory if it hasn't been set yet
      entry = {
        value: atom.initialFactory(),
        listeners: new Set<() => void>(),
      };
      atom.instances.set(store, entry);
    }
    return entry.value;
  };

  const set = <T>(atom: Atom<T>, value: T): void => {
    let entry = atom.instances.get(store);
    if (!entry) {
      entry = {
        value,
        listeners: new Set<() => void>(),
      };
      atom.instances.set(store, entry);
    } else {
      entry.value = value;
      notify(atom);
    }
  };

  const notify = (atom: Atom<any>): void => {
    const entry = atom.instances.get(store);
    if (entry) {
      if (pendingBatch) {
        entry.listeners.forEach((listener) => pendingBatch!.add(listener));
      } else {
        entry.listeners.forEach((listener) => listener());
      }
    }
  };

  const effect = (atoms: Atom<any>[], callback: () => void | (() => void)) => {
    const cleanups: (() => void)[] = [];
    const listeners: (() => void)[] = [];

    for (const atom of atoms) {
      let instance = atom.instances.get(store);
      if (!instance) {
        instance = {
          value: atom.initialFactory(),
          listeners: new Set<() => void>(),
        };
        atom.instances.set(store, instance);
      }

      const listener = () => {
        // Cleanup previous
        for (const cleanup of cleanups) {
          cleanup();
        }
        cleanups.length = 0;

        // Run effect
        const cleanup = callback();
        if (cleanup) {
          cleanups.push(cleanup);
        }
      }
      instance.listeners.add(listener);
      listeners.push(() => {
        instance!.listeners.delete(listener);
      });

      // Initial run
      listener();
    }

    const unsubscribe = () => {
      // Cleanup listeners
      for (const removeListener of listeners) {
        removeListener();
      }
      // Cleanup effects
      for (const cleanup of cleanups) {
        cleanup();
      }
    }

    scopeCleanups.push(unsubscribe);
    return unsubscribe;
  }

  const compute = <T>(sources: Atom<any>[], target: Atom<T>, fn: (...values: any[]) => T) => {
    return effect(sources, () => {
      const values = sources.map(s => get(s));
      set(target, fn(...values));
    });
  };

  const debounce = (atoms: Atom<any>[], ms: number, callback: () => void | (() => void)) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let effectCleanup: (() => void) | null = null;

    const unsubscribe = effect(atoms, () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (effectCleanup) {
        effectCleanup();
        effectCleanup = null;
      }

      timeoutId = setTimeout(() => {
        effectCleanup = callback() || null;
        timeoutId = null;
      }, ms);

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (effectCleanup) {
          effectCleanup();
          effectCleanup = null;
        }
      };
    });

    return unsubscribe;
  };

  const throttle = (atoms: Atom<any>[], ms: number, callback: () => void | (() => void)) => {
    let lastRun = 0;
    let effectCleanup: (() => void) | null = null;
    let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = effect(atoms, () => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun;

      if (effectCleanup) {
        effectCleanup();
        effectCleanup = null;
      }

      if (timeSinceLastRun >= ms) {
        lastRun = now;
        effectCleanup = callback() || null;
      } else {
        // Schedule for remaining time
        if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
        pendingTimeoutId = setTimeout(() => {
          lastRun = Date.now();
          effectCleanup = callback() || null;
          pendingTimeoutId = null;
        }, ms - timeSinceLastRun);
      }

      return () => {
        if (pendingTimeoutId) {
          clearTimeout(pendingTimeoutId);
          pendingTimeoutId = null;
        }
        if (effectCleanup) {
          effectCleanup();
          effectCleanup = null;
        }
      };
    });

    return unsubscribe;
  };

  const interval = (ms: number, callback: () => void) => {
    const id = setInterval(callback, ms);
    const cleanup = () => clearInterval(id);
    scopeCleanups.push(cleanup);
    return cleanup;
  };

  const timeout = (ms: number, callback: () => void) => {
    const id = setTimeout(callback, ms);
    const cleanup = () => clearTimeout(id);
    scopeCleanups.push(cleanup);
    return cleanup;
  };

  const onDispose = (callback: () => void) => {
    scopeCleanups.push(callback);
  };

  const emit = () => {
    if (pendingBatch) {
      for (const listener of pendingBatch) {
        listener();
      }
      pendingBatch = null;
    }
  };

  const batch = (callback: () => void) => {
    pendingBatch = new Set();
    callback();
    emit();
  };

  const dispose = () => {
    for (const cleanup of scopeCleanups) {
      cleanup();
    }
    scopeCleanups.length = 0;
  };

  return { get, set, notify, effect, compute, debounce, throttle, interval, timeout, onDispose, batch, emit, dispose };
}
