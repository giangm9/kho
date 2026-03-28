import { atomWithFactory } from './atom';
import type { Atom, Store } from '../types';
import { reactive } from './reactive';
import { effects } from '../system/effects';

// ============================================
// Types
// ============================================

export type EntityId = string;
export type Entity = string;

/**
 * Entities — entity registry + component registry
 * Created by world(), used by query() and component()
 */
export type Entities = {
  readonly $entities: Atom<Set<string>>;
  readonly _components: Set<Component<any>>;
};

/**
 * Component — Atom<Map<string, T>> bound to an Entities registry
 */
export type Component<T> = Atom<Map<string, T>> & {
  readonly _entities: Entities;
  defaultFactory?: () => T;
};

/**
 * World — operational interface for entity/component operations
 * Returned by query(entities)(store)
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
 * Create an entity registry (Entities)
 *
 * @example
 * const $units = world();
 * const $position = component($units, { x: 0, y: 0 });
 * const $health = component($units, 100);
 */
export function world(): Entities {
  const $entities = atomWithFactory(() => new Set<string>());
  const _components = new Set<Component<any>>();
  return { $entities, _components };
}

/**
 * Create a component bound to an Entities registry
 *
 * @example
 * const $units = world();
 * const $position = component($units, { x: 0, y: 0 });
 * const $health = component($units, 100);
 */
export function component<T>(entities: Entities, defaultValue?: T): Component<T> {
  const comp = atomWithFactory(() => new Map<string, T>()) as Component<T>;
  (comp as any)._entities = entities;
  if (defaultValue !== undefined) {
    comp.defaultFactory = () => defaultValue;
  }
  entities._components.add(comp);
  return comp;
}

/**
 * Create a component with a factory function
 * Each entity gets a fresh value from the factory
 *
 * @example
 * const $inventory = componentWithFactory($units, () => []);
 * const $stats = componentWithFactory($units, () => ({ hp: 100, mp: 50 }));
 */
export function componentWithFactory<T>(entities: Entities, factory: () => T): Component<T> {
  const comp = atomWithFactory(() => new Map<string, T>()) as Component<T>;
  (comp as any)._entities = entities;
  comp.defaultFactory = factory;
  entities._components.add(comp);
  return comp;
}

// ============================================
// Query — World factory
// ============================================

/**
 * Create a World factory for an Entities registry
 * Returns (store) => World, compatible with scope()
 *
 * @example
 * const $units = world();
 * const $position = component($units, { x: 0, y: 0 });
 *
 * const gameSystem = system((scope) => {
 *   const { add, set, select } = scope(query($units));
 *
 *   add('player-1');
 *   set('player-1', $position, { x: 10, y: 20 });
 *
 *   for (const id of select($position)) {
 *     const pos = get(id, $position);
 *   }
 * });
 */
export function query(entities: Entities): (store: Store) => World {
  const { $entities, _components } = entities;

  return (store: Store): World => {
    const r = reactive(store);
    const e = effects(store);

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

    // Query cache: serialized comp key → result
    // Invalidated on any add/remove/set/delete
    let queryCache = new Map<string, string[]>();
    let queryCacheValid = true;

    const invalidateQueryCache = () => {
      if (queryCacheValid) {
        queryCacheValid = false;
        queryCache.clear();
      }
    };

    // Comp key for query cache (use object identity via index)
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
        e.batch(() => {
          for (const comp of _components) {
            const map = getMap(comp);
            if (map.has(id)) {
              map.delete(id);
              r.atoms.notify(comp);
            }
          }
          r.sets.remove($entities, id);
        });
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
        // Check query cache
        const cacheKey = makeCacheKey('s:', comps);
        if (queryCacheValid) {
          const cached = queryCache.get(cacheKey);
          if (cached) return cached;
        } else {
          queryCacheValid = true;
        }

        // Resolve maps once (avoid repeated WeakMap lookups)
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
        e.dispose();
        r.dispose();
      },
    };
  };
}
