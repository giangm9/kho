/**
 * Composer - Data-driven System Orchestrator
 *
 * Unlike traditional assemblers with imperative APIs,
 * Composer uses atoms and effects for reactive system management.
 *
 * Systems can be added, removed, enabled, or disabled at runtime
 * simply by modifying the $systems atom.
 */

import type { Atom, Store, System } from './types';
import { atom } from './atom';
import { scope } from './scope';

export type SystemEntry = {
  name: string;
  factory: System;
  dispose: (() => void) | null;
  enabled: boolean;
};

/**
 * Atom containing all registered systems
 *
 * @example
 * const { set, get } = scope(store);
 *
 * // Add a system
 * const systems = new Map(get($systems)!);
 * systems.set('physics', {
 *   name: 'physics',
 *   factory: physicsSystem,
 *   dispose: null,
 *   enabled: true
 * });
 * set($systems, systems);
 *
 * // Disable a system
 * const systems = new Map(get($systems)!);
 * systems.get('physics')!.enabled = false;
 * set($systems, systems);
 */
export const $systems: Atom<Map<string, SystemEntry>> = atom(new Map());

/**
 * Composer system - reacts to $systems changes
 *
 * When enabled changes from false to true: calls factory, stores dispose
 * When enabled changes from true to false: calls dispose, sets null
 *
 * @example
 * const store = createStore();
 * const disposeComposer = composer(store);
 *
 * const { set, get } = scope(store);
 *
 * // Add systems by setting atom
 * set($systems, new Map([
 *   ['game', { name: 'game', factory: gameSystem, dispose: null, enabled: true }],
 *   ['debug', { name: 'debug', factory: debugSystem, dispose: null, enabled: false }],
 * ]));
 *
 * // Enable/disable dynamically
 * const systems = new Map(get($systems)!);
 * systems.get('debug')!.enabled = true;
 * set($systems, systems);
 *
 * // Cleanup
 * disposeComposer();
 */
export function composer(store: Store): () => void {
  const { effect, dispose } = scope(store);

  effect([$systems], () => {
    const systems = $systems.instances.get(store)?.value;
    if (!systems) return;

    for (const entry of systems.values()) {
      if (entry.enabled && !entry.dispose) {
        // Enable: call factory, store dispose
        entry.dispose = entry.factory(store);
      } else if (!entry.enabled && entry.dispose) {
        // Disable: call dispose, clear
        entry.dispose();
        entry.dispose = null;
      }
    }
  });

  // On composer dispose, dispose all active systems
  return () => {
    const systems = $systems.instances.get(store)?.value;
    if (systems) {
      // Dispose in reverse order (last added first)
      const entries = Array.from(systems.values()).reverse();
      for (const entry of entries) {
        if (entry.dispose) {
          entry.dispose();
          entry.dispose = null;
        }
      }
    }
    dispose();
  };
}
