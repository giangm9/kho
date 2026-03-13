import { CodeBlock } from '../components/CodeBlock';
import { CodeTabs } from '../components/CodeTabs';

export function GettingStarted() {
  return (
    <article className="prose">
      <h1>Getting Started</h1>
      <p>
        This guide walks you through everything you need to start building apps with Kho.
        Kho separates state management into two layers: <strong>Data</strong> (what your state is)
        and <strong>System</strong> (how your app reacts to changes). This separation keeps your
        code predictable, testable, and easy to reason about.
      </p>

      {/* ================================================
          INSTALLATION
          ================================================ */}
      <h2 id="installation">Installation</h2>
      <p>
        Install Kho with your preferred package manager. It has zero dependencies and works with
        any JavaScript or TypeScript project.
      </p>
      <CodeTabs tabs={[
        { label: 'npm', code: 'npm install kho' },
        { label: 'yarn', code: 'yarn add kho' },
        { label: 'pnpm', code: 'pnpm add kho' },
        { label: 'bun', code: 'bun add kho' },
      ]} />

      {/* ================================================
          YOUR FIRST KHO APP
          ================================================ */}
      <h2 id="first-app">Your First Kho App</h2>
      <p>
        Let's build a simple app step by step. By the end, you'll understand atoms, stores,
        reactive operations, and effects — the four building blocks of every Kho application.
      </p>

      {/* --- Step 1: Atoms --- */}
      <h3>Step 1: Define Atoms</h3>
      <p>
        An <strong>atom</strong> is the smallest unit of state in Kho. Think of it as a named
        container for a single value. Atoms are created outside of any component or function —
        they are <em>definitions</em>, not values. The actual value lives inside a store (more on
        that in Step 2).
      </p>
      <p>
        By convention, atom names start with a <code>$</code> prefix. This makes it easy to
        distinguish state definitions from regular variables at a glance.
      </p>
      <CodeBlock
        code={`import { atom } from 'kho';

// A simple number atom with initial value 0
const $count = atom(0);

// A typed atom that starts as null
const $currentUser = atom<User | null>(null);

// An atom holding an array
const $todos = atom<string[]>([]);

// Atoms are just definitions — no value is stored yet.
// You need a store to hold actual values.`}
        title="atoms.ts"
      />
      <p>
        The argument you pass to <code>atom()</code> is the <strong>initial value</strong>. When
        a store first reads this atom, it uses this value as the starting point. You can create
        as many atoms as you need — they are lightweight and cheap to create.
      </p>

      {/* --- Step 2: Store & Reactive --- */}
      <h3>Step 2: Create a Store and Reactive Operations</h3>
      <p>
        A <strong>store</strong> is the container that holds all your state values. You create one
        with <code>createStore()</code>. Most apps only need a single store, but you can create
        multiple stores if you need isolated state (for example, in tests).
      </p>
      <p>
        To read and write atom values, you create a <strong>reactive</strong> scope
        with <code>reactive(store)</code>. This gives you namespaced operations
        for <code>atoms</code>, <code>sets</code>, and <code>maps</code>.
      </p>
      <CodeBlock
        code={`import { createStore, reactive, atom } from 'kho';

const $count = atom(0);
const $name = atom('world');

// 1. Create a store — this holds all state
const store = createStore();

// 2. Create a reactive scope — this is how you read/write state
const { atoms } = reactive(store);

// Read an atom's value
console.log(atoms.get($count));  // 0 (the initial value)
console.log(atoms.get($name));   // 'world'

// Write a new value
atoms.set($count, 10);
console.log(atoms.get($count));  // 10

// Update based on current value
atoms.set($count, atoms.get($count)! + 1);
console.log(atoms.get($count));  // 11`}
        title="store.ts"
      />
      <p>
        Notice that <code>atoms.get()</code> returns the value directly — there is no
        subscription happening here. The reactive scope simply provides a convenient way
        to interact with the store. Subscriptions happen through effects (Step 3).
      </p>

      {/* --- Step 3: Effects --- */}
      <h3>Step 3: Add Effects</h3>
      <p>
        Effects are where the magic happens. <code>effects(store)</code> gives you reactive
        primitives that automatically run when their dependencies change. The three most important
        ones are:
      </p>
      <ul>
        <li>
          <strong><code>effect(atoms, callback)</code></strong> — runs the callback whenever any of the
          watched atoms change. Also runs once immediately when created.
        </li>
        <li>
          <strong><code>compute(sources, target, fn)</code></strong> — derives a value from one or more
          source atoms and writes it to a target atom. Automatically stays in sync.
        </li>
        <li>
          <strong><code>batch(fn)</code></strong> — groups multiple state changes into a single
          notification. Effects only fire once after the batch completes, not once per change.
        </li>
      </ul>
      <CodeBlock
        code={`import { atom, createStore, reactive, effects } from 'kho';

const $count = atom(0);
const $doubled = atom(0);

const store = createStore();
const { atoms } = reactive(store);
const { effect, compute, batch } = effects(store);

// Derived state: $doubled always equals $count * 2
compute([$count], $doubled, (count) => count * 2);

// Side effect: log whenever $count changes
effect([$count], () => {
  console.log('Count is now:', atoms.get($count));
  console.log('Doubled is:', atoms.get($doubled));
});

// Single update — triggers both the effect and compute
atoms.set($count, 5);
// Logs: "Count is now: 5"
// Logs: "Doubled is: 10"

// Batch multiple updates — effects fire only once at the end
batch(() => {
  atoms.set($count, 100);
  // If you had more atoms to update, do it here.
  // Effects won't fire until the batch is done.
});
// Logs: "Count is now: 100"
// Logs: "Doubled is: 200"`}
        title="effects.ts"
      />
      <p>
        Effects also support <strong>cleanup functions</strong>. If your effect callback returns a
        function, that function is called before the effect re-runs and when the effect is disposed.
        This is useful for cleaning up event listeners, timers, or subscriptions.
      </p>
      <CodeBlock
        code={`effect([$url], () => {
  const controller = new AbortController();

  fetch(atoms.get($url)!, { signal: controller.signal })
    .then(res => res.json())
    .then(data => atoms.set($data, data));

  // Cleanup: abort the fetch if $url changes before it completes
  return () => controller.abort();
});`}
        title="Effect cleanup"
      />

      {/* --- Step 4: Full Working Example --- */}
      <h3>Step 4: Full Working Example</h3>
      <p>
        Here is a complete vanilla TypeScript example that ties everything together. It creates a
        simple todo list manager with computed state and reactive logging.
      </p>
      <CodeBlock
        code={`import { atom, createStore, reactive, effects } from 'kho';

// --- Define atoms ---
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const $todos = atom<Todo[]>([]);
const $filter = atom<'all' | 'active' | 'done'>('all');
const $filteredTodos = atom<Todo[]>([]);
const $stats = atom({ total: 0, active: 0, done: 0 });

// --- Set up store ---
const store = createStore();
const { atoms } = reactive(store);
const { effect, compute, batch } = effects(store);

// --- Derived state ---
// Compute filtered todos whenever $todos or $filter changes
compute([$todos, $filter], $filteredTodos, (todos, filter) => {
  if (filter === 'all') return todos;
  if (filter === 'active') return todos.filter(t => !t.done);
  return todos.filter(t => t.done);
});

// Compute stats whenever $todos changes
compute([$todos], $stats, (todos) => ({
  total: todos.length,
  active: todos.filter(t => !t.done).length,
  done: todos.filter(t => t.done).length,
}));

// --- Side effects ---
effect([$stats], () => {
  const stats = atoms.get($stats)!;
  console.log(\`📋 \${stats.total} todos: \${stats.active} active, \${stats.done} done\`);
});

effect([$filteredTodos], () => {
  const todos = atoms.get($filteredTodos)!;
  console.log('Visible todos:', todos.map(t => t.text));
});

// --- Use it ---
let nextId = 1;
function addTodo(text: string) {
  const todos = atoms.get($todos)!;
  atoms.set($todos, [...todos, { id: nextId++, text, done: false }]);
}

function toggleTodo(id: number) {
  const todos = atoms.get($todos)!;
  atoms.set($todos, todos.map(t =>
    t.id === id ? { ...t, done: !t.done } : t
  ));
}

// Add some todos
addTodo('Learn Kho');
addTodo('Build an app');
addTodo('Ship it');

// Toggle one
toggleTodo(1);

// Batch: toggle + change filter in one go
batch(() => {
  toggleTodo(2);
  atoms.set($filter, 'active');
});
// Effects fire once: shows only active todos`}
        title="todo-app.ts"
      />

      {/* ================================================
          REACT INTEGRATION
          ================================================ */}
      <h2 id="react">React Integration</h2>
      <p>
        Kho provides first-class React bindings through <code>kho/react</code>. The integration
        follows familiar React patterns: a provider wraps your app, and hooks let you read and
        write atoms inside components. Components automatically re-render when the atoms they
        subscribe to change.
      </p>

      {/* --- React Setup --- */}
      <h3>Setup</h3>
      <p>
        Wrap your app with <code>KhoProvider</code> and pass it a store. Inside any child
        component, use the <code>useAtom</code> hook — it works just like
        React's <code>useState</code> but the state is shared across all components.
      </p>
      <CodeBlock
        code={`import { atom, createStore } from 'kho';
import { KhoProvider, useAtom } from 'kho/react';

// Define atoms outside components (they are just definitions)
const $count = atom(0);

// Create one store for the whole app
const store = createStore();

function Counter() {
  // useAtom returns [value, setter] — just like useState
  const [count, setCount] = useAtom($count);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
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

export default App;`}
        title="App.tsx"
      />
      <p>
        The setter from <code>useAtom</code> also supports updater functions, just like
        React's <code>useState</code>:
      </p>
      <CodeBlock
        code={`const [count, setCount] = useAtom($count);

// Direct value
setCount(42);

// Updater function (receives current value)
setCount(prev => prev + 1);`}
        title="Updater functions"
      />

      {/* --- Shared State --- */}
      <h3>Multiple Components Sharing State</h3>
      <p>
        The real power of Kho shows up when multiple components read the same atom. They all
        stay in sync automatically — when one component updates the atom, every other component
        that reads it re-renders with the new value.
      </p>
      <CodeBlock
        code={`import { atom, createStore } from 'kho';
import { KhoProvider, useAtom, useAtomValue, useSetAtom } from 'kho/react';

const $count = atom(0);
const store = createStore();

// This component can both read and write
function CounterControls() {
  const [count, setCount] = useAtom($count);
  return (
    <div>
      <button onClick={() => setCount(count - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}

// This component only reads — it re-renders when $count changes
function CounterDisplay() {
  const count = useAtomValue($count);
  return <h2>The count is {count}</h2>;
}

// This component only writes — it NEVER re-renders when $count changes
function ResetButton() {
  const setCount = useSetAtom($count);
  return <button onClick={() => setCount(0)}>Reset</button>;
}

function App() {
  return (
    <KhoProvider store={store}>
      <CounterDisplay />
      <CounterControls />
      <ResetButton />
    </KhoProvider>
  );
}`}
        title="SharedState.tsx"
      />
      <p>
        Notice the three hooks available for different use cases:
      </p>
      <ul>
        <li><code>useAtom($atom)</code> — read + write, re-renders on change</li>
        <li><code>useAtomValue($atom)</code> — read only, re-renders on change</li>
        <li><code>useSetAtom($atom)</code> — write only, <strong>never</strong> re-renders</li>
      </ul>
      <p>
        Using <code>useSetAtom</code> for components that only need to write state is a
        simple performance optimization — the component won't re-render when the atom changes.
      </p>

      {/* --- Systems with React --- */}
      <h3>Systems with React</h3>
      <p>
        For logic that lives outside of React components (data fetching, real-time sync,
        game loops, etc.), Kho provides <strong>systems</strong>. A system is a function
        that sets up effects and reactive operations. You pass systems
        to <code>KhoProvider</code> and they start automatically.
      </p>
      <CodeBlock
        code={`import { atom, createStore, reactive, effects, system } from 'kho';
import { KhoProvider, useAtom } from 'kho/react';

const $seconds = atom(0);

// A system that counts seconds
const timerSystem = system((scope) => {
  // scope(effects) gives you effects tied to the store, with auto-cleanup
  const { effect, interval } = scope(effects);
  const { atoms } = scope(reactive);

  // interval is managed by the system — it stops when the system disposes
  interval(1000, () => {
    atoms.set($seconds, atoms.get($seconds)! + 1);
  });

  effect([$seconds], () => {
    const s = atoms.get($seconds)!;
    if (s > 0 && s % 60 === 0) {
      console.log(\`\${s / 60} minute(s) elapsed\`);
    }
  });
});

const store = createStore();

function Timer() {
  const [seconds] = useAtom($seconds);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return <p>{mins}:{secs.toString().padStart(2, '0')}</p>;
}

function App() {
  return (
    <KhoProvider store={store} systems={[timerSystem]}>
      <Timer />
    </KhoProvider>
  );
}`}
        title="SystemsWithReact.tsx"
      />
      <p>
        Systems created with <code>system()</code> use a <code>scope</code> helper that
        automatically manages cleanup. When the <code>KhoProvider</code> unmounts, all
        systems are disposed — effects stop, intervals are cleared, and any custom cleanup
        runs. You never have to worry about memory leaks.
      </p>

      {/* ================================================
          VUE INTEGRATION
          ================================================ */}
      <h2 id="vue">Vue Integration</h2>
      <p>
        Kho integrates with Vue 3's Composition API through <code>kho/vue</code>. The API
        mirrors the React integration: provide a store at the root, then use composables
        in any component.
      </p>

      {/* --- Vue Setup --- */}
      <h3>Setup</h3>
      <p>
        Call <code>provideStore()</code> in your root component's <code>setup()</code> to make
        the store available to all child components. Then use <code>useAtom()</code> to read
        and write atoms — it returns a reactive <code>Ref</code> that Vue tracks automatically.
      </p>
      <CodeBlock
        code={`<!-- App.vue -->
<script setup>
import { createStore } from 'kho';
import { provideStore } from 'kho/vue';

const store = createStore();
provideStore(store);
</script>

<template>
  <Counter />
</template>`}
        title="App.vue"
      />
      <CodeBlock
        code={`<!-- Counter.vue -->
<script setup>
import { atom } from 'kho';
import { useAtom } from 'kho/vue';

const $count = atom(0);
const [count, setCount] = useAtom($count);
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="setCount(count + 1)">Increment</button>
    <button @click="setCount(count - 1)">Decrement</button>
    <button @click="setCount(0)">Reset</button>
  </div>
</template>`}
        title="Counter.vue"
      />
      <p>
        In Vue, <code>useAtom()</code> returns a read-only <code>Ref</code> for the value
        and a setter function. The Ref updates automatically when the atom changes, so Vue's
        reactivity system picks it up and re-renders the template.
      </p>

      {/* --- Vue Composition API --- */}
      <h3>Composition API</h3>
      <p>
        You can use Kho composables freely inside <code>setup()</code> functions. Here is a
        more complete example showing multiple atoms, computed state, and effects.
      </p>
      <CodeBlock
        code={`<script setup>
import { atom, effects } from 'kho';
import {
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
  useEffects,
} from 'kho/vue';

// Atoms
const $firstName = atom('');
const $lastName = atom('');
const $fullName = atom('');

// Read/write
const [firstName, setFirstName] = useAtom($firstName);
const [lastName, setLastName] = useAtom($lastName);

// Read-only
const fullName = useAtomValue($fullName);

// Get the effects API for this store
const { compute } = useEffects();

// Derived state: fullName = firstName + lastName
compute(
  [$firstName, $lastName],
  $fullName,
  (first, last) => \`\${first} \${last}\`.trim()
);
</script>

<template>
  <div>
    <input :value="firstName" @input="setFirstName($event.target.value)" placeholder="First" />
    <input :value="lastName" @input="setLastName($event.target.value)" placeholder="Last" />
    <p>Hello, {{ fullName || 'stranger' }}!</p>
  </div>
</template>`}
        title="NameForm.vue"
      />
      <p>
        The available Vue composables mirror the React hooks:
      </p>
      <ul>
        <li><code>useAtom($atom)</code> — reactive ref + setter</li>
        <li><code>useAtomValue($atom)</code> — reactive ref (read-only)</li>
        <li><code>useSetAtom($atom)</code> — setter only (no reactivity overhead)</li>
        <li><code>useReactive()</code> — get the full reactive scope</li>
        <li><code>useEffects()</code> — get the effects API</li>
        <li><code>useBatch()</code> — get a batch function</li>
      </ul>
      <p>
        You can also pass systems when providing the store, just like in React:
      </p>
      <CodeBlock
        code={`// App.vue setup
import { provideStore } from 'kho/vue';
provideStore(store, [timerSystem, syncSystem]);`}
        title="Vue systems"
      />

      {/* ================================================
          PROJECT STRUCTURE
          ================================================ */}
      <h2>Project Structure Recommendations</h2>
      <p>
        As your app grows, a clear file structure helps keep things manageable. Here is a
        recommended layout that works well for most Kho projects.
      </p>
      <CodeBlock
        code={`src/
├── state/
│   ├── atoms.ts          # All atom definitions
│   ├── store.ts          # Store creation and export
│   └── systems/
│       ├── auth.ts       # Auth system (login, token refresh)
│       ├── sync.ts       # Data sync system (websocket, polling)
│       └── index.ts      # Re-export all systems
├── components/
│   ├── App.tsx           # KhoProvider + systems
│   ├── Counter.tsx
│   └── TodoList.tsx
└── main.tsx              # Entry point`}
        title="Project layout"
      />
      <p>
        Key principles:
      </p>
      <ul>
        <li>
          <strong>Atoms live in one place.</strong> Put all your atom definitions
          in <code>state/atoms.ts</code> (or split by domain: <code>state/atoms/auth.ts</code>,
          etc.). This makes it easy to see all your app's state at a glance.
        </li>
        <li>
          <strong>Systems are separate from components.</strong> Systems contain logic that
          doesn't belong in the UI layer — data fetching, validation, syncing. Keep them
          in <code>state/systems/</code>.
        </li>
        <li>
          <strong>One store per app.</strong> Create the store in <code>state/store.ts</code> and
          import it where needed. Most apps only need one store.
        </li>
        <li>
          <strong>Components only use hooks/composables.</strong> Components should
          use <code>useAtom</code>, <code>useAtomValue</code>, etc. They should not
          call <code>reactive()</code> or <code>effects()</code> directly — that's what systems are for.
        </li>
      </ul>

      {/* ================================================
          TYPESCRIPT TIPS
          ================================================ */}
      <h2 id="typescript">TypeScript Tips</h2>
      <p>
        Kho is written in TypeScript and provides full type safety out of the box. Here are
        some tips to get the most out of it.
      </p>

      <h3>Typing Atoms</h3>
      <p>
        Atom types are inferred from the initial value. For complex types or atoms
        that start as <code>null</code>, provide a type parameter explicitly.
      </p>
      <CodeBlock
        code={`import { atom } from 'kho';

// Type inferred as Atom<number>
const $count = atom(0);

// Type inferred as Atom<string>
const $name = atom('');

// Explicit type needed — starts as null but will hold a User
interface User {
  id: string;
  name: string;
  email: string;
}
const $currentUser = atom<User | null>(null);

// Explicit type for arrays (inferred as never[] without it)
const $tags = atom<string[]>([]);

// Complex nested types work fine
interface AppSettings {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}
const $settings = atom<AppSettings>({
  theme: 'light',
  language: 'en',
  notifications: true,
});`}
        title="Typed atoms"
      />

      <h3>Generic Components</h3>
      <p>
        You can build reusable React components that work with any atom type by using generics.
      </p>
      <CodeBlock
        code={`import { Atom } from 'kho';
import { useAtom } from 'kho/react';

// A generic text input bound to any string atom
function AtomInput({ atom, label }: { atom: Atom<string>; label: string }) {
  const [value, setValue] = useAtom(atom);
  return (
    <label>
      {label}
      <input value={value} onChange={e => setValue(e.target.value)} />
    </label>
  );
}

// Usage
const $firstName = atom('');
const $lastName = atom('');

function Form() {
  return (
    <div>
      <AtomInput atom={$firstName} label="First Name" />
      <AtomInput atom={$lastName} label="Last Name" />
    </div>
  );
}`}
        title="GenericComponent.tsx"
      />

      <h3>Type Inference with Effects</h3>
      <p>
        The <code>compute</code> function automatically infers the types of source values
        passed to the transform function. Each argument corresponds to the type of the
        respective source atom.
      </p>
      <CodeBlock
        code={`import { atom, createStore, reactive, effects } from 'kho';

const $price = atom(29.99);           // Atom<number>
const $quantity = atom(1);            // Atom<number>
const $coupon = atom<string | null>(null); // Atom<string | null>

const store = createStore();
const { atoms } = reactive(store);
const { compute } = effects(store);

const $total = atom(0);

// TypeScript knows: price is number, qty is number, coupon is string | null
compute([$price, $quantity, $coupon], $total, (price, qty, coupon) => {
  const subtotal = price * qty;
  if (coupon === 'HALF') return subtotal * 0.5;
  return subtotal;
});

// Effect callbacks have no parameters — read atoms explicitly
const $summary = atom('');
compute([$total, $quantity], $summary, (total, qty) => {
  return \`\${qty} item(s) — $\${total.toFixed(2)}\`;
});`}
        title="Type inference"
      />
      <p>
        Because Kho's API is minimal and consistent, TypeScript integration is straightforward.
        If you define your atoms with the correct types, everything downstream — effects, hooks,
        and components — picks up those types automatically.
      </p>
    </article>
  );
}
