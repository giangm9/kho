/**
 * Kho Vue Bindings
 * Vue 3 Composition API integration for Kho state management
 */

import { ref, inject, provide, onMounted, onUnmounted, readonly, shallowRef } from 'vue';
import type { Ref, InjectionKey } from 'vue';
import type { Atom, Store, System } from '../core/types';
import type { AttributeAtom, EntityId } from '../core/attribute';
import { createStore } from '../core/store';
import { scope } from '../core/scope';
import { assembler } from '../core/assembler';

type Scope = ReturnType<typeof scope>;

// ============================================
// Store Context (provide/inject Pattern)
// ============================================

const StoreKey: InjectionKey<Store> = Symbol('kho-store');

/**
 * Provide a Kho store to the component tree
 * Call this in your root component's setup()
 *
 * @example
 * // App.vue
 * import { createStore } from 'kho';
 * import { provideStore } from 'kho/vue';
 *
 * setup() {
 *   const store = createStore();
 *   provideStore(store);
 * }
 */
export function provideStore(store: Store, systems?: System[]): void {
  provide(StoreKey, store);

  if (systems && systems.length > 0) {
    const dispose = assembler(systems, store);
    onUnmounted(dispose);
  }
}

// ============================================
// Global Store (Fallback)
// ============================================

let globalStore: Store | null = null;

export function setGlobalStore(store: Store): void {
  globalStore = store;
}

export function getGlobalStore(): Store {
  if (!globalStore) {
    globalStore = createStore();
  }
  return globalStore;
}

// ============================================
// Internal: Get store from context or global
// ============================================

function useStoreInternal(): Store {
  const contextStore = inject(StoreKey, null);
  if (contextStore) {
    return contextStore;
  }
  return getGlobalStore();
}

// ============================================
// Vue Composables
// ============================================

/**
 * Vue composable to get the store instance
 *
 * @example
 * const store = useStore();
 */
export function useStore(): Store {
  return useStoreInternal();
}

/**
 * Vue composable to read and write atom values
 * Returns a reactive ref that updates when atom changes
 *
 * @example
 * const [count, setCount] = useAtom($count);
 * // count.value is reactive
 * // setCount(5) updates the atom
 */
export function useAtom<T>(atom: Atom<T>): [Readonly<Ref<T>>, (value: T) => void] {
  const store = useStoreInternal();
  const value = shallowRef<T>(store.get(atom));

  onMounted(() => {
    // Sync initial value
    value.value = store.get(atom);

    // Subscribe to changes
    const unsubscribe = store.subscribe(atom, (newValue) => {
      value.value = newValue;
    });

    onUnmounted(unsubscribe);
  });

  const setValue = (newValue: T): void => {
    store.set(atom, newValue);
  };

  return [readonly(value) as Readonly<Ref<T>>, setValue];
}

/**
 * Vue composable to read atom value (read-only)
 *
 * @example
 * const count = useAtomValue($count);
 * // count.value is reactive and read-only
 */
export function useAtomValue<T>(atom: Atom<T>): Readonly<Ref<T>> {
  const store = useStoreInternal();
  const value = shallowRef<T>(store.get(atom));

  onMounted(() => {
    value.value = store.get(atom);

    const unsubscribe = store.subscribe(atom, (newValue) => {
      value.value = newValue;
    });

    onUnmounted(unsubscribe);
  });

  return readonly(value) as Readonly<Ref<T>>;
}

/**
 * Vue composable to get setter function only (no reactivity overhead)
 *
 * @example
 * const setCount = useSetAtom($count);
 * setCount(5);
 */
export function useSetAtom<T>(atom: Atom<T>): (value: T) => void {
  const store = useStoreInternal();

  return (newValue: T): void => {
    store.set(atom, newValue);
  };
}

/**
 * Vue composable to get a scope instance
 * Automatically disposes on component unmount
 *
 * @example
 * const s = useScope();
 * s.effect([$count], (count) => {
 *   console.log('Count changed:', count);
 * });
 */
export function useScope(): Scope {
  const store = useStoreInternal();
  const s = scope(store);

  onUnmounted(() => {
    s.dispose();
  });

  return s;
}

/**
 * Vue composable to batch multiple updates
 *
 * @example
 * const batch = useBatch();
 * batch(() => {
 *   store.set($count, 10);
 *   store.set($name, 'Alice');
 * });
 */
export function useBatch(): (fn: () => void) => void {
  const s = useScope();
  return (fn: () => void): void => {
    s.batch(fn);
  };
}

// ============================================
// Attribute Composables
// ============================================

/**
 * Attribute getter/setter tuple returned by useAttribute
 */
export type UseAttributeResult<T> = [
  (entityId: EntityId) => T | undefined,
  (entityId: EntityId, value: T) => void,
  (entityId: EntityId) => void
];

/**
 * Vue composable for attribute access with stable functions
 * Functions don't trigger reactivity - use useAttributeValue for reactive access
 *
 * @example
 * const [getPosition, setPosition, removePosition] = useAttribute($position);
 * const pos = getPosition('player');
 * setPosition('player', { x: 10, y: 20 });
 */
export function useAttribute<T>(attr: AttributeAtom<T>): UseAttributeResult<T> {
  const store = useStoreInternal();

  const get = (entityId: EntityId): T | undefined => {
    const map = store.get(attr);
    return map.get(entityId);
  };

  const set = (entityId: EntityId, value: T): void => {
    const current = store.get(attr);
    const updated = new Map(current);
    updated.set(entityId, value);
    store.set(attr, updated);
  };

  const remove = (entityId: EntityId): void => {
    const current = store.get(attr);
    if (!current.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    store.set(attr, updated);
  };

  return [get, set, remove];
}

/**
 * Vue composable to read a single entity's attribute value
 * Returns a reactive ref that updates when the specific entity changes
 *
 * @example
 * const playerPos = useAttributeValue($position, 'player');
 * // playerPos.value updates only when player's position changes
 */
export function useAttributeValue<T>(
  attr: AttributeAtom<T>,
  entityId: EntityId
): Readonly<Ref<T | undefined>> {
  const store = useStoreInternal();
  const initialMap = store.get(attr);
  const value = shallowRef<T | undefined>(initialMap.get(entityId));

  onMounted(() => {
    const currentMap = store.get(attr);
    value.value = currentMap.get(entityId);

    const unsubscribe = store.subscribe(attr, (newMap) => {
      const newValue = newMap.get(entityId);
      // Only update if value changed (shallow comparison)
      if (value.value !== newValue) {
        // Deep comparison for objects
        if (
          typeof value.value === 'object' &&
          typeof newValue === 'object' &&
          value.value !== null &&
          newValue !== null &&
          JSON.stringify(value.value) === JSON.stringify(newValue)
        ) {
          return;
        }
        value.value = newValue;
      }
    });

    onUnmounted(unsubscribe);
  });

  return readonly(value) as Readonly<Ref<T | undefined>>;
}

/**
 * Vue composable to get only setter functions for attributes
 *
 * @example
 * const [setPosition, removePosition] = useSetAttribute($position);
 * setPosition('player', { x: 10, y: 20 });
 */
export function useSetAttribute<T>(
  attr: AttributeAtom<T>
): [(entityId: EntityId, value: T) => void, (entityId: EntityId) => void] {
  const store = useStoreInternal();

  const set = (entityId: EntityId, value: T): void => {
    const current = store.get(attr);
    const updated = new Map(current);
    updated.set(entityId, value);
    store.set(attr, updated);
  };

  const remove = (entityId: EntityId): void => {
    const current = store.get(attr);
    if (!current.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    store.set(attr, updated);
  };

  return [set, remove];
}
