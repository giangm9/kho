import { Atom, Store } from '../types'

type InstanceEntry<T> = {
  value: T;
  listeners: Set<() => void>;
}

export function atomWithFactory<T>(initialFactory: () => T): Atom<T> {
  const instances = new WeakMap<Store, InstanceEntry<T>>();

  return {
    initialFactory,
    instances,
  };
}

export function atom<T>(initialValue: T) {
  return atomWithFactory(() => initialValue);
}

