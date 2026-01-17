/**
 * Kho - Data-driven state management library
 *
 * Public API exports
 */

// Types
export type { Atom, Store, System } from './core/types';
export type {
  AttributeAtom,
  Aspect,
  EntityId,
  AttributeValue,
  TypedAttributeAtom,
  TypedAttributeData,
  TypedAspect,
  TypedArray,
  TypedArrayConstructor,
} from './core/attribute';

// Infer Scope type from scope function return
import { scope } from './core/scope';
export type Scope = ReturnType<typeof scope>;

export { atom } from './core/atom';
export { createStore } from './core/store';
export { scope } from './core/scope';
export { attribute, aspect, typedAttribute, typedAspect } from './core/attribute';
export { assembler } from './core/assembler';
