# Kho

> Data-driven state management library with reactive effects

[![npm version](https://img.shields.io/npm/v/kho.svg)](https://www.npmjs.com/package/kho)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is Kho?

Kho is a state management library built on data-driven architecture principles:

- **Data-Driven**: Logic reacts to state changes instead of imperative commands
- **Reactive Effects**: Automatic updates when dependencies change
- **Type-Safe**: Full TypeScript support with strict type checking
- **Minimal**: Small bundle size with zero dependencies

## Installation

```bash
npm install kho
```

## Quick Example

### Vanilla JavaScript/TypeScript

```typescript
import { atom, createStore, scope } from 'kho';

// Create atoms ($ prefix convention)
const $count = atom(0);
const $doubled = atom(0);

// Create store
const store = createStore();

// Create reactive effects
const { effect, dispose } = scope(store);

effect([$count], () => {
  const count = store.get($count)!;
  store.set($doubled, count * 2);
});

// Update state
store.set($count, 5);
// $doubled automatically becomes 10

// Cleanup when done
dispose();
```

### React

```tsx
import { atom, createStore } from 'kho';
import { KhoProvider, useAtom } from 'kho/react';

const $count = atom(0);
const store = createStore();

function Counter() {
  const [count, setCount] = useAtom($count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

function App() {
  return (
    <KhoProvider store={store}>
      <Counter />
    </KhoProvider>
  );
}
```

## Core API

### Types

```typescript
// Atom - smallest unit of state
type Atom<T> = {
  initialFactory: () => T;
  instances: WeakMap<Store, { value: T; listeners: Set<() => void> }>;
}

// Store - central state container
type Store = {
  name: string;
  pendingBatch: Set<() => void> | null;
  get<T>(atom: Atom<T>): T | undefined;
  set<T>(atom: Atom<T>, value: T): void;
  notify(atom: Atom<any>): void;
}

// System - organized business logic
type System = (store: Store) => () => void;
```

### atom.ts

```typescript
// Create atom with initial value
atom<T>(initialValue: T): Atom<T>

// Create atom with factory function (lazy initialization)
atomWithFactory<T>(factory: () => T): Atom<T>
```

### store.ts

```typescript
// Create a new store
createStore(name?: string): Store

// Store methods:
store.get(atom)     // Get current value (or undefined)
store.set(atom, value)  // Set value and notify listeners
store.notify(atom)  // Trigger listeners (respects pendingBatch)
store.pendingBatch  // null (immediate) or Set (batching mode)
```

### scope.ts

```typescript
const {
  effect,     // (atoms[], callback) - reactive effect
  debounce,   // (atoms[], ms, callback) - debounced effect
  throttle,   // (atoms[], ms, callback) - throttled effect
  interval,   // (ms, callback) - auto-cleanup interval
  timeout,    // (ms, callback) - auto-cleanup timeout
  onDispose,  // (callback) - register cleanup
  batch,      // (callback) - batch updates
  emit,       // () - flush pending batch
  dispose,    // () - cleanup all
} = scope(store);
```

### ecs.ts (Entity-Component-System)

```typescript
// Types
type Entity = { id: number }
type World = Atom<Map<number, Entity>>
type Attribute<V> = Atom<WeakMap<Entity, V>>

// Create world (entity registry)
world(): World

// Create attribute (per-entity data)
attribute<V>(): Attribute<V>

// Create aspect (view into entity attributes)
aspect(store, world, id): {
  get<V>(attr): V | undefined,
  set<V>(attr, value): void,
  apply<V>(commands: [Attribute<V>, V][]): void
}
```

### assembler.ts

```typescript
// Combine multiple systems with shared store
assembler(systems: System[], store: Store): () => void
```

## System Pattern

Systems are self-contained, testable units following data-driven principles:

```typescript
import { atom, createStore, scope } from 'kho';
import type { Store } from 'kho';

// Define atoms with $ prefix
export const $count = atom(0);
export const $doubled = atom(0);

// System function returns dispose
export function counterSystem(store: Store) {
  const { effect, dispose } = scope(store);

  // All logic in effects - no public methods
  effect([$count], () => {
    const count = store.get($count)!;
    store.set($doubled, count * 2);
  });

  return dispose;
}

// Usage
const store = createStore();
const dispose = counterSystem(store);

store.set($count, 5);
console.log(store.get($doubled)); // 10

dispose(); // Cleanup
```

## ECS Example

```typescript
import { world, attribute, aspect, createStore, scope } from 'kho';
import type { Store } from 'kho';

// Create world and attributes
const $world = world();
const $position = attribute<{ x: number; y: number }>();
const $velocity = attribute<{ vx: number; vy: number }>();

function gameSystem(store: Store) {
  const { effect, interval, dispose } = scope(store);

  // Initialize world with entities
  const worldMap = store.get($world)!;
  worldMap.set(1, { id: 1 });
  worldMap.set(2, { id: 2 });
  store.notify($world);

  // Set initial positions
  const player = aspect(store, $world, 1);
  player.set($position, { x: 0, y: 0 });
  player.set($velocity, { vx: 1, vy: 0 });

  // Game loop - update positions
  interval(16, () => {
    for (const [id] of store.get($world)!) {
      const asp = aspect(store, $world, id);
      const pos = asp.get($position);
      const vel = asp.get($velocity);
      if (pos && vel) {
        asp.set($position, {
          x: pos.x + vel.vx,
          y: pos.y + vel.vy,
        });
      }
    }
  });

  return dispose;
}
```

## Batching Updates

Use `batch()` to group multiple updates into a single notification cycle:

```typescript
const { batch, effect, dispose } = scope(store);

effect([$a, $b, $c], () => {
  console.log('Effect triggered');
});

// Without batch: 3 effect triggers
store.set($a, 1);
store.set($b, 2);
store.set($c, 3);

// With batch: 1 effect trigger
batch(() => {
  store.set($a, 1);
  store.set($b, 2);
  store.set($c, 3);
});
```

## Assembling Multiple Systems

```typescript
import { createStore, assembler } from 'kho';

const store = createStore('app');

const dispose = assembler([
  inputSystem,
  physicsSystem,
  renderSystem,
], store);

// Later, cleanup all systems (in reverse order)
dispose();
```

## License

MIT
