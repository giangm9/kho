# Kho — Project Patterns & Conventions

Kho is a **data-driven state-management library**: zero runtime deps, TypeScript-first,
ships core + `kho/react` + `kho/vue` + `kho/systems`. This file documents the patterns the
codebase already follows — match them; don't reinvent.

For how to structure a project that *consumes* Kho, see [docs/project-structure.md](docs/project-structure.md).

## The one mental model to hold

**Atoms/signals/components are descriptors (keys), not value containers. State lives per-`Store`
inside a `WeakMap` keyed by the store.** See [src/types.ts](src/types.ts):

```ts
type Atom<T> = {
  initialFactory: () => T;                                  // lazy init on first access
  instances: WeakMap<Store, { value: T; listeners: Set<() => void> }>;
};
type Store = { name: string };                             // just an identity object / WeakMap key
```

Consequences that drive everything:
- Atoms are declared at **module scope** (`const $count = atom(0)`) and are safe to share across
  many stores — each store gets its own isolated value + listeners. This is what makes SSR and
  test isolation free: `createStore()` per request/test.
- Nothing is allocated until first `get`/`set` (`initialFactory` runs lazily).
- `atom(v)` is sugar for `atomWithFactory(() => v)`.

## Two-layer architecture

| Layer | Dir | Responsibility |
|-------|-----|----------------|
| **Data** | [src/data/](src/data/) | CRUD on state: `reactive`, `atom`, `signal`, `entity`, `attribute`, `store` |
| **System** | [src/system/](src/system/) | Reactions & lifecycle: `effects`, `system`, `assembler` (ignite) |

Rule of thumb: reading/writing values → data layer; reacting to changes / timers / orchestration → system layer.

## Core patterns

### 1. Scoped disposable API factories
Every stateful API is a factory `(store) => { ...ops, dispose() }`:
`reactive(store)`, `effects(store)`, `listen(store)`, `attributes(store)`, `query($entities)(store)`.
The caller that creates a scope **owns disposal**. `reactive().dispose()` is intentionally a no-op
(data layer holds no subscriptions); `effects()` owns the real cleanup.

### 2. `system()` + `scope()` — never forget to dispose
Prefer wrapping logic in `system()` ([src/system/system.ts](src/system/system.ts)) instead of calling
factories directly. `scope(factory)` runs `factory(store)`, auto-registers its `.dispose`, and returns
the API. Cleanups run **LIFO**; setup may return a custom cleanup.

```ts
const gameSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { effect } = scope(effects);
  const { on, emit } = scope(listen);
  // ...
  return () => {/* optional custom cleanup, runs first */};
});
const dispose = gameSystem(store);   // System = (store) => () => void
```

### 3. Namespaced, plural operations
`reactive(store)` returns `{ atoms, sets, maps, dispose }` — destructure what you need.
`atoms.get/set/notify`, `sets.add/remove/has/clear/size/values`, `maps.set/get/delete/has/…`.
Local aliases are conventional: `r` = reactive, `e` = effects, `a` = attributes.

### 4. Two write strategies — don't mix them up
- **`reactive` `sets`/`maps` = copy-on-write.** `sets.add` builds a *new* `Set`, then `set()` (which
  notifies). Immutable snapshots; safe to hand to React/Vue.
- **ECS `query().set` / `attributes.set` = mutate-in-place + explicit `notify()`.** Chosen for
  per-frame performance; callers must not assume referential change.

### 5. Signals = fire-and-forget events (no stored value)
[src/data/signal.ts](src/data/signal.ts): `signal<T>()` + `listen(store)` → `{ on, emit, dispose }`,
handlers store-scoped via `WeakMap`. Use for **loose coupling between systems** instead of direct calls.

### 6. Batching is store-wide
`effects().batch(fn)` uses a module-level `storeBatch: WeakMap<Store, Set<fn>>`
([src/system/effects.ts](src/system/effects.ts)), so batching coalesces effects **across every
`effects()` instance for that store**, not just the local one. `emit()` flushes.

### 7. ECS (Entity Component System)
[src/data/entity.ts](src/data/entity.ts): entities are **string IDs**; components are standalone
`Atom<Map<id, T>>` **data columns** (SoA), decoupled from any registry.
- `entities()` → `Atom<Set<string>>`; `component(default?)` / `componentWithFactory(fn)`; `query($e)(store)` → `World`.
- `select(...c)` = has-ALL (AND), `exclude(...c)` = has-NONE. Query results are cached and invalidated
  on mutation; `select` iterates the smallest map first (sparse).
- **`World.remove(id)` only drops the entity from the set — it does NOT free component data.**
  Pair the registry with `ecsBind($entities, comps)` from `kho/systems`
  ([src/systems/ecs-bind.ts](src/systems/ecs-bind.ts)) to GC components on entity removal.

### 8. Attributes = ECS for arbitrary objects
[src/data/attribute.ts](src/data/attribute.ts): attach typed data to any object via `WeakMap`.
`registry<K>()` + `attribute($reg, default)` / `attributeWithFactory` + `attributes(store)`.

### 9. Orchestration via `ignite`
[src/system/assembler.ts](src/system/assembler.ts): add systems to the `$systems` atom, call
`ignite(store)`. Ignite diffs the set and auto-starts added / auto-stops removed systems (tracked in
`$state`). Disposing ignite tears everything down in reverse order.

## Framework bindings — keep React & Vue in parity
[src/react/index.ts](src/react/index.ts) and [src/vue/index.ts](src/vue/index.ts) mirror each other:
Provider (`KhoProvider` / `provideStore`), `useAtom` / `useAtomValue` / `useSetAtom`,
`useReactive` / `useEffects`, `useBatch`, `useComponent` / `useComponentValue` / `useSetComponent`,
plus a global-store fallback for provider-less usage. **When you change one binding's surface, change
the other to match.** Bindings subscribe by creating an `effects(store)` scope and disposing it on unmount.

> Note: parts of [src/react/README.md](src/react/README.md) are stale (mention `scope`/`useScope`,
> which don't exist). Trust the source, not that README.

## Conventions

- **`$` prefix** for every store-scoped descriptor: atoms (`$count`), signals (`$damage`), components
  (`$position`), registries/entities (`$units`, `$players`), attributes (`$health`), system atoms
  (`$systems`, `$state`).
- Each module opens with a **JSDoc header block + `@example`**, and uses `// ====` section banners.
- **Types:** core shared types in [src/types.ts](src/types.ts); feature-specific types are colocated
  (`Signal`/`Listener` in signal.ts, `Component`/`World` in entity.ts, `Attribute` in attribute.ts) and
  re-exported through the entry file.
- **Public API is the entry files only:** [src/index.ts](src/index.ts) (core) plus subpath entries
  `src/react/`, `src/vue/`, `src/systems/`. Every subpath has a matching `exports` map in
  [package.json](package.json) — add both when introducing a new subpath.

## Toolchain

- **TypeScript strict-max** ([tsconfig.json](tsconfig.json)): `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `noImplicitReturns`. Target ES2020, ESM
  (`"type": "module"`).
- **Build:** `npm run build` → [scripts/build.ts](scripts/build.ts) runs esbuild per entry, emitting
  both **ESM (`.js`) and CJS (`.cjs`)**, minified + sourcemapped; `.d.ts` via `tsc --emitDeclarationOnly`.
  `react`/`react-dom`/`vue` are marked external.
- **Deps:** zero runtime deps; `react` and `vue` are **optional peer deps**. Keep it that way.
- **Tests:** none yet — the deploy script skips tests when absent. If you add a suite, wire a `test`
  script (deploy/CI will pick it up).

## Git & release

- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `chore:`; `!` for breaking (`feat!:`); scopes like
  `fix(world):`. End commit messages with the required `Co-Authored-By` trailer.
- **Version is CI-managed.** [.github/workflows/publish.yml](.github/workflows/publish.yml) runs on push
  to `main`: `npm version patch`, commits `chore: bump version to X [skip ci]`, and
  `npm publish --provenance`. **Do not hand-edit `version` in package.json** for a normal change —
  let CI bump the patch. Only bump manually for an intentional minor/major.
- `[skip ci]` in a commit subject skips the publish workflow.

## Gotchas checklist

- [ ] New scope created outside a `system()`? Ensure something calls its `dispose()`.
- [ ] Touching an ECS registry? Do component values need `ecsBind` cleanup on `remove()`?
- [ ] Changed a React hook? Mirror it in the Vue composable (and vice-versa).
- [ ] Using `sets`/`maps` (copy-on-write) vs ECS/attribute `set` (mutate + `notify`)? Pick deliberately.
- [ ] Added a public export? Update the entry file **and** `package.json` `exports` if it's a new subpath.
- [ ] Don't bump `version` by hand — CI does it on merge to `main`.
