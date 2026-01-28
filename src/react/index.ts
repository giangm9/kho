import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import type { Atom, Store, System, Reactive, Effects } from '../types';
import type { Component, Entity } from '../data/entity';
import { createStore } from '../data/store';
import { reactive } from '../data/reactive';
import { effects } from '../system/effects';
import { ignite, $systems } from '../system/assembler';

// ============================================
// Store Context (Provider Pattern)
// ============================================

type StoreContextValue = {
  store: Store;
  reactive: Reactive;
};

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Provider component for Kho store
 * Wrap your app with this to provide store access to all components
 *
 * @example
 * const store = createStore();
 *
 * function App() {
 *   return (
 *     <KhoProvider store={store}>
 *       <MyComponent />
 *     </KhoProvider>
 *   );
 * }
 */
export type KhoProviderProps = {
  store: Store;
  systems?: System[];
  children: React.ReactNode;
};

export function KhoProvider({ store, systems, children }: KhoProviderProps): React.ReactElement {
  // Create a single reactive instance for the provider
  const reactiveRef = useRef<Reactive | null>(null);
  if (!reactiveRef.current) {
    reactiveRef.current = reactive(store);
  }

  useEffect(() => {
    // Register systems - ignite will auto-start them
    const r = reactive(store);

    if (systems && systems.length > 0) {
      for (const sys of systems) {
        r.sets.add($systems, sys);
      }
    }

    // Ignite the store
    const dispose = ignite(store);

    return () => {
      dispose();
      r.dispose();
    };
  }, [store, systems]);

  useEffect(() => {
    return () => {
      reactiveRef.current?.dispose();
    };
  }, []);

  const contextValue = { store, reactive: reactiveRef.current };

  return React.createElement(StoreContext.Provider, { value: contextValue }, children);
}

// ============================================
// Global Store (Fallback for non-Provider usage)
// ============================================

let globalStore: Store | null = null;
let globalReactive: Reactive | null = null;

export function setGlobalStore(store: Store) {
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
// Internal: Get store and scope from context or global
// ============================================

function useStoreInternal(): StoreContextValue {
  const contextValue = useContext(StoreContext);
  if (contextValue) {
    return contextValue;
  }
  // Fallback to global store for backwards compatibility
  return { store: getGlobalStore(), reactive: getGlobalReactive() };
}

// ============================================
// React Hooks
// ============================================

/**
 * React hook to read and write atom values
 * Automatically subscribes to changes and re-renders component
 * Supports both direct values and updater functions
 *
 * @example
 * const [count, setCount] = useAtom($count);
 * setCount(5);           // Direct value
 * setCount(c => c + 1);  // Updater function
 */
export function useAtom<T>(atom: Atom<T>): [T, (value: T | ((prev: T) => T)) => void] {
  const { store, reactive: r } = useStoreInternal();
  const [value, setValue] = useState<T>(() => r.atoms.get(atom) as T);

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(r.atoms.get(atom) as T);

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
      setValue(r.atoms.get(atom) as T);
    });

    // Cleanup subscription on unmount
    return e.dispose;
  }, [atom, store]);

  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = r.atoms.get(atom) as T;
      r.atoms.set(atom, updater(currentValue));
    } else {
      r.atoms.set(atom, newValue);
    }
  }, [atom, r]);

  return [value, updateValue];
}

/**
 * React hook to read atom value (read-only)
 *
 * @example
 * const count = useAtomValue($count);
 */
export function useAtomValue<T>(atom: Atom<T>): T {
  const { store, reactive: r } = useStoreInternal();
  const [value, setValue] = useState<T>(() => r.atoms.get(atom) as T);

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(r.atoms.get(atom) as T);

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
      setValue(r.atoms.get(atom) as T);
    });

    return e.dispose;
  }, [atom, store]);

  return value;
}

/**
 * React hook to get setter function only (no re-renders on value change)
 * Supports both direct values and updater functions
 *
 * @example
 * const setCount = useSetAtom($count);
 * setCount(5);           // Direct value
 * setCount(c => c + 1);  // Updater function
 * // Component won't re-render when $count changes
 */
export function useSetAtom<T>(atom: Atom<T>): (value: T | ((prev: T) => T)) => void {
  const { reactive: r } = useStoreInternal();

  return useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = r.atoms.get(atom) as T;
      r.atoms.set(atom, updater(currentValue));
    } else {
      r.atoms.set(atom, newValue);
    }
  }, [atom, r]);
}

/**
 * React hook to get the store instance
 * Uses Provider store if available, otherwise falls back to global store
 *
 * @example
 * const store = useStore();
 */
export function useStore(): Store {
  return useStoreInternal().store;
}

/**
 * React hook to get a reactive instance for the current store
 * Creates a reactive instance once and reuses it, disposing on unmount
 *
 * @example
 * const { atoms, sets, maps } = useReactive();
 * atoms.set($count, 10);
 * sets.add($users, user);
 */
export function useReactive(): Reactive {
  const { store } = useStoreInternal();
  const reactiveRef = useRef<Reactive | null>(null);

  if (!reactiveRef.current) {
    reactiveRef.current = reactive(store);
  }

  useEffect(() => {
    return () => {
      reactiveRef.current?.dispose();
    };
  }, []);

  return reactiveRef.current;
}

/**
 * React hook to get an effects instance for the current store
 * Creates an effects instance once and reuses it, disposing on unmount
 *
 * @example
 * const { effect, batch } = useEffects();
 * effect([$count], () => {
 *   console.log('count changed');
 * });
 */
export function useEffects(): Effects {
  const { store } = useStoreInternal();
  const effectsRef = useRef<Effects | null>(null);

  if (!effectsRef.current) {
    effectsRef.current = effects(store);
  }

  useEffect(() => {
    return () => {
      effectsRef.current?.dispose();
    };
  }, []);

  return effectsRef.current;
}

/**
 * React hook to batch multiple updates
 * Returns a function that wraps updates in a batch
 * Effects are only triggered once after all updates complete
 *
 * @example
 * const batch = useBatch();
 * batch(() => {
 *   atom.set($count, 10);
 *   atom.set($name, 'Alice');
 * }); // Effects run once at the end
 */
export function useBatch(): (fn: () => void) => void {
  const e = useEffects();

  return useCallback((fn: () => void) => {
    e.batch(fn);
  }, [e]);
}

// ============================================
// ECS Component Hooks
// ============================================

/**
 * Component getter/setter tuple returned by useComponent
 */
export type UseComponentResult<T> = [
  /** Get component value for an entity (reads directly from store) */
  (entity: Entity) => T | undefined,
  /** Set component value for an entity */
  (entity: Entity, value: T) => void,
  /** Remove component value for an entity */
  (entity: Entity) => void
];

/**
 * React hook for ECS component access with STABLE functions (no re-renders)
 *
 * This hook returns stable getter/setter functions that read/write directly
 * from the store. The component will NOT re-render when component values change.
 *
 * Use this when:
 * - Rendering a list of entities (combine with useAtomValue($entities))
 * - You only need to write values
 * - Child components handle their own subscriptions via useComponentValue
 *
 * @example
 * function EntityList() {
 *   const entities = useAtomValue($entities); // Re-renders when list changes
 *   const [get, set] = useComponent($position); // Stable, no re-renders
 *
 *   return entities.map(e => (
 *     <EntityItem key={e.id} entity={e} />
 *   ));
 * }
 *
 * function EntityItem({ entity }) {
 *   const pos = useComponentValue($position, entity); // Re-renders when THIS entity changes
 *   return <div>{pos?.x}, {pos?.y}</div>;
 * }
 */
export function useComponent<T>(comp: Component<T>): UseComponentResult<T> {
  const { reactive: r } = useStoreInternal();

  // Stable getter - reads directly from store (always fresh value)
  const get = useCallback((entity: Entity): T | undefined => {
    const map = r.atoms.get(comp);
    return map?.get(entity);
  }, [comp, r]);

  // Stable setter - mutates WeakMap and notifies
  const set = useCallback((entity: Entity, value: T): void => {
    const map = r.atoms.get(comp)!;
    map.set(entity, value);
    r.atoms.notify(comp);
  }, [comp, r]);

  // Stable remover
  const remove = useCallback((entity: Entity): void => {
    const map = r.atoms.get(comp)!;
    map.delete(entity);
    r.atoms.notify(comp);
  }, [comp, r]);

  return [get, set, remove];
}

/**
 * React hook to read a single entity's component value
 * Only re-renders when the specific entity's value changes
 *
 * @example
 * const playerPos = useComponentValue($position, player);
 * // Only re-renders when player's position changes, not other entities
 *
 * const enemyHealth = useComponentValue($health, enemy);
 */
export function useComponentValue<T>(
  comp: Component<T>,
  entity: Entity
): T | undefined {
  const { store, reactive: r } = useStoreInternal();
  const [value, setValue] = useState<T | undefined>(() => {
    const map = r.atoms.get(comp);
    return map?.get(entity);
  });

  useEffect(() => {
    // Get initial value
    const map = r.atoms.get(comp);
    setValue(map?.get(entity));

    // Create an effects instance for this subscription
    const e = effects(store);

    // Use a flag to skip the initial run
    let isFirstRun = true;

    // Subscribe to component changes using effect
    e.effect([comp], () => {
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      const newMap = r.atoms.get(comp);
      const newValue = newMap?.get(entity);
      setValue((prev) => {
        // Only trigger re-render if value actually changed
        if (prev === newValue) return prev;
        // Deep comparison for objects (simple check)
        if (
          typeof prev === 'object' &&
          typeof newValue === 'object' &&
          prev !== null &&
          newValue !== null &&
          JSON.stringify(prev) === JSON.stringify(newValue)
        ) {
          return prev;
        }
        return newValue;
      });
    });

    return e.dispose;
  }, [comp, entity, store]);

  return value;
}

/**
 * React hook to get only the setter for a component (no re-renders)
 * Useful when you only need to update values without reading them
 *
 * @example
 * const [setPosition, removePosition] = useSetComponent($position);
 * setPosition(player, { x: 10, y: 20 });
 * removePosition(enemy);
 */
export function useSetComponent<T>(
  comp: Component<T>
): [(entity: Entity, value: T) => void, (entity: Entity) => void] {
  const { reactive: r } = useStoreInternal();

  const set = useCallback((entity: Entity, value: T): void => {
    const map = r.atoms.get(comp)!;
    map.set(entity, value);
    r.atoms.notify(comp);
  }, [comp, r]);

  const remove = useCallback((entity: Entity): void => {
    const map = r.atoms.get(comp)!;
    map.delete(entity);
    r.atoms.notify(comp);
  }, [comp, r]);

  return [set, remove];
}

// ============================================
// Deprecated aliases for backwards compatibility
// ============================================

/** @deprecated Use UseComponentResult instead */
export type UseAttributeResult<T> = UseComponentResult<T>;

/** @deprecated Use useComponent instead */
export const useAttribute = useComponent;

/** @deprecated Use useComponentValue instead */
export const useAttributeValue = useComponentValue;

/** @deprecated Use useSetComponent instead */
export const useSetAttribute = useSetComponent;
