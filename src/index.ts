/**
 * Kho - Data-driven state management library
 *
 * Public API exports
 */

// Core types
export type {
  Atom,
  Store,
  System,
  Reactive,
  ReactiveAtom,
  ReactiveSet,
  ReactiveMap,
  Effects,
} from './types';

// Data layer
export { atom, atomWithFactory } from './data/atom';
export { createStore } from './data/store';
export { reactive } from './data/reactive';
export { signal, listen } from './data/signal';
export type { Signal, Listener } from './data/signal';

// System layer
export { effects } from './system/effects';
export { system } from './system/system';
export { ignite, $systems, $state } from './system/assembler';

// Attribute system (generic object attributes)
export { registry, attribute, attributeWithFactory, attributes } from './data/attribute';
export type { Attribute, Attributes } from './data/attribute';

// ECS (Entity Component System)
export { entities, component, componentWithFactory, query } from './data/entity';
export type { EntityId, Entity, Component, World } from './data/entity';
