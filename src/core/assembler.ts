/**
 * Assembler - System Orchestrator
 *
 * Initializes systems with a store and returns dispose function
 */

import type { Store, System } from './types';

/**
 * Assemble multiple systems with a shared store
 *
 * @example
 * const store = createStore();
 * const dispose = assembler([
 *   createGameSystem,
 *   createPhysicsSystem,
 * ], store);
 *
 * // Later, cleanup all systems
 * dispose();
 */
export function assembler(systems: System[], store: Store): () => void {
  const disposers = systems.map(system => system(store).dispose);

  return () => {
    // Dispose in reverse order
    disposers.reverse().forEach(dispose => dispose());
  };
}
