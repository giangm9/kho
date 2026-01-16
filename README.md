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

// Create atoms
const $count = atom(0);
const $doubled = atom(0);

// Create store
const store = createStore();

// Create reactive effects
const s = scope(store);

s.effect([$count], (count) => {
  store.set($doubled, count * 2);
});

// Update state
store.set($count, 5);
// $doubled automatically becomes 10

// Cleanup when done
s.dispose();
```

### React

```tsx
import { atom, createStore } from 'kho';
import { KhoProvider, useAtom } from 'kho/react';

// Create atoms
const $count = atom(0);

// Create store
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

## Attributes & Aspects (ECS Pattern)

Attributes provide per-entity data storage using `Map<EntityId, T>`. Ideal for game development and entity-component systems.

### What is an Aspect?

An **Aspect** is a view into a set of entity attributes. When you work with multiple attributes of entities (position, health, velocity...), the aspect provides a unified interface to read and write these attributes.

Think of it this way:
- **Attribute** = A single property type (e.g., `$position`, `$health`)
- **Aspect** = A lens to work with attributes across entities

```
Entity "player" ─┬─ $position: {x: 0, y: 0}
                 ├─ $health: 100
                 └─ $velocity: {vx: 1, vy: 0}

Entity "enemy1" ─┬─ $position: {x: 50, y: 30}
                 └─ $health: 50

Aspect ──────────── asp.get('player', $position) → {x: 0, y: 0}
                    asp.set('enemy1', $health, 25)
```

### Basic Usage

```typescript
import { atom, attribute, aspect, createStore } from 'kho';

// 1. Create attributes (like atoms)
const $position = attribute<{ x: number; y: number }>();
const $health = attribute<number>();
const $entities = atom<string[]>([]);

// 2. Create store and aspect
const store = createStore();
const asp = aspect(store);

// 3. Add entities
store.set($entities, ['player', 'enemy1', 'enemy2']);

// 4. Set attribute values
asp.set('player', $position, { x: 0, y: 0 });
asp.set('player', $health, 100);
asp.set('enemy1', $position, { x: 100, y: 50 });
asp.set('enemy1', $health, 50);

// 5. Get attribute values
const playerPos = asp.get('player', $position);  // { x: 0, y: 0 }
const playerHp = asp.get('player', $health);     // 100

// 6. Other operations
asp.has('player', $position);    // true
asp.remove('enemy1', $position); // Remove attribute from entity
asp.keys($position);             // ['player'] - entities with this attribute
asp.clear($health);              // Clear all health values
```

### Aspect API

```typescript
const asp = aspect(store);

// Core operations
asp.get(entityId, $attr)          // Get value (or undefined)
asp.set(entityId, $attr, value)   // Set value
asp.remove(entityId, $attr)       // Remove value
asp.has(entityId, $attr)          // Check if exists

// Batch operations (internally batched - single notification)
asp.attach(entityId, [[$position, {x: 0, y: 0}], [$health, 100]]);
asp.detach(entityId, [$position, $health, $velocity]);

// Query operations
asp.keys($attr)                   // Get all entity IDs with this attribute
asp.getMap($attr)                 // Get underlying Map for iteration
asp.clear($attr)                  // Clear all values
```

### With Reactive Effects

```typescript
const s = scope(store);
const asp = aspect(store);

// React to entity changes
s.effect([$entities, $health], (entities) => {
  entities.forEach((id) => {
    const health = asp.get(id, $health);
    if (health !== undefined && health <= 0) {
      console.log(`${id} is dead!`);
    }
  });
});

// Game loop: update positions based on velocity
s.effect([$entities], (entities) => {
  entities.forEach((id) => {
    const pos = asp.get(id, $position);
    const vel = asp.get(id, $velocity);
    if (pos && vel) {
      asp.set(id, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }
  });
});
```

### React Component Example

```tsx
import { useAtomValue, useAttribute, useAttributeValue, useSetAttribute } from 'kho/react';

// Option 1: Full access (re-renders on ANY entity change)
function EntityList() {
  const entities = useAtomValue($entities);
  const [getPosition] = useAttribute($position);
  const [getHealth] = useAttribute($health);

  return (
    <ul>
      {entities.map((id) => (
        <li key={id}>
          {id}: pos=({getPosition(id)?.x}, {getPosition(id)?.y})
          hp={getHealth(id)}
        </li>
      ))}
    </ul>
  );
}

// Option 2: Single entity (ONLY re-renders when 'player' changes)
function PlayerStatus() {
  const playerPos = useAttributeValue($position, 'player');
  const playerHealth = useAttributeValue($health, 'player');

  return (
    <div>
      Player: ({playerPos?.x}, {playerPos?.y}) HP: {playerHealth}
    </div>
  );
}

// Option 3: Write-only (NO re-renders)
function GameControls() {
  const [setPosition] = useSetAttribute($position);
  const [setHealth] = useSetAttribute($health);

  return (
    <button onClick={() => setHealth('player', 100)}>Heal Player</button>
  );
}
```

### Complete System Example

```typescript
import { atom, attribute, aspect, scope, createStore } from 'kho';
import type { Store } from 'kho';

// Schema
type Position = { x: number; y: number };
type Health = { current: number; max: number };

// Attributes
const $entities = atom<string[]>([]);
const $position = attribute<Position>();
const $health = attribute<Health>();

// System
function createGameSystem(store: Store) {
  const s = scope(store);
  const asp = aspect(store);

  s.effect([$entities], (entities) => {
    // Game logic using asp.get() and asp.set()
  });

  return { dispose: () => s.dispose() };
}
```

## API

### Core

- `atom<T>(initialValue)` - Create an atom with initial value
- `attribute<T>()` - Create a per-entity attribute atom
- `createStore()` - Create a store for managing atom values
- `scope(store)` - Create a scope for reactive effects
- `aspect(store)` - Create aspect for working with entity attributes
- `assembler(systems, store)` - Initialize multiple systems

### React Hooks

- `useAtom(atom)` - Read and write atom value `[value, setValue]`
- `useAtomValue(atom)` - Read atom value (read-only)
- `useSetAtom(atom)` - Get setter function (no re-renders on change)
- `useAttribute(attr)` - Full attribute access `[get, set, remove]` (re-renders on any change)
- `useAttributeValue(attr, entityId)` - Single entity value (only re-renders when that entity changes)
- `useSetAttribute(attr)` - Setter only `[set, remove]` (no re-renders)
- `useStore()` - Get store instance
- `useScope()` - Get scope for effects
- `useBatch()` - Get batch function for grouped updates

## License

MIT
