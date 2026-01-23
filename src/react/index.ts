import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import type { Atom, Store, System, Scope } from '../core/types';
import type { Attribute, Entity } from '../core/entity';
import { createStore } from '../core/store';
import { scope } from '../core/scope';
import { composer, $systems } from '../core/composer';
import type { SystemEntry } from '../core/composer';

// ============================================
// Store Context (Provider Pattern)
// ============================================

type StoreContextValue = {
  store: Store;
  scope: Scope;
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
  // Create a single scope for the provider
  const scopeRef = useRef<Scope | null>(null);
  if (!scopeRef.current) {
    scopeRef.current = scope(store);
  }

  useEffect(() => {
    // Start composer
    const disposeComposer = composer(store);

    // Register systems via $systems atom (data-driven)
    if (systems && systems.length > 0) {
      const systemsMap = new Map<string, SystemEntry>();
      systems.forEach((factory, index) => {
        const name = factory.name || `system_${index}`;
        systemsMap.set(name, {
          name,
          factory,
          dispose: null,
          enabled: true,
        });
      });
      scopeRef.current!.set($systems, systemsMap);
    }

    return disposeComposer;
  }, [store, systems]);

  useEffect(() => {
    return () => {
      scopeRef.current?.dispose();
    };
  }, []);

  const contextValue = { store, scope: scopeRef.current };

  return React.createElement(StoreContext.Provider, { value: contextValue }, children);
}

// ============================================
// Global Store (Fallback for non-Provider usage)
// ============================================

let globalStore: Store | null = null;
let globalScope: Scope | null = null;

export function setGlobalStore(store: Store) {
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
  const contextValue = useContext(StoreContext);
  if (contextValue) {
    return contextValue;
  }
  // Fallback to global store for backwards compatibility
  return { store: getGlobalStore(), scope: getGlobalScope() };
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
  const { store, scope: s } = useStoreInternal();
  const [value, setValue] = useState<T>(() => s.get(atom) as T);

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(s.get(atom) as T);

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
      setValue(get(atom) as T);
    });

    // Cleanup subscription on unmount
    return dispose;
  }, [atom, store]);

  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = s.get(atom) as T;
      s.set(atom, updater(currentValue));
    } else {
      s.set(atom, newValue);
    }
  }, [atom, s]);

  return [value, updateValue];
}

/**
 * React hook to read atom value (read-only)
 *
 * @example
 * const count = useAtomValue($count);
 */
export function useAtomValue<T>(atom: Atom<T>): T {
  const { store, scope: s } = useStoreInternal();
  const [value, setValue] = useState<T>(() => s.get(atom) as T);

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(s.get(atom) as T);

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
      setValue(get(atom) as T);
    });

    return dispose;
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
  const { scope: s } = useStoreInternal();

  return useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = s.get(atom) as T;
      s.set(atom, updater(currentValue));
    } else {
      s.set(atom, newValue);
    }
  }, [atom, s]);
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
 * React hook to get a scope instance for the current store
 * Creates a scope once and reuses it, disposing on unmount
 *
 * @example
 * const s = useScope();
 * s.batch(() => {
 *   s.set($count, 10);
 *   s.set($name, 'Alice');
 * });
 */
export function useScope(): Scope {
  const { store } = useStoreInternal();
  const scopeRef = useRef<Scope | null>(null);

  if (!scopeRef.current) {
    scopeRef.current = scope(store);
  }

  useEffect(() => {
    return () => {
      scopeRef.current?.dispose();
    };
  }, []);

  return scopeRef.current;
}

/**
 * React hook to batch multiple updates
 * Returns a function that wraps updates in a batch
 * Effects are only triggered once after all updates complete
 *
 * @example
 * const batch = useBatch();
 * batch(() => {
 *   s.set($count, 10);
 *   s.set($name, 'Alice');
 * }); // Effects run once at the end
 */
export function useBatch(): (fn: () => void) => void {
  const s = useScope();

  return useCallback((fn: () => void) => {
    s.batch(fn);
  }, [s]);
}

/**
 * Attribute getter/setter tuple returned by useAttribute
 */
export type UseAttributeResult<T> = [
  /** Get attribute value for an entity (reads directly from store) */
  (entity: Entity) => T | undefined,
  /** Set attribute value for an entity */
  (entity: Entity, value: T) => void,
  /** Remove attribute value for an entity */
  (entity: Entity) => void
];

/**
 * React hook for attribute access with STABLE functions (no re-renders)
 *
 * This hook returns stable getter/setter functions that read/write directly
 * from the store. The component will NOT re-render when attribute values change.
 *
 * Use this when:
 * - Rendering a list of entities (combine with useAtomValue($entities))
 * - You only need to write values
 * - Child components handle their own subscriptions via useAttributeValue
 *
 * @example
 * function EntityList() {
 *   const entities = useAtomValue($entities); // Re-renders when list changes
 *   const [get, set] = useAttribute($position); // Stable, no re-renders
 *
 *   return entities.map(id => (
 *     <EntityItem key={id} id={id} />
 *   ));
 * }
 *
 * function EntityItem({ id }) {
 *   const pos = useAttributeValue($position, id); // Re-renders when THIS entity changes
 *   return <div>{pos?.x}, {pos?.y}</div>;
 * }
 */
export function useAttribute<T>(attr: Attribute<T>): UseAttributeResult<T> {
  const { scope: s } = useStoreInternal();

  // Stable getter - reads directly from store (always fresh value)
  const get = useCallback((entity: Entity): T | undefined => {
    const map = s.get(attr);
    return map?.get(entity);
  }, [attr, s]);

  // Stable setter - mutates WeakMap and notifies
  const set = useCallback((entity: Entity, value: T): void => {
    const map = s.get(attr)!;
    map.set(entity, value);
    s.notify(attr);
  }, [attr, s]);

  // Stable remover
  const remove = useCallback((entity: Entity): void => {
    const map = s.get(attr)!;
    map.delete(entity);
    s.notify(attr);
  }, [attr, s]);

  return [get, set, remove];
}

/**
 * React hook to read a single entity's attribute value
 * Only re-renders when the specific entity's value changes
 *
 * @example
 * const playerPos = useAttributeValue($position, 'player');
 * // Only re-renders when player's position changes, not other entities
 *
 * const enemyHealth = useAttributeValue($health, 'enemy1');
 */
export function useAttributeValue<T>(
  attr: Attribute<T>,
  entity: Entity
): T | undefined {
  const { store, scope: s } = useStoreInternal();
  const [value, setValue] = useState<T | undefined>(() => {
    const map = s.get(attr);
    return map?.get(entity);
  });

  useEffect(() => {
    // Get initial value
    const map = s.get(attr);
    setValue(map?.get(entity));

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

    return dispose;
  }, [attr, entity, store]);

  return value;
}

/**
 * React hook to get only the setter for an attribute (no re-renders)
 * Useful when you only need to update values without reading them
 *
 * @example
 * const [setPosition, removePosition] = useSetAttribute($position);
 * setPosition('player', { x: 10, y: 20 });
 * removePosition('enemy1');
 */
export function useSetAttribute<T>(
  attr: Attribute<T>
): [(entity: Entity, value: T) => void, (entity: Entity) => void] {
  const { scope: s } = useStoreInternal();

  const set = useCallback((entity: Entity, value: T): void => {
    const map = s.get(attr)!;
    map.set(entity, value);
    s.notify(attr);
  }, [attr, s]);

  const remove = useCallback((entity: Entity): void => {
    const map = s.get(attr)!;
    map.delete(entity);
    s.notify(attr);
  }, [attr, s]);

  return [set, remove];
}
