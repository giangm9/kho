import { atomWithFactory } from './atom';
import type { Atom, Store } from '../types';
import { reactive } from './reactive';

// ============================================
// Types
// ============================================

export type EntityId = string;
export type Entity = string;

/**
 * Component — standalone Atom<Map<string, T>>
 * Each component is a data column: entity ID → value
 */
export type Component<T> = Atom<Map<string, T>> & {
  defaultFactory?: () => T;
};

/**
 * World — operational interface for entity/component queries
 * Returned by query($entities)(store)
 */
export type World = {
  add(id: string): void;
  remove(id: string): void;
  has(id: string): boolean;
  has<T>(id: string, comp: Component<T>): boolean;
  all(): string[];
  get<T>(id: string, comp: Component<T>): T | undefined;
  set<T>(id: string, comp: Component<T>, value: T): void;
  delete<T>(id: string, comp: Component<T>): void;
  select(...comps: Component<any>[]): string[];
  exclude(...comps: Component<any>[]): string[];
  dispose(): void;
};

// ============================================
// Factories
// ============================================

/**
 * Create an entity registry
 *
 * @example
 * const $units = entities();
 * const $projectiles = entities();
 */
export function entities(): Atom<Set<string>> {
  return atomWithFactory(() => new Set<string>());
}

/**
 * Create a standalone component
 *
 * @example
 * const $position = component({ x: 0, y: 0 });
 * const $health = component(100);
 * const $tag = component<boolean>();
 */
export function component<T>(defaultValue?: T): Component<T> {
  const comp = atomWithFactory(() => new Map<string, T>()) as Component<T>;
  if (defaultValue !== undefined) {
    comp.defaultFactory = () => defaultValue;
  }
  return comp;
}

/**
 * Create a component with a factory function
 * Each entity gets a fresh value from the factory
 *
 * @example
 * const $inventory = componentWithFactory(() => []);
 * const $stats = componentWithFactory(() => ({ hp: 100, mp: 50 }));
 */
export function componentWithFactory<T>(factory: () => T): Component<T> {
  const comp = atomWithFactory(() => new Map<string, T>()) as Component<T>;
  comp.defaultFactory = factory;
  return comp;
}

// ============================================
// Query — World factory
// ============================================

/**
 * Create a World factory for an entity registry
 * Returns (store) => World, compatible with scope()
 *
 * Note: remove() only removes from entity set.
 * Use ecsBind from 'kho/systems' for component cleanup.
 *
 * @example
 * const $units = entities();
 * const $position = component({ x: 0, y: 0 });
 *
 * const gameSystem = system((scope) => {
 *   const { add, set, get, select } = scope(query($units));
 *
 *   add('player-1');
 *   set('player-1', $position, { x: 10, y: 20 });
 *
 *   for (const id of select($position)) {
 *     const pos = get(id, $position);
 *   }
 * });
 */
export function query($entities: Atom<Set<string>>): (store: Store) => World {
  return (store: Store): World => {
    const r = reactive(store);

    // Cache: component → Map (avoids repeated WeakMap lookups)
    const mapCache = new WeakMap<Component<any>, Map<string, any>>();
    const getMap = <T>(comp: Component<T>): Map<string, T> => {
      let map = mapCache.get(comp);
      if (!map) {
        map = r.atoms.get(comp)!;
        mapCache.set(comp, map);
      }
      return map as Map<string, T>;
    };

    // Query cache: invalidated on any mutation
    let queryCache = new Map<string, string[]>();
    let queryCacheValid = true;

    const invalidateQueryCache = () => {
      if (queryCacheValid) {
        queryCacheValid = false;
        queryCache.clear();
      }
    };

    // Comp key for query cache
    const compKeys = new WeakMap<Component<any>, number>();
    let compKeyCounter = 0;
    const getCompKey = (comp: Component<any>): number => {
      let key = compKeys.get(comp);
      if (key === undefined) {
        key = compKeyCounter++;
        compKeys.set(comp, key);
      }
      return key;
    };

    const makeCacheKey = (prefix: string, comps: Component<any>[]): string => {
      return prefix + comps.map(c => getCompKey(c)).sort().join(',');
    };

    return {
      add(id) {
        r.sets.add($entities, id);
        invalidateQueryCache();
      },

      remove(id) {
        r.sets.remove($entities, id);
        invalidateQueryCache();
      },

      has(id: string, comp?: Component<any>): boolean {
        if (comp) return getMap(comp).has(id);
        return r.sets.has($entities, id);
      },

      all() {
        return r.sets.values($entities);
      },

      get(id, comp) {
        const val = getMap(comp).get(id);
        return val !== undefined ? val : comp.defaultFactory?.();
      },

      set(id, comp, value) {
        getMap(comp).set(id, value);
        r.atoms.notify(comp);
        invalidateQueryCache();
      },

      delete(id, comp) {
        getMap(comp).delete(id);
        r.atoms.notify(comp);
        invalidateQueryCache();
      },

      select(...comps) {
        const cacheKey = makeCacheKey('s:', comps);
        if (queryCacheValid) {
          const cached = queryCache.get(cacheKey);
          if (cached) return cached;
        } else {
          queryCacheValid = true;
        }

        const maps = comps.map(c => getMap(c));

        if (maps.length === 0) {
          const result = r.sets.values($entities);
          queryCache.set(cacheKey, result);
          return result;
        }

        // Sparse iteration: pick smallest map as base
        let smallestIdx = 0;
        for (let i = 1; i < maps.length; i++) {
          if (maps[i]!.size < maps[smallestIdx]!.size) smallestIdx = i;
        }
        const base = maps[smallestIdx]!;
        const others = maps.filter((_, i) => i !== smallestIdx);

        const result: string[] = [];
        const entitySet = r.atoms.get($entities)!;
        for (const id of base.keys()) {
          if (entitySet.has(id) && others.every(m => m.has(id))) {
            result.push(id);
          }
        }

        queryCache.set(cacheKey, result);
        return result;
      },

      exclude(...comps) {
        const cacheKey = makeCacheKey('e:', comps);
        if (queryCacheValid) {
          const cached = queryCache.get(cacheKey);
          if (cached) return cached;
        } else {
          queryCacheValid = true;
        }

        const maps = comps.map(c => getMap(c));
        const entitySet = r.atoms.get($entities)!;
        const result: string[] = [];
        for (const id of entitySet) {
          if (maps.every(m => !m.has(id))) {
            result.push(id);
          }
        }

        queryCache.set(cacheKey, result);
        return result;
      },

      dispose() {
        queryCache.clear();
        r.dispose();
      },
    };
  };
}
