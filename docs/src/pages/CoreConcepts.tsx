import { CodeBlock } from '../components/CodeBlock';

export function CoreConcepts() {
  return (
    <article className="prose">
      <h1>Core Concepts</h1>
      <p>
        Kho is a data-driven state management library built around a small set of composable
        primitives. This page covers every core concept in detail, from the smallest unit of
        state (an atom) all the way up to full system orchestration and ECS.
      </p>

      {/* ========================================== */}
      {/* 1. ATOMS */}
      {/* ========================================== */}

      <h2 id="atoms">1. Atoms</h2>
      <p>
        Atoms are the fundamental state containers in Kho. Each atom holds a single value and
        acts as a reactive cell: when the value changes, any effects watching that atom are
        notified automatically. Atoms are <strong>store-scoped</strong>, meaning the same atom
        definition can hold different values in different stores. This is what makes testing,
        SSR, and multi-tenant architectures trivial.
      </p>
      <p>
        Atoms are created outside of any system or store. They are <strong>definitions</strong>,
        not instances. The actual value lives inside a store and is lazily initialized the first
        time it is accessed.
      </p>

      <h3>atom() — static initial value</h3>
      <p>
        Use <code>atom(initialValue)</code> for values that are cheap to create and can be
        shared across stores. Under the hood, <code>atom</code> wraps <code>atomWithFactory</code>{' '}
        with a closure that returns the provided value.
      </p>
      <CodeBlock
        title="Creating atoms with static values"
        code={`import { atom } from 'kho';

// Primitives
const $count = atom(0);
const $name = atom('untitled');
const $isActive = atom(false);

// Nullable objects
const $user = atom<User | null>(null);
const $selectedId = atom<string | null>(null);

// Complex types with explicit generics
const $scores = atom<number[]>([]);
const $config = atom<AppConfig>({ theme: 'dark', locale: 'en' });`}
      />

      <h3>atomWithFactory() — lazy initialization</h3>
      <p>
        Use <code>atomWithFactory(factory)</code> when the initial value is expensive to create
        or when each store needs its own unique instance (e.g., a <code>Map</code> or{' '}
        <code>Set</code>). The factory runs <strong>once per store</strong>, the first time
        the atom is accessed in that store.
      </p>
      <CodeBlock
        title="Creating atoms with factory functions"
        code={`import { atomWithFactory } from 'kho';

// Each store gets its own Map instance
const $cache = atomWithFactory(() => new Map<string, Data>());

// Each store gets its own Set instance
const $tags = atomWithFactory(() => new Set<string>());

// Expensive initialization deferred until first access
const $heavyData = atomWithFactory(() => {
  return computeExpensiveInitialState();
});`}
      />

      <h3>The $ prefix convention</h3>
      <p>
        By convention, all atoms, signals, and components are prefixed with <code>$</code>.
        This makes it immediately clear which variables are reactive definitions versus plain
        values. It also prevents naming collisions — <code>$count</code> is the atom,
        while <code>count</code> can be the local value read from it.
      </p>
      <CodeBlock
        title="$ prefix convention"
        code={`// Atoms
const $health = atom(100);
const $position = atom({ x: 0, y: 0 });

// Signals
const $damage = signal<{ amount: number }>();

// Components (ECS)
const $velocity = component<{ vx: number; vy: number }>();

// In a system, the $ prefix distinguishes atom from value:
const health = atoms.get($health);   // number
const position = atoms.get($position); // { x, y }`}
      />

      {/* ========================================== */}
      {/* 2. STORE */}
      {/* ========================================== */}

      <h2 id="store">2. Store</h2>
      <p>
        A store is the runtime container for all state. It is a lightweight identity object
        that atoms, effects, and signals use as a key to look up their per-store instances.
        You create a store with <code>createStore()</code>, then pass it to reactive APIs.
      </p>
      <p>
        The store itself holds no data directly — atom values are stored in WeakMaps keyed
        by the store object. This means when a store is garbage-collected, all of its state
        is automatically cleaned up.
      </p>

      <h3>createStore()</h3>
      <CodeBlock
        title="Creating a store"
        code={`import { createStore } from 'kho';

// Basic store
const store = createStore();

// Named store (useful for debugging)
const store = createStore('GameStore');`}
      />

      <h3>Why you need a store</h3>
      <p>
        <strong>Dependency injection:</strong> Systems receive a store and operate on it. You
        can swap the store to change the entire state context without modifying any system code.
      </p>
      <p>
        <strong>Testing:</strong> Each test creates a fresh store, ensuring complete isolation.
        No global state leaks between tests.
      </p>
      <p>
        <strong>SSR (Server-Side Rendering):</strong> Each request gets its own store. Multiple
        requests in flight simultaneously never share state.
      </p>
      <p>
        <strong>Multi-tenant:</strong> Run multiple independent instances of your application
        in the same process, each with its own store.
      </p>
      <CodeBlock
        title="Store isolation for testing"
        code={`import { createStore, atom, reactive } from 'kho';

const $count = atom(0);

// Test A — completely isolated
const storeA = createStore('TestA');
const rA = reactive(storeA);
rA.atoms.set($count, 10);

// Test B — completely isolated
const storeB = createStore('TestB');
const rB = reactive(storeB);
rB.atoms.get($count); // 0, not 10`}
      />

      {/* ========================================== */}
      {/* 3. REACTIVE */}
      {/* ========================================== */}

      <h2 id="reactive">3. Reactive (Data Operations)</h2>
      <p>
        <code>reactive(store)</code> is the data access layer. It returns an object with
        three namespaces — <code>atoms</code>, <code>sets</code>, and <code>maps</code> —
        plus a <code>dispose</code> function. Every mutation through reactive automatically
        notifies subscribers; you never call listeners manually.
      </p>
      <CodeBlock
        title="Destructuring reactive"
        code={`import { reactive } from 'kho';

const { atoms, sets, maps, dispose } = reactive(store);`}
      />

      <h3>atoms namespace</h3>
      <p>
        The <code>atoms</code> namespace provides three operations for working with any atom:
      </p>
      <ul>
        <li><code>get(atom)</code> — Read the current value. Returns <code>T | undefined</code>. Lazily initializes the atom if this is the first access.</li>
        <li><code>set(atom, value)</code> — Write a new value and notify all listeners.</li>
        <li><code>notify(atom)</code> — Manually trigger notifications without changing the value. Useful when you mutate the value in-place (e.g., modifying a WeakMap entry).</li>
      </ul>
      <CodeBlock
        title="Atom operations"
        code={`const $count = atom(0);
const $user = atom<User | null>(null);

const { atoms } = reactive(store);

// Read
const count = atoms.get($count);    // 0
const user = atoms.get($user);      // null

// Write (notifies all effects watching $count)
atoms.set($count, 10);
atoms.set($user, { name: 'Alice', age: 30 });

// Manual notify (for in-place mutations)
// Useful with WeakMap-backed data like ECS components
atoms.notify($someAtom);`}
      />

      <h3>sets namespace</h3>
      <p>
        The <code>sets</code> namespace provides immutable Set operations for atoms typed as{' '}
        <code>Atom&lt;Set&lt;T&gt;&gt;</code>. Every operation creates a new Set and notifies
        subscribers, ensuring proper reactivity.
      </p>
      <ul>
        <li><code>add(atom, item)</code> — Add an item to the set.</li>
        <li><code>remove(atom, item)</code> — Remove an item from the set.</li>
        <li><code>has(atom, item)</code> — Check if the set contains an item.</li>
        <li><code>clear(atom)</code> — Replace the set with an empty one.</li>
        <li><code>size(atom)</code> — Get the number of items.</li>
        <li><code>values(atom)</code> — Get all items as an array.</li>
      </ul>
      <CodeBlock
        title="Set operations"
        code={`import { atom, reactive } from 'kho';

const $tags = atom(new Set<string>());
const { sets } = reactive(store);

sets.add($tags, 'typescript');
sets.add($tags, 'reactive');
sets.add($tags, 'ecs');

sets.has($tags, 'typescript');    // true
sets.size($tags);                 // 3
sets.values($tags);               // ['typescript', 'reactive', 'ecs']

sets.remove($tags, 'ecs');
sets.size($tags);                 // 2

sets.clear($tags);
sets.size($tags);                 // 0`}
      />

      <h3>maps namespace</h3>
      <p>
        The <code>maps</code> namespace provides immutable Map operations for atoms typed as{' '}
        <code>Atom&lt;Map&lt;K, V&gt;&gt;</code>. Like the sets namespace, every mutation
        creates a new Map for proper reactivity.
      </p>
      <ul>
        <li><code>set(atom, key, value)</code> — Set a key-value pair.</li>
        <li><code>get(atom, key)</code> — Get the value for a key.</li>
        <li><code>delete(atom, key)</code> — Remove a key-value pair.</li>
        <li><code>has(atom, key)</code> — Check if a key exists.</li>
        <li><code>clear(atom)</code> — Replace the map with an empty one.</li>
        <li><code>size(atom)</code> — Get the number of entries.</li>
        <li><code>keys(atom)</code> — Get all keys as an array.</li>
        <li><code>values(atom)</code> — Get all values as an array.</li>
        <li><code>entries(atom)</code> — Get all entries as <code>[K, V][]</code>.</li>
      </ul>
      <CodeBlock
        title="Map operations"
        code={`import { atom, reactive } from 'kho';

const $scores = atom(new Map<string, number>());
const { maps } = reactive(store);

maps.set($scores, 'alice', 100);
maps.set($scores, 'bob', 85);
maps.set($scores, 'charlie', 92);

maps.get($scores, 'alice');        // 100
maps.has($scores, 'bob');          // true
maps.size($scores);                // 3

maps.keys($scores);                // ['alice', 'bob', 'charlie']
maps.values($scores);              // [100, 85, 92]
maps.entries($scores);             // [['alice', 100], ['bob', 85], ['charlie', 92]]

maps.delete($scores, 'bob');
maps.size($scores);                // 2

maps.clear($scores);
maps.size($scores);                // 0`}
      />

      {/* ========================================== */}
      {/* 4. EFFECTS */}
      {/* ========================================== */}

      <h2 id="effects">4. Effects (Reactions)</h2>
      <p>
        <code>effects(store)</code> is the reaction layer. It returns utilities for responding
        to atom changes, computing derived values, batching updates, and managing timers. All
        effects are automatically cleaned up when <code>dispose()</code> is called.
      </p>
      <CodeBlock
        title="Destructuring effects"
        code={`import { effects } from 'kho';

const {
  effect,     // react to atom changes
  compute,    // derived atom
  batch,      // group multiple writes
  debounce,   // debounced reaction
  throttle,   // throttled reaction
  interval,   // auto-cleanup setInterval
  timeout,    // auto-cleanup setTimeout
  onDispose,  // register custom cleanup
  dispose,    // cleanup everything
} = effects(store);`}
      />

      <h3>effect(deps, fn) — react to changes</h3>
      <p>
        <code>effect</code> watches one or more atoms and runs the callback whenever any of
        them change. The callback runs <strong>immediately once</strong> on creation (the
        initial run), then again on every subsequent change.
      </p>
      <p>
        The callback can optionally return a cleanup function, which runs before the next
        invocation and on dispose. This is useful for cleaning up subscriptions, DOM listeners,
        or other side effects.
      </p>
      <CodeBlock
        title="Basic effect"
        code={`const { atoms } = reactive(store);
const { effect } = effects(store);

// Simple effect — runs on every change to $count
effect([$count], () => {
  console.log('Count is now:', atoms.get($count));
});

// Effect with cleanup — cleanup runs before re-execution
effect([$url], () => {
  const controller = new AbortController();
  fetch(atoms.get($url)!, { signal: controller.signal })
    .then(r => r.json())
    .then(data => atoms.set($data, data));

  // Returned function runs before next execution or on dispose
  return () => controller.abort();
});

// Watching multiple atoms
effect([$firstName, $lastName], () => {
  const first = atoms.get($firstName);
  const last = atoms.get($lastName);
  console.log(\`Full name: \${first} \${last}\`);
});`}
      />

      <h3>compute(sources, target, fn) — derived atoms</h3>
      <p>
        <code>compute</code> creates a derived atom that automatically updates when its source
        atoms change. The computation function receives the current values of all source atoms
        and returns the new value for the target atom.
      </p>
      <CodeBlock
        title="Computed values"
        code={`const $a = atom(10);
const $b = atom(20);
const $sum = atom(0);
const $product = atom(0);
const $label = atom('');

const { compute } = effects(store);

// Simple derivation
compute([$a, $b], $sum, (a, b) => a + b);
// $sum is now 30

// Multiple computed atoms from same sources
compute([$a, $b], $product, (a, b) => a * b);
// $product is now 200

// String derivation
const $firstName = atom('John');
const $lastName = atom('Doe');
const $fullName = atom('');

compute([$firstName, $lastName], $fullName, (first, last) => \`\${first} \${last}\`);
// $fullName is now 'John Doe'`}
      />

      <h3>batch(fn) — group writes</h3>
      <p>
        <code>batch</code> groups multiple atom writes into a single notification cycle. Without
        batching, each <code>atoms.set()</code> triggers effects immediately. With batching,
        effects run only once after all writes complete. Batching works{' '}
        <strong>across systems</strong> sharing the same store.
      </p>
      <CodeBlock
        title="Batching updates"
        code={`const { atoms } = reactive(store);
const { effect, batch } = effects(store);

const $x = atom(0);
const $y = atom(0);
const $z = atom(0);

// This effect watches all three atoms
effect([$x, $y, $z], () => {
  console.log('Position:', atoms.get($x), atoms.get($y), atoms.get($z));
});

// WITHOUT batch: effect runs 3 times
atoms.set($x, 1);  // effect fires
atoms.set($y, 2);  // effect fires
atoms.set($z, 3);  // effect fires

// WITH batch: effect runs once
batch(() => {
  atoms.set($x, 10);
  atoms.set($y, 20);
  atoms.set($z, 30);
});
// effect fires once with all new values`}
      />

      <h3>debounce(deps, ms, fn) — debounced reaction</h3>
      <p>
        <code>debounce</code> delays execution until no changes have occurred for the
        specified duration. Ideal for search-as-you-type, auto-save, and other scenarios
        where you want to wait for the user to "settle."
      </p>
      <CodeBlock
        title="Debounced effect"
        code={`const $searchQuery = atom('');

const { debounce } = effects(store);
const { atoms } = reactive(store);

// Wait 300ms after the last keystroke before searching
debounce([$searchQuery], 300, () => {
  const query = atoms.get($searchQuery)!;
  if (query.length > 2) {
    fetchSearchResults(query);
  }
});

// Auto-save after 1 second of inactivity
const $document = atom<DocContent | null>(null);

debounce([$document], 1000, () => {
  const doc = atoms.get($document);
  if (doc) saveToServer(doc);
});`}
      />

      <h3>throttle(deps, ms, fn) — throttled reaction</h3>
      <p>
        <code>throttle</code> ensures the callback runs at most once per time window, with
        a trailing call if changes occurred during the cooldown. Ideal for scroll handlers,
        resize observers, and frame-rate-limited updates.
      </p>
      <CodeBlock
        title="Throttled effect"
        code={`const $scrollY = atom(0);
const $mousePos = atom({ x: 0, y: 0 });

const { throttle } = effects(store);
const { atoms } = reactive(store);

// Update UI at most every 16ms (~60fps)
throttle([$scrollY], 16, () => {
  updateScrollIndicator(atoms.get($scrollY)!);
});

// Throttle analytics events
throttle([$mousePos], 500, () => {
  const pos = atoms.get($mousePos)!;
  trackHeatmap(pos.x, pos.y);
});`}
      />

      <h3>interval and timeout — auto-cleanup timers</h3>
      <p>
        <code>interval(ms, fn)</code> and <code>timeout(ms, fn)</code> are wrappers around{' '}
        <code>setInterval</code> and <code>setTimeout</code> that are automatically cleared
        on dispose. No more forgotten timers leaking memory.
      </p>
      <CodeBlock
        title="Auto-cleanup timers"
        code={`const { interval, timeout } = effects(store);

// Tick every second — automatically cleared on dispose
interval(1000, () => {
  atoms.set($elapsed, atoms.get($elapsed)! + 1);
});

// One-shot after 5 seconds — automatically cleared on dispose
timeout(5000, () => {
  atoms.set($showWelcome, false);
});

// Game loop at ~60fps
interval(16, () => {
  updatePhysics();
  render();
});`}
      />

      <h3>onDispose(fn) — custom cleanup</h3>
      <p>
        <code>onDispose</code> registers a callback that runs when the effects scope is
        disposed. Use it for any cleanup that does not fit into an effect's return value,
        such as removing DOM event listeners or closing connections.
      </p>
      <CodeBlock
        title="Custom cleanup with onDispose"
        code={`const { onDispose } = effects(store);

// WebSocket cleanup
const ws = new WebSocket('wss://example.com');
onDispose(() => ws.close());

// DOM listener cleanup
const handler = (e: MouseEvent) => { /* ... */ };
document.addEventListener('click', handler);
onDispose(() => document.removeEventListener('click', handler));

// Custom resource cleanup
const db = openDatabase();
onDispose(() => db.close());`}
      />

      {/* ========================================== */}
      {/* 5. SIGNALS */}
      {/* ========================================== */}

      <h2 id="signals">5. Signals (Events)</h2>
      <p>
        Signals are fire-and-forget events for loose coupling between systems. Unlike atoms,
        signals <strong>do not store a value</strong>. They exist only to dispatch a payload
        to all registered handlers at the moment of emission. Once emitted, the payload is gone.
      </p>
      <p>
        This makes signals ideal for cross-system communication where you want to decouple
        the sender from the receiver. The emitting system does not need to know who is
        listening, and listeners do not need to know who is emitting.
      </p>

      <h3>signal() — create a typed event</h3>
      <p>
        <code>signal&lt;T&gt;()</code> creates a signal definition with a typed payload. Like
        atoms, signals are definitions — they become active per-store.
      </p>
      <CodeBlock
        title="Defining signals"
        code={`import { signal } from 'kho';

// Signal with a typed payload
const $damage = signal<{ target: string; amount: number }>();
const $itemPickup = signal<{ itemId: string; quantity: number }>();
const $levelComplete = signal<{ level: number; score: number }>();

// Signal with no payload (void)
const $reset = signal<void>();
const $pause = signal<void>();`}
      />

      <h3>listen(store) — subscribe and emit</h3>
      <p>
        <code>listen(store)</code> returns <code>{'{ on, emit, dispose }'}</code>. Use{' '}
        <code>on</code> to subscribe to a signal and <code>emit</code> to dispatch a payload
        to all handlers.
      </p>
      <CodeBlock
        title="Listening and emitting signals"
        code={`import { signal, listen, createStore } from 'kho';

const $damage = signal<{ target: string; amount: number }>();
const $death = signal<{ entityId: string }>();

const store = createStore();
const { on, emit, dispose } = listen(store);

// Subscribe to damage events
on($damage, ({ target, amount }) => {
  console.log(\`\${target} took \${amount} damage\`);
});

// Subscribe to death events
on($death, ({ entityId }) => {
  console.log(\`Entity \${entityId} died\`);
});

// Emit from anywhere with the same store
emit($damage, { target: 'player', amount: 25 });
// → "player took 25 damage"

// Multiple handlers on the same signal
on($damage, ({ target, amount }) => {
  playSound('hit');
  showFloatingText(\`-\${amount}\`, target);
});

// Cleanup all subscriptions
dispose();`}
      />

      <h3>Signals vs Atoms</h3>
      <p>
        <strong>Atoms</strong> hold persistent state that can be read at any time. Effects
        react to changes and always have access to the current value.{' '}
        <strong>Signals</strong> are transient events — if no one is listening when a signal
        is emitted, the payload is lost. Use atoms for state, signals for events.
      </p>
      <CodeBlock
        title="When to use atoms vs signals"
        code={`// STATE → use atoms
// "What is the current health?" — readable at any time
const $health = atom(100);

// EVENTS → use signals
// "Something just happened" — transient, fire-and-forget
const $damage = signal<{ amount: number }>();
const $heal = signal<{ amount: number }>();
const $respawn = signal<{ position: { x: number; y: number } }>();`}
      />

      {/* ========================================== */}
      {/* 6. SYSTEMS */}
      {/* ========================================== */}

      <h2 id="systems">6. Systems (Encapsulated Logic)</h2>
      <p>
        A system is a reusable unit of logic that encapsulates effects, signal handlers, and
        state operations. Systems are created with <code>system(setup)</code>, which provides
        a <code>scope()</code> helper for injecting store-bound APIs with automatic cleanup.
      </p>
      <p>
        When a system is disposed, all APIs acquired through <code>scope()</code> are automatically
        disposed in reverse order (LIFO). This means you never have to manually track cleanup —
        the framework handles it.
      </p>

      <h3>system(setup) — create a system</h3>
      <p>
        The setup function receives a <code>scope</code> helper. Call <code>scope(apiFactory)</code>{' '}
        to get a store-bound API instance. The system function itself returns{' '}
        <code>(store) =&gt; dispose</code>, so you can start it by passing a store.
      </p>
      <CodeBlock
        title="Creating a system"
        code={`import { system, reactive, effects, listen } from 'kho';

const healthSystem = system((scope) => {
  // Inject store-bound APIs — automatically disposed
  const { atoms } = scope(reactive);
  const { effect, batch } = scope(effects);
  const { on, emit } = scope(listen);

  // React to damage signals
  on($damage, ({ target, amount }) => {
    const current = atoms.get($health) ?? 100;
    const newHealth = Math.max(0, current - amount);

    batch(() => {
      atoms.set($health, newHealth);
      atoms.set($lastDamageTime, Date.now());
    });

    if (newHealth <= 0) {
      emit($death, { entityId: target });
    }
  });

  // Effect: update UI when health changes
  effect([$health], () => {
    const health = atoms.get($health)!;
    updateHealthBar(health);
  });
});`}
      />

      <h3>Multiple scope() calls</h3>
      <p>
        You can call <code>scope()</code> multiple times with different API factories. Each
        scoped API is independently tracked for disposal.
      </p>
      <CodeBlock
        title="Multiple scope() calls in a system"
        code={`import { system, reactive, effects, listen, world } from 'kho';

const $players = entities();

const gameSystem = system((scope) => {
  // Data operations
  const { atoms, sets } = scope(reactive);

  // Reactive effects and timers
  const { effect, interval, compute } = scope(effects);

  // Signal handling
  const { on, emit } = scope(listen);

  // ECS world
  const ecs = scope(world($players));

  // All four scoped APIs will be auto-disposed
  // in reverse order: ecs → listen → effects → reactive
});

// Start the system
const store = createStore();
const dispose = gameSystem(store);

// Later: dispose everything cleanly
dispose();`}
      />

      <h3>Optional custom cleanup</h3>
      <p>
        The setup function can optionally return a custom cleanup function. This runs{' '}
        <strong>before</strong> scoped APIs are disposed, giving you a chance to do
        custom teardown work.
      </p>
      <CodeBlock
        title="System with custom cleanup"
        code={`const networkSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { onDispose } = scope(effects);

  const ws = new WebSocket('wss://game.example.com');
  ws.onmessage = (e) => {
    atoms.set($serverState, JSON.parse(e.data));
  };

  // Custom cleanup runs first, then scoped APIs dispose
  return () => {
    ws.close();
    console.log('Network system shut down');
  };
});`}
      />

      {/* ========================================== */}
      {/* 7. SYSTEM ORCHESTRATION */}
      {/* ========================================== */}

      <h2 id="orchestration">7. System Orchestration</h2>
      <p>
        <code>ignite(store)</code> manages multiple systems as a group. It watches the{' '}
        <code>$systems</code> atom (a <code>Set&lt;System&gt;</code>) and automatically starts
        systems when they are added and stops them when they are removed.
      </p>

      <h3>$systems atom and ignite()</h3>
      <p>
        The <code>$systems</code> atom is a built-in atom that holds the set of active systems.
        Use the <code>sets</code> namespace from reactive to add and remove systems. When you
        call <code>ignite(store)</code>, it sets up an effect that watches <code>$systems</code>{' '}
        and manages system lifecycles automatically.
      </p>
      <CodeBlock
        title="Basic orchestration"
        code={`import { createStore, reactive, ignite, $systems } from 'kho';

const store = createStore();
const { sets } = reactive(store);

// Register systems before ignition
sets.add($systems, healthSystem);
sets.add($systems, movementSystem);
sets.add($systems, renderSystem);

// Ignite — starts all registered systems
const dispose = ignite(store);`}
      />

      <h3>Dynamic add/remove at runtime</h3>
      <p>
        Systems can be added or removed at any time after ignition. Added systems start
        immediately; removed systems are disposed immediately.
      </p>
      <CodeBlock
        title="Dynamic system management"
        code={`// Start with core systems
sets.add($systems, coreSystem);
sets.add($systems, inputSystem);
const dispose = ignite(store);

// Later: add debug overlay
sets.add($systems, debugSystem);     // auto-starts immediately

// Later: remove debug overlay
sets.remove($systems, debugSystem);  // auto-stops and disposes

// Player enters combat → add combat system
sets.add($systems, combatSystem);

// Player leaves combat → remove it
sets.remove($systems, combatSystem);

// Shutdown everything
dispose(); // disposes all active systems in reverse order`}
      />

      <h3>Auto-start/stop lifecycle</h3>
      <p>
        Internally, <code>ignite</code> uses an effect watching <code>$systems</code>. On
        each change, it diffs the current set against the previous set:
      </p>
      <ul>
        <li><strong>New systems</strong> (in current but not previous) are started by calling <code>system(store)</code>, and their dispose function is stored in the internal <code>$state</code> map.</li>
        <li><strong>Removed systems</strong> (in previous but not current) have their dispose function called, cleaning up all their effects, signal handlers, and timers.</li>
      </ul>

      {/* ========================================== */}
      {/* 8. ECS */}
      {/* ========================================== */}

      <h2 id="ecs">8. ECS (Entity Component System)</h2>
      <p>
        Kho includes a built-in Entity Component System for game development and similar
        data-oriented architectures. The ECS follows the classic pattern: entities are IDs,
        components are data columns, and systems contain the logic.
      </p>

      <h3>component() and componentWithFactory()</h3>
      <p>
        Components define the data schema for entities. Under the hood, each component is an
        atom holding a <code>WeakMap&lt;Entity, T&gt;</code>, which means entity data is
        automatically garbage-collected when the entity object is no longer referenced.
      </p>
      <CodeBlock
        title="Defining components"
        code={`import { component, componentWithFactory } from 'kho';

// Basic components — no default value
const $position = component<{ x: number; y: number }>();
const $velocity = component<{ vx: number; vy: number }>();
const $health = component<number>();
const $name = component<string>();
const $sprite = component<{ texture: string; frame: number }>();

// Components with default factories — each entity gets a fresh copy
const $inventory = componentWithFactory(() => [] as Item[]);
const $stats = componentWithFactory(() => ({
  strength: 10,
  dexterity: 10,
  intelligence: 10,
}));
const $buffs = componentWithFactory(() => new Set<string>());`}
      />

      <h3>entities() — entity registry</h3>
      <p>
        <code>entities()</code> creates an atom that holds a <code>Set&lt;Entity&gt;</code>.
        This is the registry of all entities in a particular category (players, enemies,
        projectiles, etc.).
      </p>
      <CodeBlock
        title="Entity registries"
        code={`import { entities } from 'kho';

// Separate registries for different entity types
const $players = entities();
const $enemies = entities();
const $projectiles = entities();
const $pickups = entities();`}
      />

      <h3>world($entities) — entity operations</h3>
      <p>
        <code>world($entities)</code> returns a factory that, when passed to <code>scope()</code>,
        provides a full set of entity operations bound to a specific registry and store.
      </p>
      <CodeBlock
        title="World API overview"
        code={`import { world, entities, system } from 'kho';

const $players = entities();

const mySystem = system((scope) => {
  const ecs = scope(world($players));

  // Entity lifecycle
  const e = ecs.entity('player-1');  // get or create Entity by ID
  ecs.add(e);                        // add to registry
  ecs.has(e);                        // true
  ecs.all();                         // [Entity]
  ecs.remove(e);                     // remove from registry

  // Component data
  ecs.set(e, $position, { x: 0, y: 0 });   // set component value
  ecs.get(e, $position);                     // { x: 0, y: 0 }
  ecs.hasComp(e, $position);                 // true
  ecs.delete(e, $position);                  // remove component

  // Queries
  ecs.with($position, $velocity);           // entities with BOTH components
  ecs.without($health);                      // entities WITHOUT health
});`}
      />

      <h3>Full game example</h3>
      <p>
        Here is a complete example showing a movement system that updates entity positions
        based on their velocities every frame.
      </p>
      <CodeBlock
        title="Movement system with ECS"
        code={`import {
  component, entities, world,
  system, reactive, effects,
  createStore, ignite, $systems,
  atom,
} from 'kho';

// Components
const $position = component<{ x: number; y: number }>();
const $velocity = component<{ vx: number; vy: number }>();
const $health = component<number>();
const $dead = component<boolean>();

// Entity registry
const $units = entities();

// Shared state
const $tick = atom(0);

// Movement system
const movementSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);
  const ecs = scope(world($units));

  interval(16, () => {
    const moving = ecs.with($position, $velocity);

    batch(() => {
      for (const entity of moving) {
        const pos = ecs.get(entity, $position)!;
        const vel = ecs.get(entity, $velocity)!;
        ecs.set(entity, $position, {
          x: pos.x + vel.vx,
          y: pos.y + vel.vy,
        });
      }
      atoms.set($tick, atoms.get($tick)! + 1);
    });
  });
});

// Spawn system
const spawnSystem = system((scope) => {
  const ecs = scope(world($units));

  // Create some entities
  const player = ecs.entity('player');
  ecs.add(player);
  ecs.set(player, $position, { x: 100, y: 100 });
  ecs.set(player, $velocity, { vx: 1, vy: 0 });
  ecs.set(player, $health, 100);

  const enemy = ecs.entity('enemy-1');
  ecs.add(enemy);
  ecs.set(enemy, $position, { x: 500, y: 200 });
  ecs.set(enemy, $velocity, { vx: -1, vy: 0 });
  ecs.set(enemy, $health, 50);
});

// Death system — removes dead entities
const deathSystem = system((scope) => {
  const { effect } = scope(effects);
  const ecs = scope(world($units));

  effect([$health as any], () => {
    for (const entity of ecs.with($health)) {
      if (ecs.get(entity, $health)! <= 0) {
        ecs.set(entity, $dead, true);
        ecs.remove(entity);
      }
    }
  });
});

// Boot the game
const store = createStore('Game');
const { sets } = reactive(store);

sets.add($systems, spawnSystem);
sets.add($systems, movementSystem);
sets.add($systems, deathSystem);

const shutdown = ignite(store);

// Later: shutdown() to clean up everything`}
      />

      {/* ========================================== */}
      {/* 9. ATTRIBUTES */}
      {/* ========================================== */}

      <h2 id="attributes">9. Attributes (Generic Object Data)</h2>
      <p>
        Attributes are similar to ECS components but designed for <strong>any object type</strong>,
        not just entities. They let you attach typed data to arbitrary objects (DOM elements,
        class instances, third-party objects) using a <code>WeakMap</code>-backed storage
        with automatic cleanup.
      </p>
      <p>
        The attribute system has its own registry, attribute definitions, and operations scope.
        It is useful when you need entity-like data attachment but your "entities" are not
        string-identified ECS entities.
      </p>

      <h3>registry() — create an object registry</h3>
      <p>
        <code>registry&lt;T&gt;()</code> creates an atom that holds a <code>Set&lt;T&gt;</code>{' '}
        where <code>T extends object</code>. Objects must be registered before they can be queried.
      </p>
      <CodeBlock
        title="Creating a registry"
        code={`import { registry } from 'kho';

// Registry for DOM elements
const $elements = registry<HTMLElement>();

// Registry for class instances
class Player {
  constructor(public name: string) {}
}
const $players = registry<Player>();`}
      />

      <h3>attribute() and attributeWithFactory()</h3>
      <p>
        <code>attribute($registry, defaultValue)</code> creates an attribute with a static
        default. <code>attributeWithFactory($registry, factory)</code> creates one where each
        object gets a fresh value from the factory. Both are tied to a specific registry.
      </p>
      <CodeBlock
        title="Defining attributes"
        code={`import { registry, attribute, attributeWithFactory } from 'kho';

const $players = registry<Player>();

// Static default — shared value
const $health = attribute($players, 100);
const $team = attribute($players, 'neutral');

// Factory default — each player gets its own instance
const $inventory = attributeWithFactory($players, () => [] as Item[]);
const $position = attributeWithFactory($players, () => ({ x: 0, y: 0 }));`}
      />

      <h3>attributes(store) — operations scope</h3>
      <p>
        <code>attributes(store)</code> returns an operations scope with methods for managing
        objects and their attribute data:
      </p>
      <ul>
        <li><code>add(obj, attr)</code> — Add object to the attribute's registry.</li>
        <li><code>remove(obj, attr)</code> — Remove object from the registry.</li>
        <li><code>has(obj, attr)</code> — Check if object is in the registry.</li>
        <li><code>all(attr)</code> — Get all objects in the registry.</li>
        <li><code>get(obj, attr)</code> — Get the attribute value (returns default if not set).</li>
        <li><code>set(obj, attr, value)</code> — Set the attribute value.</li>
        <li><code>delete(obj, attr)</code> — Remove the attribute value.</li>
        <li><code>hasAttr(obj, attr)</code> — Check if the object has an explicit attribute value.</li>
        <li><code>dispose()</code> — Clean up the scope.</li>
      </ul>
      <CodeBlock
        title="Using attributes"
        code={`import {
  createStore, registry, attribute,
  attributeWithFactory, attributes, reactive,
} from 'kho';

// Setup
class Player {
  constructor(public name: string) {}
}

const $players = registry<Player>();
const $health = attribute($players, 100);
const $inventory = attributeWithFactory($players, () => [] as string[]);

const store = createStore();
const a = attributes(store);

// Register objects
const alice = new Player('Alice');
const bob = new Player('Bob');

a.add(alice, $health);
a.add(bob, $health);

// Read (returns default 100 since not explicitly set)
a.get(alice, $health);          // 100

// Write
a.set(alice, $health, 80);
a.get(alice, $health);          // 80

// Check
a.hasAttr(alice, $health);      // true (explicitly set)
a.hasAttr(bob, $health);        // false (using default)
a.has(alice, $health);          // true (in registry)

// Query all
a.all($health);                 // [alice, bob]

// Delete attribute data
a.delete(alice, $health);
a.get(alice, $health);          // 100 (back to default)

// Remove from registry
a.remove(bob, $health);
a.all($health);                 // [alice]`}
      />

      <h3>Use case: DOM element data</h3>
      <p>
        A practical use case for attributes is attaching reactive data to DOM elements without
        subclassing or using <code>dataset</code>.
      </p>
      <CodeBlock
        title="Attaching data to DOM elements"
        code={`import {
  registry, attribute, attributeWithFactory,
  attributes, system, reactive, effects,
} from 'kho';

const $elements = registry<HTMLElement>();
const $tooltip = attribute($elements, '');
const $visible = attribute($elements, true);
const $position = attributeWithFactory($elements, () => ({ x: 0, y: 0 }));

const tooltipSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { effect } = scope(effects);
  const a = scope(attributes);

  // Register a DOM element
  const el = document.getElementById('my-button')!;
  a.add(el, $tooltip);
  a.set(el, $tooltip, 'Click to save');

  // React to tooltip changes
  effect([$tooltip as any], () => {
    for (const element of a.all($tooltip)) {
      const text = a.get(element, $tooltip);
      element.title = text;
    }
  });
});`}
      />
    </article>
  );
}
