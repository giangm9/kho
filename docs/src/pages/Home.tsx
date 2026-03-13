import { type ReactNode } from 'react';
import { AppLink } from '../router';
import { CodeBlock } from '../components/CodeBlock';
import { LuTarget, LuPuzzle, LuShieldCheck, LuFeather, LuZap, LuRadio, LuTimer, LuListTodo, LuGamepad2 } from 'react-icons/lu';

/* ── Code Samples ── */

const QUICK_START = `import { atom, createStore, reactive, effects } from 'kho';

// 1. Define atoms (units of state)
const $count = atom(0);
const $doubled = atom(0);
const $label = atom('hello');

// 2. Create a store and bind helpers
const store = createStore();
const { atoms } = reactive(store);
const { effect, compute } = effects(store);

// 3. Derive state with compute
compute([$count], (c) => c * 2, $doubled);

// 4. React to changes with effects
effect([$label, $doubled], (label, doubled) => {
  console.log(\`\${label}: \${doubled}\`);
});

// 5. Drive the system by changing data
atoms.set($count, 5);
// console: "hello: 10"`;

const REACT_EXAMPLE = `import { atom, createStore } from 'kho';
import { useAtom, KhoProvider } from 'kho/react';

const $count = atom(0);
const store = createStore();

function Counter() {
  const [count, setCount] = useAtom($count);

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}

function App() {
  return (
    <KhoProvider store={store}>
      <Counter />
    </KhoProvider>
  );
}`;

const SYSTEM_EXAMPLE = `import { atom, signal, createStore, system, ignite } from 'kho';

// Signals are fire-and-forget events
const onAttack = signal<{ target: string; dmg: number }>();

const $hp = atom(100);

const combatSystem = system('combat', (store) => {
  const { atoms } = reactive(store);
  const { effect } = effects(store);
  const { listen } = signals(store);

  // Listen to signals inside a system
  listen(onAttack, ({ target, dmg }) => {
    const current = atoms.get($hp) ?? 100;
    atoms.set($hp, Math.max(0, current - dmg));
    console.log(\`\${target} took \${dmg} dmg, hp: \${atoms.get($hp)}\`);
  });

  // Effects auto-dispose when system stops
  effect([$hp], (hp) => {
    if (hp <= 0) console.log('Game Over');
  });
});

// Orchestrate systems
ignite(store, [combatSystem]);`;

const ECS_EXAMPLE = `import { entity, attribute, createStore, reactive, effects } from 'kho';

// Attributes are typed component slots for entities
const Position = attribute<{ x: number; y: number }>();
const Velocity = attribute<{ x: number; y: number }>();

const store = createStore();
const { atoms } = reactive(store);
const { effect } = effects(store);

// Create entities
const player = entity();
atoms.set(Position.of(player), { x: 0, y: 0 });
atoms.set(Velocity.of(player), { x: 1, y: 0 });

// Physics system — runs whenever velocity changes
effect([Velocity.of(player), Position.of(player)], (vel, pos) => {
  if (!vel || !pos) return;
  atoms.set(Position.of(player), {
    x: pos.x + vel.x,
    y: pos.y + vel.y,
  });
});`;

/* ── Feature Cards ── */

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <LuTarget />,
    title: 'Data-Driven Architecture',
    desc: 'Logic reacts to state changes, not imperative commands. Define what happens when data changes and let the runtime orchestrate execution.',
  },
  {
    icon: <LuPuzzle />,
    title: 'Separation of Concerns',
    desc: 'Clear split between data operations (reactive) and reactions (effects). Each layer has a single, well-defined responsibility.',
  },
  {
    icon: <LuShieldCheck />,
    title: 'Fully Type-Safe',
    desc: 'Strict TypeScript generics throughout. Atoms, signals, attributes, and effects are all strongly typed with full inference.',
  },
  {
    icon: <LuFeather />,
    title: '~5KB Zero Dependencies',
    desc: 'Tiny bundle with zero runtime dependencies. Works with React, Vue, or vanilla TypeScript out of the box.',
  },
  {
    icon: <LuGamepad2 />,
    title: 'Built-in ECS',
    desc: 'Entity Component System for game dev and complex simulations. Entities, attributes, and reactive queries.',
  },
  {
    icon: <LuZap />,
    title: 'System Orchestration',
    desc: 'Compose independent systems with ignite(). Dynamic start/stop, automatic cleanup, zero boilerplate.',
  },
  {
    icon: <LuRadio />,
    title: 'Signals for Events',
    desc: 'Fire-and-forget signals for cross-system communication. Type-safe, decoupled, and zero-allocation when unused.',
  },
  {
    icon: <LuTimer />,
    title: 'Built-in Timing',
    desc: 'First-class debounce, throttle, interval, and timeout effects. All auto-dispose when the owning system stops.',
  },
];

/* ── Comparison Data ── */

const COMPARISON = [
  { feature: 'Bundle size', kho: '~5KB', redux: '~45KB+', zustand: '~1KB', jotai: '~8KB', mobx: '~16KB' },
  { feature: 'TypeScript-first', kho: 'Yes', redux: 'Partial', zustand: 'Yes', jotai: 'Yes', mobx: 'Partial' },
  { feature: 'Zero dependencies', kho: 'Yes', redux: 'No', zustand: 'Yes', jotai: 'Yes', mobx: 'No' },
  { feature: 'Reactive effects', kho: 'Built-in', redux: 'Middleware', zustand: 'Manual', jotai: 'Limited', mobx: 'Built-in' },
  { feature: 'Signals / events', kho: 'Built-in', redux: 'Actions', zustand: 'No', jotai: 'No', mobx: 'No' },
  { feature: 'ECS support', kho: 'Built-in', redux: 'No', zustand: 'No', jotai: 'No', mobx: 'No' },
  { feature: 'System orchestration', kho: 'Built-in', redux: 'No', zustand: 'No', jotai: 'No', mobx: 'No' },
  { feature: 'Debounce / throttle', kho: 'Built-in', redux: 'Middleware', zustand: 'Manual', jotai: 'Manual', mobx: 'Manual' },
  { feature: 'Framework support', kho: 'React / Vue / Vanilla', redux: 'React', zustand: 'React', jotai: 'React', mobx: 'React / Vue' },
];

/* ── Demo Cards ── */

const DEMOS: { icon: ReactNode; title: string; desc: string; to: string }[] = [
  {
    icon: <LuListTodo />,
    title: 'Todo App',
    desc: 'Classic CRUD with reactive effects, computed counts, and filters.',
    to: '/examples/todo',
  },
  {
    icon: <LuGamepad2 />,
    title: 'Space Shooter',
    desc: 'Canvas game with ECS — entities, components, and five composable systems.',
    to: '/examples/space-shooter',
  },
];

/* ── Page ── */

export function Home() {
  return (
    <div className="max-w-[960px] mx-auto">
      {/* ── Hero ── */}
      <section className="text-center py-12 pb-14">
        <h1 className="text-6xl font-extrabold tracking-tighter bg-gradient-to-br from-accent to-cyan bg-clip-text text-transparent">Kho</h1>
        <p className="text-text-muted text-lg mt-3 max-w-[640px] mx-auto leading-relaxed">
          Data-driven state management with reactive effects, signals, and ECS
        </p>

        <div className="flex gap-2 justify-center flex-wrap mt-5">
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border text-text-muted bg-bg-card tracking-wide">~5KB</span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border text-text-muted bg-bg-card tracking-wide">TypeScript</span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border text-text-muted bg-bg-card tracking-wide">Zero deps</span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border text-text-muted bg-bg-card tracking-wide">React / Vue / Vanilla</span>
        </div>

        <div className="flex gap-3 justify-center flex-wrap mt-8">
          <AppLink to="/getting-started" className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-accent !text-white hover:bg-accent-hover transition-all">
            Get Started
          </AppLink>
          <AppLink to="/examples/todo" className="px-6 py-2.5 rounded-lg font-semibold text-sm border border-border !text-text hover:border-text-muted transition-all">
            Live Examples
          </AppLink>
          <a
            href="https://github.com/giangm9/kho"
            className="px-6 py-2.5 rounded-lg font-semibold text-sm border border-border !text-text hover:border-text-muted transition-all"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>

        <div className="mt-6">
          <code className="text-sm px-4 py-1.5">npm install kho</code>
        </div>
      </section>

      {/* ── Quick Start ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">Quick Start</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Atoms hold state. Reactive reads and writes. Effects react. Compute derives.
        </p>
        <CodeBlock code={QUICK_START} title="quick-start.ts" />
      </section>

      {/* ── Features ── */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 my-12">
        {FEATURES.map((f) => (
          <div key={f.title} className="p-5 border border-border rounded-xl bg-bg-card hover:border-border-bright transition-colors">
            <span className="text-xl text-accent block mb-2">{f.icon}</span>
            <h3 className="text-sm font-semibold text-text mb-1.5">{f.title}</h3>
            <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Architecture ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">Architecture</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Kho separates <strong>what the data is</strong> from <strong>what happens when it changes</strong>.
        </p>
        <pre className="text-[0.78rem] leading-relaxed">{`┌─────────────────────────────────────────────────────────────┐
│                           Kho                               │
├──────────────────────────┬──────────────────────────────────┤
│      Data Layer          │      System Layer                │
├──────────────────────────┼──────────────────────────────────┤
│  reactive(store)         │  effects(store)                  │
│  ├─ atoms.get/set/notify │  ├─ effect()                     │
│  ├─ sets.add/remove/has  │  ├─ compute()                    │
│  └─ maps.set/get/delete  │  ├─ batch()                      │
│                          │  ├─ debounce/throttle()           │
│  signal / listen         │  └─ interval/timeout()            │
│  entity / attribute      │                                  │
│  (ECS primitives)        │  system() — auto dispose          │
│                          │  ignite() — orchestration         │
└──────────────────────────┴──────────────────────────────────┘`}</pre>
      </section>

      {/* ── React Integration ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">React Integration</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Wrap your app in a provider and use hooks to read and write atoms. Re-renders are automatic and granular.
        </p>
        <CodeBlock code={REACT_EXAMPLE} title="react-counter.tsx" />
      </section>

      {/* ── Systems ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">Systems &amp; Signals</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Encapsulate logic in systems. Communicate across systems with typed signals. Everything auto-disposes.
        </p>
        <CodeBlock code={SYSTEM_EXAMPLE} title="combat-system.ts" />
      </section>

      {/* ── ECS ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">Entity Component System</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Model complex domains with entities and attributes. Reactive effects serve as systems that run on data changes.
        </p>
        <CodeBlock code={ECS_EXAMPLE} title="physics-ecs.ts" />
      </section>

      {/* ── Why Kho? ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">Why Kho?</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          A quick comparison with popular state management libraries.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm mt-4">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left border-b border-border">Feature</th>
                <th className="px-3 py-2.5 text-left border-b border-border">Kho</th>
                <th className="px-3 py-2.5 text-left border-b border-border">Redux</th>
                <th className="px-3 py-2.5 text-left border-b border-border">Zustand</th>
                <th className="px-3 py-2.5 text-left border-b border-border">Jotai</th>
                <th className="px-3 py-2.5 text-left border-b border-border">MobX</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <td className="px-3 py-2.5 text-left border-b border-border">{row.feature}</td>
                  <td className="px-3 py-2.5 text-left border-b border-border"><strong>{row.kho}</strong></td>
                  <td className="px-3 py-2.5 text-left border-b border-border">{row.redux}</td>
                  <td className="px-3 py-2.5 text-left border-b border-border">{row.zustand}</td>
                  <td className="px-3 py-2.5 text-left border-b border-border">{row.jotai}</td>
                  <td className="px-3 py-2.5 text-left border-b border-border">{row.mobx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Demos ── */}
      <section className="mt-14">
        <h2 className="text-xl font-bold mb-3 text-text">See It In Action</h2>
        <p className="text-text-muted text-[0.95rem] mb-5 leading-relaxed">
          Interactive examples running entirely in the browser.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mt-6">
          {DEMOS.map((d) => (
            <AppLink key={d.to} to={d.to} className="block p-5 border border-border rounded-xl bg-bg-card transition-all hover:border-border-bright hover:-translate-y-0.5 no-underline text-inherit">
              <span className="text-lg text-cyan block mb-2">{d.icon}</span>
              <h3 className="text-sm font-semibold text-text mb-1">{d.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{d.desc}</p>
            </AppLink>
          ))}
        </div>
      </section>
    </div>
  );
}
