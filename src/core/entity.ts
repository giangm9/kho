import { atomWithFactory } from "./atom"
import { Atom, Store } from "./types"
import { scope } from "./scope"

export type EntityId = string;

/** Entity - object reference for WeakMap auto-cleanup */
export type Entity = { readonly id: EntityId };

/** Attribute - Atom storing WeakMap<Entity, T> for auto-cleanup */
export type Attribute<T> = Atom<WeakMap<Entity, T>>;

/** @deprecated Use Attribute instead */
export type AttributeAtom<T> = Attribute<T>;

/** World accessor - entity operations bound to a store */
export type World = {
  entity(id: EntityId): Entity;
  add(entity: Entity): void;
  remove(entity: Entity): void;
  has(entity: Entity): boolean;
  all(): Entity[];
  get<T>(entity: Entity, attr: Attribute<T>): T | undefined;
  set<T>(entity: Entity, attr: Attribute<T>, value: T): void;
  delete<T>(entity: Entity, attr: Attribute<T>): void;
  hasAttr<T>(entity: Entity, attr: Attribute<T>): boolean;
  with(...attrs: Attribute<any>[]): Entity[];
  without(...attrs: Attribute<any>[]): Entity[];
};

/** Entity registry atom */
export const $entities: Atom<Set<Entity>> = atomWithFactory(() => new Set());

/**
 * Create an attribute (data column for entities)
 * Uses WeakMap for automatic cleanup when entity is GC'd
 *
 * @example
 * const $position = attribute<{ x: number; y: number }>();
 * const $health = attribute<number>();
 *
 * // Use directly in effects
 * effect([$health], () => { ... });
 */
export function attribute<T>(): Attribute<T> {
  return atomWithFactory<WeakMap<Entity, T>>(() => new WeakMap());
}

/**
 * Create a world accessor for entity operations
 *
 * @example
 * const $position = attribute<{ x: number; y: number }>();
 * const $health = attribute<number>();
 *
 * const { entity, add, remove, get, set } = world(store);
 * const player = entity('player');
 *
 * add(player);
 * set(player, $position, { x: 0, y: 0 });
 * set(player, $health, 100);
 *
 * get(player, $position);  // { x: 0, y: 0 }
 * remove(player);
 */
export function world(store: Store): World {
  const s = scope(store);
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
      const entities = new Set(s.get($entities)!);
      entities.add(entity);
      s.set($entities, entities);
    },

    remove(entity: Entity): void {
      const entities = new Set(s.get($entities)!);
      entities.delete(entity);
      s.set($entities, entities);
    },

    has(entity: Entity): boolean {
      return s.get($entities)!.has(entity);
    },

    all(): Entity[] {
      return Array.from(s.get($entities)!);
    },

    get<T>(entity: Entity, attr: Attribute<T>): T | undefined {
      return s.get(attr)!.get(entity);
    },

    set<T>(entity: Entity, attr: Attribute<T>, value: T): void {
      const map = s.get(attr)!;
      map.set(entity, value);
      s.notify(attr);
    },

    delete<T>(entity: Entity, attr: Attribute<T>): void {
      const map = s.get(attr)!;
      map.delete(entity);
      s.notify(attr);
    },

    hasAttr<T>(entity: Entity, attr: Attribute<T>): boolean {
      return s.get(attr)!.has(entity);
    },

    with(...attrs: Attribute<any>[]): Entity[] {
      const entities = s.get($entities)!;
      return Array.from(entities).filter(entity =>
        attrs.every(attr => s.get(attr)!.has(entity))
      );
    },

    without(...attrs: Attribute<any>[]): Entity[] {
      const entities = s.get($entities)!;
      return Array.from(entities).filter(entity =>
        attrs.every(attr => !s.get(attr)!.has(entity))
      );
    },
  };
}
