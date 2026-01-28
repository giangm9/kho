/**
 * Attribute - Generic data attachment for any object type
 *
 * Attributes allow attaching typed data to any object using WeakMap.
 * Objects must be registered in a registry (Set) for querying.
 *
 * @example
 * const $players = registry<Player>();
 * const $health = attribute($players, 100);
 * const $inventory = attributeWithFactory($players, () => []);
 *
 * const { sets } = reactive(store);
 *
 * const player = new Player('Alice');
 * sets.add($players, player);
 *
 * // Use attributes scope for attribute operations
 * const a = attributes(store);
 * a.set(player, $health, 80);
 * console.log(a.get(player, $health));  // 80
 */

import { atomWithFactory } from './atom';
import { reactive } from './reactive';
import type { Atom, Store } from '../types';

// ============================================
// Types
// ============================================

/**
 * Attribute - Atom storing WeakMap<K, V> with registry reference
 */
export type Attribute<K extends object, V> = Atom<WeakMap<K, V>> & {
  readonly $registry: Atom<Set<K>>;
  readonly defaultValue?: V;
  readonly defaultFactory?: () => V;
};

/**
 * Attributes scope - operations for attributes
 */
export type Attributes = {
  /** Add object to its attribute's registry */
  add<K extends object>(obj: K, attr: Attribute<K, any>): void;
  /** Remove object from its attribute's registry */
  remove<K extends object>(obj: K, attr: Attribute<K, any>): void;
  /** Check if object is in registry */
  has<K extends object>(obj: K, attr: Attribute<K, any>): boolean;
  /** Get all objects in registry */
  all<K extends object>(attr: Attribute<K, any>): K[];
  /** Get attribute value for object */
  get<K extends object, V>(obj: K, attr: Attribute<K, V>): V;
  /** Set attribute value for object */
  set<K extends object, V>(obj: K, attr: Attribute<K, V>, value: V): void;
  /** Delete attribute value for object */
  delete<K extends object, V>(obj: K, attr: Attribute<K, V>): void;
  /** Check if object has attribute value */
  hasAttr<K extends object, V>(obj: K, attr: Attribute<K, V>): boolean;
  /** Dispose the scope */
  dispose(): void;
};

// ============================================
// Registry
// ============================================

/**
 * Create a registry for objects
 * Registry is a Set that holds strong references to objects
 *
 * @example
 * const $players = registry<Player>();
 * const $enemies = registry<Enemy>();
 */
export function registry<K extends object>(): Atom<Set<K>> {
  return atomWithFactory<Set<K>>(() => new Set());
}

// ============================================
// Attribute Creators
// ============================================

/**
 * Create an attribute with a default value
 * Use for primitives or shared immutable objects
 *
 * @example
 * const $health = attribute($players, 100);
 * const $name = attribute($players, 'Unknown');
 */
export function attribute<K extends object, V>(
  $registry: Atom<Set<K>>,
  defaultValue: V
): Attribute<K, V> {
  const attr = atomWithFactory<WeakMap<K, V>>(() => new WeakMap()) as Attribute<K, V>;
  (attr as any).$registry = $registry;
  (attr as any).defaultValue = defaultValue;
  return attr;
}

/**
 * Create an attribute with a factory function
 * Use for mutable objects where each key needs its own instance
 *
 * @example
 * const $inventory = attributeWithFactory($players, () => []);
 * const $stats = attributeWithFactory($players, () => ({ hp: 100, mp: 50 }));
 */
export function attributeWithFactory<K extends object, V>(
  $registry: Atom<Set<K>>,
  factory: () => V
): Attribute<K, V> {
  const attr = atomWithFactory<WeakMap<K, V>>(() => new WeakMap()) as Attribute<K, V>;
  (attr as any).$registry = $registry;
  (attr as any).defaultFactory = factory;
  return attr;
}

// ============================================
// Attributes Scope
// ============================================

/**
 * Create an attributes scope for a store
 *
 * @example
 * const a = attributes(store);
 *
 * const player = new Player();
 * a.add(player, $health);
 * a.set(player, $health, 100);
 * console.log(a.get(player, $health));
 */
export function attributes(store: Store): Attributes {
  const r = reactive(store);

  return {
    add<K extends object>(obj: K, attr: Attribute<K, any>): void {
      r.sets.add(attr.$registry, obj);
    },

    remove<K extends object>(obj: K, attr: Attribute<K, any>): void {
      r.sets.remove(attr.$registry, obj);
    },

    has<K extends object>(obj: K, attr: Attribute<K, any>): boolean {
      return r.sets.has(attr.$registry, obj);
    },

    all<K extends object>(attr: Attribute<K, any>): K[] {
      return r.sets.values(attr.$registry);
    },

    get<K extends object, V>(obj: K, attr: Attribute<K, V>): V {
      const map = r.atoms.get(attr)!;
      const value = map.get(obj);
      if (value !== undefined) return value;
      if (attr.defaultFactory) return attr.defaultFactory();
      return attr.defaultValue as V;
    },

    set<K extends object, V>(obj: K, attr: Attribute<K, V>, value: V): void {
      const map = r.atoms.get(attr)!;
      map.set(obj, value);
      r.atoms.notify(attr);
    },

    delete<K extends object, V>(obj: K, attr: Attribute<K, V>): void {
      const map = r.atoms.get(attr)!;
      map.delete(obj);
      r.atoms.notify(attr);
    },

    hasAttr<K extends object, V>(obj: K, attr: Attribute<K, V>): boolean {
      return r.atoms.get(attr)!.has(obj);
    },

    dispose: r.dispose,
  };
}
