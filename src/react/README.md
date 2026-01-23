# Kho React Bindings

React hooks and components for using Kho with React.

## Installation

```bash
npm install kho react
```

## Usage

### 1. Setup Provider

Wrap your app with `KhoProvider`:

```tsx
import { createStore } from 'kho';
import { KhoProvider } from 'kho/react';

const store = createStore();

function App() {
  return (
    <KhoProvider store={store}>
      <YourApp />
    </KhoProvider>
  );
}
```

### 2. Use Hooks in Components

#### `useAtom()` - Read and write atom value

```tsx
import { atom } from 'kho';
import { useAtom } from 'kho/react';

const $count = atom(0);

function Counter() {
  const [count, setCount] = useAtom($count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(c => c - 1)}>-</button>
    </div>
  );
}
```

#### `useAtomValue()` - Read atom value (read-only)

```tsx
import { useAtomValue } from 'kho/react';

function Display() {
  const count = useAtomValue($count);
  return <p>Count: {count}</p>;
}
```

#### `useSetAtom()` - Get setter function only

```tsx
import { useSetAtom } from 'kho/react';

function IncrementButton() {
  const setCount = useSetAtom($count);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Increment
    </button>
  );
}
```

#### `useStore()` - Access store directly

```tsx
import { scope } from 'kho';
import { useStore } from 'kho/react';

function Debug() {
  const store = useStore();
  const { get } = scope(store);

  const handleLog = () => {
    console.log('Count:', get($count));
  };

  return <button onClick={handleLog}>Log Count</button>;
}
```

#### `useScope()` - Create scoped effects

```tsx
import { useEffect } from 'react';
import { useScope } from 'kho/react';

function EffectExample() {
  const s = useScope();

  useEffect(() => {
    // Register effects - they will be cleaned up on unmount
    s.effect([$count], () => {
      console.log('Count changed:', s.get($count));
    });
  }, [s]);

  return <div>Check console for updates</div>;
}
```

#### `useBatch()` - Batch multiple updates

```tsx
import { useBatch, useScope } from 'kho/react';

function BatchExample() {
  const batch = useBatch();
  const s = useScope();

  const handleReset = () => {
    batch(() => {
      s.set($count, 0);
      s.set($name, 'Anonymous');
    }); // Effects run once at the end
  };

  return <button onClick={handleReset}>Reset All</button>;
}
```

## Complete Example

```tsx
import { atom, createStore } from 'kho';
import { KhoProvider, useAtom, useAtomValue, useSetAtom } from 'kho/react';

// Define atoms
const $count = atom(0);
const $name = atom('Alice');

// Create store
const store = createStore();

// Counter component
function Counter() {
  const [count, setCount] = useAtom($count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

// Name component
function NameInput() {
  const name = useAtomValue($name);
  const setName = useSetAtom($name);

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p>Hello, {name}!</p>
    </div>
  );
}

// App
function App() {
  return (
    <KhoProvider store={store}>
      <Counter />
      <NameInput />
    </KhoProvider>
  );
}
```

## API Reference

### Components

#### `<KhoProvider>`

Provides Kho store to the component tree.

**Props:**
- `store: Store` - The Kho store instance
- `systems?: System[]` - Optional array of systems to initialize
- `children: ReactNode` - Child components

### Hooks

#### `useStore(): Store`

Returns the Kho store from context.

#### `useAtom<T>(atom: Atom<T>): [T, (value: T | ((prev: T) => T)) => void]`

Returns the atom's value and a setter function (like `useState`). Supports both direct values and updater functions.

#### `useAtomValue<T>(atom: Atom<T>): T`

Subscribes to an atom and returns its current value. Component re-renders when value changes.

#### `useSetAtom<T>(atom: Atom<T>): (value: T | ((prev: T) => T)) => void`

Returns a function to update an atom's value. Component does NOT re-render when value changes.

#### `useScope(): Scope`

Creates a scope with lifecycle tied to the component. Automatically disposes when component unmounts. Use this to register effects that should live with the component.

#### `useBatch(): (fn: () => void) => void`

Returns a function that batches multiple store updates. Effects only run once after all updates complete.

## How It Works

The React bindings use `scope(store).effect()` internally to subscribe to atom changes. When an atom changes, the effect callback runs and triggers a React state update, causing the component to re-render.

Each hook creates its own scope and properly disposes it when the component unmounts, preventing memory leaks.

## Notes

- **Automatic Subscriptions**: Components automatically re-render when atoms change
- **Cleanup**: Subscriptions are automatically cleaned up on unmount
- **Type Safety**: All hooks are fully typed with TypeScript
- **Updater Functions**: `useAtom` and `useSetAtom` support updater functions like `setCount(c => c + 1)`

## TypeScript

All hooks and components are fully typed:

```tsx
import { Atom, atom } from 'kho';
import { useAtom } from 'kho/react';

const $count: Atom<number> = atom(0);

function Counter() {
  const [count, setCount] = useAtom($count); // Types inferred
  // count: number
  // setCount: (value: number | ((prev: number) => number)) => void
}
```
