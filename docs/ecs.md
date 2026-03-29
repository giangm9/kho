# ECS (Entity Component System)

Kho ECS provides a lightweight, data-driven Entity Component System built on Kho's reactive primitives.

## Core Concepts

- **Entity** = `string` ID (e.g. `"player-1"`, `"enemy-42"`)
- **Component** = standalone data column stored as `Atom<Map<string, T>>`
- **World** = operational interface for querying and mutating entities/components
- **ecsBind** = system factory that binds component cleanup to entity lifecycle

## API

### `entities()` — Create entity registry

```typescript
import { entities } from 'kho';

const $units = entities();        // Atom<Set<string>>
const $projectiles = entities();  // separate registry
```

Returns `Atom<Set<string>>`. Use multiple registries for query optimization.

### `component(defaultValue?)` — Create component

```typescript
import { component, componentWithFactory } from 'kho';

const $position = component({ x: 0, y: 0 });
const $health = component(100);
const $tag = component<boolean>();  // no default

// Use componentWithFactory for mutable defaults (fresh copy per entity)
const $inventory = componentWithFactory(() => []);
const $stats = componentWithFactory(() => ({ hp: 100, mp: 50 }));
```

Components are standalone — not bound to any entity registry. Any component can be used with any registry.

**Note:** `component({ x: 0, y: 0 })` returns the same default reference for every entity. Use `componentWithFactory()` when you need per-entity copies of mutable objects.

### `query($entities)` — Create World factory

```typescript
import { query } from 'kho';

// Returns (store: Store) => World — compatible with scope()
const worldFactory = query($units);
```

### `ecsBind($entities, components, options?)` — Component cleanup

```typescript
import { ecsBind } from 'kho/systems';

// When entities are removed from $units, clean up their component data
const unitsBind = ecsBind($units, [$position, $velocity, $health]);

// With debounce batching
const unitsBind = ecsBind($units, [$position, $health], { batch: 16 });
```

**Options:**
- `batch: number` — debounce cleanup by N ms (e.g. `16` for frame-aligned)
- `batch: true` — immediate but batched notifications
- `batch: false` or omitted — immediate cleanup

`ecsBind` is a `System` — register it via `$systems`:

```typescript
sets.add($systems, unitsBind);
```

### World operations

```typescript
import { system, effects } from 'kho';

const gameSystem = system((scope) => {
  const { interval } = scope(effects);
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

  // Remove entity — ecsBind handles component cleanup
  remove('enemy-1');
});
```

### World API Reference

| Method | Description |
|--------|-------------|
| `add(id)` | Add entity to registry |
| `remove(id)` | Remove entity from registry |
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
import { entities, component, query, system, effects, createStore, reactive, ignite, $systems } from 'kho';
import { ecsBind } from 'kho/systems';

// Define entity registry
const $units = entities();

// Define components (standalone)
const $position = component({ x: 0, y: 0 });
const $velocity = component({ vx: 0, vy: 0 });
const $health = component(100);

// Bind cleanup
const unitsBind = ecsBind($units, [$position, $velocity, $health]);

// Movement system
const movementSystem = system((scope) => {
  const { interval } = scope(effects);
  const { add, set, get, select } = scope(query($units));

  // Spawn entities
  add('player');
  set('player', $position, { x: 0, y: 0 });
  set('player', $velocity, { vx: 1, vy: 0 });
  set('player', $health, 100);

  add('enemy');
  set('enemy', $position, { x: 100, y: 50 });
  set('enemy', $health, 50);
  // enemy has no velocity — it's static

  // Game loop: update positions
  interval(16, () => {
    for (const id of select($position, $velocity)) {
      const pos = get(id, $position)!;
      const vel = get(id, $velocity)!;
      set(id, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }
  });
});

// Start
const store = createStore();
const { sets } = reactive(store);
sets.add($systems, unitsBind);
sets.add($systems, movementSystem);
const dispose = ignite(store);

// Cleanup
dispose();
```

## Multiple Registries

Use separate registries for query optimization:

```typescript
const $units = entities();       // players, enemies
const $projectiles = entities(); // bullets, missiles

const $position = component({ x: 0, y: 0 });

// Bind cleanup per registry
const unitsBind = ecsBind($units, [$position, $health]);
const projBind = ecsBind($projectiles, [$position, $damage]);

// Queries are scoped to registry
const unitWorld = scope(query($units));
const projWorld = scope(query($projectiles));

// 500 units + 10,000 projectiles
// unitWorld.select($position) scans 500, not 10,500
```

## Component Cleanup (ecsBind)

When an entity is removed from the registry:

1. `ecsBind` detects the removal (watches `$entities` atom)
2. Diffs previous vs current entity set
3. For each removed entity, deletes data from all bound component Maps
4. All notifications are **batched** — effects fire once after all cleanup

```typescript
// $units has ecsBind with [$position, $velocity, $health]
remove('player');
// ecsBind detects 'player' removed
// Cleans $position, $velocity, $health maps
// Effects fire ONCE after all cleanup
```

**Per-store isolation:** `ecsBind` is a system — it runs per-store. Server store only sets `$position` → ecsBind only cleans `$position` data (the Map for unused components is empty).

## React Integration

```tsx
import { useAtomValue } from 'kho/react';
import { useComponent, useComponentValue } from 'kho/react';

function UnitList() {
  const unitEntities = useAtomValue($units);
  const [get, set] = useComponent($position);

  return [...unitEntities].map(id => (
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

const unitEntities = useAtomValue($units);
const [getPos, setPos] = useComponent($position);
</script>

<template>
  <div v-for="id in unitEntities" :key="id">
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
