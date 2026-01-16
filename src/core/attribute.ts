/**
 * Attributes & Aspects - Per-Entity Data for ECS Pattern
 *
 * - Attribute: A single property type that entities can have (e.g., $position, $health)
 * - Aspect: A view into entity attributes, providing unified interface to read/write
 *
 * When you work with multiple attributes across entities, the aspect gives you
 * a clean API to manipulate them.
 *
 * @example
 * // Create attributes (like atoms)
 * const $position = attribute<Position>();
 * const $health = attribute<number>();
 *
 * // Create aspect to work with attributes
 * const asp = aspect(store);
 *
 * // Set values
 * asp.set('player', $position, { x: 0, y: 0 });
 * asp.set('player', $health, 100);
 *
 * // Get values
 * const pos = asp.get('player', $position); // { x: 0, y: 0 }
 * const hp = asp.get('player', $health);    // 100
 */

import type { Atom, Store } from './types';

export type EntityId = string | number;

export type AttributeAtom<T = any> = Atom<Map<EntityId, T>> & {
  _isAttribute: true;
};

let attributeIdCounter = 100000;

/**
 * Create an attribute atom (per-entity data store)
 *
 * @example
 * const $position = attribute<{ x: number; y: number }>();
 * const $health = attribute<number>();
 */
export function attribute<T>(): AttributeAtom<T> {
  return {
    _id: attributeIdCounter++,
    _type: 'atom',
    _initialValue: new Map<EntityId, T>(),
    _isAttribute: true,
  };
}

/**
 * Attribute-value pair for batch operations
 */
export type AttributeValue<T = any> = [AttributeAtom<T>, T];

export type Aspect = {
  /**
   * Get attribute value for an entity
   * @returns The value or undefined if not set
   */
  get<T>(entityId: EntityId, attr: AttributeAtom<T>): T | undefined;

  /**
   * Set attribute value for an entity
   */
  set<T>(entityId: EntityId, attr: AttributeAtom<T>, value: T): void;

  /**
   * Remove attribute value for an entity
   */
  remove<T>(entityId: EntityId, attr: AttributeAtom<T>): void;

  /**
   * Check if entity has attribute value
   */
  has<T>(entityId: EntityId, attr: AttributeAtom<T>): boolean;

  /**
   * Get all entity IDs that have this attribute
   */
  keys<T>(attr: AttributeAtom<T>): EntityId[];

  /**
   * Get the underlying Map for an attribute (for iteration)
   */
  getMap<T>(attr: AttributeAtom<T>): Map<EntityId, T>;

  /**
   * Clear all values for an attribute
   */
  clear<T>(attr: AttributeAtom<T>): void;

  /**
   * Attach multiple attributes to an entity (batched)
   * All updates are batched - subscribers notified once at the end
   */
  attach(entityId: EntityId, values: AttributeValue[]): void;

  /**
   * Detach multiple attributes from an entity (batched)
   * All updates are batched - subscribers notified once at the end
   */
  detach(entityId: EntityId, attrs: AttributeAtom<any>[]): void;
};

/**
 * Create an aspect bound to a store
 *
 * An aspect provides a unified interface to work with entity attributes.
 * Use it to get, set, remove, and query attribute values across entities.
 *
 * @example
 * const asp = aspect(store);
 *
 * // Work with attributes
 * asp.set('player', $position, { x: 0, y: 0 });
 * asp.set('enemy', $position, { x: 100, y: 50 });
 *
 * const pos = asp.get('player', $position); // { x: 0, y: 0 }
 */
export function aspect(store: Store): Aspect {
  function get<T>(entityId: EntityId, attr: AttributeAtom<T>): T | undefined {
    const map = store.get(attr);
    return map.get(entityId);
  }

  function set<T>(entityId: EntityId, attr: AttributeAtom<T>, value: T): void {
    const current = store.get(attr);
    const updated = new Map(current);
    updated.set(entityId, value);
    store.set(attr, updated);
  }

  function remove<T>(entityId: EntityId, attr: AttributeAtom<T>): void {
    const current = store.get(attr);
    if (!current.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    store.set(attr, updated);
  }

  function has<T>(entityId: EntityId, attr: AttributeAtom<T>): boolean {
    const map = store.get(attr);
    return map.has(entityId);
  }

  function keys<T>(attr: AttributeAtom<T>): EntityId[] {
    const map = store.get(attr);
    return Array.from(map.keys());
  }

  function getMap<T>(attr: AttributeAtom<T>): Map<EntityId, T> {
    return store.get(attr);
  }

  function clear<T>(attr: AttributeAtom<T>): void {
    store.set(attr, new Map());
  }

  function attach(entityId: EntityId, values: AttributeValue[]): void {
    if (values.length === 0) return;

    // Enable batching
    const wasBatching = store._isBatching;
    store._isBatching = true;

    try {
      for (const [attr, value] of values) {
        set(entityId, attr, value);
      }
    } finally {
      // Restore batching state and flush if we started the batch
      if (!wasBatching) {
        store._isBatching = false;
        store._flushPendingNotifications();
      }
    }
  }

  function detach(entityId: EntityId, attrs: AttributeAtom<any>[]): void {
    if (attrs.length === 0) return;

    // Enable batching
    const wasBatching = store._isBatching;
    store._isBatching = true;

    try {
      for (const attr of attrs) {
        remove(entityId, attr);
      }
    } finally {
      // Restore batching state and flush if we started the batch
      if (!wasBatching) {
        store._isBatching = false;
        store._flushPendingNotifications();
      }
    }
  }

  return { get, set, remove, has, keys, getMap, clear, attach, detach };
}
