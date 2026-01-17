/**
 * Atom implementation
 */

import type { Atom } from './types';

/**
 * Create an atom with initial value
 *
 * @example
 * const $count = atom(0);
 * const $name = atom('Alice');
 */
export function atom<T>(initialValue: T): Atom<T> {
  return {
    _initialValue: initialValue,
  };
}
