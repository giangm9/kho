/**
 * Kho - Data-driven state management library
 *
 * Public API exports
 */

// Types
export type { Atom, Store, System, Scope } from './core/types';

export { atom } from './core/atom';
export { createStore } from './core/store';
export { scope } from './core/scope';
export { attribute, aspect, world } from './core/ecs';
export type { Entity, World, Attribute } from './core/ecs';
export { assembler } from './core/assembler';
