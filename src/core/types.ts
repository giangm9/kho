/**
 * Core type definitions for Kho
 */

// Per-store data stored in atom
export type AtomStoreData<T> = {
  v: T | undefined;                // Value
  l: ((value: T) => void)[];       // Listeners
};

export type Atom<T> = {
  _initialValue: T;
  // Factory function to create fresh initial value (for object types that need isolation)
  _initialFactory?: () => T;
  // WeakMap keyed by store reference - auto GC when store is dereferenced
  _s?: WeakMap<object, AtomStoreData<T>>;
};

export type Store = {
  get<T>(atom: Atom<T>): T;
  set<T>(atom: Atom<T>, value: T): void;
  subscribe<T>(atom: Atom<T>, listener: (value: T) => void): () => void;
  // Internal - used by scope for batching
  _isBatching: boolean;
  _clearPending(): void;
  _flushPendingNotifications(): void;
  // Notify listeners without changing value (for mutable updates)
  _notify<T>(atom: Atom<T>): void;
};

export type System = (store: Store) => {
  dispose: () => void;
};
