/**
 * Core type definitions for Kho
 */

export type Atom<T> = {
  _id: number;
  _type: 'atom';
  _initialValue: T;
};

export type Store = {
  get<T>(atom: Atom<T>): T;
  set<T>(atom: Atom<T>, value: T): void;
  subscribe<T>(atom: Atom<T>, listener: (value: T) => void): () => void;
  // Internal - used by scope for batching
  _isBatching: boolean;
  _pendingNotifications: Map<number, any>;
  _notifyListeners(atomId: number, value: any): void;
  _flushPendingNotifications(): void;
};

export type System = (store: Store) => {
  dispose: () => void;
};
