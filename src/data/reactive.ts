/**
 * Reactive - Data access layer for atoms
 *
 * Provides operations for reading and writing atom values.
 * For reactive effects, use the `effects` module.
 *
 * @example
 * const { atoms, sets, maps } = reactive(store);
 *
 * // Atom operations
 * atoms.set($count, 5);
 * atoms.get($count);
 *
 * // Set operations
 * sets.add($users, user);
 * sets.remove($users, user);
 *
 * // Map operations
 * maps.set($cache, 'key', value);
 * maps.get($cache, 'key');
 */

import { Atom, Store, Reactive, ReactiveAtom, ReactiveSet, ReactiveMap } from "../types"

export function reactive(store: Store): Reactive {
  // ============================================
  // Core atom operations
  // ============================================

  const get = <T>(atom: Atom<T>): T | undefined => {
    let entry = atom.instances.get(store);
    if (!entry) {
      entry = {
        value: atom.initialFactory(),
        listeners: new Set<() => void>(),
      };
      atom.instances.set(store, entry);
    }
    return entry.value;
  };

  const set = <T>(atom: Atom<T>, value: T): void => {
    let entry = atom.instances.get(store);
    if (!entry) {
      entry = {
        value,
        listeners: new Set<() => void>(),
      };
      atom.instances.set(store, entry);
    } else {
      entry.value = value;
      notify(atom);
    }
  };

  const notify = (atom: Atom<any>): void => {
    const entry = atom.instances.get(store);
    if (entry) {
      entry.listeners.forEach((listener) => listener());
    }
  };

  // ============================================
  // ReactiveAtom namespace
  // ============================================

  const atomOps: ReactiveAtom = {
    get,
    set,
    notify,
  };

  // ============================================
  // ReactiveSet namespace
  // ============================================

  const setOps: ReactiveSet = {
    add<T>(atom: Atom<Set<T>>, item: T): void {
      const current = get(atom) ?? new Set<T>();
      const newSet = new Set(current);
      newSet.add(item);
      set(atom, newSet);
    },
    remove<T>(atom: Atom<Set<T>>, item: T): void {
      const current = get(atom);
      if (!current) return;
      const newSet = new Set(current);
      newSet.delete(item);
      set(atom, newSet);
    },
    has<T>(atom: Atom<Set<T>>, item: T): boolean {
      const current = get(atom);
      return current?.has(item) ?? false;
    },
    clear<T>(atom: Atom<Set<T>>): void {
      set(atom, new Set<T>());
    },
    size<T>(atom: Atom<Set<T>>): number {
      return get(atom)?.size ?? 0;
    },
    values<T>(atom: Atom<Set<T>>): T[] {
      const current = get(atom);
      return current ? Array.from(current) : [];
    },
  };

  // ============================================
  // ReactiveMap namespace
  // ============================================

  const mapOps: ReactiveMap = {
    set<K, V>(atom: Atom<Map<K, V>>, key: K, value: V): void {
      const current = get(atom) ?? new Map<K, V>();
      const newMap = new Map(current);
      newMap.set(key, value);
      set(atom, newMap);
    },
    get<K, V>(atom: Atom<Map<K, V>>, key: K): V | undefined {
      return get(atom)?.get(key);
    },
    delete<K, V>(atom: Atom<Map<K, V>>, key: K): void {
      const current = get(atom);
      if (!current) return;
      const newMap = new Map(current);
      newMap.delete(key);
      set(atom, newMap);
    },
    has<K, V>(atom: Atom<Map<K, V>>, key: K): boolean {
      return get(atom)?.has(key) ?? false;
    },
    clear<K, V>(atom: Atom<Map<K, V>>): void {
      set(atom, new Map<K, V>());
    },
    size<K, V>(atom: Atom<Map<K, V>>): number {
      return get(atom)?.size ?? 0;
    },
    entries<K, V>(atom: Atom<Map<K, V>>): [K, V][] {
      const current = get(atom);
      return current ? Array.from(current.entries()) : [];
    },
    keys<K, V>(atom: Atom<Map<K, V>>): K[] {
      const current = get(atom);
      return current ? Array.from(current.keys()) : [];
    },
    values<K, V>(atom: Atom<Map<K, V>>): V[] {
      const current = get(atom);
      return current ? Array.from(current.values()) : [];
    },
  };

  // ============================================
  // Dispose
  // ============================================

  const dispose = () => {
    // Reactive data layer doesn't have cleanups
    // Effects layer handles cleanup
  };

  return {
    atoms: atomOps,
    sets: setOps,
    maps: mapOps,
    dispose,
  };
}
