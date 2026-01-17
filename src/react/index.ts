import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import type { Atom, Store, System } from '../core/types';
import type { AttributeAtom, EntityId } from '../core/attribute';
import { createStore } from '../core/store';
import { scope } from '../core/scope';
import { assembler } from '../core/assembler';

type Scope = ReturnType<typeof scope>;

// ============================================
// Store Context (Provider Pattern)
// ============================================

const StoreContext = createContext<Store | null>(null);

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
  useEffect(() => {
    if (!systems || systems.length === 0) return;

    const dispose = assembler(systems, store);

    return dispose;
  }, [store, systems]);

  return React.createElement(StoreContext.Provider, { value: store }, children);
}

// ============================================
// Global Store (Fallback for non-Provider usage)
// ============================================

let globalStore: Store | null = null;

export function setGlobalStore(store: Store) {
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
  const contextStore = useContext(StoreContext);
  if (contextStore) {
    return contextStore;
  }
  // Fallback to global store for backwards compatibility
  return getGlobalStore();
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
  const store = useStoreInternal();
  const [value, setValue] = useState<T>(() => store.get(atom));

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(store.get(atom));

    // Subscribe to atom changes
    const unsubscribe = store.subscribe(atom, (newValue) => {
      setValue(newValue);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [atom, store]);

  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = store.get(atom);
      store.set(atom, updater(currentValue));
    } else {
      store.set(atom, newValue);
    }
  }, [atom, store]);

  return [value, updateValue];
}

/**
 * React hook to read atom value (read-only)
 *
 * @example
 * const count = useAtomValue($count);
 */
export function useAtomValue<T>(atom: Atom<T>): T {
  const store = useStoreInternal();
  const [value, setValue] = useState<T>(() => store.get(atom));

  useEffect(() => {
    // Sync state if atom value changed externally
    setValue(store.get(atom));

    // Subscribe to atom changes
    const unsubscribe = store.subscribe(atom, (newValue) => {
      setValue(newValue);
    });

    return unsubscribe;
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
  const store = useStoreInternal();

  return useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof newValue === 'function') {
      const updater = newValue as (prev: T) => T;
      const currentValue = store.get(atom);
      store.set(atom, updater(currentValue));
    } else {
      store.set(atom, newValue);
    }
  }, [atom, store]);
}

/**
 * React hook to get the store instance
 * Uses Provider store if available, otherwise falls back to global store
 *
 * @example
 * const store = useStore();
 */
export function useStore(): Store {
  return useStoreInternal();
}

/**
 * React hook to get a scope instance for the current store
 * Creates a scope once and reuses it, disposing on unmount
 *
 * @example
 * const s = useScope();
 * s.batch(() => {
 *   store.set($count, 10);
 *   store.set($name, 'Alice');
 * });
 */
export function useScope(): Scope {
  const store = useStoreInternal();
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
 *   store.set($count, 10);
 *   store.set($name, 'Alice');
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
  (entityId: EntityId) => T | undefined,
  /** Set attribute value for an entity */
  (entityId: EntityId, value: T) => void,
  /** Remove attribute value for an entity */
  (entityId: EntityId) => void
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
export function useAttribute<T>(attr: AttributeAtom<T>): UseAttributeResult<T> {
  const store = useStoreInternal();

  // Stable getter - reads directly from store (always fresh value)
  const get = useCallback((entityId: EntityId): T | undefined => {
    const map = store.get(attr);
    return map.get(entityId);
  }, [attr, store]);

  // Stable setter
  const set = useCallback((entityId: EntityId, value: T): void => {
    const current = store.get(attr);
    const updated = new Map(current);
    updated.set(entityId, value);
    store.set(attr, updated);
  }, [attr, store]);

  // Stable remover
  const remove = useCallback((entityId: EntityId): void => {
    const current = store.get(attr);
    if (!current.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    store.set(attr, updated);
  }, [attr, store]);

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
  attr: AttributeAtom<T>,
  entityId: EntityId
): T | undefined {
  const store = useStoreInternal();
  const [value, setValue] = useState<T | undefined>(() => {
    const map = store.get(attr);
    return map.get(entityId);
  });

  useEffect(() => {
    // Get initial value
    const map = store.get(attr);
    setValue(map.get(entityId));

    // Subscribe to attribute changes, but only update if this entity changed
    const unsubscribe = store.subscribe(attr, (newMap) => {
      const newValue = newMap.get(entityId);
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

    return unsubscribe;
  }, [attr, entityId, store]);

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
  attr: AttributeAtom<T>
): [(entityId: EntityId, value: T) => void, (entityId: EntityId) => void] {
  const store = useStoreInternal();

  const set = useCallback((entityId: EntityId, value: T): void => {
    const current = store.get(attr);
    const updated = new Map(current);
    updated.set(entityId, value);
    store.set(attr, updated);
  }, [attr, store]);

  const remove = useCallback((entityId: EntityId): void => {
    const current = store.get(attr);
    if (!current.has(entityId)) return;
    const updated = new Map(current);
    updated.delete(entityId);
    store.set(attr, updated);
  }, [attr, store]);

  return [set, remove];
}
