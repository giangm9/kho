/**
 * Assembler - System Orchestrator
 *
 * Initializes systems with a scope and returns dispose function
 */

import type { Scope, System } from './types';

/**
 * Assemble multiple systems with a shared scope
 *
 * @example
 * const store = createStore();
 * const s = scope(store);
 * const dispose = assembler([
 *   createGameSystem,
 *   createPhysicsSystem,
 * ], s);
 *
 * // Later, cleanup all systems
 * dispose();
 */
export function assembler(systems: System[], s: Scope): () => void {
  const disposers = systems.map(system => system(s));

  return () => {
    // Dispose in reverse order
    disposers.reverse().forEach(dispose => dispose());
  };
}
