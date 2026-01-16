/**
 * Atom implementation
 */

import type { Atom } from './types';

let atomIdCounter = 0;

/**
 * Create an atom with initial value
 *
 * @example
 * const $count = atom(0);
 * const $name = atom('Alice');
 */
export function atom<T>(initialValue: T): Atom<T> {
  return {
    _id: atomIdCounter++,
    _type: 'atom',
    _initialValue: initialValue,
  };
}
