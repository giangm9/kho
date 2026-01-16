# Kho - Implementation Roadmap

## Overview
Roadmap implement thư viện Kho theo từng phase, mỗi phase có thể test và verify được.

---

## Phase 1: Core Foundation (Atoms & Store)
**Mục tiêu**: Implement atom và store cơ bản

### Deliverables
- ✅ `atom<T>(value)` - Tạo atom với giá trị khởi tạo
- ✅ `Store` class với `get()` và `set()`
- ✅ Type-safe operations

### Implementation
```typescript
// src/atom.ts
export function atom<T>(initialValue: T): Atom<T>

// src/store.ts
export class Store {
  get<T>(atom: Atom<T>): T
  set<T>(atom: Atom<T>, value: T): void
}
```

### Testing
```typescript
// Test 1: Create atom
const $count = atom(0);
expect($count).toBeDefined();

// Test 2: Store get/set
const store = new Store();
store.set($count, 5);
expect(store.get($count)).toBe(5);

// Test 3: Multiple atoms
const $name = atom("test");
store.set($name, "hello");
expect(store.get($name)).toBe("hello");
```

### Examples
- `examples/01-basic-counter/` - Counter với atoms và store
- `examples/01-basic-counter/index.html` - UI đơn giản

---

## Phase 2: Reactive Effects (Scope & Effect)
**Mục tiêu**: Implement scope với effect để reactive programming

### Deliverables
- ✅ `scope(store)` - Tạo scope từ store
- ✅ `effect(deps, callback)` - Subscribe atoms và auto-run
- ✅ Cleanup khi atom thay đổi hoặc dispose
- ✅ Reference counting cho effects

### Implementation
```typescript
// src/scope.ts
export function scope(store: Store): {
  effect(deps: Atom[], callback: (...values) => (() => void) | void): void
  dispose(): void
}
```

### Testing
```typescript
// Test 1: Effect runs on atom change
const $count = atom(0);
const $doubled = atom(0);

const { effect, dispose } = scope(store);
effect([$count], (count) => {
  store.set($doubled, count * 2);
});

store.set($count, 5);
await waitFor(() => store.get($doubled) === 10);

// Test 2: Cleanup function
let cleanupCalled = false;
effect([$count], () => {
  return () => { cleanupCalled = true; };
});
store.set($count, 1);
await waitFor(() => cleanupCalled === true);

// Test 3: Dispose cleanup
dispose();
expect(/* all effects cleaned up */).toBe(true);
```

### Examples
- `examples/02-reactive-counter/` - Counter với effects
- `examples/02-todo-list/` - Todo list với filtering

---

## Phase 3: Debounced Effects
**Mục tiêu**: Implement debounce cho delayed effects

### Deliverables
- ✅ `debounce(deps, callback, delay)` - Effect với delay
- ✅ Cancel pending debounce khi atom thay đổi
- ✅ Cleanup khi dispose

### Implementation
```typescript
// src/scope.ts - extend
export function scope(store: Store): {
  effect(deps: Atom[], callback: (...values) => (() => void) | void): void
  debounce(deps: Atom[], callback: (...values) => any, delay: number): void
  dispose(): void
}
```

### Testing
```typescript
// Test 1: Debounce delays execution
const $search = atom("");
const $results = atom<string[]>([]);

debounce([$search], (query) => {
  store.set($results, performSearch(query));
}, 300);

store.set($search, "hello");
// Should NOT run immediately
expect(store.get($results)).toEqual([]);

// Should run after 300ms
await sleep(350);
expect(store.get($results)).toEqual(["hello world"]);

// Test 2: Rapid changes only trigger once
store.set($search, "h");
store.set($search, "he");
store.set($search, "hel");
store.set($search, "hello");
// Only last value triggers after delay
await sleep(350);
expect(searchCallCount).toBe(1);
```

### Examples
- `examples/03-search-box/` - Search với debounce
- `examples/03-live-validation/` - Form validation

---

## Phase 4: Entity-Component System (Attributes)
**Mục tiêu**: Implement attribute system cho ECS pattern

### Deliverables
- ✅ `attribute<T>(entities)` - Tạo bound attribute
- ✅ `registerAttribute(attribute)` - Đăng ký trong scope
- ✅ Auto-sync Map keys với entity list
- ✅ Reference counting cho shared attributes
- ✅ Cleanup khi dispose

### Implementation
```typescript
// src/attribute.ts
export function attribute<T>(
  entities: Atom<string[] | number[]>
): Atom<Map<EntityId, T>>

// src/scope.ts - extend
export function scope(store: Store): {
  effect(deps: Atom[], callback: (...values) => (() => void) | void): void
  debounce(deps: Atom[], callback: (...values) => any, delay: number): void
  registerAttribute(attribute: AttributeAtom): void
  dispose(): void
}
```

### Testing
```typescript
// Test 1: Attribute creation
const $entities = atom<string[]>([]);
const $position = attribute<Vector3>($entities);
expect($position).toBeDefined();

// Test 2: Auto-sync with entities
const { registerAttribute } = scope(store);
registerAttribute($position);

store.set($entities, ["player", "enemy"]);
const positions = store.get($position);
expect(positions.size).toBe(2);
expect(positions.has("player")).toBe(true);

// Test 3: Set attribute values
const newPositions = new Map(positions);
newPositions.set("player", { x: 10, y: 20, z: 30 });
store.set($position, newPositions);

// Test 4: Reference counting
const scope1 = scope(store);
const scope2 = scope(store);
scope1.registerAttribute($position);
scope2.registerAttribute($position);
scope1.dispose(); // Should NOT dispose attribute
scope2.dispose(); // NOW should dispose
```

### Examples
- `examples/04-game-entities/` - Simple game với ECS
- `examples/04-particle-system/` - Particle system

---

## Phase 5: System Pattern & Assembler
**Mục tiêu**: Implement system pattern và assembler

### Deliverables
- ✅ System type definition
- ✅ `assembler(systems)` - Kết hợp systems
- ✅ Shared store cho all systems
- ✅ Dispose all systems

### Implementation
```typescript
// src/types.ts
export type System = (store: Store) => {
  dispose: () => void
}

// src/assembler.ts
export interface App {
  store: Store
  systems: Record<string, ReturnType<System>>
}

export function assembler(systems: System[]): App
```

### Testing
```typescript
// Test 1: Create app with multiple systems
function counterSystem(store: Store) {
  const { effect, dispose } = scope(store);
  effect([$count], (c) => {
    store.set($doubled, c * 2);
  });
  return { dispose };
}

function todoSystem(store: Store) {
  const { effect, dispose } = scope(store);
  effect([$items], (items) => {
    store.set($count, items.length);
  });
  return { dispose };
}

const app = assembler([counterSystem, todoSystem]);
expect(app.store).toBeDefined();

// Test 2: Systems share same store
app.store.set($count, 5);
await waitFor(() => app.store.get($doubled) === 10);

// Test 3: Dispose all
app.dispose();
```

### Examples
- `examples/05-multi-system/` - App với nhiều systems
- `examples/05-game-app/` - Complete game app

---

## Phase 6: Optimization & Polish
**Mục tiêu**: Optimize performance và developer experience

### Deliverables
- ✅ Batch updates để reduce effect re-runs
- ✅ Memoization cho expensive computations
- ✅ Dev tools / debugging utilities
- ✅ Error handling và validation
- ✅ TypeScript strict mode
- ✅ Bundle size optimization

### Testing
- Performance benchmarks
- Memory leak detection
- Edge cases và error scenarios

### Examples
- `examples/06-performance/` - Performance demos
- `examples/06-devtools/` - Dev tools showcase

---

## Phase 7: Documentation & Release
**Mục tiêu**: Complete documentation và npm release

### Deliverables
- ✅ README.md với quick start
- ✅ API documentation
- ✅ Tutorial guides
- ✅ Migration guides (nếu cần)
- ✅ npm package setup
- ✅ CI/CD pipeline

### Tasks
1. Write comprehensive README
2. Generate API docs
3. Create tutorials
4. Setup npm publishing
5. Version 1.0.0 release

---

## Development Workflow

### Commands
```bash
# Development mode - watch + serve examples
npm run dev

# Build library
npm run build

# Run tests
npm run test

# Deploy to npm
npm run deploy
```

### Scripts Structure
```
scripts/
├── dev.ts          # Dev server + watch mode
├── build.ts        # Production build
└── deploy.ts       # npm publish
```

---

## Success Criteria

### Phase 1-2
- [ ] Basic atoms và reactive effects hoạt động
- [ ] Counter example chạy được

### Phase 3-4
- [ ] Debounce và attributes hoạt động
- [ ] Search và ECS examples chạy được

### Phase 5
- [ ] Multi-system app hoạt động
- [ ] Game example chạy được

### Phase 6-7
- [ ] Performance đạt yêu cầu
- [ ] Bundle size < 5KB (gzipped)
- [ ] Documentation đầy đủ
- [ ] Published to npm

---

## Timeline Notes
Implement theo phases, mỗi phase phải pass tests trước khi sang phase tiếp theo. Không có timeline cụ thể - focus vào quality và correctness.
