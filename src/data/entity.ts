/**
 * Entity Component System (ECS)
 *
 * ECS pattern for game development and similar use cases.
 * Uses Entity as key type with string-based IDs and caching.
 *
 * @example
 * const $players = entities();
 * const $position = component<{ x: number; y: number }>();
 * const $health = component<number>();
 *
 * const gameSystem = system((scope) => {
 *   const w = scope(world($players));
 *
 *   const player = w.entity('player');
 *   w.add(player);
 *   w.set(player, $position, { x: 0, y: 0 });
 *   w.set(player, $health, 100);
 * });
 */

import { atomWithFactory } from './atom';
import type { Atom, Store } from '../types';
import { reactive } from './reactive';

// ============================================
// Types
// ============================================

export type EntityId = string;

/** Entity - object reference for WeakMap auto-cleanup */
export type Entity = { readonly id: EntityId };

/** Component - Atom storing WeakMap<Entity, T> for auto-cleanup */
export type Component<T> = Atom<WeakMap<Entity, T>> & {
  defaultFactory?: () => T;
};

/** @deprecated Use Component instead */
export type Attribute<T> = Component<T>;

/** @deprecated Use Component instead */
export type AttributeAtom<T> = Component<T>;

/** World accessor - entity operations bound to a store */
export type World = {
  entity(id: EntityId): Entity;
  add(entity: Entity): void;
  remove(entity: Entity): void;
  has(entity: Entity): boolean;
  all(): Entity[];
  get<T>(entity: Entity, comp: Component<T>): T | undefined;
  set<T>(entity: Entity, comp: Component<T>, value: T): void;
  delete<T>(entity: Entity, comp: Component<T>): void;
  hasComp<T>(entity: Entity, comp: Component<T>): boolean;
  with(...comps: Component<any>[]): Entity[];
  without(...comps: Component<any>[]): Entity[];
  dispose(): void;
};

// ============================================
// Component Creators
// ============================================

/**
 * Create a component (data column for entities)
 * Uses WeakMap for automatic cleanup when entity is GC'd
 *
 * @example
 * const $position = component<{ x: number; y: number }>();
 * const $health = component<number>();
 */
export function component<T>(): Component<T> {
  return atomWithFactory<WeakMap<Entity, T>>(() => new WeakMap()) as Component<T>;
}

/**
 * Create a component with a default factory
 * Each entity gets a fresh value from the factory when accessed
 *
 * @example
 * const $position = componentWithFactory(() => ({ x: 0, y: 0 }));
 * const $health = componentWithFactory(() => 100);
 */
export function componentWithFactory<T>(defaultFactory: () => T): Component<T> {
  const comp = atomWithFactory<WeakMap<Entity, T>>(() => new WeakMap()) as Component<T>;
  comp.defaultFactory = defaultFactory;
  return comp;
}

/** @deprecated Use component() instead */
export const attribute = component;

/** @deprecated Use componentWithFactory() instead */
export const attributeWithFactory = componentWithFactory;

// ============================================
// Entity Registry
// ============================================

/**
 * Create an entities atom (entity registry)
 *
 * @example
 * const $players = entities();
 * const $enemies = entities();
 */
export function entities(): Atom<Set<Entity>> {
  return atomWithFactory<Set<Entity>>(() => new Set());
}

// ============================================
// World Scope
// ============================================

/**
 * Create a world factory for entity operations
 * Returns a factory compatible with scope()
 *
 * @example
 * const $players = entities();
 * const $position = component<{ x: number; y: number }>();
 * const $health = component<number>();
 *
 * const gameSystem = system((scope) => {
 *   const w = scope(world($players));
 *
 *   const player = w.entity('player');
 *   w.add(player);
 *   w.set(player, $position, { x: 0, y: 0 });
 *   w.set(player, $health, 100);
 *
 *   console.log(w.get(player, $position));  // { x: 0, y: 0 }
 * });
 */
export function world($entities: Atom<Set<Entity>>): (store: Store) => World {
  return (store: Store): World => {
    const r = reactive(store);
    const entityCache = new Map<EntityId, Entity>();

    return {
      entity(id: EntityId): Entity {
        let e = entityCache.get(id);
        if (!e) {
          e = { id };
          entityCache.set(id, e);
        }
        return e;
      },

      add(entity: Entity): void {
        r.sets.add($entities, entity);
      },

      remove(entity: Entity): void {
        r.sets.remove($entities, entity);
      },

      has(entity: Entity): boolean {
        return r.sets.has($entities, entity);
      },

      all(): Entity[] {
        return r.sets.values($entities);
      },

      get<T>(entity: Entity, comp: Component<T>): T | undefined {
        const value = r.atoms.get(comp)!.get(entity);
        return value !== undefined ? value : comp.defaultFactory?.();
      },

      set<T>(entity: Entity, comp: Component<T>, value: T): void {
        const map = r.atoms.get(comp)!;
        map.set(entity, value);
        r.atoms.notify(comp);
      },

      delete<T>(entity: Entity, comp: Component<T>): void {
        const map = r.atoms.get(comp)!;
        map.delete(entity);
        r.atoms.notify(comp);
      },

      hasComp<T>(entity: Entity, comp: Component<T>): boolean {
        return r.atoms.get(comp)!.has(entity);
      },

      with(...comps: Component<any>[]): Entity[] {
        const all = r.sets.values($entities);
        return all.filter((entity: Entity) =>
          comps.every(comp => r.atoms.get(comp)!.has(entity))
        );
      },

      without(...comps: Component<any>[]): Entity[] {
        const all = r.sets.values($entities);
        return all.filter((entity: Entity) =>
          comps.every(comp => !r.atoms.get(comp)!.has(entity))
        );
      },

      dispose: r.dispose,
    };
  };
}
