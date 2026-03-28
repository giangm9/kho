/**
 * Kho Vue Bindings
 * Vue 3 Composition API integration for Kho state management
 */

import { inject, provide, onUnmounted, readonly, shallowRef } from 'vue';
import type { Ref, InjectionKey } from 'vue';
import type { Atom, Store, System, Reactive, Effects } from '../types';
import type { Component } from '../data/entity';
import { createStore } from '../data/store';
import { reactive } from '../data/reactive';
import { effects } from '../system/effects';
import { ignite, $systems } from '../system/assembler';

// ============================================
// Store Context (provide/inject Pattern)
// ============================================

type StoreContextValue = {
  store: Store;
  reactive: Reactive;
};

const StoreKey: InjectionKey<StoreContextValue> = Symbol('kho-store');

/**
 * Provide a Kho store to the component tree
 * Call this in your root component's setup()
 *
 * @example
 * // App.vue
 * <script setup>
 * import { createStore } from 'kho';
 * import { provideStore } from 'kho/vue';
 *
 * const store = createStore();
 * provideStore(store);
 * // Or with systems:
 * // provideStore(store, [gameSystem, uiSystem]);
 * </script>
 */
export function provideStore(store: Store, systems?: System[]): void {
  const r = reactive(store);
  provide(StoreKey, { store, reactive: r });

  // Register systems - ignite will auto-start them
  if (systems && systems.length > 0) {
    for (const sys of systems) {
      r.sets.add($systems, sys);
    }
  }

  // Ignite the store
  const dispose = ignite(store);

  onUnmounted(() => {
    dispose();
    r.dispose();
  });
}

// ============================================
// Global Store (Fallback)
// ============================================

let globalStore: Store | null = null;
let globalReactive: Reactive | null = null;

export function setGlobalStore(store: Store): void {
  globalStore = store;
  globalReactive = reactive(store);
}

export function getGlobalStore(): Store {
  if (!globalStore) {
    globalStore = createStore();
    globalReactive = reactive(globalStore);
  }
  return globalStore;
}

function getGlobalReactive(): Reactive {
  if (!globalReactive) {
    getGlobalStore(); // This will initialize both
  }
  return globalReactive!;
}

// ============================================
// Internal: Get store and reactive from context or global
// ============================================

function useStoreInternal(): StoreContextValue {
  const contextValue = inject(StoreKey, null);
  if (contextValue) {
    return contextValue;
  }
  return { store: getGlobalStore(), reactive: getGlobalReactive() };
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
  const { store, reactive: r } = useStoreInternal();
  const value = shallowRef<T>(r.atoms.get(atom) as T);

  // Create an effects instance for this subscription
  const e = effects(store);

  // Use a flag to skip the initial run since we already have the value
  let isFirstRun = true;

  // Subscribe to atom changes using effect
  e.effect([atom], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    value.value = r.atoms.get(atom) as T;
  });

  // Cleanup on component unmount
  onUnmounted(e.dispose);

  const setValue = (newValue: T): void => {
    r.atoms.set(atom, newValue);
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
  const { store, reactive: r } = useStoreInternal();
  const value = shallowRef<T>(r.atoms.get(atom) as T);

  // Create an effects instance for this subscription
  const e = effects(store);

  // Use a flag to skip the initial run since we already have the value
  let isFirstRun = true;

  // Subscribe to atom changes using effect
  e.effect([atom], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    value.value = r.atoms.get(atom) as T;
  });

  // Cleanup on component unmount
  onUnmounted(e.dispose);

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
  const { reactive: r } = useStoreInternal();

  return (newValue: T): void => {
    r.atoms.set(atom, newValue);
  };
}

/**
 * Vue composable to get a reactive instance
 * Automatically disposes on component unmount
 *
 * @example
 * const { atoms, sets, maps } = useReactive();
 * atoms.set($count, 10);
 * sets.add($users, user);
 */
export function useReactive(): Reactive {
  const { store } = useStoreInternal();
  const r = reactive(store);

  onUnmounted(() => {
    r.dispose();
  });

  return r;
}

/**
 * Vue composable to get an effects instance
 * Automatically disposes on component unmount
 *
 * @example
 * const { effect, batch } = useEffects();
 * effect([$count], () => {
 *   console.log('count changed');
 * });
 */
export function useEffects(): Effects {
  const { store } = useStoreInternal();
  const e = effects(store);

  onUnmounted(() => {
    e.dispose();
  });

  return e;
}

/**
 * Vue composable to batch multiple updates
 *
 * @example
 * const batch = useBatch();
 * batch(() => {
 *   atom.set($count, 10);
 *   atom.set($name, 'Alice');
 * });
 */
export function useBatch(): (fn: () => void) => void {
  const e = useEffects();
  return (fn: () => void): void => {
    e.batch(fn);
  };
}

// ============================================
// ECS Component Composables
// ============================================

/**
 * Component getter/setter tuple returned by useComponent
 */
export type UseComponentResult<T> = [
  (entity: string) => T | undefined,
  (entity: string, value: T) => void,
  (entity: string) => void
];

/**
 * Vue composable for ECS component access with stable functions
 * Functions don't trigger reactivity - use useComponentValue for reactive access
 *
 * @example
 * const [getPosition, setPosition, removePosition] = useComponent($position);
 * const pos = getPosition('player-1');
 * setPosition('player-1', { x: 10, y: 20 });
 */
export function useComponent<T>(comp: Component<T>): UseComponentResult<T> {
  const { reactive: r } = useStoreInternal();

  const get = (entity: string): T | undefined => {
    const map = r.atoms.get(comp);
    return map?.get(entity);
  };

  const set = (entity: string, value: T): void => {
    const map = r.atoms.get(comp)!;
    map.set(entity, value);
    r.atoms.notify(comp);
  };

  const remove = (entity: string): void => {
    const map = r.atoms.get(comp)!;
    map.delete(entity);
    r.atoms.notify(comp);
  };

  return [get, set, remove];
}

/**
 * Vue composable to read a single entity's component value
 * Returns a reactive ref that updates when the specific entity changes
 *
 * @example
 * const playerPos = useComponentValue($position, 'player-1');
 */
export function useComponentValue<T>(
  comp: Component<T>,
  entity: string
): Readonly<Ref<T | undefined>> {
  const { store, reactive: r } = useStoreInternal();
  const initialMap = r.atoms.get(comp);
  const value = shallowRef<T | undefined>(initialMap?.get(entity));

  const e = effects(store);
  let isFirstRun = true;

  e.effect([comp], () => {
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    const newMap = r.atoms.get(comp);
    const newValue = newMap?.get(entity);
    if (value.value !== newValue) {
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

  onUnmounted(e.dispose);

  return readonly(value) as Readonly<Ref<T | undefined>>;
}

/**
 * Vue composable to get only setter functions for components
 *
 * @example
 * const [setPosition, removePosition] = useSetComponent($position);
 * setPosition('player-1', { x: 10, y: 20 });
 */
export function useSetComponent<T>(
  comp: Component<T>
): [(entity: string, value: T) => void, (entity: string) => void] {
  const { reactive: r } = useStoreInternal();

  const set = (entity: string, value: T): void => {
    const map = r.atoms.get(comp)!;
    map.set(entity, value);
    r.atoms.notify(comp);
  };

  const remove = (entity: string): void => {
    const map = r.atoms.get(comp)!;
    map.delete(entity);
    r.atoms.notify(comp);
  };

  return [set, remove];
}
