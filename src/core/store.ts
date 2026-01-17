/**
 * Store - State Container
 *
 * Uses WeakMap-in-Atom pattern for optimal performance with effect chains.
 * Each store is isolated - multiple stores can use the same atoms without
 * sharing state.
 *
 * Data is stored in atom._s (WeakMap keyed by store reference).
 * When store is dereferenced, GC automatically cleans up the data.
 */

import type { Atom, AtomStoreData, Store } from './types';

/**
 * Create a store
 *
 * Each store is isolated - you can create multiple stores that use the same
 * atoms without sharing state. Data is automatically cleaned up when the
 * store is garbage collected.
 *
 * @example
 * const store = createStore();
 * store.set($count, 5);
 * console.log(store.get($count)); // 5
 *
 * @example
 * // Multiple isolated stores
 * const store1 = createStore();
 * const store2 = createStore();
 * store1.set($count, 10);
 * store2.set($count, 20);
 * console.log(store1.get($count)); // 10
 * console.log(store2.get($count)); // 20
 */
export function createStore(): Store {
  // Store reference - used as WeakMap key in atoms
  // When this object is GC'd, all atom._s entries for this store are auto-cleaned
  const storeRef = {};

  // Batching state
  let isBatching = false;
  const pendingAtoms = new Map<Atom<any>, any>();

  // Get or create per-store data for an atom
  function getStoreData<T>(atom: Atom<T>): AtomStoreData<T> {
    if (!atom._s) {
      atom._s = new WeakMap();
    }

    let data = atom._s.get(storeRef) as AtomStoreData<T> | undefined;
    if (!data) {
      // First access - create initial value
      const initialValue = atom._initialFactory ? atom._initialFactory() : atom._initialValue;
      data = { v: initialValue, l: [] };
      atom._s.set(storeRef, data);
    }
    return data;
  }

  function get<T>(atom: Atom<T>): T {
    const data = getStoreData(atom);
    return data.v !== undefined ? data.v : atom._initialValue;
  }

  function set<T>(atom: Atom<T>, value: T): void {
    const data = getStoreData(atom);
    data.v = value;

    if (isBatching) {
      pendingAtoms.set(atom, value);
      return;
    }

    // Notify listeners
    const listeners = data.l;
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](value);
    }
  }

  function subscribe<T>(atom: Atom<T>, listener: (value: T) => void): () => void {
    const data = getStoreData(atom);
    data.l.push(listener);

    return () => {
      const pos = data.l.indexOf(listener);
      if (pos !== -1) {
        data.l.splice(pos, 1);
      }
    };
  }

  function _flushPendingNotifications(): void {
    for (const [atom] of pendingAtoms) {
      const data = atom._s?.get(storeRef) as AtomStoreData<any> | undefined;
      if (data) {
        const value = data.v;
        const listeners = data.l;
        for (let i = 0; i < listeners.length; i++) {
          listeners[i](value);
        }
      }
    }
    pendingAtoms.clear();
  }

  function _clearPending(): void {
    pendingAtoms.clear();
  }

  function _notify<T>(atom: Atom<T>): void {
    const data = getStoreData(atom);
    const value = data.v !== undefined ? data.v : atom._initialValue;

    if (isBatching) {
      pendingAtoms.set(atom, value);
      return;
    }

    const listeners = data.l;
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](value);
    }
  }

  return {
    get,
    set,
    subscribe,
    get _isBatching() { return isBatching; },
    set _isBatching(v: boolean) { isBatching = v; },
    _clearPending,
    _flushPendingNotifications,
    _notify,
  };
}
