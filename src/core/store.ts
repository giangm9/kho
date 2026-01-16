/**
 * Store - State Container
 *
 * Functional implementation for managing atom values
 */

import type { Atom, Store } from './types';

/**
 * Create a store for managing atom values
 *
 * @example
 * const store = createStore();
 * store.set($count, 5);
 * console.log(store.get($count)); // 5
 */
export function createStore(): Store {
  const values = new Map<number, any>();
  const listeners = new Map<number, Set<(value: any) => void>>();

  // Batching state (controlled by scope)
  let isBatching = false;
  const pendingNotifications = new Map<number, any>();

  function get<T>(atom: Atom<T>): T {
    if (values.has(atom._id)) {
      return values.get(atom._id);
    }
    return atom._initialValue;
  }

  function set<T>(atom: Atom<T>, value: T): void {
    values.set(atom._id, value);

    if (isBatching) {
      pendingNotifications.set(atom._id, value);
      return;
    }

    _notifyListeners(atom._id, value);
  }

  function subscribe<T>(atom: Atom<T>, listener: (value: T) => void): () => void {
    if (!listeners.has(atom._id)) {
      listeners.set(atom._id, new Set());
    }

    const atomListeners = listeners.get(atom._id)!;
    atomListeners.add(listener);

    return () => {
      atomListeners.delete(listener);
      if (atomListeners.size === 0) {
        listeners.delete(atom._id);
      }
    };
  }

  function _notifyListeners(atomId: number, value: any): void {
    const atomListeners = listeners.get(atomId);
    if (atomListeners) {
      atomListeners.forEach(listener => listener(value));
    }
  }

  function _flushPendingNotifications(): void {
    pendingNotifications.forEach((value, atomId) => {
      _notifyListeners(atomId, value);
    });
    pendingNotifications.clear();
  }

  return {
    get,
    set,
    subscribe,
    get _isBatching() { return isBatching; },
    set _isBatching(v: boolean) { isBatching = v; },
    _pendingNotifications: pendingNotifications,
    _notifyListeners,
    _flushPendingNotifications,
  };
}
