# Kho

> Data-driven state management with reactive effects and signals

[![npm version](https://img.shields.io/npm/v/kho.svg)](https://www.npmjs.com/package/kho)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is Kho?

Kho is a state management library built on data-driven architecture principles:

- **Data-Driven**: Logic reacts to state changes instead of imperative commands
- **Separation of Concerns**: Clear split between data (CRUD) and reactions (effects)
- **Type-Safe**: Full TypeScript support with strict type checking
- **Minimal**: ~5KB bundle size with zero dependencies

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Kho                                 │
├─────────────────────────┬───────────────────────────────────┤
│     Data Layer          │      System Layer                 │
│  (src/data/)            │   (src/system/)                   │
├─────────────────────────┼───────────────────────────────────┤
│  reactive(store)        │  effects(store)                   │
│  ├─ atoms.get/set/notify│  ├─ effect()                      │
│  ├─ sets.add/remove/has │  ├─ compute()                     │
│  └─ maps.set/get/delete │  ├─ batch()                       │
│                         │  ├─ debounce/throttle()           │
│  signal/listen          │  └─ interval/timeout()            │
│  entity/world (ECS)     │                                   │
│  attribute (generic)    │  system() - auto dispose          │
│                         │  ignite() - orchestration         │
└─────────────────────────┴───────────────────────────────────┘
```

## Installation

```bash
npm install kho
```

## Quick Start

### Vanilla TypeScript

```typescript
import { atom, createStore, reactive, effects } from 'kho';

// Define atoms ($ prefix convention)
const $count = atom(0);
const $doubled = atom(0);

// Create store
const store = createStore();

// Data layer - destructure for cleaner code
const { atoms } = reactive(store);

// System layer - reactions
const { effect, dispose } = effects(store);

// React to changes
effect([$count], () => {
  const count = atoms.get($count)!;
  atoms.set($doubled, count * 2);
});

// Update state
atoms.set($count, 5);
// $doubled automatically becomes 10

// Cleanup
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
      <button onClick={() => setCount(count + 1)}>+</button>
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

### Vue

```vue
<!-- App.vue (root component) -->
<script setup>
import { createStore } from 'kho';
import { provideStore } from 'kho/vue';

const store = createStore();
provideStore(store);
</script>

<template>
  <Counter />
</template>
```

```vue
<!-- Counter.vue -->
<script setup>
import { atom } from 'kho';
import { useAtom } from 'kho/vue';

const $count = atom(0);
const [count, setCount] = useAtom($count);
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="setCount(count + 1)">+</button>
  </div>
</template>
```

## Core Concepts

### 1. Atoms - State Containers

```typescript
import { atom, atomWithFactory } from 'kho';

// Simple atoms
const $count = atom(0);
const $user = atom<User | null>(null);
const $items = atom<string[]>([]);

// Lazy initialization
const $cache = atomWithFactory(() => new Map());
```

### 2. Reactive - Data Operations

The `reactive(store)` function returns namespaced operations for different data types:

```typescript
import { createStore, reactive } from 'kho';

const store = createStore();
const { atoms, sets, maps, dispose } = reactive(store);

// Atom operations
atoms.get($count);           // Get value
atoms.set($count, 10);       // Set value
atoms.notify($count);        // Notify listeners manually

// Set operations (Atom<Set<T>>)
const $tags = atom(new Set<string>());
sets.add($tags, 'new');      // Add item
sets.remove($tags, 'old');   // Remove item
sets.has($tags, 'new');      // Check existence
sets.values($tags);          // Get as array

// Map operations (Atom<Map<K, V>>)
const $cache = atom(new Map<string, number>());
maps.set($cache, 'key', 42); // Set entry
maps.get($cache, 'key');     // Get entry
maps.delete($cache, 'key');  // Delete entry
maps.has($cache, 'key');     // Check existence
maps.keys($cache);           // Get all keys
maps.values($cache);         // Get all values
maps.entries($cache);        // Get all entries

dispose();                   // Cleanup
```

### 3. Effects - Reactions

The `effects(store)` function provides reactive primitives:

```typescript
import { effects } from 'kho';

const { effect, compute, batch, debounce, throttle, interval, timeout, onDispose, dispose } = effects(store);

// Basic effect - runs when dependencies change
effect([$count], () => {
  console.log('Count:', atoms.get($count));
});

// Computed - derived state
compute([$a, $b], $sum, (a, b) => a + b);

// Batch - single notification for multiple updates
batch(() => {
  atoms.set($a, 1);
  atoms.set($b, 2);
});

// Timing utilities
debounce([$search], 300, () => { /* search API */ });
throttle([$scroll], 16, () => { /* update UI */ });
interval(1000, () => { /* tick */ });
timeout(5000, () => { /* delayed */ });

// Custom cleanup
onDispose(() => { /* cleanup */ });

dispose();  // Cleanup all
```

### 4. Signals - Event Communication

Signals enable loose coupling between systems:

```typescript
import { signal, listen } from 'kho';

// Define signals
const $playerDied = signal<{ playerId: string }>();
const $damage = signal<{ target: string; amount: number }>();

// Listen to signals
const { on, emit, dispose } = listen(store);

on($damage, ({ target, amount }) => {
  console.log(`${target} took ${amount} damage`);
});

// Emit signals
emit($damage, { target: 'player', amount: 10 });
```

### 5. System - Encapsulated Logic

Use `system()` to create self-contained units with automatic cleanup:

```typescript
import { atom, system, reactive, effects, listen, signal } from 'kho';

const $health = atom(100);
const $gameOver = atom(false);
const $damage = signal<number>();

const gameSystem = system((scope) => {
  // scope() injects store and tracks disposal
  const { atoms } = scope(reactive);
  const { effect } = scope(effects);
  const { on, emit } = scope(listen);

  // Listen to damage events
  on($damage, (amount) => {
    const health = atoms.get($health)! - amount;
    atoms.set($health, Math.max(0, health));
  });

  // React to health changes
  effect([$health], () => {
    if (atoms.get($health)! <= 0) {
      atoms.set($gameOver, true);
    }
  });

  // Optional: return custom cleanup
  return () => {
    console.log('Game system stopped');
  };
});

// Usage
const store = createStore();
const dispose = gameSystem(store);
// ... later
dispose();  // All cleanup handled automatically
```

## ECS (Entity Component System)

For game development and similar use cases:

```typescript
import { component, componentWithFactory, entities, world, system, effects } from 'kho';

// Define components (data columns)
const $position = component<{ x: number; y: number }>();
const $velocity = component<{ vx: number; vy: number }>();
const $health = component<number>();
const $inventory = componentWithFactory(() => []);  // With default

// Create entity registry
const $players = entities();

// Game system
const gameSystem = system((scope) => {
  const { interval } = scope(effects);
  const entityWorld = scope(world($players));

  // Create entities
  const player = entityWorld.entity('player-1');
  const enemy = entityWorld.entity('enemy-1');

  // Add to world
  entityWorld.add(player);
  entityWorld.set(player, $position, { x: 0, y: 0 });
  entityWorld.set(player, $velocity, { vx: 1, vy: 0 });
  entityWorld.set(player, $health, 100);

  entityWorld.add(enemy);
  entityWorld.set(enemy, $position, { x: 100, y: 50 });
  entityWorld.set(enemy, $health, 50);

  // Game loop
  interval(16, () => {
    // Update all entities with position and velocity
    for (const entity of entityWorld.with($position, $velocity)) {
      const pos = entityWorld.get(entity, $position)!;
      const vel = entityWorld.get(entity, $velocity)!;
      entityWorld.set(entity, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }
  });
});
```

### World API

```typescript
const entityWorld = scope(world($entities));

// Entity lifecycle
entityWorld.entity(id)              // Get/create entity by ID (cached)
entityWorld.add(entity)             // Add to registry
entityWorld.remove(entity)          // Remove from registry
entityWorld.has(entity)             // Check existence
entityWorld.all()                   // Get all entities

// Component operations
entityWorld.get(entity, $comp)      // Get value (undefined if not set)
entityWorld.set(entity, $comp, val) // Set value
entityWorld.delete(entity, $comp)   // Remove component
entityWorld.hasComp(entity, $comp)  // Check if entity has component

// Queries
entityWorld.with($a, $b)            // Entities with ALL components
entityWorld.without($a)             // Entities without component

entityWorld.dispose()               // Cleanup
```

## System Orchestration

Use `ignite()` to manage multiple systems:

```typescript
import { createStore, reactive, ignite, $systems } from 'kho';

const store = createStore();
const { sets } = reactive(store);

// Register systems
sets.add($systems, gameSystem);
sets.add($systems, audioSystem);
sets.add($systems, uiSystem);

// Start all systems
const dispose = ignite(store);

// Dynamic system management
sets.add($systems, debugSystem);     // Auto-starts
sets.remove($systems, audioSystem);  // Auto-stops

// Cleanup all
dispose();
```

### With React/Vue

```tsx
// React - wrap your app
<KhoProvider store={store} systems={[gameSystem, uiSystem]}>
  <App />
</KhoProvider>
```

```vue
<!-- Vue - in root component setup -->
<script setup>
import { createStore } from 'kho';
import { provideStore } from 'kho/vue';

const store = createStore();
provideStore(store, [gameSystem, uiSystem]);
</script>
```

## Generic Attributes

For attaching data to non-entity objects:

```typescript
import { registry, attribute, attributeWithFactory, attributes, system } from 'kho';

// Define registry and attributes
const $nodes = registry<HTMLElement>();
const $draggable = attribute($nodes, false);           // With default
const $position = attributeWithFactory($nodes, () => ({ x: 0, y: 0 }));

const dragSystem = system((scope) => {
  const attrOps = scope(attributes);

  const element = document.getElementById('draggable')!;

  // Register object
  attrOps.add(element, $draggable);

  // Get/set attributes
  attrOps.set(element, $draggable, true);
  attrOps.set(element, $position, { x: 100, y: 50 });

  console.log(attrOps.get(element, $draggable));  // true
  console.log(attrOps.get(element, $position));   // { x: 100, y: 50 }
});
```

## API Reference

### Data Layer

| Function | Returns | Description |
|----------|---------|-------------|
| `atom(value)` | `Atom<T>` | Create atom with initial value |
| `atomWithFactory(fn)` | `Atom<T>` | Create atom with factory |
| `createStore(name?)` | `Store` | Create a store instance |
| `reactive(store)` | `Reactive` | Get data operations |
| `signal()` | `Signal<T>` | Create event signal |
| `listen(store)` | `Listener` | Get signal operations |

### Reactive Namespaces

| Namespace | Methods |
|-----------|---------|
| `atoms` | `get`, `set`, `notify` |
| `sets` | `add`, `remove`, `has`, `clear`, `size`, `values` |
| `maps` | `set`, `get`, `delete`, `has`, `clear`, `size`, `keys`, `values`, `entries` |

### System Layer

| Function | Returns | Description |
|----------|---------|-------------|
| `effects(store)` | `Effects` | Get reaction primitives |
| `system(setup)` | `System` | Create system with auto-dispose |
| `ignite(store)` | `() => void` | Start system orchestrator |

### Effects Methods

| Method | Description |
|--------|-------------|
| `effect(atoms, fn)` | Reactive effect |
| `compute(sources, target, fn)` | Derived state |
| `batch(fn)` | Batch updates |
| `debounce(atoms, ms, fn)` | Debounced effect |
| `throttle(atoms, ms, fn)` | Throttled effect |
| `interval(ms, fn)` | Auto-cleanup interval |
| `timeout(ms, fn)` | Auto-cleanup timeout |
| `onDispose(fn)` | Register cleanup |
| `dispose()` | Cleanup all |

### ECS

| Function | Description |
|----------|-------------|
| `component()` | Create component type |
| `componentWithFactory(fn)` | Component with default factory |
| `entities()` | Create entity registry |
| `world($entities)` | Create world factory |

### Attributes

| Function | Description |
|----------|-------------|
| `registry()` | Create object registry |
| `attribute($reg, default)` | Create attribute with default |
| `attributeWithFactory($reg, fn)` | Create attribute with factory |
| `attributes(store)` | Get attribute operations |

## License

MIT
