/**
 * Effects - Reactive effect system for responding to data changes
 *
 * Provides effect, compute, batch, and timing utilities.
 * Use with `reactive` for data access.
 *
 * @example
 * const { atoms } = reactive(store);
 * const { effect, compute, dispose } = effects(store);
 *
 * // React to changes
 * effect([$count], () => {
 *   console.log('Count:', atoms.get($count));
 * });
 *
 * // Computed values
 * compute([$a, $b], $sum, (a, b) => a + b);
 *
 * // Batch updates
 * batch(() => {
 *   atoms.set($a, 1);
 *   atoms.set($b, 2);
 * });
 *
 * // Cleanup
 * dispose();
 */

import { Atom, Store, Effects } from "../types"
import { reactive } from "../data/reactive"

// Shared batch state per store - enables cross-system batching
const storeBatch = new WeakMap<Store, Set<() => void>>();

export function effects(store: Store): Effects {
  const r = reactive(store);
  const scopeCleanups: (() => void)[] = [];

  // ============================================
  // Effect system
  // ============================================

  const effect = (atoms: Atom<any>[], callback: () => void | (() => void)) => {
    const cleanups: (() => void)[] = [];
    const listeners: (() => void)[] = [];

    const runEffect = () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;

      const cleanup = callback();
      if (cleanup) {
        cleanups.push(cleanup);
      }
    };

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
        // Check if we're in a batch (shared across all effects for this store)
        const pending = storeBatch.get(store);
        if (pending) {
          pending.add(runEffect);
        } else {
          runEffect();
        }
      };

      instance.listeners.add(listener);
      listeners.push(() => {
        instance!.listeners.delete(listener);
      });
    }

    // Initial run (once, not per atom)
    runEffect();

    const unsubscribe = () => {
      for (const removeListener of listeners) {
        removeListener();
      }
      for (const cleanup of cleanups) {
        cleanup();
      }
    }

    scopeCleanups.push(unsubscribe);
    return unsubscribe;
  }

  const compute = <T>(sources: Atom<any>[], target: Atom<T>, fn: (...values: any[]) => T) => {
    return effect(sources, () => {
      const values = sources.map(s => r.atoms.get(s));
      r.atoms.set(target, fn(...values));
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
    const pending = storeBatch.get(store);
    if (pending) {
      storeBatch.delete(store);
      for (const listener of pending) {
        listener();
      }
    }
  };

  const batch = (callback: () => void) => {
    storeBatch.set(store, new Set());
    callback();
    emit();
  };

  const dispose = () => {
    for (const cleanup of scopeCleanups) {
      cleanup();
    }
    scopeCleanups.length = 0;
    r.dispose();
  };

  return {
    effect,
    compute,
    debounce,
    throttle,
    interval,
    timeout,
    onDispose,
    batch,
    emit,
    dispose,
  };
}
