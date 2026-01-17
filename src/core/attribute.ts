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

// TypedArray constructor types
export type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor;

export type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;


/**
 * Storage for typed attributes - contiguous TypedArray synced with length atom
 */
export interface TypedAttributeData<T extends TypedArray = TypedArray> {
  /** The underlying TypedArray storing all entity data */
  data: T;
  /** Number of components per entity (e.g., 3 for position xyz) */
  stride: number;
  /** Current capacity (max entities before resize) */
  capacity: number;
  /** Entity ID to index mapping */
  entityToIndex: Map<EntityId, number>;
  /** Index to entity ID mapping */
  indexToEntity: EntityId[];
}

export type AttributeAtom<T = any> = Atom<Map<EntityId, T>> & {
  _isAttribute: true;
};

/**
 * TypedAttribute atom - stores data in a contiguous TypedArray
 * Linked to a target atom for entity management
 */
export type TypedAttributeAtom<T extends TypedArray = TypedArray> = Atom<TypedAttributeData<T>> & {
  _isTypedAttribute: true;
  _ArrayType: TypedArrayConstructor;
  _stride: number;
  _targetAtom: Atom<number>;
};

/**
 * Create an attribute atom (per-entity data store)
 *
 * @example
 * const $position = attribute<{ x: number; y: number }>();
 * const $health = attribute<number>();
 */
export function attribute<T>(): AttributeAtom<T> {
  return {
    _initialValue: new Map<EntityId, T>(),
    _isAttribute: true,
  };
}

const DEFAULT_INITIAL_CAPACITY = 64;

/**
 * Create a typed attribute atom with contiguous TypedArray storage
 * Linked to a target atom that controls the entity count
 *
 * @param $target - Target atom that tracks entity count
 * @param ArrayType - TypedArray constructor (Float32Array, Int32Array, etc.)
 * @param stride - Number of components per entity (e.g., 3 for xyz position)
 * @param initialCapacity - Initial capacity (default: 64)
 *
 * @example
 * const $unit = atom(0);
 * const $position = typedAttribute($unit, Float32Array, 3);  // x, y, z
 * const $velocity = typedAttribute($unit, Float32Array, 3);  // vx, vy, vz
 * const $color = typedAttribute($unit, Uint8Array, 4);       // r, g, b, a
 *
 * // Use with typedAspect
 * const tasp = typedAspect(store);
 * tasp.set('entity1', $position, [100, 200, 0]);
 * tasp.get('entity1', $position);  // [100, 200, 0]
 *
 * // Access raw data for GPU upload
 * const { data, count, stride } = tasp.getRaw($position);
 */
export function typedAttribute<T extends TypedArray>(
  $target: Atom<number>,
  ArrayType: { new(length: number): T; BYTES_PER_ELEMENT: number },
  stride: number,
  initialCapacity: number = DEFAULT_INITIAL_CAPACITY
): TypedAttributeAtom<T> {
  // Factory to create fresh storage for each store
  const createStorage = (): TypedAttributeData<T> => ({
    data: new ArrayType(initialCapacity * stride),
    stride,
    capacity: initialCapacity,
    entityToIndex: new Map(),
    indexToEntity: [],
  });

  return {
    _initialValue: createStorage(), // For fast store (single-store)
    _initialFactory: createStorage, // For isolated stores (multi-store)
    _isTypedAttribute: true,
    _ArrayType: ArrayType as unknown as TypedArrayConstructor,
    _stride: stride,
    _targetAtom: $target,
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
    // Mutable update: mutate Map directly, then notify
    const map = store.get(attr);
    map.set(entityId, value);
    store._notify(attr);
  }

  function remove<T>(entityId: EntityId, attr: AttributeAtom<T>): void {
    const map = store.get(attr);
    if (!map.has(entityId)) return;
    // Mutable update: mutate Map directly, then notify
    map.delete(entityId);
    store._notify(attr);
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

/**
 * TypedAspect for working with TypedAttribute atoms
 * Works similarly to Aspect but with TypedArray storage
 */
export type TypedAspect = {
  /**
   * Get raw data for direct access/GPU upload
   */
  getRaw<T extends TypedArray>(attr: TypedAttributeAtom<T>): { data: T; count: number; stride: number };

  /**
   * Get values for an entity
   */
  get<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): number[] | undefined;

  /**
   * Set values for an entity (creates if not exists)
   */
  set<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>, values: ArrayLike<number>): void;

  /**
   * Remove an entity from the attribute
   */
  remove<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): void;

  /**
   * Check if entity exists in attribute
   */
  has<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): boolean;

  /**
   * Get all entity IDs
   */
  keys<T extends TypedArray>(attr: TypedAttributeAtom<T>): EntityId[];

  /**
   * Clear all entities from attribute
   */
  clear<T extends TypedArray>(attr: TypedAttributeAtom<T>): void;

  /**
   * Notify that data has changed (for manual TypedArray mutations)
   */
  notify<T extends TypedArray>(attr: TypedAttributeAtom<T>): void;
};

/**
 * Create a typed aspect for working with TypedAttribute atoms
 *
 * TypedAspect works similarly to Aspect but stores data in contiguous TypedArrays.
 * Entity IDs are mapped to array indices internally.
 *
 * @param store - The store instance
 *
 * @example
 * const $count = atom(0);
 * const $position = typedAttribute($count, Float32Array, 2);
 * const $velocity = typedAttribute($count, Float32Array, 2);
 * const tasp = typedAspect(store);
 *
 * // Set values - similar to aspect
 * tasp.set('entity1', $position, [100, 200]);
 * tasp.set('entity1', $velocity, [1, -1]);
 *
 * // Get values
 * tasp.get('entity1', $position);  // [100, 200]
 *
 * // Get raw data for direct manipulation/GPU upload
 * const { data, count, stride } = tasp.getRaw($position);
 * for (let i = 0; i < count; i++) {
 *   data[i * stride] += data[i * stride + 2];  // update x by vx
 * }
 *
 * // Direct GPU upload
 * gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * stride), gl.DYNAMIC_DRAW);
 */
export function typedAspect(store: Store): TypedAspect {
  function ensureCapacity<T extends TypedArray>(
    attr: TypedAttributeAtom<T>,
    storage: TypedAttributeData<T>,
    minCapacity: number
  ): void {
    if (storage.capacity >= minCapacity) return;

    // Double capacity until sufficient
    let newCapacity = storage.capacity;
    while (newCapacity < minCapacity) {
      newCapacity *= 2;
    }

    // Create new array and copy data
    const ArrayType = attr._ArrayType as unknown as { new(length: number): T };
    const newData = new ArrayType(newCapacity * storage.stride);
    newData.set(storage.data as unknown as ArrayLike<number>);

    storage.data = newData;
    storage.capacity = newCapacity;
  }

  function getRaw<T extends TypedArray>(attr: TypedAttributeAtom<T>): { data: T; count: number; stride: number } {
    const storage = store.get(attr) as TypedAttributeData<T>;
    const count = storage.indexToEntity.length;

    return {
      data: storage.data,
      count,
      stride: storage.stride,
    };
  }

  function get<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): number[] | undefined {
    const storage = store.get(attr) as TypedAttributeData<T>;
    const index = storage.entityToIndex.get(entityId);
    if (index === undefined) return undefined;

    const offset = index * storage.stride;
    const result: number[] = [];
    for (let i = 0; i < storage.stride; i++) {
      result.push(storage.data[offset + i] as number);
    }
    return result;
  }

  function set<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>, values: ArrayLike<number>): void {
    const storage = store.get(attr) as TypedAttributeData<T>;
    let index = storage.entityToIndex.get(entityId);

    // New entity - add to the end
    if (index === undefined) {
      index = storage.indexToEntity.length;
      storage.entityToIndex.set(entityId, index);
      storage.indexToEntity.push(entityId);

      // Update target atom count
      const $target = attr._targetAtom;
      store.set($target, storage.indexToEntity.length);

      // Ensure capacity
      ensureCapacity(attr, storage, index + 1);
    }

    // Set values using TypedArray.set() - the proper way to copy data
    const offset = index * storage.stride;
    // Create a view of just the values we need if values is longer than stride
    if (values.length <= storage.stride) {
      storage.data.set(values as ArrayLike<number>, offset);
    } else {
      // Only copy up to stride elements
      const length = Math.min(storage.stride, values.length);
      storage.data.set(Array.prototype.slice.call(values, 0, length) as number[], offset);
    }

    store._notify(attr);
  }

  function remove<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): void {
    const storage = store.get(attr) as TypedAttributeData<T>;
    const index = storage.entityToIndex.get(entityId);
    if (index === undefined) return;

    const lastIndex = storage.indexToEntity.length - 1;

    // If not the last element, swap with last
    if (index !== lastIndex) {
      const lastEntityId = storage.indexToEntity[lastIndex]!;
      const stride = storage.stride;

      // Copy last element data to removed position using subarray and set
      const lastOffset = lastIndex * stride;
      const targetOffset = index * stride;
      storage.data.set(storage.data.subarray(lastOffset, lastOffset + stride), targetOffset);

      // Update mappings for swapped entity
      storage.entityToIndex.set(lastEntityId, index);
      storage.indexToEntity[index] = lastEntityId;
    }

    // Remove last element
    storage.entityToIndex.delete(entityId);
    storage.indexToEntity.pop();

    // Update target atom count
    const $target = attr._targetAtom;
    store.set($target, storage.indexToEntity.length);

    store._notify(attr);
  }

  function has<T extends TypedArray>(entityId: EntityId, attr: TypedAttributeAtom<T>): boolean {
    const storage = store.get(attr) as TypedAttributeData<T>;
    return storage.entityToIndex.has(entityId);
  }

  function keys<T extends TypedArray>(attr: TypedAttributeAtom<T>): EntityId[] {
    const storage = store.get(attr) as TypedAttributeData<T>;
    return [...storage.indexToEntity];
  }

  function clear<T extends TypedArray>(attr: TypedAttributeAtom<T>): void {
    const storage = store.get(attr) as TypedAttributeData<T>;
    storage.entityToIndex.clear();
    storage.indexToEntity.length = 0;

    // Update target atom count
    const $target = attr._targetAtom;
    store.set($target, 0);

    store._notify(attr);
  }

  function notify<T extends TypedArray>(attr: TypedAttributeAtom<T>): void {
    store._notify(attr);
  }

  return { getRaw, get, set, remove, has, keys, clear, notify };
}
