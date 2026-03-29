/**
 * ecsBind — System factory that binds component lifecycle to an entity set
 *
 * Watches entity set changes. When entities are removed,
 * automatically cleans up their component data.
 *
 * @example
 * import { entities, component } from 'kho';
 * import { ecsBind } from 'kho/systems';
 *
 * const $units = entities();
 * const $position = component({ x: 0, y: 0 });
 * const $health = component(100);
 *
 * // Cleanup when entities are removed
 * const unitsBind = ecsBind($units, [$position, $health]);
 *
 * // With debounce batching (ms)
 * const unitsBind = ecsBind($units, [$position, $health], { batch: 16 });
 */

import { system } from '../system/system';
import { reactive } from '../data/reactive';
import { effects } from '../system/effects';
import type { Atom, System } from '../types';
import type { Component } from '../data/entity';

export type EcsBindOptions = {
  /** Batching strategy:
   * - number: debounce in ms (e.g. 16 for frame-aligned)
   * - true: immediate but batched notifications
   * - false/undefined: immediate
   */
  batch?: number | boolean;
};

export function ecsBind(
  $entities: Atom<Set<string>>,
  components: Component<any>[],
  options?: EcsBindOptions
): System {
  return system((scope) => {
    const { atoms } = scope(reactive);
    const { effect, debounce, batch } = scope(effects);

    const handler = () => {
      const current = atoms.get($entities);
      if (!current) return;
      batch(() => {
        for (const comp of components) {
          const map = atoms.get(comp);
          if (!map) continue;
          for (const id of map.keys()) {
            if (!current.has(id)) {
              map.delete(id);
              atoms.notify(comp);
            }
          }
        }
      });
    };

    const batchMs = options?.batch;
    if (typeof batchMs === 'number') {
      debounce([$entities], batchMs, handler);
    } else {
      effect([$entities], handler);
    }
  });
}
