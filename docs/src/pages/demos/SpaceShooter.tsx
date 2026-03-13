import { useEffect, useRef, useState } from 'react';
import {
  atom, createStore, reactive, effects, signal, listen, system, ignite, $systems,
  component, entities, world,
} from 'kho';
import { KhoProvider, useAtomValue, useStore } from 'kho/react';
import { CodeTabs } from '../../components/CodeTabs';

// ============================================
// ECS Components — data columns
// ============================================

interface Vec2 { x: number; y: number }

const $pos = component<Vec2>();
const $vel = component<Vec2>();
const $radius = component<number>();
const $kind = component<'player' | 'bullet' | 'asteroid'>();

const $objects = entities();

// ============================================
// Global State
// ============================================

const W = 300, H = 400;

const $score = atom(0);
const $lives = atom(3);
const $gameOver = atom(false);
const $mousePos = atom<Vec2>({ x: W / 2, y: H - 50 });
const $canvasEl = atom<HTMLCanvasElement | null>(null);

// For Step 1 inspector
const $entitySnapshot = atom<{ id: string; kind?: string; pos?: Vec2; vel?: Vec2; radius?: number }[]>([]);

const restartSignal = signal<void>();
const explosionSignal = signal<Vec2>();
const fireSignal = signal<void>();

// ============================================
// Helpers
// ============================================

let _eid = 0;
function eid(prefix: string) { return `${prefix}_${++_eid}`; }

// ============================================
// Player System — follows mouse, click to fire
// ============================================

const playerSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on } = scope(listen);

  const player = ecs.entity('player');
  ecs.set(player, $pos, { x: W / 2, y: H - 50 });
  ecs.set(player, $radius, 12);
  ecs.set(player, $kind, 'player');
  ecs.add(player);

  let fireCd = 0;

  on(fireSignal, () => {
    if (atoms.get($gameOver)) return;
    if (fireCd > 0) return;
    fireCd = 8;
    const pp = ecs.get(player, $pos)!;
    const b = ecs.entity(eid('b'));
    ecs.set(b, $pos, { x: pp.x, y: pp.y - 16 });
    ecs.set(b, $vel, { x: 0, y: -9 });
    ecs.set(b, $radius, 3);
    ecs.set(b, $kind, 'bullet');
    ecs.add(b);
  });

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    if (fireCd > 0) fireCd--;

    const mouse = atoms.get($mousePos);
    if (!mouse) return;
    const p = ecs.get(player, $pos);
    if (!p) return;

    // Smoothly follow mouse X, clamp within bounds
    const dx = mouse.x - p.x;
    const newX = Math.max(14, Math.min(W - 14, p.x + dx * 0.3));
    ecs.set(player, $pos, { x: newX, y: p.y });
  });

  on(restartSignal, () => {
    ecs.set(player, $pos, { x: W / 2, y: H - 50 });
    atoms.set($score, 0);
    atoms.set($lives, 3);
    atoms.set($gameOver, false);
    for (const e of ecs.all()) {
      if (ecs.get(e, $kind) !== 'player') ecs.remove(e);
    }
  });
});

// ============================================
// Spawn System — asteroid generation
// ============================================

const spawnSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);

  let timer = 0;

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    timer++;
    const score = atoms.get($score) ?? 0;
    const rate = Math.max(15, 50 - Math.floor(score / 30));
    if (timer < rate) return;
    timer = 0;

    const a = ecs.entity(eid('a'));
    const r = 8 + Math.random() * 18;
    ecs.set(a, $pos, { x: r + Math.random() * (W - 2 * r), y: -r });
    ecs.set(a, $vel, { x: (Math.random() - 0.5) * 2, y: 1.5 + Math.random() * 2.5 });
    ecs.set(a, $radius, r);
    ecs.set(a, $kind, 'asteroid');
    ecs.add(a);
  });
});

// ============================================
// Physics System — movement + bounds cleanup
// ============================================

const physicsSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      for (const e of ecs.with($pos, $vel)) {
        const p = ecs.get(e, $pos)!;
        const v = ecs.get(e, $vel)!;
        ecs.set(e, $pos, { x: p.x + v.x, y: p.y + v.y });
      }
      for (const e of ecs.all()) {
        const p = ecs.get(e, $pos);
        const k = ecs.get(e, $kind);
        if (!p || k === 'player') continue;
        if (p.y < -60 || p.y > H + 60 || p.x < -60 || p.x > W + 60) ecs.remove(e);
      }
    });
  });
});

// ============================================
// Collision System — bullet/asteroid, player/asteroid
// ============================================

const collisionSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);
  const { emit } = scope(listen);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      const bullets: ReturnType<typeof ecs.entity>[] = [];
      const asteroids: ReturnType<typeof ecs.entity>[] = [];
      for (const e of ecs.all()) {
        const k = ecs.get(e, $kind);
        if (k === 'bullet') bullets.push(e);
        else if (k === 'asteroid') asteroids.push(e);
      }

      const dead = new Set<string>();

      for (const b of bullets) {
        if (dead.has(b.id)) continue;
        const bp = ecs.get(b, $pos)!;
        for (const a of asteroids) {
          if (dead.has(a.id)) continue;
          const ap = ecs.get(a, $pos)!;
          const ar = ecs.get(a, $radius)!;
          const dx = bp.x - ap.x, dy = bp.y - ap.y;
          if (dx * dx + dy * dy < ar * ar) {
            dead.add(b.id);
            dead.add(a.id);
            atoms.set($score, (atoms.get($score) ?? 0) + 10);
            emit(explosionSignal, ap);
            break;
          }
        }
      }

      const player = ecs.entity('player');
      if (ecs.has(player)) {
        const pp = ecs.get(player, $pos)!;
        const pr = ecs.get(player, $radius) ?? 12;
        for (const a of asteroids) {
          if (dead.has(a.id)) continue;
          const ap = ecs.get(a, $pos)!;
          const ar = ecs.get(a, $radius)!;
          const dx = pp.x - ap.x, dy = pp.y - ap.y;
          if (dx * dx + dy * dy < (pr + ar) * (pr + ar)) {
            dead.add(a.id);
            emit(explosionSignal, ap);
            const lives = Math.max(0, (atoms.get($lives) ?? 3) - 1);
            atoms.set($lives, lives);
            if (lives <= 0) atoms.set($gameOver, true);
          }
        }
      }

      for (const id of dead) {
        const e = ecs.entity(id);
        if (ecs.has(e)) ecs.remove(e);
      }
    });
  });
});

// ============================================
// Render System — canvas drawing
// ============================================

const renderSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on } = scope(listen);

  const stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: 0.5 + Math.random() * 1.5,
    sp: 0.2 + Math.random() * 0.5,
  }));

  const booms: { x: number; y: number; life: number }[] = [];

  on(explosionSignal, (pos) => {
    if (pos) booms.push({ x: pos.x, y: pos.y, life: 12 });
  });

  interval(16, () => {
    const canvas = atoms.get($canvasEl);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#08081a';
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      s.y += s.sp;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      ctx.globalAlpha = 0.2 + s.s * 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    for (const e of ecs.all()) {
      const p = ecs.get(e, $pos);
      const r = ecs.get(e, $radius);
      const k = ecs.get(e, $kind);
      if (!p || !r || !k) continue;

      switch (k) {
        case 'player':
          ctx.fillStyle = '#4af';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 14);
          ctx.lineTo(p.x - 10, p.y + 8);
          ctx.lineTo(p.x + 10, p.y + 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f84';
          ctx.beginPath();
          ctx.moveTo(p.x - 3, p.y + 8);
          ctx.lineTo(p.x, p.y + 13 + Math.random() * 4);
          ctx.lineTo(p.x + 3, p.y + 8);
          ctx.closePath();
          ctx.fill();
          break;
        case 'bullet':
          ctx.fillStyle = '#ff4';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff4';
          ctx.fillRect(p.x - 1.5, p.y - 5, 3, 10);
          ctx.shadowBlur = 0;
          break;
        case 'asteroid':
          ctx.fillStyle = '#555';
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#444';
          ctx.beginPath();
          ctx.arc(p.x - r * 0.3, p.y - r * 0.2, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]!;
      const t = b.life / 12;
      ctx.globalAlpha = t;
      ctx.fillStyle = '#fa4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 18 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      b.life--;
      if (b.life <= 0) booms.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    const score = atoms.get($score) ?? 0;
    const lives = atoms.get($lives) ?? 0;
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${score}`, 8, 18);
    ctx.fillStyle = '#f44';
    ctx.textAlign = 'right';
    ctx.fillText('\u2665'.repeat(lives), W - 8, 18);
    ctx.textAlign = 'left';

    if (atoms.get($gameOver)) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#4af';
      ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 8);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#888';
      ctx.fillText('Click to restart', W / 2, H / 2 + 32);
      ctx.textAlign = 'left';
    }
  });
});

// ============================================
// Shared React Components
// ============================================

function GameCanvas({ showHud }: { showHud?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useStore();

  useEffect(() => {
    const r = reactive(store);
    if (canvasRef.current) r.atoms.set($canvasEl, canvasRef.current);
    return () => { r.atoms.set($canvasEl, null); r.dispose(); };
  }, [store]);

  useEffect(() => {
    const r = reactive(store);
    const { emit } = listen(store);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      r.atoms.set($mousePos, {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      });
    };

    const click = (e: MouseEvent) => {
      e.preventDefault();
      if (r.atoms.get($gameOver)) {
        emit(restartSignal);
      } else {
        emit(fireSignal);
      }
    };

    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('click', click);
    return () => {
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('click', click);
      r.dispose();
    };
  }, [store]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg"
        style={{ display: 'block', width: '100%', height: 'auto', cursor: 'crosshair' }}
      />
      {showHud !== false && (
        <div className="mt-1.5 text-center text-[10px] text-text-dim font-mono">
          Move mouse · Click to shoot
        </div>
      )}
    </div>
  );
}

// ============================================
// Per-step Demo Components
// ============================================

/** Step 1: Starfield only — just the render system, no entities */
function Step1Demo() {
  const [store, setStore] = useState<ReturnType<typeof createStore> | null>(null);
  useEffect(() => {
    const s = createStore();
    const r = reactive(s);
    r.sets.add($systems, renderSystem);
    const dispose = ignite(s);
    setStore(s);
    return () => { dispose(); r.dispose(); };
  }, []);

  if (!store) return null;
  return (
    <KhoProvider store={store}>
      <GameCanvas showHud={false} />
      <div className="mt-1 text-center text-[10px] text-text-dim font-mono">
        Just a starfield — no entities yet.
      </div>
    </KhoProvider>
  );
}

/** Step 1b: Entity inspector — shows ECS data */
function Step1bDemo() {
  const [store, setStore] = useState<ReturnType<typeof createStore> | null>(null);
  useEffect(() => {
    const s = createStore();
    const ecs = world($objects)(s);
    const r = reactive(s);

    const player = ecs.entity('player');
    ecs.set(player, $pos, { x: 150, y: 350 });
    ecs.set(player, $radius, 12);
    ecs.set(player, $kind, 'player');
    ecs.add(player);

    const a1 = ecs.entity('asteroid_1');
    ecs.set(a1, $pos, { x: 80, y: 60 });
    ecs.set(a1, $vel, { x: 0.5, y: 2.0 });
    ecs.set(a1, $radius, 15);
    ecs.set(a1, $kind, 'asteroid');
    ecs.add(a1);

    const b1 = ecs.entity('bullet_1');
    ecs.set(b1, $pos, { x: 150, y: 320 });
    ecs.set(b1, $vel, { x: 0, y: -9 });
    ecs.set(b1, $radius, 3);
    ecs.set(b1, $kind, 'bullet');
    ecs.add(b1);

    r.atoms.set($entitySnapshot, [player, a1, b1].map(e => ({
      id: e.id,
      kind: ecs.get(e, $kind),
      pos: ecs.get(e, $pos),
      vel: ecs.get(e, $vel),
      radius: ecs.get(e, $radius),
    })));

    setStore(s);
    return () => { ecs.dispose(); r.dispose(); };
  }, []);

  if (!store) return null;
  return (
    <KhoProvider store={store}>
      <EntityInspector />
    </KhoProvider>
  );
}

function EntityInspector() {
  const snapshot = useAtomValue($entitySnapshot);
  const kindColors: Record<string, string> = { player: '#4af', asteroid: '#888', bullet: '#ff4' };

  return (
    <div className="flex flex-col gap-3 text-xs font-mono">
      <div className="text-[10px] uppercase tracking-wider text-text-dim font-semibold">Entity · Component Data</div>
      {snapshot.map(e => (
        <div key={e.id} className="rounded-md border border-border/50 overflow-hidden">
          <div className="px-2 py-1 bg-bg-code flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: kindColors[e.kind ?? ''] ?? '#666' }} />
            <span className="text-text-muted font-semibold">{e.id}</span>
            <span className="text-text-dim ml-auto">{e.kind}</span>
          </div>
          <div className="px-2 py-1.5 flex flex-col gap-0.5 text-[11px]">
            {e.pos && <Row label="$pos" value={`{x: ${e.pos.x}, y: ${e.pos.y}}`} />}
            {e.vel && <Row label="$vel" value={`{x: ${e.vel.x}, y: ${e.vel.y}}`} />}
            {e.radius != null && <Row label="$radius" value={String(e.radius)} />}
          </div>
        </div>
      ))}
      <div className="text-[10px] text-text-dim pt-1 border-t border-border">
        No systems running yet — just data.
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-accent shrink-0">{label}</span>
      <span className="text-text-muted">{value}</span>
    </div>
  );
}

/** Step 2: Player + render only — ship follows mouse, shoots into void */
function Step2Demo() {
  const [store, setStore] = useState<ReturnType<typeof createStore> | null>(null);
  useEffect(() => {
    const s = createStore();
    const r = reactive(s);
    r.sets.add($systems, playerSystem);
    r.sets.add($systems, renderSystem);
    const dispose = ignite(s);
    setStore(s);
    return () => { dispose(); r.dispose(); };
  }, []);

  if (!store) return null;
  return (
    <KhoProvider store={store}>
      <GameCanvas />
    </KhoProvider>
  );
}

/** Step 3: + spawn + physics — asteroids fall, no collisions */
function Step3Demo() {
  const [store, setStore] = useState<ReturnType<typeof createStore> | null>(null);
  useEffect(() => {
    const s = createStore();
    const r = reactive(s);
    r.sets.add($systems, playerSystem);
    r.sets.add($systems, spawnSystem);
    r.sets.add($systems, physicsSystem);
    r.sets.add($systems, renderSystem);
    const dispose = ignite(s);
    setStore(s);
    return () => { dispose(); r.dispose(); };
  }, []);

  if (!store) return null;
  return (
    <KhoProvider store={store}>
      <GameCanvas />
      <div className="mt-1 px-2 py-1 rounded-md bg-amber/5 border border-amber/20 text-[10px] text-amber text-center">
        No collisions — bullets pass through!
      </div>
    </KhoProvider>
  );
}

/** Step 4: + collision — full game */
function Step4Demo() {
  const [store, setStore] = useState<ReturnType<typeof createStore> | null>(null);
  useEffect(() => {
    const s = createStore();
    const r = reactive(s);
    r.sets.add($systems, playerSystem);
    r.sets.add($systems, spawnSystem);
    r.sets.add($systems, physicsSystem);
    r.sets.add($systems, collisionSystem);
    r.sets.add($systems, renderSystem);
    const dispose = ignite(s);
    setStore(s);
    return () => { dispose(); r.dispose(); };
  }, []);

  if (!store) return null;
  return (
    <KhoProvider store={store}>
      <GameCanvas />
    </KhoProvider>
  );
}

/** Layout wrapper: content left, demo right */
function StepRow({ children, demo, label }: { children: React.ReactNode; demo: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 32 }}>
        <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border bg-bg-code flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green" />
            <span className="text-[11px] font-semibold text-text-muted font-mono">{label}</span>
          </div>
          <div className="p-3">
            {demo}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Source code strings
// ============================================

const ECS_CODE = `import {
  component, entities, world, atom, signal,
  system, reactive, effects, listen,
} from 'kho';

interface Vec2 { x: number; y: number }

// Components — typed data columns (Atom<WeakMap<Entity, T>>)
const $pos    = component<Vec2>();   // position
const $vel    = component<Vec2>();   // velocity
const $radius = component<number>(); // collision radius
const $kind   = component<'player' | 'bullet' | 'asteroid'>();

// Entity registry — tracks which entities exist
const $objects = entities();

// Global atoms
const $score    = atom(0);
const $lives    = atom(3);
const $gameOver = atom(false);
const $mousePos = atom<Vec2>({ x: 150, y: 350 });

// Signals
const restartSignal   = signal<void>();
const explosionSignal = signal<Vec2>();
const fireSignal      = signal<void>();`;

const PLAYER_CODE = `const playerSystem = system((scope) => {
  const ecs       = scope(world($objects)); // scoped ECS
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on, emit } = scope(listen);

  // Create player entity with components
  const player = ecs.entity('player');
  ecs.set(player, $pos, { x: 150, y: 350 });
  ecs.set(player, $radius, 12);
  ecs.set(player, $kind, 'player');
  ecs.add(player);  // register in $objects

  let fireCd = 0;

  // Click → fire bullet
  on(fireSignal, () => {
    if (atoms.get($gameOver) || fireCd > 0) return;
    fireCd = 8;
    const pp = ecs.get(player, $pos)!;
    const b = ecs.entity(nextId('b'));
    ecs.set(b, $pos, { x: pp.x, y: pp.y - 16 });
    ecs.set(b, $vel, { x: 0, y: -9 });
    ecs.set(b, $radius, 3);
    ecs.set(b, $kind, 'bullet');
    ecs.add(b);
  });

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    if (fireCd > 0) fireCd--;

    // Ship smoothly follows mouse X position
    const mouse = atoms.get($mousePos);
    const p = ecs.get(player, $pos)!;
    const dx = mouse.x - p.x;
    const newX = Math.max(14, Math.min(286, p.x + dx * 0.3));
    ecs.set(player, $pos, { x: newX, y: p.y });
  });

  on(restartSignal, () => { /* reset player + clear entities */ });
});`;

const SPAWN_CODE = `const spawnSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);

  let timer = 0;

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    timer++;

    // Difficulty: spawn faster as score increases
    const score = atoms.get($score) ?? 0;
    const rate = Math.max(15, 50 - Math.floor(score / 30));
    if (timer < rate) return;
    timer = 0;

    const a = ecs.entity(nextId('a'));
    const r = 8 + Math.random() * 18;
    ecs.set(a, $pos, { x: Math.random() * 300, y: -r });
    ecs.set(a, $vel, {
      x: (Math.random() - 0.5) * 2,
      y: 1.5 + Math.random() * 2.5,
    });
    ecs.set(a, $radius, r);
    ecs.set(a, $kind, 'asteroid');
    ecs.add(a);
  });
});`;

const PHYSICS_CODE = `const physicsSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      // Query: all entities with BOTH $pos and $vel
      for (const e of ecs.with($pos, $vel)) {
        const p = ecs.get(e, $pos)!;
        const v = ecs.get(e, $vel)!;
        ecs.set(e, $pos, { x: p.x + v.x, y: p.y + v.y });
      }
      // Remove off-screen entities
      for (const e of ecs.all()) {
        const p = ecs.get(e, $pos);
        const k = ecs.get(e, $kind);
        if (!p || k === 'player') continue;
        if (p.y < -60 || p.y > 460) ecs.remove(e);
      }
    });
  });
});`;

const COLLISION_CODE = `const collisionSystem = system((scope) => {
  const ecs = scope(world($objects));
  const { atoms }  = scope(reactive);
  const { interval, batch } = scope(effects);
  const { emit }   = scope(listen);  // can emit signals

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      const bullets   = ecs.all().filter(
        e => ecs.get(e, $kind) === 'bullet'
      );
      const asteroids = ecs.all().filter(
        e => ecs.get(e, $kind) === 'asteroid'
      );

      // Bullet → Asteroid
      for (const b of bullets) {
        const bp = ecs.get(b, $pos)!;
        for (const a of asteroids) {
          const ap = ecs.get(a, $pos)!;
          const ar = ecs.get(a, $radius)!;
          const dx = bp.x - ap.x, dy = bp.y - ap.y;
          if (dx*dx + dy*dy < ar*ar) {
            ecs.remove(b);
            ecs.remove(a);
            atoms.set($score, (atoms.get($score) ?? 0) + 10);
            emit(explosionSignal, ap);  // → renderSystem
            break;
          }
        }
      }

      // Asteroid → Player
      const player = ecs.entity('player');
      const pp = ecs.get(player, $pos)!;
      const pr = ecs.get(player, $radius)!;
      for (const a of asteroids) {
        const ap = ecs.get(a, $pos)!;
        const ar = ecs.get(a, $radius)!;
        const dx = pp.x - ap.x, dy = pp.y - ap.y;
        if (dx*dx + dy*dy < (pr+ar)*(pr+ar)) {
          ecs.remove(a);
          emit(explosionSignal, ap);
          const lives = (atoms.get($lives) ?? 3) - 1;
          atoms.set($lives, lives);
          if (lives <= 0) atoms.set($gameOver, true);
        }
      }
    });
  });
});`;

const COMPOSE_CODE = `import { createStore, reactive, ignite, $systems } from 'kho';

const store = createStore();
const { sets } = reactive(store);

// Register systems — order = startup priority
sets.add($systems, playerSystem);
sets.add($systems, spawnSystem);
sets.add($systems, physicsSystem);
sets.add($systems, collisionSystem);
sets.add($systems, renderSystem);

const dispose = ignite(store);
// All 5 systems now running. dispose() stops them all.

// Remove a system at runtime:
sets.delete($systems, collisionSystem);
// → bullets now fly through asteroids (graceful degradation)`;

// ============================================
// Cumulative file tabs per step
// ============================================

const STEP1_FILES = [
  { label: 'ecs-setup.ts', code: ECS_CODE, lang: 'typescript' },
];

const STEP2_FILES = [
  ...STEP1_FILES,
  { label: 'player-system.ts', code: PLAYER_CODE, lang: 'typescript' },
];

const STEP3_FILES = [
  ...STEP2_FILES,
  { label: 'spawn-system.ts', code: SPAWN_CODE, lang: 'typescript' },
  { label: 'physics-system.ts', code: PHYSICS_CODE, lang: 'typescript' },
];

const STEP4_FILES = [
  ...STEP3_FILES,
  { label: 'collision-system.ts', code: COLLISION_CODE, lang: 'typescript' },
];

const STEP5_FILES = [
  ...STEP4_FILES,
  { label: 'main.ts', code: COMPOSE_CODE, lang: 'typescript' },
];

// ============================================
// Page Export
// ============================================

export function SpaceShooter() {
  return (
    <article className="prose">
      <h1>Space Shooter — ECS in Action</h1>
      <p>
        A step-by-step guide building a canvas game with kho's <strong>Entity Component System</strong>.
        Entities are just IDs. Data lives in components. Logic lives in systems.
        Each step adds a new system — the game gains capabilities without touching existing code.
      </p>

      <nav>
        <ol>
          <li><a href="#step-1">Define the ECS data model</a></li>
          <li><a href="#step-2">Player system — mouse control & shooting</a></li>
          <li><a href="#step-3">Spawning & physics — asteroids fall</a></li>
          <li><a href="#step-4">Collision system — the game works</a></li>
          <li><a href="#step-5">Composing systems — the architecture</a></li>
        </ol>
      </nav>

      {/* ── Step 1 ── */}
      <h2 id="step-1">Step 1 — Define the ECS Data Model</h2>
      <StepRow label="Step 1 · Starfield" demo={<Step1Demo />}>
        <p>
          In ECS, data and logic are completely separated.
          A <strong>component</strong> is a typed data column — <code>Atom&lt;WeakMap&lt;Entity, T&gt;&gt;</code>.
          An <strong>entity</strong> is just an ID; it gains behavior by having components attached.
        </p>
        <p>
          We start with the render system only — just a starfield background, no entities.
          The panel on the right shows what a running <code>renderSystem</code> draws when
          the entity set is empty.
        </p>
        <CodeTabs tabs={STEP1_FILES} defaultActive={0} />
        <blockquote>
          <strong>Key insight:</strong> Components are pure data — no methods, no inheritance.
          An asteroid and a bullet share <code>$pos</code> and <code>$vel</code> but have
          different <code>$kind</code> values. Composition over inheritance.
        </blockquote>
        <h4>Entity Inspector</h4>
        <p>Here's what entities look like when you manually create them — each is just an ID with component data attached:</p>
        <Step1bDemo />
      </StepRow>

      {/* ── Step 2 ── */}
      <h2 id="step-2">Step 2 — Player System</h2>
      <StepRow label="Step 2 · Ship Only" demo={<Step2Demo />}>
        <p>
          The player system creates a ship entity, reads mouse position from the <code>$mousePos</code> atom,
          and spawns bullet entities when <code>fireSignal</code> fires (on click). It uses <code>scope(world($objects))</code>
          to get a scoped ECS handle that auto-disposes when the system stops.
        </p>
        <CodeTabs tabs={STEP2_FILES} defaultActive={1} />
        <p>
          <code>ecs.entity(id)</code> creates or retrieves an entity by string ID.
          <code>ecs.set()</code> attaches component data. <code>ecs.add()</code> registers it
          in the entity set. The render system draws whatever entities exist.
        </p>
      </StepRow>

      {/* ── Step 3 ── */}
      <h2 id="step-3">Step 3 — Spawning & Physics</h2>
      <StepRow label="Step 3 · No Collisions" demo={<Step3Demo />}>
        <p>
          Two new systems: <strong>spawnSystem</strong> creates asteroid entities at increasing rates
          (difficulty scales with score), and <strong>physicsSystem</strong> moves every entity that
          has both <code>$pos</code> and <code>$vel</code>.
        </p>
        <p>
          The query <code>ecs.with($pos, $vel)</code> returns only matching entities — the player
          has no <code>$vel</code> (it moves via mouse input), so it's excluded automatically.
        </p>
        <CodeTabs tabs={STEP3_FILES} defaultActive={2} />
        <blockquote>
          <strong>Pattern:</strong> <code>batch()</code> groups many <code>ecs.set()</code> calls
          into a single notification. Without it, effects watching <code>$pos</code> would
          fire once per entity per frame.
        </blockquote>
      </StepRow>

      {/* ── Step 4 ── */}
      <h2 id="step-4">Step 4 — Collision & Game Logic</h2>
      <StepRow label="Step 4 · Full Game" demo={<Step4Demo />}>
        <p>
          The collision system checks bullet→asteroid and asteroid→player overlaps every frame.
          When it detects a hit, it removes both entities, updates <code>$score</code> or <code>$lives</code>,
          and emits <code>explosionSignal</code> — a <strong>signal</strong> that the render system
          listens for to spawn visual effects.
        </p>
        <CodeTabs tabs={STEP4_FILES} defaultActive={4} />
        <blockquote>
          <strong>Pattern:</strong> Systems communicate through <strong>atoms</strong> (shared state)
          and <strong>signals</strong> (fire-and-forget events). The collision system doesn't import
          the render system — it just emits <code>explosionSignal</code>. Any system can listen.
        </blockquote>
      </StepRow>

      {/* ── Step 5 ── */}
      <h2 id="step-5">Step 5 — Composing Systems</h2>
      <StepRow label="Step 5 · Complete" demo={<Step4Demo />}>
        <p>
          Each system is a standalone function <code>(store) =&gt; () =&gt; void</code>.
          Register them in <code>$systems</code>, call <code>ignite()</code>, and the game runs.
          Remove a system at runtime and the game gracefully degrades — delete <code>collisionSystem</code>
          and bullets fly through asteroids.
        </p>
        <CodeTabs tabs={STEP5_FILES} defaultActive={5} />
      </StepRow>

      {/* ── Recap ── */}
      <h2>Architecture</h2>
      <table>
        <thead>
          <tr><th>System</th><th>Reads</th><th>Writes</th><th>Signals</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>playerSystem</code></td>
            <td><code>$mousePos</code></td>
            <td>player <code>$pos</code>, spawns bullets</td>
            <td>listens <code>restartSignal</code>, <code>fireSignal</code></td>
          </tr>
          <tr>
            <td><code>spawnSystem</code></td>
            <td><code>$score</code> (difficulty)</td>
            <td>spawns asteroids</td>
            <td>—</td>
          </tr>
          <tr>
            <td><code>physicsSystem</code></td>
            <td><code>$pos</code>, <code>$vel</code></td>
            <td>updates <code>$pos</code></td>
            <td>—</td>
          </tr>
          <tr>
            <td><code>collisionSystem</code></td>
            <td>all entities</td>
            <td><code>$score</code>, <code>$lives</code></td>
            <td>emits <code>explosionSignal</code></td>
          </tr>
          <tr>
            <td><code>renderSystem</code></td>
            <td>all entities</td>
            <td>canvas pixels</td>
            <td>listens <code>explosionSignal</code></td>
          </tr>
        </tbody>
      </table>
      <p>
        Every system touches only the data it needs. No system imports another.
        The store is the only shared surface — composition through data, not code dependencies.
      </p>
    </article>
  );
}
