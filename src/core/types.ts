export type Atom<T> = {
  initialFactory: () => T;
  instances: WeakMap<any, { value: T; listeners: Set<() => void> }>;
}

export type Store = {
  name: string;
}

export type Scope = {
  get<T>(atom: Atom<T>): T | undefined;
  set<T>(atom: Atom<T>, value: T): void;
  notify(atom: Atom<any>): void;
  effect(atoms: Atom<any>[], callback: () => void | (() => void)): () => void;
  compute<T>(sources: Atom<any>[], target: Atom<T>, fn: (...values: any[]) => T): () => void;
  debounce(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  throttle(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  interval(ms: number, callback: () => void): () => void;
  timeout(ms: number, callback: () => void): () => void;
  onDispose(callback: () => void): void;
  batch(callback: () => void): void;
  emit(): void;
  dispose(): void;
}

export type System = (store: Store) => () => void;

export type Signal<T> = {
  readonly _brand: 'signal';
  readonly handlers: WeakMap<Store, Set<(value: T) => void>>;
};

export type Listener = {
  on<T>(signal: Signal<T>, handler: (value: T) => void): () => void;
  emit<T>(signal: Signal<T>, value: T): void;
  dispose(): void;
};
