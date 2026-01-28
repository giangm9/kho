/**
 * Assembler - System Orchestration using Reactive APIs
 *
 * Simple approach: add system to $systems → ignite auto-starts it
 *
 * @example
 * const store = createStore();
 * const { sets } = reactive(store);
 *
 * // Add systems (ignite will auto-start them)
 * sets.add($systems, gameSystem);
 * sets.add($systems, audioSystem);
 *
 * // Ignite!
 * const dispose = ignite(store);
 *
 * // To stop a system at runtime
 * sets.remove($systems, gameSystem);
 *
 * // Cleanup all
 * dispose();
 */

import type { Store, System } from '../types';
import { atomWithFactory } from '../data/atom';
import { reactive } from '../data/reactive';
import { effects } from './effects';

// ============================================
// System Atoms
// ============================================

/** Registry of all systems */
export const $systems = atomWithFactory<Set<System>>(() => new Set());

/** System state - maps system to its dispose function (null = not running) */
export const $state = atomWithFactory<Map<System, (() => void) | null>>(() => new Map());

// ============================================
// Ignite
// ============================================

/**
 * Ignite the store - start all registered systems
 *
 * Watches the $systems registry:
 * - When system is added → starts it (calls factory, stores dispose in $state)
 * - When system is removed → stops it (calls dispose)
 *
 * @example
 * const store = createStore();
 * const { set } = reactive(store);
 *
 * // Add systems
 * set.add($systems, gameSystem);
 * set.add($systems, audioSystem);
 *
 * // Start!
 * const dispose = ignite(store);
 *
 * // Add more systems at runtime
 * set.add($systems, debugSystem);  // Auto-starts
 *
 * // Remove system at runtime
 * set.remove($systems, gameSystem);  // Auto-stops
 *
 * // Cleanup everything
 * dispose();
 */
export function ignite(store: Store): () => void {
  const r = reactive(store);
  const e = effects(store);

  // Track previously seen systems to detect add/remove
  let prevSystems = new Set<System>();

  // React to $systems registry changes
  e.effect([$systems], () => {
    const currentSystems = new Set(r.sets.values($systems));

    // Find added systems
    for (const sys of currentSystems) {
      if (!prevSystems.has(sys)) {
        // New system added - start it
        const existingDispose = r.maps.get($state, sys);
        if (!existingDispose) {
          const newDispose = sys(store);
          r.maps.set($state, sys, newDispose);
        }
      }
    }

    // Find removed systems
    for (const sys of prevSystems) {
      if (!currentSystems.has(sys)) {
        // System removed - stop it
        const disposeFn = r.maps.get($state, sys);
        if (disposeFn) {
          disposeFn();
          r.maps.delete($state, sys);
        }
      }
    }

    prevSystems = currentSystems;
  });

  // On dispose, cleanup all active systems
  return () => {
    const allSystems = r.sets.values($systems);

    // Dispose in reverse order (last added first)
    const reversedSystems = [...allSystems].reverse();
    for (const sys of reversedSystems) {
      const disposeFn = r.maps.get($state, sys);
      if (disposeFn) {
        disposeFn();
        r.maps.delete($state, sys);
      }
    }

    e.dispose();
  };
}
