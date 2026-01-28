import { Store } from "../types";

export function createStore(name?: string): Store {
  return {
    name: name ?? 'StoreInstance',
  };
}
