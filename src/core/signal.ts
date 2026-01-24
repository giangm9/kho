/**
 * Signal - Event-based communication for Kho
 *
 * Signals replace traditional function calls for inter-system communication.
 * Instead of calling methods directly, systems emit signals and other systems
 * listen and react - achieving loose coupling and better testability.
 *
 * Traditional (tight coupling):
 *   playerSystem.takeDamage(10);
 *   inventorySystem.addItem(item);
 *
 * Signal-based (loose coupling):
 *   emit($damage, { target: playerId, amount: 10 });
 *   emit($itemPickup, { item });
 */

import type { Store } from './types';

/**
 * Signal type - fire-and-forget event emitter
 * Unlike Atom, Signal does not store value - it only dispatches to handlers
 */
export type Signal<T = void> = {
  readonly _brand: 'signal';
  readonly handlers: WeakMap<Store, Set<(value?: T) => void>>;
};

/**
 * Listener type - returned by listen()
 */
export type Listener = {
  on<T = void>(signal: Signal<T>, handler: (value?: T) => void): () => void;
  emit<T = void>(signal: Signal<T>, value?: T): void;
  dispose(): void;
};

/**
 * Create a new signal
 *
 * @example
 * const $playerDied = signal<{ playerId: number }>();
 * const $itemPickup = signal<{ itemId: number; quantity: number }>();
 */
export function signal<T>(): Signal<T> {
  return {
    _brand: 'signal',
    handlers: new WeakMap(),
  };
}

/**
 * Create a listener bound to a store
 *
 * Listener provides:
 * - on(signal, handler): Subscribe to a signal
 * - emit(signal, value): Dispatch a signal to all handlers
 * - dispose(): Cleanup all subscriptions
 *
 * @example
 * function gameSystem(store: Store) {
 *   const { effect, get, set, dispose: disposeScope } = scope(store);
 *   const { on, emit, dispose: disposeListener } = listen(store);
 *
 *   // Listen to signals from other systems
 *   on($playerDied, ({ playerId }) => {
 *     set($gameOver, true);
 *   });
 *
 *   // Emit signals for other systems to handle
 *   effect([$health], () => {
 *     if (get($health)! <= 0) {
 *       emit($playerDied, { playerId: get($playerId)! });
 *     }
 *   });
 *
 *   return () => {
 *     disposeScope();
 *     disposeListener();
 *   };
 * }
 */
export function listen(store: Store): Listener {
  const disposables: Array<() => void> = [];

  function on<T = void>(signal: Signal<T>, handler: (value?: T) => void): () => void {
    let handlers = signal.handlers.get(store);
    if (!handlers) {
      handlers = new Set();
      (signal.handlers as WeakMap<Store, Set<(value?: T) => void>>).set(store, handlers);
    }
    handlers.add(handler);

    const unsubscribe = () => {
      handlers!.delete(handler);
    };
    disposables.push(unsubscribe);

    return unsubscribe;
  }

  function emit<T = void>(signal: Signal<T>, value?: T): void {
    const handlers = signal.handlers.get(store);
    if (handlers) {
      handlers.forEach((handler) => handler(value));
    }
  }

  function dispose(): void {
    disposables.forEach((fn) => fn());
    disposables.length = 0;
  }

  return { on, emit, dispose };
}
