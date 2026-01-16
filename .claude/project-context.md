# Kho - State Management Library

## Tổng quan dự án

Kho là một thư viện quản lý trạng thái (state management) theo mô hình reactive programming với kiến trúc hướng dữ liệu (data-driven architecture).

## Design Philosophy: Data-Driven Architecture

Kho áp dụng **data-driven approach** thay vì command-based approach:

**Traditional (Command-based):**
```typescript
// Code gọi methods để thay đổi state
counter.increment();
todo.addItem('Task 1');
```

**Kho (Data-driven):**
```typescript
// Code chỉ thay đổi atoms, logic chạy tự động qua effects
store.set($count, store.get($count) + 1);
store.set($items, [...store.get($items), 'Task 1']);
```

**Lợi ích:**
1. **Separation of concerns**: Logic nghiệp vụ (effects) tách biệt khỏi UI/controllers
2. **Testability**: Test bằng cách set atoms và verify kết quả, không cần mock
3. **Composability**: Effects có thể subscribe nhiều atoms, tự động react với changes
4. **Predictability**: State flow rõ ràng: Data changes → Effects run → Derived state updates
5. **Time-travel debugging**: Có thể replay state changes dễ dàng

**Triết lý cốt lõi:**
> "State is the source of truth. Logic reacts to state changes."

## Kiến trúc cốt lõi

### 1. Atom - Đơn vị state nguyên tử
```typescript
function atom<T>(value: T): Atom<T>
```
- Đại diện cho một đơn vị state bất biến
- Có thể được quan sát và cập nhật thông qua Store

### 2. Store - Container quản lý state
```typescript
class Store {
  set<T>(atom: Atom<T>, value: T): void
  get<T>(atom: Atom<T>): T
}
```

**Chức năng:**
- Lưu trữ giá trị của tất cả atoms
- Cung cấp API để đọc/ghi atom

### 3. Scope - Quản lý lifecycle và side-effects
```typescript
function scope(store: Store): {
  effect(deps: Atom[], callback: (...values) => (() => void) | void): void
  debounce(deps: Atom[], callback: (...values) => any, delay: number): void
  registerAttribute(attribute: AttributeAtom): void
  dispose(): void
}

function attribute<T>(entities: Atom<string[] | number[]>): Atom<Map<EntityId, T>>
```

**Cách sử dụng:**
```typescript
const { effect, debounce, registerAttribute, dispose } = scope(store);

// Tạo attribute bound với entities
const $mesh = attribute<Mesh>($objects);
```

**Chức năng:**

#### 3.1 Effect
- Đăng ký reactive effects theo dõi sự thay đổi của atoms
- Callback nhận vào giá trị hiện tại của dependencies
- Có thể return một dispose function để cleanup khi effect bị hủy
- Chạy ngay lập tức khi atoms thay đổi
- Dùng cho cả side-effects và computed values

```typescript
// Side-effect example
effect([$count], (count) => {
  console.log('Count:', count);
  return () => {
    // cleanup
  };
});

// Computed value example
effect([$atom1, $atom2], (value1, value2) => {
  const result = value1 + value2;
  store.set($output, result);
});
```

#### 3.2 Debounce
- Giống effect nhưng có delay
- Chỉ chạy sau khi atoms không thay đổi trong khoảng thời gian delay
- Hữu ích cho search, validation, API calls

```typescript
debounce([$searchQuery], (query) => {
  // Chỉ chạy sau 300ms không có thay đổi
  store.set($results, performSearch(query));
}, 300);
```

#### 3.3 Attribute - Gắn thuộc tính cho entities

**Khái niệm:**
- `attribute<T>(entities)` tạo một attribute atom bound với entity list
- Attribute atom là `Atom<Map<EntityId, T>>` - tự động sync với entities
- Type-safe: compiler biết được relationship giữa entities và attribute

**API:**
```typescript
function attribute<T>(entities: Atom<string[] | number[]>): Atom<Map<EntityId, T>>
```

**Cách sử dụng:**
```typescript
// 1. Tạo entity list
const $gameObjects = atom<string[]>([]);

// 2. Tạo attributes bound với entities
const $position = attribute<Vector3>($gameObjects);
const $mesh = attribute<Mesh>($gameObjects);
const $color = attribute<Color>($gameObjects);

// 3. Register trong scope
function gameSystem(store: Store) {
  const { registerAttribute, dispose } = scope(store);

  registerAttribute($position);
  registerAttribute($mesh);
  registerAttribute($color);

  return { dispose };
}

// 4. Khi entities thay đổi, attributes tự động update
store.set($gameObjects, ['player', 'enemy']);
// $position, $mesh, $color tự động có keys: 'player', 'enemy'
```

**Ví dụ đầy đủ:**
```typescript
import { atom, attribute, scope, Store } from 'kho';

// Entities
export const $entities = atom<string[]>([]);

// Attributes - bound với entities
export const $position = attribute<{ x: number; y: number; z: number }>($entities);
export const $velocity = attribute<{ x: number; y: number; z: number }>($entities);
export const $mesh = attribute<Mesh>($entities);

function physicsSystem(store: Store) {
  const { effect, registerAttribute, dispose } = scope(store);

  // Register attributes
  registerAttribute($position);
  registerAttribute($velocity);
  registerAttribute($mesh);

  // Effect: Update positions dựa trên velocity
  effect([$velocity, $position], (velocities, positions) => {
    const newPositions = new Map(positions);

    velocities.forEach((vel, id) => {
      const pos = positions.get(id);
      if (pos) {
        newPositions.set(id, {
          x: pos.x + vel.x,
          y: pos.y + vel.y,
          z: pos.z + vel.z
        });
      }
    });

    store.set($position, newPositions);
  });

  return { dispose };
}
```

**Lợi ích:**
- ✅ **Type-safe**: `$position` biết nó thuộc về `$entities`
- ✅ **Concise**: Chỉ 1 parameter khi register
- ✅ **Clear ownership**: Rõ ràng attribute của entities nào
- ✅ **Auto-sync**: Khi entities thay đổi, Map keys tự động update

**Reference Counting:**
- Chỉ đăng ký attribute nếu chưa có scope nào sử dụng
- Chỉ dispose attribute khi không còn scope nào sử dụng
- Attribute có thể được share giữa nhiều scopes

#### 3.4 Disposal
- Gọi `dispose()` để cleanup tất cả effects và attributes
- Tự động giảm reference count của attributes
- Chỉ dispose attribute nếu reference count = 0

### 4. System - Module tổ chức logic (Data-Driven)

System là đơn vị tổ chức code độc lập, self-contained và có thể test được theo **data-driven architecture**.

**Type signature:**
```typescript
type System = (store: Store) => {
  dispose: () => void;
}
```

**Triết lý Data-Driven:**
- System **KHÔNG** có public methods (increment, addItem, etc.)
- System **CHỈ** có effects để react với state changes
- Logic được điều khiển bằng cách thay đổi atoms trong store
- Testing: Set atoms → Watch atoms → Verify kết quả

**Yêu cầu thiết kế:**

1. **Self-contained**: Tất cả logic nằm trong một file
2. **Reactive**: Logic chạy tự động thông qua effects khi atoms thay đổi
3. **Testable**: Test bằng cách set atoms và watch kết quả
4. **Disposable**: Return object với method `dispose()` để cleanup
5. **Isolated**: Không depend vào global state, chỉ nhận store qua parameter

**Pattern chuẩn:**
```typescript
// counterSystem.ts
import { atom, scope, Store } from 'kho';

// Export atoms với $ prefix
export const $count = atom(0);
export const $doubled = atom(0);
export const $tripled = atom(0);

export function counterSystem(store: Store) {
  // 1. Create scope - destructure methods
  const { effect, dispose } = scope(store);

  // 2. Register effects - TOÀN BỘ LOGIC Ở ĐÂY

  // Effect 1: Tính toán derived values
  effect([$count], (count) => {
    store.set($doubled, count * 2);
    store.set($tripled, count * 3);
  });

  // Effect 2: Side-effects (logging, etc.)
  effect([$doubled], (value) => {
    console.log('Doubled changed:', value);

    // Cleanup function (optional)
    return () => {
      console.log('Effect cleaned up');
    };
  });

  // 3. QUAN TRỌNG: Chỉ return dispose, KHÔNG có methods
  return { dispose };
}
```

**File structure cho một system:**
```typescript
// mySystem.ts

// 1. Imports
import { atom, attribute, scope, Store } from 'kho';
import type { MyData } from './types'; // Types ở file riêng

// 2. Export atoms với $ prefix
export const $entities = atom<string[]>([]);
export const $data = attribute<MyData>($entities);
export const $state = atom<string>('idle');

// 3. Helper functions (private, nếu cần)
function processData(id: string, data: MyData): MyData {
  // ... business logic
  return data;
}

// 4. Main system function (export)
export function mySystem(store: Store) {
  const { effect, registerAttribute, dispose } = scope(store);

  // Register attributes
  registerAttribute($data);

  // Effects
  effect([$data], (dataMap) => {
    dataMap.forEach((data, id) => {
      const processed = processData(id, data);
      // ... update state
    });
  });

  effect([$state], (state) => {
    console.log('State changed:', state);
  });

  // CHỈ return dispose
  return { dispose };
}
```

**Ví dụ chi tiết - Todo System:**
```typescript
// todoSystem.ts
import { atom, scope, Store } from 'kho';

// Export atoms với $ prefix
export const $items = atom<string[]>([]);
export const $filter = atom<'all' | 'active' | 'completed'>('all');
export const $filteredItems = atom<string[]>([]);
export const $count = atom(0);

export function todoSystem(store: Store) {
  const { effect, dispose } = scope(store);

  // Effect 1: Tính count từ items
  effect([$items], (items) => {
    store.set($count, items.length);
  });

  // Effect 2: Filter items theo filter value
  effect([$items, $filter], (items, filterValue) => {
    let filtered = items;
    if (filterValue === 'active') {
      filtered = items.filter(item => !item.startsWith('[DONE]'));
    } else if (filterValue === 'completed') {
      filtered = items.filter(item => item.startsWith('[DONE]'));
    }
    store.set($filteredItems, filtered);
  });

  // Effect 3: Log khi có thay đổi
  effect([$filteredItems], (items) => {
    console.log('Filtered items:', items);
  });

  return { dispose };
}
```

### 5. Assembler - Kết hợp systems
```typescript
function assembler(systems: System[]): App
```

**Chức năng:**
- Tạo một Store chung
- Khởi tạo từng system với store
- Gán store cho mỗi system và gọi hàm khởi động
- Return object chứa store và các system instances

**Output:**
```typescript
interface App {
  store: Store
  systems: Record<string, any>
}
```

## Nguyên tắc thiết kế

### Reference Counting cho Attributes
- Track số lượng scopes đang sử dụng mỗi attribute
- Map internal: `attribute -> referenceCount`
- `registerAttribute()`: increment count, chỉ setup nếu count = 1
- `scope.dispose()`: decrement count, chỉ cleanup nếu count = 0
- Đảm bảo attributes shared không bị dispose sớm

### Reactive Effects
- Effects tự động re-run khi dependencies thay đổi
- Gọi dispose function của effect cũ trước khi chạy effect mới
- `scope.dispose()` phải cleanup tất cả effects đã đăng ký

### Immutability
- Atoms lưu giá trị immutable
- Khi update, tạo giá trị mới thay vì mutate
- So sánh bằng reference để detect changes

## Structure dự án

```
kho/
├── src/
│   ├── index.ts          # Export public API
│   ├── atom.ts           # Atom implementation
│   ├── attribute.ts      # Attribute implementation
│   ├── store.ts          # Store implementation
│   ├── scope.ts          # Scope implementation
│   ├── assembler.ts      # Assembler function
│   └── types.ts          # TypeScript types
├── dist/                 # Build output
└── scripts/
    └── dev.js            # Development scripts
```

## Quy ước code

1. **TypeScript strict mode**: Bật tất cả strict checks
2. **Naming conventions**:
   - **Atoms**: `$` prefix + camelCase (e.g., `$userProfile`, `$todoList`, `$count`)
   - **Attributes**: `$` prefix + camelCase (e.g., `$position`, `$mesh`, `$velocity`)
   - **Systems**: camelCase + "System" suffix (e.g., `counterSystem`, `todoSystem`)
   - **Types**: PascalCase (e.g., `Atom`, `Store`, `Scope`)
   - **Variables/Functions**: camelCase (e.g., `processData`, `helper`)
3. **Export pattern**:
   - Export atoms và attributes trực tiếp từ system file
   - Export system function
   - Export public API từ `index.ts`
4. **Error handling**: Throw errors với message rõ ràng
5. **Comments**: Chỉ comment logic phức tạp, code tự giải thích

### Tại sao dùng $ prefix cho atoms & attributes?
- **Dễ nhận biết**: Biết ngay đây là reactive atom/attribute, không phải variable thường
- **Tránh conflict**: Không trùng tên với variables, functions, hoặc parameters
- **Convention**: Giống Svelte stores và các reactive libraries khác
- **Searchability**: Dễ search tất cả atoms/attributes trong codebase
- **Consistent**: Attributes cũng là atoms (Map-based), nên dùng cùng convention

## Ưu tiên khi phát triển

1. **Type safety**: Đảm bảo TypeScript types chính xác
2. **Memory safety**: Không memory leaks, proper cleanup
3. **Performance**: Minimize unnecessary re-runs
4. **Developer experience**: API đơn giản, trực quan
5. **Bundle size**: Giữ thư viện nhỏ gọn

## Testing strategy (Data-Driven Approach)

### Nguyên tắc testing
1. **Set atoms** trong store để mô phỏng input
2. **Khởi động system** để đăng ký effects
3. **Watch atoms** để chờ effects hoàn thành
4. **Verify kết quả** bằng cách kiểm tra giá trị atoms

### Helper function: waitFor

```typescript
// test-utils.ts
export async function waitFor(
  condition: () => boolean,
  timeout = 1000
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
```

### Ví dụ test với counterSystem

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store } from 'kho';
import { counterSystem, $count, $doubled, $tripled } from './counterSystem';
import { waitFor } from './test-utils';

describe('counterSystem', () => {
  let store: Store;
  let system: ReturnType<typeof counterSystem>;

  beforeEach(() => {
    store = new Store();
    system = counterSystem(store);
  });

  afterEach(() => {
    system.dispose();
  });

  it('should compute doubled value when count changes', async () => {
    // Set input atom
    store.set($count, 5);

    // Wait for effect to complete
    await waitFor(() => store.get($doubled) === 10);

    // Verify result
    expect(store.get($doubled)).toBe(10);
  });

  it('should compute tripled value', async () => {
    store.set($count, 7);
    await waitFor(() => store.get($tripled) === 21);

    expect(store.get($tripled)).toBe(21);
  });

  it('should handle multiple updates', async () => {
    // Update 1
    store.set($count, 3);
    await waitFor(() => store.get($doubled) === 6);
    expect(store.get($tripled)).toBe(9);

    // Update 2
    store.set($count, 10);
    await waitFor(() => store.get($doubled) === 20);
    expect(store.get($tripled)).toBe(30);
  });
});
```

### Ví dụ test với todoSystem

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store } from 'kho';
import {
  todoSystem,
  $items,
  $filter,
  $filteredItems,
  $count
} from './todoSystem';
import { waitFor } from './test-utils';

describe('todoSystem', () => {
  let store: Store;
  let system: ReturnType<typeof todoSystem>;

  beforeEach(() => {
    store = new Store();
    system = todoSystem(store);
  });

  afterEach(() => {
    system.dispose();
  });

  it('should update count when items change', async () => {
    // Add items
    store.set($items, ['Task 1', 'Task 2', 'Task 3']);

    // Wait for count to update
    await waitFor(() => store.get($count) === 3);

    expect(store.get($count)).toBe(3);
  });

  it('should filter active items', async () => {
    // Setup data
    store.set($items, [
      'Task 1',
      '[DONE] Task 2',
      'Task 3',
      '[DONE] Task 4'
    ]);

    // Set filter
    store.set($filter, 'active');

    // Wait for filtering
    await waitFor(() => store.get($filteredItems).length === 2);

    expect(store.get($filteredItems)).toEqual(['Task 1', 'Task 3']);
  });

  it('should filter completed items', async () => {
    store.set($items, [
      'Task 1',
      '[DONE] Task 2',
      'Task 3',
      '[DONE] Task 4'
    ]);

    store.set($filter, 'completed');

    await waitFor(() => store.get($filteredItems).length === 2);

    expect(store.get($filteredItems)).toEqual([
      '[DONE] Task 2',
      '[DONE] Task 4'
    ]);
  });

  it('should show all items when filter is "all"', async () => {
    const allItems = ['Task 1', '[DONE] Task 2', 'Task 3'];
    store.set($items, allItems);
    store.set($filter, 'all');

    await waitFor(() => store.get($filteredItems).length === 3);

    expect(store.get($filteredItems)).toEqual(allItems);
  });
});
```

### Test với Effects có cleanup

```typescript
it('should cleanup effects on dispose', async () => {
  let effectRunCount = 0;
  let cleanupRunCount = 0;

  const $value = atom(0);

  function testSystem(store: Store) {
    const { effect, dispose } = scope(store);

    effect([$value], (v) => {
      effectRunCount++;
      return () => {
        cleanupRunCount++;
      };
    });

    return { dispose };
  }

  const store = new Store();
  const system = testSystem(store);

  // Initial effect run
  expect(effectRunCount).toBe(1);
  expect(cleanupRunCount).toBe(0);

  // Trigger effect
  store.set($value, 1);
  await waitFor(() => effectRunCount === 2);

  // Old effect cleaned up
  expect(cleanupRunCount).toBe(1);

  // Dispose system
  system.dispose();
  expect(cleanupRunCount).toBe(2);
});
```

### Test multiple systems interaction

```typescript
it('should allow multiple systems to work independently', async () => {
  const store = new Store();

  // Import atoms từ systems
  import { $count as $counterCount, $doubled } from './counterSystem';
  import { $items, $count as $todoCount } from './todoSystem';

  // System 1: Counter
  const counter = counterSystem(store);

  // System 2: Todo
  const todo = todoSystem(store);

  // Test counter
  store.set($counterCount, 5);
  await waitFor(() => store.get($doubled) === 10);
  expect(store.get($doubled)).toBe(10);

  // Test todo
  store.set($items, ['A', 'B', 'C']);
  await waitFor(() => store.get($todoCount) === 3);
  expect(store.get($todoCount)).toBe(3);

  // Systems work independently
  expect(store.get($counterCount)).toBe(5);
  expect(store.get($todoCount)).toBe(3);

  counter.dispose();
  todo.dispose();
});
```

### Best Practices

1. **Luôn wait**: Dùng `waitFor` để chờ effects hoàn thành
2. **Export atoms**: Export atoms với $ prefix từ system file
3. **Dispose trong afterEach**: Đảm bảo cleanup sau mỗi test
4. **Test isolation**: Mỗi test tạo store và system riêng
5. **Mock attributes**: Mock external dependencies (localStorage, DOM, API)
6. **Test edge cases**: Test với empty arrays, null values, concurrent updates
7. **Async testing**: Luôn dùng async/await với effects
8. **Clear assertions**: Assert cả input và output atoms
