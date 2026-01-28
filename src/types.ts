export type Atom<T> = {
  initialFactory: () => T;
  instances: WeakMap<any, { value: T; listeners: Set<() => void> }>;
}

export type Store = {
  name: string;
}

// ============================================
// Reactive - Data Layer
// ============================================

/**
 * ReactiveAtom - Operations for basic atoms
 */
export type ReactiveAtom = {
  get<T>(atom: Atom<T>): T | undefined;
  set<T>(atom: Atom<T>, value: T): void;
  notify(atom: Atom<any>): void;
};

/**
 * ReactiveSet - Operations for Set atoms
 */
export type ReactiveSet = {
  add<T>(atom: Atom<Set<T>>, item: T): void;
  remove<T>(atom: Atom<Set<T>>, item: T): void;
  has<T>(atom: Atom<Set<T>>, item: T): boolean;
  clear<T>(atom: Atom<Set<T>>): void;
  size<T>(atom: Atom<Set<T>>): number;
  values<T>(atom: Atom<Set<T>>): T[];
};

/**
 * ReactiveMap - Operations for Map atoms
 */
export type ReactiveMap = {
  set<K, V>(atom: Atom<Map<K, V>>, key: K, value: V): void;
  get<K, V>(atom: Atom<Map<K, V>>, key: K): V | undefined;
  delete<K, V>(atom: Atom<Map<K, V>>, key: K): void;
  has<K, V>(atom: Atom<Map<K, V>>, key: K): boolean;
  clear<K, V>(atom: Atom<Map<K, V>>): void;
  size<K, V>(atom: Atom<Map<K, V>>): number;
  entries<K, V>(atom: Atom<Map<K, V>>): [K, V][];
  keys<K, V>(atom: Atom<Map<K, V>>): K[];
  values<K, V>(atom: Atom<Map<K, V>>): V[];
};

/**
 * Reactive - Data access layer for atoms
 */
export type Reactive = {
  /** Atom operations (plural for cleaner destructuring) */
  atoms: ReactiveAtom;
  /** Set atom operations */
  sets: ReactiveSet;
  /** Map atom operations */
  maps: ReactiveMap;
  /** Dispose all subscriptions */
  dispose(): void;
}

// ============================================
// Effects - System Reaction Layer
// ============================================

/**
 * Effects - Reactive effect system for responding to data changes
 */
export type Effects = {
  /** Create reactive effect */
  effect(atoms: Atom<any>[], callback: () => void | (() => void)): () => void;
  /** Create computed atom */
  compute<T>(sources: Atom<any>[], target: Atom<T>, fn: (...values: any[]) => T): () => void;
  /** Create debounced effect */
  debounce(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  /** Create throttled effect */
  throttle(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  /** Create auto-cleanup interval */
  interval(ms: number, callback: () => void): () => void;
  /** Create auto-cleanup timeout */
  timeout(ms: number, callback: () => void): () => void;
  /** Register cleanup callback */
  onDispose(callback: () => void): void;
  /** Batch multiple updates */
  batch(callback: () => void): void;
  /** Flush pending batch */
  emit(): void;
  /** Dispose all effects */
  dispose(): void;
}

// ============================================
// System
// ============================================

export type System = (store: Store) => () => void;

// ============================================
// Signal
// ============================================

export type Signal<T> = {
  readonly _brand: 'signal';
  readonly handlers: WeakMap<Store, Set<(value: T) => void>>;
};

export type Listener = {
  on<T>(signal: Signal<T>, handler: (value: T) => void): () => void;
  emit<T>(signal: Signal<T>, value: T): void;
  dispose(): void;
};
