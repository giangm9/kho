# Project Structure — Building Apps with Kho

How to lay out a project that **uses** Kho. This is opinionated on purpose: Kho is data-driven, and
the file layout is meant to mirror how Kho stores data at runtime.

## Philosophy: group by kind, not by feature

> **One rule:** everything of the same kind lives in the same directory. Atoms with atoms, systems
> with systems, components with components, assets with assets, shaders with shaders. Keep those
> directories flat. Business logic gets its own dedicated directory.

This is a **data-oriented** (hardware-leaning) architecture. In data-oriented design you lay memory
out the way hardware likes it — homogeneous data packed together (**Structure of Arrays**), not
objects that each bundle a little of everything (**Array of Structures**). Kho already does this at
runtime: an ECS component is a **column** (`Atom<Map<id, T>>`), all values of one kind sitting side
by side.

Apply the same idea to your source tree: a directory per kind is a Structure of Arrays for your
codebase. Each directory is a uniform, scannable set — no logic hidden inside a feature silo, no
state buried three folders deep.

**Avoid tree structures.** Deep nesting invents arbitrary taxonomies and hides things. A flat
directory of same-kind files is just a flat array — that is the point.

The common alternative — *feature folders* (`player/`, `enemy/`, each holding its own state, logic,
and view) — is Array of Structures for code. It bundles unlike things together and makes primitives
hard to reuse. Kho projects deliberately do not do this.

## The layout

```
src/
├── atoms/        # reactive state              — atom() / atomWithFactory()
├── signals/      # events                      — signal()
├── components/   # ECS data columns + registries — component() / entities()
├── systems/      # logic and reactions         — system()
├── functions/    # pure, stateless helpers     — plain functions, no store
├── assets/       # static assets               — images, audio, json, fonts
├── shaders/      # GPU shader sources          — .glsl / .wgsl
├── domain/       # business logic: composes everything above
└── main.ts       # entry: createStore → register systems → ignite
```

Include only the kinds your project actually has — a data app may have no `shaders/`, a headless
service no `assets/`. The principle is unchanged: one flat directory per kind.

Everything above `domain/` is a **primitive layer**: uniform, dumb, reusable, and unaware of your
business rules. `domain/` is the only place that reaches across kinds to assemble features.

If you render UI, treat views as just another kind: add a flat `views/` directory (all components
together) under the same rule.

## The primitive directories

Each kind directory is flat. Split into multiple files for cohesion, but do not nest subfolders.
Prefix every store-scoped descriptor with `$` (Kho convention).

### `atoms/` — reactive state
```ts
// atoms/session.ts
import { atom } from 'kho';
export const $score  = atom(0);
export const $level  = atom(1);
export const $paused = atom(false);
```

### `signals/` — events
```ts
// signals/progress.ts
import { signal } from 'kho';
export const $levelUp    = signal<{ level: number }>();
export const $itemPicked = signal<{ id: string }>();
```

### `components/` — ECS columns + entity registries
```ts
// components/entities.ts
import { entities, component, componentWithFactory } from 'kho';
export const $things   = entities();               // Atom<Set<string>>
export const $position = component({ x: 0, y: 0 });
export const $velocity = component({ vx: 0, vy: 0 });
export const $label    = componentWithFactory(() => '');
```

### `systems/` — logic and reactions
One `system()` per file. Systems import primitives from other kind directories; they never import
from `domain/`.
```ts
// systems/movement.ts
import { system, effects, query } from 'kho';
import { $things, $position, $velocity } from '../components/entities';

export const movementSystem = system((scope) => {
  const { interval } = scope(effects);
  const { get, set, select } = scope(query($things));

  interval(16, () => {
    for (const id of select($position, $velocity)) {
      const p = get(id, $position)!;
      const v = get(id, $velocity)!;
      set(id, $position, { x: p.x + v.vx, y: p.y + v.vy });
    }
  });
});
```

### `functions/` — pure helpers
Stateless: no `store`, no atoms, just input → output. Grouped because they are the same kind.
```ts
// functions/rules.ts
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const threshold = (level: number) => level * 100;
```

### `assets/` and `shaders/`
Static, same-kind files together — `assets/logo.png`, `assets/click.wav`, `shaders/blur.glsl`.
Reference them by path; do not scatter them next to whichever module happens to use them.

## The domain layer

`domain/` holds **business logic** — the rules specific to your product, expressed by composing the
primitives. This is the one directory allowed to know about many kinds at once.

Keep primitives generic and let the domain wire them into features:
```ts
// domain/progression.ts — "advance a level when the score crosses a threshold"
import { system, effects, reactive, listen } from 'kho';
import { $score, $level } from '../atoms/session';
import { $levelUp } from '../signals/progress';
import { threshold } from '../functions/rules';

export const progressionSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { effect } = scope(effects);
  const { emit }   = scope(listen);

  effect([$score], () => {
    const level = atoms.get($level)!;
    if (atoms.get($score)! >= threshold(level)) {   // business rule
      atoms.set($level, level + 1);
      emit($levelUp, { level: level + 1 });
    }
  });
});
```

Why separate it: primitives stay reusable across projects, and every product-specific decision lives
in one findable place. When a rule changes, you edit `domain/`, not a dozen feature folders.

## Wiring it together

`main.ts` creates the store, registers systems into `$systems`, and calls `ignite`. Nothing else
constructs the store.
```ts
// main.ts
import { createStore, reactive, ignite, $systems } from 'kho';
import { movementSystem } from './systems/movement';
import { progressionSystem } from './domain/progression';

const store = createStore('app');
const { sets } = reactive(store);

for (const sys of [movementSystem, progressionSystem]) {
  sets.add($systems, sys);   // ignite auto-starts each
}

const dispose = ignite(store);
```

For React or Vue, skip `main.ts` and pass systems to the provider instead:
`<KhoProvider store={store} systems={[...]}>` or `provideStore(store, [...])`.

## Do / Don't

| Do | Don't |
|----|-------|
| One directory per kind, kept flat | Nest per-feature folders (`player/`, `enemy/`, …) |
| Import primitives across kind directories | Import `domain/` from a primitive |
| Put every product rule in `domain/` | Scatter business logic inside atoms or systems |
| Prefix descriptors with `$` | Mix stateful atoms and pure functions in one directory |
| Add a new kind → a new top-level directory | Bury assets or shaders next to their caller |

## Why this fits Kho

Kho's API is already separated by kind — `atom`, `signal`, `component`, and `system` are distinct
primitives, and state is stored as homogeneous columns per store. Laying out files by kind makes the
source tree match the runtime data layout: the same data-oriented shape, top to bottom.
