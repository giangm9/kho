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
const { effect, get, set, dispose } = scope(store);

effect([$count], () => {
  const count = get($count)!;
  set($doubled, count * 2);
});

// Update state
set($count, 5);
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
```

### scope.ts

```typescript
const {
  get,        // (atom) - get current value (or undefined)
  set,        // (atom, value) - set value and notify listeners
  notify,     // (atom) - trigger listeners manually
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

### entity.ts (Entity-Component-System)

```typescript
// Types
type EntityId = string;
type Entity = { readonly id: EntityId };
type Attribute<T> = Atom<WeakMap<Entity, T>>;

// Create attribute (data column for entities)
attribute<T>(): Attribute<T>

// Create world accessor for entity operations
const {
  entity,   // (id) - get/create cached entity object
  add,      // (entity) - add entity to world
  remove,   // (entity) - remove entity from world
  has,      // (entity) - check if entity exists
  all,      // () - get all entities
  get,      // (entity, attr) - get attribute value
  set,      // (entity, attr, value) - set attribute value
  delete,   // (entity, attr) - delete attribute
  hasAttr,  // (entity, attr) - check if entity has attribute
  with,     // (...attrs) - entities with all attributes
  without,  // (...attrs) - entities without attributes
} = world(store);
```

### composer.ts

```typescript
// System entry type
type SystemEntry = {
  name: string;
  factory: System;
  dispose: (() => void) | null;
  enabled: boolean;
}

// Atom containing all registered systems
$systems: Atom<Map<string, SystemEntry>>

// Composer system - reacts to $systems changes
composer(store: Store): () => void
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
  const { effect, get, set, dispose } = scope(store);

  // All logic in effects - no public methods
  effect([$count], () => {
    const count = get($count)!;
    set($doubled, count * 2);
  });

  return dispose;
}

// Usage
const store = createStore();
const { get, set } = scope(store);
const dispose = counterSystem(store);

set($count, 5);
console.log(get($doubled)); // 10

dispose(); // Cleanup
```

## ECS Example

```typescript
import { attribute, world, createStore, scope } from 'kho';
import type { Store } from 'kho';

// Create attributes (data columns)
const $position = attribute<{ x: number; y: number }>();
const $velocity = attribute<{ vx: number; vy: number }>();

function gameSystem(store: Store) {
  const { interval, dispose } = scope(store);
  const { entity, add, get, set, with: withAttrs } = world(store);

  // Create and add entities
  const player = entity('player');
  const enemy = entity('enemy');

  add(player);
  set(player, $position, { x: 0, y: 0 });
  set(player, $velocity, { vx: 1, vy: 0 });

  add(enemy);
  set(enemy, $position, { x: 100, y: 100 });
  set(enemy, $velocity, { vx: -1, vy: 1 });

  // Game loop - update positions for entities with both attributes
  interval(16, () => {
    for (const e of withAttrs($position, $velocity)) {
      const pos = get(e, $position)!;
      const vel = get(e, $velocity)!;
      set(e, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }
  });

  return dispose;
}
```

## Batching Updates

Use `batch()` to group multiple updates into a single notification cycle:

```typescript
const { batch, set, effect, dispose } = scope(store);

effect([$a, $b, $c], () => {
  console.log('Effect triggered');
});

// Without batch: 3 effect triggers
set($a, 1);
set($b, 2);
set($c, 3);

// With batch: 1 effect trigger
batch(() => {
  set($a, 1);
  set($b, 2);
  set($c, 3);
});
```

## Composing Multiple Systems

Composer uses data-driven approach - systems are managed through an atom:

```typescript
import { createStore, scope, composer, $systems } from 'kho';
import type { SystemEntry } from 'kho';

const store = createStore('app');
const { set, get } = scope(store);

// Start composer (reacts to $systems changes)
const disposeComposer = composer(store);

// Add systems by setting $systems atom
set($systems, new Map<string, SystemEntry>([
  ['input', { name: 'input', factory: inputSystem, dispose: null, enabled: true }],
  ['physics', { name: 'physics', factory: physicsSystem, dispose: null, enabled: true }],
  ['render', { name: 'render', factory: renderSystem, dispose: null, enabled: true }],
]));

// Enable/disable systems dynamically
const systems = new Map(get($systems)!);
systems.get('physics')!.enabled = false;  // Disable physics
set($systems, systems);  // Composer reacts and calls dispose

// Later, cleanup
disposeComposer();
```

## License

MIT
