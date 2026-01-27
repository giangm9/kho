/**
 * Kho - Data-driven state management library
 *
 * Public API exports
 */

// Types
export type { Atom, Store, System, Scope, Signal, Listener } from './core/types';

export { atom, atomWithFactory } from './core/atom';
export { createStore } from './core/store';
export { scope } from './core/scope';
export { attribute, attributeWithFactory, entities, world } from './core/entity';
export type { EntityId, Entity, Attribute, AttributeAtom, World } from './core/entity';
export { composer, $systems } from './core/composer';
export type { SystemEntry } from './core/composer';
export { signal, listen } from './core/signal';
