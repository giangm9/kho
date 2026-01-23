# Kho

> Data-driven state management with reactive effects and signals

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

### Atom

```typescript
import { atom } from 'kho';

const $count = atom(0);
const $user = atom<User | null>(null);
const $items = atom<string[]>([]);
```

### Store & Scope

```typescript
import { createStore, scope } from 'kho';

const store = createStore();
const { get, set, effect, batch, dispose } = scope(store);

// Get/set values
const count = get($count);
set($count, 10);

// Reactive effect
effect([$count], () => {
  console.log('Count changed:', get($count));
});

// Batch updates (single notification)
batch(() => {
  set($a, 1);
  set($b, 2);
});

// Cleanup
dispose();
```

### Entity & Attribute (ECS)

```typescript
import { attribute, world } from 'kho';

const $position = attribute<{ x: number; y: number }>();
const $health = attribute<number>();

const { entity, add, get, set, with: withAttrs } = world(store);

const player = entity('player');
add(player);
set(player, $position, { x: 0, y: 0 });
set(player, $health, 100);

// Query entities
for (const e of withAttrs($position)) {
  console.log(get(e, $position));
}
```

### Signal

```typescript
import { signal, listen } from 'kho';

const $damage = signal<{ target: string; amount: number }>();

const { on, emit, dispose } = listen(store);

on($damage, ({ target, amount }) => {
  console.log(`${target} took ${amount} damage`);
});

emit($damage, { target: 'player', amount: 10 });
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

## License

MIT

