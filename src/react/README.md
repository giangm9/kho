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
import { Store } from 'kho';
import { KhoProvider } from 'kho/react';

const store = new Store();

function App() {
  return (
    <KhoProvider store={store}>
      <YourApp />
    </KhoProvider>
  );
}
```

### 2. Use Hooks in Components

#### `useAtom()` - Read atom value

```tsx
import { atom } from 'kho';
import { useAtom } from 'kho/react';

const $count = atom(0);

function Counter() {
  const count = useAtom($count);
  return <p>Count: {count}</p>;
}
```

#### `useSetAtom()` - Get setter function

```tsx
import { useSetAtom } from 'kho/react';

function Counter() {
  const setCount = useSetAtom($count);

  return (
    <button onClick={() => setCount(5)}>
      Set to 5
    </button>
  );
}
```

#### `useAtomValue()` - Get both value and setter

```tsx
import { useAtomValue } from 'kho/react';

function Counter() {
  const [count, setCount] = useAtomValue($count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

#### `useStore()` - Access store directly

```tsx
import { useStore } from 'kho/react';

function Debug() {
  const store = useStore();

  const handleLog = () => {
    console.log('Count:', store.get($count));
  };

  return <button onClick={handleLog}>Log Count</button>;
}
```

#### `useScope()` - Create scoped effects

```tsx
import { useEffect } from 'react';
import { useScope } from 'kho/react';

function EffectExample() {
  const scope = useScope();

  useEffect(() => {
    // Register effects
    scope.effect([$count], (count) => {
      console.log('Count changed:', count);
    });

    // Cleanup
    return () => scope.dispose();
  }, [scope]);

  return <div>Check console for updates</div>;
}
```

## Complete Example

```tsx
import { atom, Store } from 'kho';
import { KhoProvider, useAtom, useSetAtom } from 'kho/react';

// Define atoms
const $count = atom(0);
const $name = atom('Alice');

// Create store
const store = new Store();

// Counter component
function Counter() {
  const count = useAtom($count);
  const setCount = useSetAtom($count);

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
  const name = useAtom($name);
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
- `children: ReactNode` - Child components

### Hooks

#### `useStore(): Store`

Returns the Kho store from context.

#### `useAtom<T>(atom: Atom<T>): T`

Subscribes to an atom and returns its current value.

#### `useSetAtom<T>(atom: Atom<T>): (value: T) => void`

Returns a function to update an atom's value.

#### `useAtomValue<T>(atom: Atom<T>): [T, (value: T) => void]`

Returns both the atom's value and setter function (like `useState`).

#### `useScope(): Scope`

Creates a scope with lifecycle tied to the component. Automatically disposes when component unmounts.

## Notes

- **Automatic Subscriptions**: Components automatically re-render when atoms change
- **Cleanup**: Scopes created with `useScope()` are automatically disposed on unmount
- **Type Safety**: All hooks are fully typed with TypeScript
- **Zero Dependencies**: Core library has zero runtime dependencies (React is a peer dependency)

## TypeScript

All hooks and components are fully typed:

```tsx
import { Atom } from 'kho';
import { useAtom } from 'kho/react';

const $count: Atom<number> = atom(0);

function Counter() {
  const count: number = useAtom($count); // Type inferred
  // ...
}
```
