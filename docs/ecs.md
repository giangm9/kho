# ECS (Entity Component System)

Kho ECS provides a lightweight, data-driven Entity Component System built on top of Kho's reactive primitives.

## Core Concepts

- **Entity** = `string` ID (e.g. `"player-1"`, `"enemy-42"`)
- **Component** = typed data column bound to an entity registry, stored as `Map<string, T>`
- **World** = operational interface for querying and mutating entities/components
- **Entities** = registry definition created by `world()`, groups related entities and their components

## API

### `world()` — Create entity registry

```typescript
import { world } from 'kho';

const $units = world();
const $projectiles = world();
```

Each `world()` creates an independent `Entities` registry. Use multiple registries for query optimization — query only the relevant subset instead of scanning all entities.

### `component(entities, defaultValue?)` — Define component

```typescript
import { component, componentWithFactory } from 'kho';

const $position = component($units, { x: 0, y: 0 });
const $health = component($units, 100);
const $velocity = component($units);  // no default

// Use componentWithFactory for mutable defaults (fresh copy per entity)
const $inventory = componentWithFactory($units, () => []);
const $stats = componentWithFactory($units, () => ({ hp: 100, mp: 50 }));
```

Components are registered to their `Entities` at definition time. This lets `remove()` know exactly which components to clean up.

**Note:** `component($units, { x: 0, y: 0 })` returns the same reference for every entity. Use `componentWithFactory()` when you need per-entity copies of mutable objects.

### `query(entities)` — Create World factory

```typescript
import { query } from 'kho';

// Returns (store: Store) => World — compatible with scope()
const worldFactory = query($units);
```

### World operations

```typescript
import { system } from 'kho';

const gameSystem = system((scope) => {
  const { add, remove, get, set, has, all, select, exclude } = scope(query($units));

  // Add entities
  add('player-1');
  add('enemy-1');

  // Set component data
  set('player-1', $position, { x: 0, y: 0 });
  set('player-1', $health, 100);
  set('enemy-1', $position, { x: 50, y: 30 });

  // Get component data
  const pos = get('player-1', $position);  // { x: 0, y: 0 }
  const hp = get('player-1', $health);     // 100

  // Check existence
  has('player-1');              // true — entity exists?
  has('player-1', $position);  // true — entity has component?
  has('player-1', $velocity);  // false

  // Query entities
  const moving = select($position, $velocity);  // entities with ALL listed components
  const idle = exclude($velocity);               // entities WITHOUT listed components
  const everyone = all();                        // all entities

  // Remove entity — auto-cleans all component data (batched)
  remove('enemy-1');
});
```

### World API Reference

| Method | Description |
|--------|-------------|
| `add(id)` | Add entity to registry |
| `remove(id)` | Remove entity + cleanup all component data (batched) |
| `has(id)` | Check if entity exists |
| `has(id, comp)` | Check if entity has component |
| `all()` | Get all entity IDs |
| `get(id, comp)` | Get component value (or default) |
| `set(id, comp, value)` | Set component value |
| `delete(id, comp)` | Remove single component from entity |
| `select(...comps)` | Entities with ALL listed components |
| `exclude(...comps)` | Entities WITHOUT listed components |
| `dispose()` | Cleanup all subscriptions |

## Complete Example

```typescript
import { world, component, componentWithFactory, query, system, effects, createStore } from 'kho';

// Define entity registry
const $units = world();

// Define components
const $position = component($units, { x: 0, y: 0 });
const $velocity = component($units, { vx: 0, vy: 0 });
const $health = component($units, 100);

// Movement system
const movementSystem = system((scope) => {
  const { interval } = scope(effects);
  const w = scope(query($units));

  // Spawn entities
  w.add('player');
  w.set('player', $position, { x: 0, y: 0 });
  w.set('player', $velocity, { vx: 1, vy: 0 });
  w.set('player', $health, 100);

  w.add('enemy');
  w.set('enemy', $position, { x: 100, y: 50 });
  w.set('enemy', $health, 50);
  // enemy has no velocity — it's static

  // Game loop: update positions
  interval(16, () => {
    for (const id of w.select($position, $velocity)) {
      const pos = w.get(id, $position)!;
      const vel = w.get(id, $velocity)!;
      w.set(id, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }
  });
});

// Start
const store = createStore();
const dispose = movementSystem(store);

// Cleanup
dispose();
```

## Multiple Registries

Use separate registries for query optimization:

```typescript
const $units = world();       // players, enemies
const $projectiles = world(); // bullets, missiles
const $effects = world();     // particles, explosions

const $position = component($units, { x: 0, y: 0 });
const $projPos = component($projectiles, { x: 0, y: 0 });

// Queries are scoped — only scan relevant entities
const unitWorld = scope(query($units));
const projWorld = scope(query($projectiles));

// 500 units + 10,000 projectiles
// unitWorld.select($position) scans 500, not 10,500
// projWorld.select($projPos) scans 10,000, not 10,500
```

## Component Cleanup

When `remove(id)` is called:

1. Iterates only components registered to this `Entities` (known at definition time)
2. Deletes entity data from each component `Map`
3. All notifications are **batched** — effects fire once after all cleanup completes
4. Removes entity from the registry `Set`

```typescript
// $units has 3 components: $position, $velocity, $health
w.remove('player');
// Scans 3 maps (not ALL components in the app)
// Effects fire ONCE after all 3 are cleaned
```

## React Integration

```tsx
import { useAtomValue } from 'kho/react';
import { useComponent, useComponentValue } from 'kho/react';

function UnitList() {
  const entities = useAtomValue($units.$entities);
  const [get, set] = useComponent($position);

  return entities.map(id => (
    <UnitItem key={id} entity={id} />
  ));
}

function UnitItem({ entity }: { entity: string }) {
  const pos = useComponentValue($position, entity);
  return <div>{pos?.x}, {pos?.y}</div>;
}
```

## Vue Integration

```vue
<script setup>
import { useAtomValue } from 'kho/vue';
import { useComponent, useComponentValue } from 'kho/vue';

const entities = useAtomValue($units.$entities);
const [getPos, setPos] = useComponent($position);
</script>

<template>
  <div v-for="id in entities" :key="id">
    <UnitItem :entity="id" />
  </div>
</template>
```

```vue
<!-- UnitItem.vue -->
<script setup>
import { useComponentValue } from 'kho/vue';

const props = defineProps<{ entity: string }>();
const pos = useComponentValue($position, props.entity);
</script>

<template>
  <div>{{ pos?.x }}, {{ pos?.y }}</div>
</template>
```
