import { useEffect, useRef, useState } from 'react';
import {
  atom, createStore, reactive, effects, signal, listen, system, ignite, $systems,
  component, entities, query,
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

const CANVAS_WIDTH = 300, CANVAS_HEIGHT = 400;

const $score = atom(0);
const $lives = atom(3);
const $gameOver = atom(false);
const $mousePos = atom<Vec2>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
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
  const ecs = scope(query($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on } = scope(listen);

  ecs.add('player');
  ecs.set('player', $pos, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
  ecs.set('player', $radius, 12);
  ecs.set('player', $kind, 'player');

  let fireCooldown = 0;

  on(fireSignal, () => {
    if (atoms.get($gameOver)) return;
    if (fireCooldown > 0) return;
    fireCooldown = 8;
    const playerPos = ecs.get('player', $pos)!;
    const bulletId = eid('b');
    ecs.add(bulletId);
    ecs.set(bulletId, $pos, { x: playerPos.x, y: playerPos.y - 16 });
    ecs.set(bulletId, $vel, { x: 0, y: -9 });
    ecs.set(bulletId, $radius, 3);
    ecs.set(bulletId, $kind, 'bullet');
  });

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    if (fireCooldown > 0) fireCooldown--;

    const mouse = atoms.get($mousePos);
    if (!mouse) return;
    const playerPos = ecs.get('player', $pos);
    if (!playerPos) return;

    // Smoothly follow mouse X, clamp within bounds
    const dx = mouse.x - playerPos.x;
    const newX = Math.max(14, Math.min(CANVAS_WIDTH - 14, playerPos.x + dx * 0.3));
    ecs.set('player', $pos, { x: newX, y: playerPos.y });
  });

  on(restartSignal, () => {
    ecs.set('player', $pos, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 });
    atoms.set($score, 0);
    atoms.set($lives, 3);
    atoms.set($gameOver, false);
    for (const entity of ecs.all()) {
      if (ecs.get(entity, $kind) !== 'player') ecs.remove(entity);
    }
  });
});

// ============================================
// Spawn System — asteroid generation
// ============================================

const spawnSystem = system((scope) => {
  const ecs = scope(query($objects));
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

    const asteroidId = eid('a');
    const radius = 8 + Math.random() * 18;
    ecs.add(asteroidId);
    ecs.set(asteroidId, $pos, { x: radius + Math.random() * (CANVAS_WIDTH - 2 * radius), y: -radius });
    ecs.set(asteroidId, $vel, { x: (Math.random() - 0.5) * 2, y: 1.5 + Math.random() * 2.5 });
    ecs.set(asteroidId, $radius, radius);
    ecs.set(asteroidId, $kind, 'asteroid');
  });
});

// ============================================
// Physics System — movement + bounds cleanup
// ============================================

const physicsSystem = system((scope) => {
  const ecs = scope(query($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      for (const entity of ecs.select($pos, $vel)) {
        const pos = ecs.get(entity, $pos)!;
        const vel = ecs.get(entity, $vel)!;
        ecs.set(entity, $pos, { x: pos.x + vel.x, y: pos.y + vel.y });
      }
      for (const entity of ecs.all()) {
        const pos = ecs.get(entity, $pos);
        const kind = ecs.get(entity, $kind);
        if (!pos || kind === 'player') continue;
        if (pos.y < -60 || pos.y > CANVAS_HEIGHT + 60 || pos.x < -60 || pos.x > CANVAS_WIDTH + 60) ecs.remove(entity);
      }
    });
  });
});

// ============================================
// Collision System — bullet/asteroid, player/asteroid
// ============================================

const collisionSystem = system((scope) => {
  const ecs = scope(query($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);
  const { emit } = scope(listen);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      const bullets: string[] = [];
      const asteroids: string[] = [];
      for (const entity of ecs.all()) {
        const kind = ecs.get(entity, $kind);
        if (kind === 'bullet') bullets.push(entity);
        else if (kind === 'asteroid') asteroids.push(entity);
      }

      const destroyed = new Set<string>();

      for (const bullet of bullets) {
        if (destroyed.has(bullet)) continue;
        const bulletPos = ecs.get(bullet, $pos)!;
        for (const asteroid of asteroids) {
          if (destroyed.has(asteroid)) continue;
          const asteroidPos = ecs.get(asteroid, $pos)!;
          const asteroidRadius = ecs.get(asteroid, $radius)!;
          const dx = bulletPos.x - asteroidPos.x, dy = bulletPos.y - asteroidPos.y;
          if (dx * dx + dy * dy < asteroidRadius * asteroidRadius) {
            destroyed.add(bullet);
            destroyed.add(asteroid);
            atoms.set($score, (atoms.get($score) ?? 0) + 10);
            emit(explosionSignal, asteroidPos);
            break;
          }
        }
      }

      if (ecs.has('player')) {
        const playerPos = ecs.get('player', $pos)!;
        const playerRadius = ecs.get('player', $radius) ?? 12;
        for (const asteroid of asteroids) {
          if (destroyed.has(asteroid)) continue;
          const asteroidPos = ecs.get(asteroid, $pos)!;
          const asteroidRadius = ecs.get(asteroid, $radius)!;
          const dx = playerPos.x - asteroidPos.x, dy = playerPos.y - asteroidPos.y;
          if (dx * dx + dy * dy < (playerRadius + asteroidRadius) * (playerRadius + asteroidRadius)) {
            destroyed.add(asteroid);
            emit(explosionSignal, asteroidPos);
            const lives = Math.max(0, (atoms.get($lives) ?? 3) - 1);
            atoms.set($lives, lives);
            if (lives <= 0) atoms.set($gameOver, true);
          }
        }
      }

      for (const id of destroyed) {
        if (ecs.has(id)) ecs.remove(id);
      }
    });
  });
});

// ============================================
// Render System — canvas drawing
// ============================================

const renderSystem = system((scope) => {
  const ecs = scope(query($objects));
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on } = scope(listen);

  const stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    size: 0.5 + Math.random() * 1.5,
    speed: 0.2 + Math.random() * 0.5,
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
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const star of stars) {
      star.y += star.speed;
      if (star.y > CANVAS_HEIGHT) { star.y = 0; star.x = Math.random() * CANVAS_WIDTH; }
      ctx.globalAlpha = 0.2 + star.size * 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    for (const entity of ecs.all()) {
      const pos = ecs.get(entity, $pos);
      const radius = ecs.get(entity, $radius);
      const kind = ecs.get(entity, $kind);
      if (!pos || !radius || !kind) continue;

      switch (kind) {
        case 'player':
          ctx.fillStyle = '#4af';
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - 14);
          ctx.lineTo(pos.x - 10, pos.y + 8);
          ctx.lineTo(pos.x + 10, pos.y + 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f84';
          ctx.beginPath();
          ctx.moveTo(pos.x - 3, pos.y + 8);
          ctx.lineTo(pos.x, pos.y + 13 + Math.random() * 4);
          ctx.lineTo(pos.x + 3, pos.y + 8);
          ctx.closePath();
          ctx.fill();
          break;
        case 'bullet':
          ctx.fillStyle = '#ff4';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff4';
          ctx.fillRect(pos.x - 1.5, pos.y - 5, 3, 10);
          ctx.shadowBlur = 0;
          break;
        case 'asteroid':
          ctx.fillStyle = '#555';
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#444';
          ctx.beginPath();
          ctx.arc(pos.x - radius * 0.3, pos.y - radius * 0.2, radius * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    for (let i = booms.length - 1; i >= 0; i--) {
      const boom = booms[i]!;
      const progress = boom.life / 12;
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#fa4';
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, 18 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8';
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, 10 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
      boom.life--;
      if (boom.life <= 0) booms.splice(i, 1);
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
    ctx.fillText('\u2665'.repeat(lives), CANVAS_WIDTH - 8, 18);
    ctx.textAlign = 'left';

    if (atoms.get($gameOver)) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#4af';
      ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 8);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#888';
      ctx.fillText('Click to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32);
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
    const reactiveOps = reactive(store);
    if (canvasRef.current) reactiveOps.atoms.set($canvasEl, canvasRef.current);
    return () => { reactiveOps.atoms.set($canvasEl, null); reactiveOps.dispose(); };
  }, [store]);

  useEffect(() => {
    const reactiveOps = reactive(store);
    const { emit } = listen(store);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const move = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      reactiveOps.atoms.set($mousePos, {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      });
    };

    const click = (event: MouseEvent) => {
      event.preventDefault();
      if (reactiveOps.atoms.get($gameOver)) {
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
      reactiveOps.dispose();
    };
  }, [store]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
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
    const newStore = createStore();
    const reactiveOps = reactive(newStore);
    reactiveOps.sets.add($systems, renderSystem);
    const dispose = ignite(newStore);
    setStore(newStore);
    return () => { dispose(); reactiveOps.dispose(); };
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
    const newStore = createStore();
    const ecs = query($objects)(newStore);
    const reactiveOps = reactive(newStore);

    ecs.add('player');
    ecs.set('player', $pos, { x: 150, y: 350 });
    ecs.set('player', $radius, 12);
    ecs.set('player', $kind, 'player');

    ecs.add('asteroid_1');
    ecs.set('asteroid_1', $pos, { x: 80, y: 60 });
    ecs.set('asteroid_1', $vel, { x: 0.5, y: 2.0 });
    ecs.set('asteroid_1', $radius, 15);
    ecs.set('asteroid_1', $kind, 'asteroid');

    ecs.add('bullet_1');
    ecs.set('bullet_1', $pos, { x: 150, y: 320 });
    ecs.set('bullet_1', $vel, { x: 0, y: -9 });
    ecs.set('bullet_1', $radius, 3);
    ecs.set('bullet_1', $kind, 'bullet');

    reactiveOps.atoms.set($entitySnapshot, ['player', 'asteroid_1', 'bullet_1'].map(id => ({
      id,
      kind: ecs.get(id, $kind),
      pos: ecs.get(id, $pos),
      vel: ecs.get(id, $vel),
      radius: ecs.get(id, $radius),
    })));

    setStore(newStore);
    return () => { ecs.dispose(); reactiveOps.dispose(); };
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
      {snapshot.map(entry => (
        <div key={entry.id} className="rounded-md border border-border/50 overflow-hidden">
          <div className="px-2 py-1 bg-bg-code flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: kindColors[entry.kind ?? ''] ?? '#666' }} />
            <span className="text-text-muted font-semibold">{entry.id}</span>
            <span className="text-text-dim ml-auto">{entry.kind}</span>
          </div>
          <div className="px-2 py-1.5 flex flex-col gap-0.5 text-[11px]">
            {entry.pos && <Row label="$pos" value={`{x: ${entry.pos.x}, y: ${entry.pos.y}}`} />}
            {entry.vel && <Row label="$vel" value={`{x: ${entry.vel.x}, y: ${entry.vel.y}}`} />}
            {entry.radius != null && <Row label="$radius" value={String(entry.radius)} />}
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
    const newStore = createStore();
    const reactiveOps = reactive(newStore);
    reactiveOps.sets.add($systems, playerSystem);
    reactiveOps.sets.add($systems, renderSystem);
    const dispose = ignite(newStore);
    setStore(newStore);
    return () => { dispose(); reactiveOps.dispose(); };
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
    const newStore = createStore();
    const reactiveOps = reactive(newStore);
    reactiveOps.sets.add($systems, playerSystem);
    reactiveOps.sets.add($systems, spawnSystem);
    reactiveOps.sets.add($systems, physicsSystem);
    reactiveOps.sets.add($systems, renderSystem);
    const dispose = ignite(newStore);
    setStore(newStore);
    return () => { dispose(); reactiveOps.dispose(); };
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
    const newStore = createStore();
    const reactiveOps = reactive(newStore);
    reactiveOps.sets.add($systems, playerSystem);
    reactiveOps.sets.add($systems, spawnSystem);
    reactiveOps.sets.add($systems, physicsSystem);
    reactiveOps.sets.add($systems, collisionSystem);
    reactiveOps.sets.add($systems, renderSystem);
    const dispose = ignite(newStore);
    setStore(newStore);
    return () => { dispose(); reactiveOps.dispose(); };
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
  component, entities, query, atom, signal,
  system, reactive, effects, listen,
} from 'kho';

interface Vec2 { x: number; y: number }

// Components — typed data columns (Atom<Map<string, T>>)
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
  const ecs       = scope(query($objects)); // scoped ECS
  const { atoms } = scope(reactive);
  const { interval } = scope(effects);
  const { on, emit } = scope(listen);

  // Create player entity with components
  ecs.add('player');
  ecs.set('player', $pos, { x: 150, y: 350 });
  ecs.set('player', $radius, 12);
  ecs.set('player', $kind, 'player');

  let fireCooldown = 0;

  // Click → fire bullet
  on(fireSignal, () => {
    if (atoms.get($gameOver) || fireCooldown > 0) return;
    fireCooldown = 8;
    const playerPos = ecs.get('player', $pos)!;
    const bulletId = nextId('b');
    ecs.add(bulletId);
    ecs.set(bulletId, $pos, { x: playerPos.x, y: playerPos.y - 16 });
    ecs.set(bulletId, $vel, { x: 0, y: -9 });
    ecs.set(bulletId, $radius, 3);
    ecs.set(bulletId, $kind, 'bullet');
  });

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    if (fireCooldown > 0) fireCooldown--;

    // Ship smoothly follows mouse X position
    const mouse = atoms.get($mousePos);
    const playerPos = ecs.get('player', $pos)!;
    const dx = mouse.x - playerPos.x;
    const newX = Math.max(14, Math.min(286, playerPos.x + dx * 0.3));
    ecs.set('player', $pos, { x: newX, y: playerPos.y });
  });

  on(restartSignal, () => { /* reset player + clear entities */ });
});`;

const SPAWN_CODE = `const spawnSystem = system((scope) => {
  const ecs = scope(query($objects));
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

    const asteroidId = nextId('a');
    const radius = 8 + Math.random() * 18;
    ecs.add(asteroidId);
    ecs.set(asteroidId, $pos, { x: Math.random() * 300, y: -radius });
    ecs.set(asteroidId, $vel, {
      x: (Math.random() - 0.5) * 2,
      y: 1.5 + Math.random() * 2.5,
    });
    ecs.set(asteroidId, $radius, radius);
    ecs.set(asteroidId, $kind, 'asteroid');
  });
});`;

const PHYSICS_CODE = `const physicsSystem = system((scope) => {
  const ecs = scope(query($objects));
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      // Query: all entities with BOTH $pos and $vel
      for (const entity of ecs.select($pos, $vel)) {
        const pos = ecs.get(entity, $pos)!;
        const vel = ecs.get(entity, $vel)!;
        ecs.set(entity, $pos, { x: pos.x + vel.x, y: pos.y + vel.y });
      }
      // Remove off-screen entities
      for (const entity of ecs.all()) {
        const pos = ecs.get(entity, $pos);
        const kind = ecs.get(entity, $kind);
        if (!pos || kind === 'player') continue;
        if (pos.y < -60 || pos.y > 460) ecs.remove(entity);
      }
    });
  });
});`;

const COLLISION_CODE = `const collisionSystem = system((scope) => {
  const ecs = scope(query($objects));
  const { atoms }  = scope(reactive);
  const { interval, batch } = scope(effects);
  const { emit }   = scope(listen);  // can emit signals

  interval(16, () => {
    if (atoms.get($gameOver)) return;
    batch(() => {
      const bullets   = ecs.all().filter(
        entity => ecs.get(entity, $kind) === 'bullet'
      );
      const asteroids = ecs.all().filter(
        entity => ecs.get(entity, $kind) === 'asteroid'
      );

      // Bullet → Asteroid
      for (const bullet of bullets) {
        const bulletPos = ecs.get(bullet, $pos)!;
        for (const asteroid of asteroids) {
          const asteroidPos = ecs.get(asteroid, $pos)!;
          const asteroidRadius = ecs.get(asteroid, $radius)!;
          const dx = bulletPos.x - asteroidPos.x, dy = bulletPos.y - asteroidPos.y;
          if (dx*dx + dy*dy < asteroidRadius*asteroidRadius) {
            ecs.remove(bullet);
            ecs.remove(asteroid);
            atoms.set($score, (atoms.get($score) ?? 0) + 10);
            emit(explosionSignal, asteroidPos);  // → renderSystem
            break;
          }
        }
      }

      // Asteroid → Player
      const playerPos = ecs.get('player', $pos)!;
      const playerRadius = ecs.get('player', $radius)!;
      for (const asteroid of asteroids) {
        const asteroidPos = ecs.get(asteroid, $pos)!;
        const asteroidRadius = ecs.get(asteroid, $radius)!;
        const dx = playerPos.x - asteroidPos.x, dy = playerPos.y - asteroidPos.y;
        if (dx*dx + dy*dy < (playerRadius+asteroidRadius)*(playerRadius+asteroidRadius)) {
          ecs.remove(asteroid);
          emit(explosionSignal, asteroidPos);
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
          A <strong>component</strong> is a typed data column — <code>Atom&lt;Map&lt;string, T&gt;&gt;</code>.
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
          and spawns bullet entities when <code>fireSignal</code> fires (on click). It uses <code>scope(query($objects))</code>
          to get a scoped ECS handle that auto-disposes when the system stops.
        </p>
        <CodeTabs tabs={STEP2_FILES} defaultActive={1} />
        <p>
          <code>ecs.add(id)</code> registers an entity in the set.
          <code>ecs.set()</code> attaches component data.
          The render system draws whatever entities exist.
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
          The query <code>ecs.select($pos, $vel)</code> returns only matching entities — the player
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
