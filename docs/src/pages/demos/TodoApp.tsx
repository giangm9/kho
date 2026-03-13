import { useEffect, useMemo, useRef } from 'react';
import { atom, createStore, reactive, effects, signal, listen, system, ignite, $systems } from 'kho';
import { KhoProvider, useAtom, useAtomValue, useStore } from 'kho/react';
import { CodeTabs } from '../../components/CodeTabs';
import { LuUndo2, LuRedo2, LuHistory, LuPlus, LuCheck, LuX, LuTrash2 } from 'react-icons/lu';

// ============================================
// Types
// ============================================

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

type Filter = 'all' | 'active' | 'completed';

// ============================================
// Atoms & Signals
// ============================================

const $todos = atom<Todo[]>([]);
const $input = atom('');
const $filter = atom<Filter>('all');
const $filtered = atom<Todo[]>([]);
const $remaining = atom(0);

const requestAdd = signal<void>();
const requestToggle = signal<number>();
const requestRemove = signal<number>();
const requestClear = signal<void>();

const $undoStack = atom<Todo[][]>([]);
const $redoStack = atom<Todo[][]>([]);
const $canUndo = atom(false);
const $canRedo = atom(false);

const requestUndo = signal<void>();
const requestRedo = signal<void>();
const requestJumpTo = signal<number>();

// ── ECS-like Component atoms ──
// Each Map stores one "component" per entity (todo.id → value).
// Adding a new component = adding a new atom. Zero changes to Todo type.
const $categories = atom<Map<number, string>>(new Map());
const $priorities = atom<Map<number, 'low' | 'medium' | 'high'>>(new Map());

const requestSetCategory = signal<{ id: number; category: string }>();
const requestSetPriority = signal<{ id: number; priority: 'low' | 'medium' | 'high' }>();

// ============================================
// Systems
// ============================================

const todoSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { compute } = scope(effects);
  const { on } = scope(listen);

  compute([$todos, $filter], $filtered, (todos: Todo[], filter: Filter) => {
    if (filter === 'all') return todos;
    if (filter === 'active') return todos.filter(t => !t.done);
    return todos.filter(t => t.done);
  });

  compute([$todos], $remaining, (todos: Todo[]) =>
    todos.filter(t => !t.done).length,
  );

  let nextId = 1;

  on(requestAdd, () => {
    const text = atoms.get($input)?.trim();
    if (!text) return;
    const todos = atoms.get($todos) ?? [];
    atoms.set($todos, [...todos, { id: nextId++, text, done: false }]);
    atoms.set($input, '');
  });

  on(requestToggle, (id) => {
    const todos = atoms.get($todos) ?? [];
    atoms.set($todos, todos.map(t =>
      t.id === id! ? { ...t, done: !t.done } : t,
    ));
  });

  on(requestRemove, (id) => {
    const todos = atoms.get($todos) ?? [];
    atoms.set($todos, todos.filter(t => t.id !== id!));
  });

  on(requestClear, () => {
    const todos = atoms.get($todos) ?? [];
    atoms.set($todos, todos.filter(t => !t.done));
  });
});

const historySystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { effect, compute } = scope(effects);
  const { on } = scope(listen);

  let skipNextPush = false;

  effect([$todos], () => {
    if (skipNextPush) { skipNextPush = false; return; }
    const current = atoms.get($todos) ?? [];
    const stack = atoms.get($undoStack) ?? [];
    if (stack.length > 0 && stack[stack.length - 1] === current) return;
    atoms.set($undoStack, [...stack, current]);
    atoms.set($redoStack, []);
  });

  compute([$undoStack], $canUndo, (s: Todo[][]) => s.length > 1);
  compute([$redoStack], $canRedo, (s: Todo[][]) => s.length > 0);

  on(requestUndo, () => {
    const undo = atoms.get($undoStack) ?? [];
    if (undo.length <= 1) return;
    const current = undo[undo.length - 1];
    const previous = undo[undo.length - 2];
    atoms.set($undoStack, undo.slice(0, -1));
    atoms.set($redoStack, [...(atoms.get($redoStack) ?? []), current!]);
    skipNextPush = true;
    atoms.set($todos, previous!);
  });

  on(requestRedo, () => {
    const redo = atoms.get($redoStack) ?? [];
    if (redo.length === 0) return;
    const next = redo[redo.length - 1];
    atoms.set($redoStack, redo.slice(0, -1));
    atoms.set($undoStack, [...(atoms.get($undoStack) ?? []), next!]);
    skipNextPush = true;
    atoms.set($todos, next!);
  });

  on(requestJumpTo, (timelineIndex) => {
    if (timelineIndex == null) return;
    const undo = atoms.get($undoStack) ?? [];
    const redo = atoms.get($redoStack) ?? [];
    const redoReversed = [...redo].reverse();
    const fullTimeline = [...undo, ...redoReversed];
    if (timelineIndex < 0 || timelineIndex >= fullTimeline.length) return;
    const target = fullTimeline[timelineIndex]!;
    atoms.set($undoStack, fullTimeline.slice(0, timelineIndex + 1));
    atoms.set($redoStack, fullTimeline.slice(timelineIndex + 1).reverse());
    skipNextPush = true;
    atoms.set($todos, target);
  });
});

const metadataSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { on } = scope(listen);
  const { effect } = scope(effects);

  on(requestSetCategory, (payload) => {
    const { id, category } = payload!;
    const m = new Map(atoms.get($categories));
    category ? m.set(id, category) : m.delete(id);
    atoms.set($categories, m);
  });

  on(requestSetPriority, (payload) => {
    const { id, priority } = payload!;
    const m = new Map(atoms.get($priorities));
    m.set(id, priority);
    atoms.set($priorities, m);
  });

  // Auto-cleanup: when a todo is removed, its metadata follows
  effect([$todos], () => {
    const ids = new Set((atoms.get($todos) ?? []).map(t => t.id));
    const cats = new Map(atoms.get($categories)!);
    const pris = new Map(atoms.get($priorities)!);
    let dirty = false;
    for (const k of cats.keys()) if (!ids.has(k)) { cats.delete(k); dirty = true; }
    for (const k of pris.keys()) if (!ids.has(k)) { pris.delete(k); dirty = true; }
    if (dirty) {
      atoms.set($categories, cats);
      atoms.set($priorities, pris);
    }
  });
});

// ============================================
// Shared hook — emit signals from UI
// ============================================

function useEmit() {
  const store = useStore();
  const ref = useRef<ReturnType<typeof listen> | null>(null);
  if (!ref.current) ref.current = listen(store);
  return ref.current.emit;
}

// ============================================
// Live Demo Components
// ============================================

function TodoInput() {
  const [input, setInput] = useAtom($input);
  const emit = useEmit();

  return (
    <form
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      onSubmit={e => { e.preventDefault(); emit(requestAdd); }}
    >
      <input
        style={{
          flex: 1, minWidth: 0, padding: '7px 10px',
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-bg-code)', color: 'var(--color-text)',
          fontSize: 13, outline: 'none',
        }}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="What needs to be done?"
      />
      <button
        type="submit"
        disabled={!input.trim()}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--color-accent)', color: '#fff',
          opacity: input.trim() ? 1 : 0.35, border: 'none',
        }}
      >
        <LuPlus style={{ fontSize: 14 }} />
      </button>
    </form>
  );
}

function TodoList() {
  const [filter, setFilter] = useAtom($filter);
  const filtered = useAtomValue($filtered);
  const remaining = useAtomValue($remaining);
  const todos = useAtomValue($todos);
  const emit = useEmit();
  const completedCount = todos.length - remaining;
  const filters: Filter[] = ['all', 'active', 'completed'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, border: 'none',
              background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-code)',
              color: filter === f ? '#fff' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--color-text-dim)' }}>
          {todos.length === 0 ? 'No todos yet. Add one above!' : 'No items match this filter.'}
        </div>
      ) : (
        <div style={{ borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {filtered.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
              }}
              className="group"
            >
              <button
                onClick={() => emit(requestToggle, t.id)}
                style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                  border: t.done ? '2px solid var(--color-accent)' : '2px solid var(--color-border-bright)',
                  background: t.done ? 'var(--color-accent)' : 'transparent',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                {t.done && <LuCheck style={{ fontSize: 10 }} />}
              </button>
              <span style={{
                flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? 'var(--color-text-dim)' : 'var(--color-text)',
              }}>
                {t.text}
              </span>
              <button
                onClick={() => emit(requestRemove, t.id)}
                className="opacity-0 group-hover:opacity-100"
                style={{
                  flexShrink: 0, background: 'none', border: 'none', padding: 2,
                  color: 'var(--color-text-dim)', cursor: 'pointer',
                }}
              >
                <LuX style={{ fontSize: 12 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {todos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
            {remaining} item{remaining !== 1 ? 's' : ''} left
          </span>
          {completedCount > 0 && (
            <button
              onClick={() => emit(requestClear)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--color-text-dim)', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <LuTrash2 style={{ fontSize: 10 }} /> Clear ({completedCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function describeSnapshot(prev: Todo[] | undefined, current: Todo[]): string {
  if (!prev || prev.length === 0 && current.length === 0) return 'Initial state';
  if (!prev) return 'Initial state';
  if (current.length > prev.length) {
    const added = current.find(t => !prev.some(p => p.id === t.id));
    return added ? `Add "${added.text}"` : 'Add item';
  }
  if (current.length < prev.length) {
    const removed = prev.find(t => !current.some(c => c.id === t.id));
    if (removed) return `Remove "${removed.text}"`;
    return `Clear ${prev.length - current.length} done`;
  }
  const toggled = current.find((t, i) => prev[i] && t.done !== prev[i]!.done);
  if (toggled) return `${toggled.done ? 'Complete' : 'Uncomplete'} "${toggled.text}"`;
  return 'Update';
}

function HistoryPanel() {
  const undoStack = useAtomValue($undoStack);
  const redoStack = useAtomValue($redoStack);
  const emit = useEmit();
  const currentIndex = undoStack.length - 1;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-current="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [undoStack.length, redoStack.length]);

  const timeline: { todos: Todo[]; label: string; isCurrent: boolean; timelineIndex: number; isRedo: boolean }[] = [];
  for (let i = 0; i < undoStack.length; i++) {
    const prev = i > 0 ? undoStack[i - 1] : undefined;
    timeline.push({
      todos: undoStack[i]!, label: describeSnapshot(prev, undoStack[i]!),
      isCurrent: i === currentIndex, timelineIndex: i, isRedo: false,
    });
  }
  const redoReversed = [...redoStack].reverse();
  for (let i = 0; i < redoReversed.length; i++) {
    const prev = i === 0 ? undoStack[currentIndex] : redoReversed[i - 1];
    timeline.push({
      todos: redoReversed[i]!, label: describeSnapshot(prev, redoReversed[i]!),
      isCurrent: false, timelineIndex: undoStack.length + i, isRedo: true,
    });
  }

  return (
    <div style={{ marginTop: 4, borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        background: 'var(--color-bg-code)', borderBottom: '1px solid var(--color-border)',
      }}>
        <LuHistory style={{ fontSize: 11, color: 'var(--color-amber)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>History</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-dim)', marginLeft: 2 }}>
          {undoStack.length} undo · {redoStack.length} redo
        </span>
      </div>
      <div ref={scrollRef} style={{ maxHeight: 176, overflowY: 'auto' }}>
        {timeline.length === 0 ? (
          <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center' }}>
            No history yet
          </div>
        ) : (
          timeline.map((entry, i) => {
            const isClickable = !entry.isCurrent;
            return (
              <button
                key={i}
                data-current={entry.isCurrent || undefined}
                disabled={!isClickable}
                onClick={() => isClickable && emit(requestJumpTo, entry.timelineIndex)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', fontSize: 11, border: 'none',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  background: entry.isCurrent ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  color: entry.isCurrent ? 'var(--color-accent)' : entry.isRedo ? 'var(--color-text-dim)' : 'var(--color-text-muted)',
                  fontWeight: entry.isCurrent ? 600 : 400,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: entry.isCurrent ? 'var(--color-accent)' : entry.isRedo ? 'var(--color-border-bright)' : 'var(--color-text-dim)',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.label}
                </span>
                {entry.isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--color-accent)',
                    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                    padding: '2px 5px', borderRadius: 4, flexShrink: 0,
                  }}>NOW</span>
                )}
                {entry.isRedo && (
                  <span style={{
                    fontSize: 9, color: 'var(--color-text-dim)',
                    background: 'var(--color-bg-code)', padding: '2px 5px', borderRadius: 4, flexShrink: 0,
                  }}>REDO</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================
// Per-step Demo Components
// ============================================

function Step1Demo() {
  const store = useMemo(() => createStore(), []);
  useEffect(() => {
    const r = reactive(store);
    r.atoms.set($todos, [
      { id: 1, text: 'Buy groceries', done: true },
      { id: 2, text: 'Walk the dog', done: false },
      { id: 3, text: 'Read a book', done: false },
    ]);
    r.sets.add($systems, todoSystem);
    const dispose = ignite(store);
    return () => { dispose(); r.dispose(); };
  }, [store]);

  return (
    <KhoProvider store={store}>
      <AtomInspector />
    </KhoProvider>
  );
}

function AtomInspector() {
  const todos = useAtomValue($todos);
  const filter = useAtomValue($filter);
  const filtered = useAtomValue($filtered);
  const remaining = useAtomValue($remaining);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-dim)', fontWeight: 600 }}>
        Atom State
      </div>
      <Row label="$todos" value={`[${todos.length} items]`} />
      <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {todos.map(t => (
          <span key={t.id} style={{
            color: t.done ? 'var(--color-text-dim)' : 'var(--color-text-muted)',
            textDecoration: t.done ? 'line-through' : 'none',
          }}>
            {t.done ? '\u2611' : '\u2610'} {t.text}
          </span>
        ))}
      </div>
      <Row label="$filter" value={`"${filter}"`} />
      <Row label="$filtered" value={`[${filtered.length} items]`} />
      <Row label="$remaining" value={String(remaining)} />
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)', fontSize: 10, color: 'var(--color-text-dim)' }}>
        No UI yet — just atoms + system running headless.
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--color-accent)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{value}</span>
    </div>
  );
}

function Step2Demo() {
  const store = useMemo(() => createStore(), []);
  useEffect(() => {
    const r = reactive(store);
    r.sets.add($systems, todoSystem);
    const dispose = ignite(store);
    return () => { dispose(); r.dispose(); };
  }, [store]);

  return (
    <KhoProvider store={store}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TodoInput />
        <TodoList />
      </div>
    </KhoProvider>
  );
}

function Step3Demo() {
  const store = useMemo(() => createStore(), []);
  useEffect(() => {
    const r = reactive(store);
    r.sets.add($systems, todoSystem);
    r.sets.add($systems, historySystem);
    const dispose = ignite(store);
    return () => { dispose(); r.dispose(); };
  }, [store]);

  return (
    <KhoProvider store={store}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}><TodoInput /></div>
          <UndoRedoBar />
        </div>
        <TodoList />
        <HistoryPanel />
      </div>
    </KhoProvider>
  );
}

function Step4Demo() {
  const store = useMemo(() => createStore(), []);
  useEffect(() => {
    const r = reactive(store);
    r.sets.add($systems, todoSystem);
    r.sets.add($systems, historySystem);
    const dispose = ignite(store);
    return () => { dispose(); r.dispose(); };
  }, [store]);

  return (
    <KhoProvider store={store}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}><TodoInput /></div>
          <UndoRedoBar />
        </div>
        <TodoList />
        <HistoryPanel />
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 11, color: 'var(--color-amber)',
          border: '1px solid color-mix(in srgb, var(--color-amber) 20%, transparent)',
          background: 'color-mix(in srgb, var(--color-amber) 5%, transparent)',
        }}>
          + localStorage persistence active
        </div>
      </div>
    </KhoProvider>
  );
}

const CAT_COLORS: Record<string, string> = {
  work: 'var(--color-cyan)',
  personal: 'var(--color-rose)',
  errands: 'var(--color-amber)',
};
const PRIO_COLORS: Record<string, string> = {
  high: 'var(--color-rose)',
  medium: 'var(--color-amber)',
  low: 'var(--color-green)',
};
const CATEGORIES = ['work', 'personal', 'errands'];
const PRIORITIES: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

function EnrichedTodoList() {
  const todos = useAtomValue($todos);
  const categories = useAtomValue($categories);
  const priorities = useAtomValue($priorities);
  const emit = useEmit();

  if (todos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--color-text-dim)' }}>
        No todos yet. Add one above!
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      {todos.map((t, i) => {
        const cat = categories.get(t.id);
        const prio = priorities.get(t.id);
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            {/* Priority select */}
            <select
              value={prio ?? ''}
              onChange={e => {
                const val = e.target.value as 'low' | 'medium' | 'high';
                if (val) emit(requestSetPriority, { id: t.id, priority: val });
              }}
              style={{
                fontSize: 10, padding: '2px 2px', borderRadius: 4, width: 28,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-code)',
                color: prio ? (PRIO_COLORS[prio] ?? 'var(--color-text-muted)') : 'var(--color-text-dim)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <option value="">—</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p === 'low' ? '🟢' : p === 'medium' ? '🟡' : '🔴'}</option>
              ))}
            </select>
            {/* Toggle done */}
            <button
              onClick={() => emit(requestToggle, t.id)}
              style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                border: t.done ? '2px solid var(--color-accent)' : '2px solid var(--color-border-bright)',
                background: t.done ? 'var(--color-accent)' : 'transparent',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              {t.done && <LuCheck style={{ fontSize: 10 }} />}
            </button>
            {/* Text */}
            <span style={{
              flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: t.done ? 'line-through' : 'none',
              color: t.done ? 'var(--color-text-dim)' : 'var(--color-text)',
            }}>
              {t.text}
            </span>
            {/* Category select */}
            <select
              value={cat ?? ''}
              onChange={e => emit(requestSetCategory, { id: t.id, category: e.target.value })}
              style={{
                fontSize: 10, padding: '2px 4px', borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-code)',
                color: cat ? (CAT_COLORS[cat] ?? 'var(--color-text-muted)') : 'var(--color-text-dim)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <option value="">no tag</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Remove */}
            <button
              onClick={() => emit(requestRemove, t.id)}
              className="opacity-0 group-hover:opacity-100"
              style={{
                flexShrink: 0, background: 'none', border: 'none', padding: 2,
                color: 'var(--color-text-dim)', cursor: 'pointer',
              }}
            >
              <LuX style={{ fontSize: 12 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Step6Demo() {
  const store = useMemo(() => createStore(), []);
  useEffect(() => {
    const r = reactive(store);
    r.atoms.set($todos, [
      { id: 1, text: 'Ship feature', done: false },
      { id: 2, text: 'Buy groceries', done: true },
      { id: 3, text: 'Morning run', done: false },
    ]);
    r.atoms.set($categories, new Map([[1, 'work'], [2, 'errands'], [3, 'personal']]));
    r.atoms.set($priorities, new Map<number, 'low' | 'medium' | 'high'>([[1, 'high'], [3, 'medium']]));
    r.sets.add($systems, todoSystem);
    r.sets.add($systems, metadataSystem);
    const dispose = ignite(store);
    return () => { dispose(); r.dispose(); };
  }, [store]);

  return (
    <KhoProvider store={store}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <TodoInput />
        <EnrichedTodoList />
      </div>
    </KhoProvider>
  );
}

function StepRow({ children, demo, label }: { children: React.ReactNode; demo: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 32 }}>
        <div style={{ borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-code)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-green)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
          </div>
          <div style={{ padding: 12 }}>
            {demo}
          </div>
        </div>
      </div>
    </div>
  );
}

function UndoRedoBar() {
  const canUndo = useAtomValue($canUndo);
  const canRedo = useAtomValue($canRedo);
  const emit = useEmit();

  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', color: 'var(--color-text-muted)',
    opacity: enabled ? 1 : 0.3, cursor: enabled ? 'pointer' : 'default',
  });

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <button style={btnStyle(canUndo)} onClick={() => emit(requestUndo)} disabled={!canUndo} title="Undo">
        <LuUndo2 style={{ fontSize: 14 }} />
      </button>
      <button style={btnStyle(canRedo)} onClick={() => emit(requestRedo)} disabled={!canRedo} title="Redo">
        <LuRedo2 style={{ fontSize: 14 }} />
      </button>
    </div>
  );
}

// ============================================
// Source code strings
// ============================================

const STEP1_CODE = `import { atom, signal, system, reactive, effects, listen } from 'kho';

// ── Types ──
interface Todo { id: number; text: string; done: boolean }
type Filter = 'all' | 'active' | 'completed';

// ── Atoms (state containers) ──
const $todos    = atom<Todo[]>([]);
const $input    = atom('');
const $filter   = atom<Filter>('all');
const $filtered = atom<Todo[]>([]);   // derived
const $remaining = atom(0);           // derived

// ── Signals (one-shot events) ──
const requestAdd    = signal<void>();
const requestToggle = signal<number>();
const requestRemove = signal<number>();
const requestClear  = signal<void>();

// ── Todo System ──
const todoSystem = system((scope) => {
  const { atoms }   = scope(reactive);
  const { compute } = scope(effects);
  const { on }      = scope(listen);

  // Derived state: auto-recomputes when deps change
  compute([$todos, $filter], $filtered, (todos, filter) => {
    if (filter === 'all') return todos;
    if (filter === 'active') return todos.filter(t => !t.done);
    return todos.filter(t => t.done);
  });

  compute([$todos], $remaining, (todos) =>
    todos.filter(t => !t.done).length
  );

  // Signal handlers
  let nextId = 1;

  on(requestAdd, () => {
    const text = atoms.get($input)?.trim();
    if (!text) return;
    atoms.set($todos, [
      ...atoms.get($todos)!,
      { id: nextId++, text, done: false },
    ]);
    atoms.set($input, '');
  });

  on(requestToggle, (id) => {
    atoms.set($todos, atoms.get($todos)!.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ));
  });

  on(requestRemove, (id) => {
    atoms.set($todos, atoms.get($todos)!.filter(t => t.id !== id));
  });

  on(requestClear, () => {
    atoms.set($todos, atoms.get($todos)!.filter(t => !t.done));
  });
});`;

const STEP1_BOOT = `import { createStore, ignite, $systems, reactive } from 'kho';

const store = createStore();
const { sets } = reactive(store);

sets.add($systems, todoSystem);
const dispose = ignite(store);
// ignite watches $systems — auto-starts/stops systems`;

const STEP2_CODE = `import { KhoProvider, useAtom, useAtomValue, useStore } from 'kho/react';
import { listen } from 'kho';

function TodoUI() {
  const [input, setInput] = useAtom($input);
  const [filter, setFilter] = useAtom($filter);
  const filtered  = useAtomValue($filtered);
  const remaining = useAtomValue($remaining);
  const todos     = useAtomValue($todos);
  const store     = useStore();
  const { emit }  = listen(store);

  return (
    <div>
      <input value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && emit(requestAdd)} />
      <button onClick={() => emit(requestAdd)}>Add</button>

      {(['all', 'active', 'completed'] as const).map(f => (
        <button key={f} onClick={() => setFilter(f)}>{f}</button>
      ))}

      {filtered.map(t => (
        <li key={t.id}>
          <input type="checkbox" checked={t.done}
            onChange={() => emit(requestToggle, t.id)} />
          <span>{t.text}</span>
          <button onClick={() => emit(requestRemove, t.id)}>×</button>
        </li>
      ))}

      <p>{remaining} items left</p>
      <button onClick={() => emit(requestClear)}>Clear completed</button>
    </div>
  );
}

function App() {
  return (
    <KhoProvider store={store} systems={[todoSystem]}>
      <TodoUI />
    </KhoProvider>
  );
}`;

const STEP3_CODE = `// ── New atoms for history ──
const $undoStack = atom<Todo[][]>([]);
const $redoStack = atom<Todo[][]>([]);
const $canUndo   = atom(false);
const $canRedo   = atom(false);

const requestUndo   = signal<void>();
const requestRedo   = signal<void>();
const requestJumpTo = signal<number>();

// ── History System ──
// Independent — just watches $todos, knows nothing about todoSystem.
const historySystem = system((scope) => {
  const { atoms }           = scope(reactive);
  const { effect, compute } = scope(effects);
  const { on }              = scope(listen);

  let skipNextPush = false;

  // Push to undo stack whenever $todos changes
  effect([$todos], () => {
    if (skipNextPush) { skipNextPush = false; return; }
    const current = atoms.get($todos) ?? [];
    const stack = atoms.get($undoStack) ?? [];
    if (stack.length > 0 && stack[stack.length - 1] === current) return;
    atoms.set($undoStack, [...stack, current]);
    atoms.set($redoStack, []);
  });

  compute([$undoStack], $canUndo, (s) => s.length > 1);
  compute([$redoStack], $canRedo, (s) => s.length > 0);

  on(requestUndo, () => {
    const undo = atoms.get($undoStack) ?? [];
    if (undo.length <= 1) return;
    atoms.set($undoStack, undo.slice(0, -1));
    atoms.set($redoStack, [
      ...(atoms.get($redoStack) ?? []),
      undo[undo.length - 1]!,
    ]);
    skipNextPush = true;
    atoms.set($todos, undo[undo.length - 2]!);
  });

  on(requestRedo, () => {
    const redo = atoms.get($redoStack) ?? [];
    if (redo.length === 0) return;
    const next = redo[redo.length - 1]!;
    atoms.set($redoStack, redo.slice(0, -1));
    atoms.set($undoStack, [
      ...(atoms.get($undoStack) ?? []),
      next,
    ]);
    skipNextPush = true;
    atoms.set($todos, next);
  });

  on(requestJumpTo, (index) => {
    const undo = atoms.get($undoStack) ?? [];
    const redo = atoms.get($redoStack) ?? [];
    const full = [...undo, ...[...redo].reverse()];
    if (index < 0 || index >= full.length) return;
    atoms.set($undoStack, full.slice(0, index + 1));
    atoms.set($redoStack, full.slice(index + 1).reverse());
    skipNextPush = true;
    atoms.set($todos, full[index]!);
  });
});

// Register both — order matters: todo first, then history
sets.add($systems, todoSystem);
sets.add($systems, historySystem);
const dispose = ignite(store);`;

const STEP4_CODE = `import type { Atom } from 'kho';

// ── Persistence System Factory ──
// Returns a system that syncs one atom to localStorage.
function persistAtom<T>(key: string, $atom: Atom<T>) {
  return system((scope) => {
    const { atoms }  = scope(reactive);
    const { effect } = scope(effects);

    // Hydrate: load saved value on start
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try { atoms.set($atom, JSON.parse(saved)); } catch {}
    }

    // Persist: save whenever the atom changes
    let isFirstRun = true;
    effect([$atom], () => {
      if (isFirstRun) { isFirstRun = false; return; }
      localStorage.setItem(key, JSON.stringify(atoms.get($atom)));
    });
  });
}

// One line per atom:
const persistTodos  = persistAtom('todo:items', $todos);
const persistFilter = persistAtom('todo:filter', $filter);

sets.add($systems, persistTodos);
sets.add($systems, persistFilter);`;

const STEP5_CODE = `import type { Atom } from 'kho';

// ── Generic: persist many atoms in one system ──
function persistenceSystem(entries: Record<string, Atom<unknown>>) {
  return system((scope) => {
    const { atoms }  = scope(reactive);
    const { effect } = scope(effects);

    for (const [key, $atom] of Object.entries(entries)) {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try { atoms.set($atom, JSON.parse(saved)); } catch {}
      }
    }

    for (const [key, $atom] of Object.entries(entries)) {
      let isFirstRun = true;
      effect([$atom], () => {
        if (isFirstRun) { isFirstRun = false; return; }
        localStorage.setItem(key, JSON.stringify(atoms.get($atom)));
      });
    }
  });
}

// Todo persistence:
const todoPersistence = persistenceSystem({
  'todo:items':  $todos,
  'todo:filter': $filter,
});

// Settings persistence — same factory, different config:
const $theme    = atom<'light' | 'dark'>('dark');
const $language = atom('en');
const $fontSize = atom(14);

const settingsPersistence = persistenceSystem({
  'settings:theme':    $theme,
  'settings:language': $language,
  'settings:fontSize': $fontSize,
});`;

const STEP6_CODE = `import { atom, signal, system, reactive, effects, listen } from 'kho';

// ── Component atoms ──
// Each Map stores one "component" per entity (todo.id → value).
// Adding a new component = adding a new Map atom. Zero changes to Todo.
const $categories = atom<Map<number, string>>(new Map());
const $priorities = atom<Map<number, 'low' | 'medium' | 'high'>>(new Map());

const requestSetCategory = signal<{ id: number; category: string }>();
const requestSetPriority = signal<{ id: number; priority: 'low' | 'medium' | 'high' }>();

// ── Metadata System ──
// Manages component data. Knows nothing about todoSystem.
const metadataSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { on }    = scope(listen);
  const { effect } = scope(effects);

  on(requestSetCategory, ({ id, category }) => {
    const m = new Map(atoms.get($categories));
    category ? m.set(id, category) : m.delete(id);
    atoms.set($categories, m);
  });

  on(requestSetPriority, ({ id, priority }) => {
    const m = new Map(atoms.get($priorities));
    m.set(id, priority);
    atoms.set($priorities, m);
  });

  // Auto-cleanup: when a todo is deleted, its metadata follows.
  // This effect watches $todos — an atom it doesn't own —
  // and removes orphaned entries from the component Maps.
  effect([$todos], () => {
    const ids = new Set(
      (atoms.get($todos) ?? []).map(t => t.id)
    );
    const cats = new Map(atoms.get($categories)!);
    const pris = new Map(atoms.get($priorities)!);
    let dirty = false;
    for (const k of cats.keys())
      if (!ids.has(k)) { cats.delete(k); dirty = true; }
    for (const k of pris.keys())
      if (!ids.has(k)) { pris.delete(k); dirty = true; }
    if (dirty) {
      atoms.set($categories, cats);
      atoms.set($priorities, pris);
    }
  });
});

// Register — todoSystem unchanged, just add alongside it
sets.add($systems, metadataSystem);`;

const STEP6_UI = `// The UI reads both entity atoms and component atoms.
// It doesn't import any system — just atoms and signals.

function EnrichedTodoItem({ todo }: { todo: Todo }) {
  const categories = useAtomValue($categories);
  const priorities = useAtomValue($priorities);
  const emit = useEmit();

  const category = categories.get(todo.id);
  const priority = priorities.get(todo.id);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Priority selector */}
      <select
        value={priority ?? ''}
        onChange={e => emit(requestSetPriority, {
          id: todo.id,
          priority: e.target.value as 'low' | 'medium' | 'high',
        })}
      >
        <option value="">—</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <span>{todo.text}</span>
      {/* Category selector */}
      <select
        value={category ?? ''}
        onChange={e => emit(requestSetCategory, {
          id: todo.id, category: e.target.value,
        })}
      >
        <option value="">no tag</option>
        <option value="work">work</option>
        <option value="personal">personal</option>
        <option value="errands">errands</option>
      </select>
    </div>
  );
}

// Key insight: remove metadataSystem from $systems and
// categories/priorities simply read as empty Maps.
// No errors, no crashes — the UI gracefully degrades.`;

// ============================================
// Cumulative file tabs per step
// ============================================

const STEP1_FILES = [
  { label: 'todo-system.ts', code: STEP1_CODE, lang: 'typescript' },
  { label: 'boot.ts', code: STEP1_BOOT, lang: 'typescript' },
];

const STEP2_FILES = [
  ...STEP1_FILES,
  { label: 'TodoUI.tsx', code: STEP2_CODE, lang: 'tsx' },
];

const STEP3_FILES = [
  ...STEP2_FILES,
  { label: 'history-system.ts', code: STEP3_CODE, lang: 'typescript' },
];

const STEP4_FILES = [
  ...STEP3_FILES,
  { label: 'persist.ts', code: STEP4_CODE, lang: 'typescript' },
];

const STEP5_FILES = [
  ...STEP4_FILES.filter(f => f.label !== 'persist.ts'),
  { label: 'persistence-factory.ts', code: STEP5_CODE, lang: 'typescript' },
];

const STEP6_FILES = [
  ...STEP5_FILES,
  { label: 'metadata-system.ts', code: STEP6_CODE, lang: 'typescript' },
  { label: 'EnrichedUI.tsx', code: STEP6_UI, lang: 'tsx' },
];

// ============================================
// Page Export
// ============================================

export function TodoApp() {
  return (
    <article className="prose">
      <h1>Building a Todo App with Kho</h1>
      <p>
        A step-by-step guide from zero to a fully-featured todo app.
        Each step adds an independent system — showing how kho lets you
        compose features without coupling.
      </p>

      <nav>
        <ol>
          <li><a href="#step-1">Define state & logic — the Todo System</a></li>
          <li><a href="#step-2">Connect to React — the UI layer</a></li>
          <li><a href="#step-3">Add undo/redo — the History System</a></li>
          <li><a href="#step-4">Persist to localStorage</a></li>
          <li><a href="#step-5">Generic persistence factory</a></li>
          <li><a href="#step-6">Extend without modifying — Component pattern</a></li>
        </ol>
      </nav>

      {/* ── Step 1 ── */}
      <h2 id="step-1">Step 1 — Define State & Logic</h2>
      <StepRow label="Step 1 · Atom State" demo={<Step1Demo />}>
        <p>
          Every kho app starts with <strong>atoms</strong> (state), <strong>signals</strong> (events),
          and a <strong>system</strong> (logic). The <code>system()</code> helper gives you
          a <code>scope</code> function that wraps API factories and auto-disposes them
          when the system shuts down.
        </p>
        <CodeTabs tabs={STEP1_FILES} defaultActive={0} />
        <p>
          To run this system, create a store, register it in <code>$systems</code>,
          and call <code>ignite()</code>. Ignite watches the <code>$systems</code> Set atom —
          when you add a system it starts, when you remove it it stops.
        </p>
        <blockquote>
          <strong>Key insight:</strong> The todo system is plain TypeScript — no React, no DOM.
          It can run in Node, a Web Worker, or a test file. The UI is just a projection of the atoms.
        </blockquote>
      </StepRow>

      {/* ── Step 2 ── */}
      <h2 id="step-2">Step 2 — Connect to React</h2>
      <StepRow label="Step 2 · Basic Todo" demo={<Step2Demo />}>
        <p>
          Kho's React bindings give you hooks that work like <code>useState</code>
          but read from the shared store:
        </p>
        <ul>
          <li><code>useAtom($atom)</code> — read + write, re-renders on change</li>
          <li><code>useAtomValue($atom)</code> — read only, re-renders on change</li>
          <li><code>useStore()</code> — get the store to emit signals</li>
        </ul>
        <p>
          To fire signals from UI, call <code>emit(signal, payload)</code> via <code>listen(store)</code>.
          The system receives the event through <code>on(signal, handler)</code>.
        </p>
        <CodeTabs tabs={STEP2_FILES} defaultActive={2} />
        <blockquote>
          <strong>Key insight:</strong> The UI never mutates <code>$todos</code> directly — it emits
          signals and the system handles mutation. Unidirectional data flow.
        </blockquote>
      </StepRow>

      {/* ── Step 3 ── */}
      <h2 id="step-3">Step 3 — Add Undo/Redo</h2>
      <StepRow label="Step 3 · History" demo={<Step3Demo />}>
        <p>
          This is where kho's system architecture shines. We add a completely independent
          history system that watches <code>$todos</code> and manages undo/redo stacks.
          It knows nothing about the todo system — it just reacts to atom changes.
        </p>
        <p>
          The history system introduces its own atoms (<code>$undoStack</code>, <code>$redoStack</code>,
          <code>$canUndo</code>, <code>$canRedo</code>) and signals (<code>requestUndo</code>,
          <code>requestRedo</code>, <code>requestJumpTo</code>). The UI binds to these the same
          way it binds to todo atoms.
        </p>
        <CodeTabs tabs={STEP3_FILES} defaultActive={3} />
        <blockquote>
          <strong>Pattern:</strong> Systems compose through atoms. The history system doesn't import
          the todo system — it only imports the <code>$todos</code> atom. You can remove it without
          touching a single line of todo code.
        </blockquote>
      </StepRow>

      {/* ── Step 4 ── */}
      <h2 id="step-4">Step 4 — Persist to localStorage</h2>
      <StepRow label="Step 4 · Persistence" demo={<Step4Demo />}>
        <p>
          Persistence is another independent system. We create a <strong>system factory</strong> —
          a function that returns a system configured for a specific atom and storage key.
        </p>
        <CodeTabs tabs={STEP4_FILES} defaultActive={4} />
        <p>
          Each <code>persistAtom()</code> call creates a standalone system that:
        </p>
        <ol>
          <li><strong>Hydrates</strong> — loads the saved value from localStorage on start</li>
          <li><strong>Persists</strong> — saves to localStorage whenever the atom changes</li>
        </ol>
        <p>
          Because it's a system, it auto-disposes when removed from <code>$systems</code>.
          No cleanup code needed in your components.
        </p>
      </StepRow>

      {/* ── Step 5 ── */}
      <h2 id="step-5">Step 5 — Generic Persistence Factory</h2>
      <StepRow label="Step 5 · Factory" demo={<Step4Demo />}>
        <p>
          The per-atom factory from Step 4 works, but you can batch many atoms
          into a single system. Pass a map of storage keys to atoms:
        </p>
        <CodeTabs tabs={STEP5_FILES} defaultActive={4} />
        <blockquote>
          <strong>Takeaway:</strong> A system factory is just a function that
          returns a <code>system()</code>. Because systems are plain
          functions <code>(store) =&gt; () =&gt; void</code>, they compose naturally —
          no special API needed.
        </blockquote>
      </StepRow>

      {/* ── Step 6 ── */}
      <h2 id="step-6">Step 6 — Extend Without Modifying</h2>
      <StepRow label="Step 6 · Components" demo={<Step6Demo />}>
        <p>
          What if you want to add <strong>category</strong> and <strong>priority</strong> to
          todo items? The traditional approach: change the <code>Todo</code> type, update
          every handler, modify the UI. With kho, there's a better way.
        </p>
        <p>
          Instead of modifying the entity, store each new property in its own <strong>Map
          atom</strong> — keyed by <code>todo.id</code>. A new <code>metadataSystem</code> manages
          these "component" atoms independently. The <code>Todo</code> type, <code>todoSystem</code>,
          and <code>historySystem</code> remain <strong>completely untouched</strong>.
        </p>
        <CodeTabs tabs={STEP6_FILES} defaultActive={5} />
        <p>
          The pattern scales naturally:
        </p>
        <ul>
          <li>Want <code>dueDate</code>? Add <code>$dueDates = atom&lt;Map&lt;number, Date&gt;&gt;(new Map())</code></li>
          <li>Want <code>assignee</code>? Add <code>$assignees = atom&lt;Map&lt;number, string&gt;&gt;(new Map())</code></li>
          <li>Want to remove a component? Delete the atom — no other code changes needed</li>
        </ul>
        <p>
          The auto-cleanup effect is key: when a todo is deleted via <code>requestRemove</code>,
          the metadata system's <code>effect([$todos])</code> fires and removes orphaned entries
          from all component Maps. No manual cleanup in the UI or todoSystem.
        </p>
        <blockquote>
          <strong>Pattern:</strong> Entity = minimal core data. Components = separate Map atoms
          per property. Systems manage components independently. This is the
          ECS (Entity-Component-System) pattern applied to state management —
          extend entities without modifying their structure.
        </blockquote>
      </StepRow>

      {/* ── Recap ── */}
      <h2>Architecture Recap</h2>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Role</th>
            <th>Coupling</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>todoSystem</code></td>
            <td>CRUD logic, derived state</td>
            <td>Owns <code>$todos</code>, <code>$filter</code></td>
          </tr>
          <tr>
            <td><code>historySystem</code></td>
            <td>Undo/redo stacks</td>
            <td>Reads <code>$todos</code> only</td>
          </tr>
          <tr>
            <td><code>metadataSystem</code></td>
            <td>Category, priority, …</td>
            <td>Reads <code>$todos</code> ids, owns component Maps</td>
          </tr>
          <tr>
            <td><code>persistAtom</code></td>
            <td>localStorage sync</td>
            <td>Generic — any atom</td>
          </tr>
          <tr>
            <td>React UI</td>
            <td>Render + emit signals</td>
            <td>No logic — reads atoms, emits signals</td>
          </tr>
        </tbody>
      </table>
      <p>
        Each system can be added, removed, or replaced independently.
        The store is the only shared surface — systems communicate through atoms
        and signals, never through direct imports of each other.
      </p>
    </article>
  );
}
