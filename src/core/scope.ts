/**
 * Scope - Reactive Effects Manager
 *
 * Functional implementation without class/interface boilerplate
 */

import type { Atom, Store } from './types';

/**
 * Create a scope for managing reactive effects
 *
 * @example
 * const s = scope(store);
 *
 * // Reactive effect
 * s.effect([$count], (count) => {
 *   console.log('Count changed:', count);
 * });
 *
 * // Batched updates
 * s.batch(() => {
 *   store.set($count, 10);
 *   store.set($name, 'Alice');
 * });
 *
 * // Cleanup when done
 * s.dispose();
 */
export function scope(store: Store) {
  const unsubscribers: Array<() => void> = [];
  const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();
  let debounceIdCounter = 0;

  /**
   * Create reactive effect that runs when dependencies change
   */
  function effect(
    deps: Atom<any>[],
    callback: (...values: any[]) => (() => void) | void
  ): void {
    let cleanup: (() => void) | void;

    const runEffect = () => {
      if (cleanup) cleanup();
      const values = deps.map((atom) => store.get(atom));
      cleanup = callback(...values);
    };

    deps.forEach((atom) => {
      const unsubscribe = store.subscribe(atom, runEffect);
      unsubscribers.push(unsubscribe);
    });

    runEffect();
  }

  /**
   * Create debounced effect that runs after delay
   */
  function debounce(
    deps: Atom<any>[],
    callback: (...values: any[]) => any,
    delay: number
  ): void {
    const timerId = debounceIdCounter++;

    const runDebounced = () => {
      const existingTimer = debounceTimers.get(timerId);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        const values = deps.map((atom) => store.get(atom));
        callback(...values);
      }, delay);

      debounceTimers.set(timerId, timer);
    };

    deps.forEach((atom) => {
      const unsubscribe = store.subscribe(atom, runDebounced);
      unsubscribers.push(unsubscribe);
    });

    runDebounced();
  }

  /**
   * Batch multiple updates - effects triggered once at end
   */
  function batch(fn: () => void): void {
    if (store._isBatching) {
      fn();
      return;
    }

    store._isBatching = true;
    store._clearPending();

    try {
      fn();
    } finally {
      store._isBatching = false;
      store._flushPendingNotifications();
    }
  }

  /**
   * Cleanup all effects and subscriptions
   */
  function dispose(): void {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers.length = 0;

    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();
  }

  return { effect, debounce, batch, dispose };
}
