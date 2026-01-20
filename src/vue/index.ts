/**
 * Kho Vue Bindings
 * Vue 3 Composition API integration for Kho state management
 */

import { inject, provide, onUnmounted, readonly, shallowRef } from 'vue';
import type { Ref, InjectionKey } from 'vue';
import type { Atom, Store, System, Scope } from '../core/types';
import type { AttributeAtom, EntityId } from '../core/ecs';
import { createStore } from '../core/store';
import { scope } from '../core/scope';
import { assembler } from '../core/assembler';

// ============================================
// Store Context (provide/inject Pattern)
// ============================================

type StoreContextValue = {
  store: Store;
  scope: Scope;
};

const StoreKey: InjectionKey<StoreContextValue> = Symbol('kho-store');

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
  const s = scope(store);
  provide(StoreKey, { store, scope: s });

  if (systems && systems.length > 0) {
    const dispose = assembler(systems, s);
    onUnmounted(dispose);
  }

  onUnmounted(() => {
    s.dispose();
  });
}

// ============================================
// Global Store (Fallback)
// ============================================

let globalStore: Store | null = null;
let globalScope: Scope | null = null;

export function setGlobalStore(store: Store): void {
  globalStore = store;
  globalScope = scope(store);
}

export function getGlobalStore(): Store {
  if (!globalStore) {
    globalStore = createStore();
    globalScope = scope(globalStore);
  }
  return globalStore;
}

function getGlobalScope(): Scope {
  if (!globalScope) {
    getGlobalStore(); // This will initialize both
  }
  return globalScope!;
}

// ============================================
// Internal: Get store and scope from context or global
// ============================================

function useStoreInternal(): StoreContextValue {
  const contextValue = inject(StoreKey, null);
  if (contextValue) {
    return contextValue;
  }
  return { store: getGlobalStore(), scope: getGlobalScope() };
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
  return useStoreInternal().store;
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
  const { store, scope: s } = useStoreInternal();
  const value = shallowRef<T>(s.get(atom) as T);

  // Create a scope for this subscription
  const { effect, get, dispose } = scope(store);

  // Use a flag to skip the initial run since we already have the value
  let isFirstRun = true;

  // Subscribe to atom changes using effect
  effect([atom], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    value.value = get(atom) as T;
  });

  // Cleanup on component unmount
  onUnmounted(dispose);

  const setValue = (newValue: T): void => {
    s.set(atom, newValue);
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
  const { store, scope: s } = useStoreInternal();
  const value = shallowRef<T>(s.get(atom) as T);

  // Create a scope for this subscription
  const { effect, get, dispose } = scope(store);

  // Use a flag to skip the initial run since we already have the value
  let isFirstRun = true;

  // Subscribe to atom changes using effect
  effect([atom], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    value.value = get(atom) as T;
  });

  // Cleanup on component unmount
  onUnmounted(dispose);

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
  const { scope: s } = useStoreInternal();

  return (newValue: T): void => {
    s.set(atom, newValue);
  };
}

/**
 * Vue composable to get a scope instance
 * Automatically disposes on component unmount
 *
 * @example
 * const s = useScope();
 * s.effect([$count], () => {
 *   console.log('Count changed:', s.get($count));
 * });
 */
export function useScope(): Scope {
  const { store } = useStoreInternal();
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
 *   s.set($count, 10);
 *   s.set($name, 'Alice');
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
  const { scope: s } = useStoreInternal();

  const get = (entityId: EntityId): T | undefined => {
    const map = s.get(attr);
    return map?.get(entityId);
  };

  const set = (entityId: EntityId, value: T): void => {
    const current = s.get(attr) || new Map();
    const updated = new Map(current);
    updated.set(entityId, value);
    s.set(attr, updated);
  };

  const remove = (entityId: EntityId): void => {
    const current = s.get(attr);
    if (!current?.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    s.set(attr, updated);
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
  const { store, scope: s } = useStoreInternal();
  const initialMap = s.get(attr);
  const value = shallowRef<T | undefined>(initialMap?.get(entityId));

  // Create a scope for this subscription
  const { effect, get, dispose } = scope(store);

  // Use a flag to skip the initial run
  let isFirstRun = true;

  // Subscribe to attribute changes using effect
  effect([attr], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    const newMap = get(attr);
    const newValue = newMap?.get(entityId);
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

  // Cleanup on component unmount
  onUnmounted(dispose);

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
  const { scope: s } = useStoreInternal();

  const set = (entityId: EntityId, value: T): void => {
    const current = s.get(attr) || new Map();
    const updated = new Map(current);
    updated.set(entityId, value);
    s.set(attr, updated);
  };

  const remove = (entityId: EntityId): void => {
    const current = s.get(attr);
    if (!current?.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    s.set(attr, updated);
  };

  return [set, remove];
}
