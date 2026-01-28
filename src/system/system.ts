/**
 * System - Helper for creating systems with automatic dispose management
 *
 * The `system()` function eliminates the need to manually track and dispose
 * of APIs like reactive() and listen(). Users cannot forget to dispose
 * because the framework handles it automatically.
 *
 * @example
 * const gameSystem = system((scope) => {
 *   const { effect, get, set } = scope(reactive);
 *   const { on, emit } = scope(listen);
 *   const { entity, add } = scope(world($players));
 *
 *   effect([$position], () => {
 *     const pos = get($position)!;
 *     // ...
 *   });
 *
 *   on($collision, (data) => {
 *     emit($damage, { target: data.entityA, amount: 10 });
 *   });
 *
 *   // Optional: return custom cleanup
 *   return () => {
 *     console.log('Custom cleanup');
 *   };
 * });
 */

import type { Store } from '../types';

type Disposable = { dispose: () => void };
type ApiFactory<T extends Disposable> = (store: Store) => T;
type Scope = <T extends Disposable>(factory: ApiFactory<T>) => T;
type SystemSetup = (scope: Scope) => void | (() => void);

/**
 * Create a system with automatic dispose management
 *
 * @param setup - Setup function that receives scope helper
 *                Can optionally return a custom dispose function
 * @returns A System function compatible with composer
 *
 * @example
 * const counterSystem = system((scope) => {
 *   const { effect, get, set } = scope(reactive);
 *
 *   effect([$count], () => {
 *     console.log('Count:', get($count));
 *   });
 *
 *   // Optional custom cleanup
 *   return () => {
 *     console.log('System disposed');
 *   };
 * });
 */
export function system(setup: SystemSetup): (store: Store) => () => void {
  return (store: Store) => {
    const disposables: (() => void)[] = [];

    const scope: Scope = <T extends Disposable>(factory: ApiFactory<T>): T => {
      const api = factory(store);
      disposables.push(api.dispose);
      return api;
    };

    const customDispose = setup(scope);

    return () => {
      // Run custom dispose first
      if (customDispose) {
        customDispose();
      }
      // Then dispose scoped APIs in reverse order (LIFO)
      for (let i = disposables.length - 1; i >= 0; i--) {
        disposables[i]();
      }
    };
  };
}
