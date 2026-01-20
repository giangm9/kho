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
  debounce(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  throttle(atoms: Atom<any>[], ms: number, callback: () => void | (() => void)): () => void;
  interval(ms: number, callback: () => void): () => void;
  timeout(ms: number, callback: () => void): () => void;
  onDispose(callback: () => void): void;
  batch(callback: () => void): void;
  emit(): void;
  dispose(): void;
}

export type System = (scope: Scope) => () => void;

