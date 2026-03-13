import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  atom,
  component,
  entities,
  world,
  system,
  effects,
  reactive,
  createStore,
} from 'kho';
import { DemoLayout } from '../../components/DemoLayout';
import { SystemInspector, type InspectorData } from '../../components/SystemInspector';

// ============================================
// Constants
// ============================================

const CANVAS_W = 600;
const CANVAS_H = 400;
const PADDLE_W = 12;
const PADDLE_H = 70;
const BALL_SIZE = 10;
const PADDLE_SPEED = 5;
const INITIAL_BALL_SPEED = 4;
const SPEED_INCREMENT = 0.3;
const AI_SPEED = 3.5;
const PADDLE_MARGIN = 20;

// ============================================
// ECS Definitions
// ============================================

const $position = component<{ x: number; y: number }>();
const $velocity = component<{ vx: number; vy: number }>();
const $size = component<{ w: number; h: number }>();
const $gameEntities = entities();

const $playerScore = atom(0);
const $aiScore = atom(0);
const $running = atom(false);

// ============================================
// Input state (shared between React and system)
// ============================================

const inputState = { up: false, down: false };

// ============================================
// Pong System
// ============================================

const pongSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);
  const ecs = scope(world($gameEntities));

  // Create entities
  const ball = ecs.entity('ball');
  const player = ecs.entity('player');
  const ai = ecs.entity('ai');

  ecs.add(ball);
  ecs.add(player);
  ecs.add(ai);

  // Player paddle (left)
  ecs.set(player, $position, { x: PADDLE_MARGIN, y: CANVAS_H / 2 - PADDLE_H / 2 });
  ecs.set(player, $size, { w: PADDLE_W, h: PADDLE_H });

  // AI paddle (right)
  ecs.set(ai, $position, { x: CANVAS_W - PADDLE_MARGIN - PADDLE_W, y: CANVAS_H / 2 - PADDLE_H / 2 });
  ecs.set(ai, $size, { w: PADDLE_W, h: PADDLE_H });

  // Ball
  ecs.set(ball, $position, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
  ecs.set(ball, $velocity, { vx: INITIAL_BALL_SPEED, vy: INITIAL_BALL_SPEED * 0.6 });
  ecs.set(ball, $size, { w: BALL_SIZE, h: BALL_SIZE });

  function resetBall(direction: number) {
    const angle = (Math.random() - 0.5) * Math.PI / 3;
    ecs.set(ball, $position, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    ecs.set(ball, $velocity, {
      vx: INITIAL_BALL_SPEED * direction * Math.cos(angle),
      vy: INITIAL_BALL_SPEED * Math.sin(angle),
    });
  }

  // Game loop at ~60fps
  interval(16, () => {
    if (!atoms.get($running)) return;

    const ballPos = ecs.get(ball, $position)!;
    const ballVel = ecs.get(ball, $velocity)!;
    const ballSz = ecs.get(ball, $size)!;
    const playerPos = ecs.get(player, $position)!;
    const playerSz = ecs.get(player, $size)!;
    const aiPos = ecs.get(ai, $position)!;
    const aiSz = ecs.get(ai, $size)!;

    // --- Player paddle movement ---
    let py = playerPos.y;
    if (inputState.up) py -= PADDLE_SPEED;
    if (inputState.down) py += PADDLE_SPEED;
    py = Math.max(0, Math.min(CANVAS_H - playerSz.h, py));
    ecs.set(player, $position, { x: playerPos.x, y: py });

    // --- AI paddle movement ---
    const aiCenter = aiPos.y + aiSz.h / 2;
    const ballCenter = ballPos.y + ballSz.h / 2;
    let ay = aiPos.y;
    if (aiCenter < ballCenter - 10) ay += AI_SPEED;
    else if (aiCenter > ballCenter + 10) ay -= AI_SPEED;
    ay = Math.max(0, Math.min(CANVAS_H - aiSz.h, ay));
    ecs.set(ai, $position, { x: aiPos.x, y: ay });

    // --- Ball movement ---
    let bx = ballPos.x + ballVel.vx;
    let by = ballPos.y + ballVel.vy;
    let bvx = ballVel.vx;
    let bvy = ballVel.vy;

    // Top/bottom wall bounce
    if (by <= 0) {
      by = 0;
      bvy = Math.abs(bvy);
    } else if (by + ballSz.h >= CANVAS_H) {
      by = CANVAS_H - ballSz.h;
      bvy = -Math.abs(bvy);
    }

    // Player paddle collision
    if (
      bx <= playerPos.x + playerSz.w &&
      bx + ballSz.w >= playerPos.x &&
      by + ballSz.h >= py &&
      by <= py + playerSz.h &&
      bvx < 0
    ) {
      bx = playerPos.x + playerSz.w;
      const hitRatio = ((by + ballSz.h / 2) - (py + playerSz.h / 2)) / (playerSz.h / 2);
      const speed = Math.sqrt(bvx * bvx + bvy * bvy) + SPEED_INCREMENT;
      const angle = hitRatio * (Math.PI / 4);
      bvx = speed * Math.cos(angle);
      bvy = speed * Math.sin(angle);
    }

    // AI paddle collision
    if (
      bx + ballSz.w >= aiPos.x &&
      bx <= aiPos.x + aiSz.w &&
      by + ballSz.h >= ay &&
      by <= ay + aiSz.h &&
      bvx > 0
    ) {
      bx = aiPos.x - ballSz.w;
      const hitRatio = ((by + ballSz.h / 2) - (ay + aiSz.h / 2)) / (aiSz.h / 2);
      const speed = Math.sqrt(bvx * bvx + bvy * bvy) + SPEED_INCREMENT;
      const angle = hitRatio * (Math.PI / 4);
      bvx = -(speed * Math.cos(angle));
      bvy = speed * Math.sin(angle);
    }

    ecs.set(ball, $position, { x: bx, y: by });
    ecs.set(ball, $velocity, { vx: bvx, vy: bvy });

    // --- Scoring ---
    if (bx + ballSz.w < 0) {
      batch(() => {
        atoms.set($aiScore, (atoms.get($aiScore) ?? 0) + 1);
      });
      resetBall(1);
    } else if (bx > CANVAS_W) {
      batch(() => {
        atoms.set($playerScore, (atoms.get($playerScore) ?? 0) + 1);
      });
      resetBall(-1);
    }
  });
});

// ============================================
// Renderer (reads ECS state and draws to canvas)
// ============================================

function renderFrame(
  ctx: CanvasRenderingContext2D,
  store: ReturnType<typeof createStore>,
) {
  const r = reactive(store);
  const ecs = world($gameEntities)(store);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Center dashed line
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw entities
  for (const e of ecs.with($position, $size)) {
    const pos = ecs.get(e, $position)!;
    const sz = ecs.get(e, $size)!;

    if (e.id === 'ball') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x + sz.w / 2, pos.y + sz.h / 2, sz.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = e.id === 'player' ? '#4ade80' : '#f87171';
      ctx.fillRect(pos.x, pos.y, sz.w, sz.h);
    }
  }

  // Score display on canvas
  const pScore = r.atoms.get($playerScore) ?? 0;
  const aScore = r.atoms.get($aiScore) ?? 0;
  ctx.fillStyle = '#555';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(pScore), CANVAS_W / 4, 60);
  ctx.fillText(String(aScore), (3 * CANVAS_W) / 4, 60);

  r.dispose();
  ecs.dispose();
}

// ============================================
// Source code for display
// ============================================

const SOURCE_CODE = `import { atom, component, entities, world, system, effects, reactive } from 'kho';

// ECS components
const $position = component<{ x: number; y: number }>();
const $velocity = component<{ vx: number; vy: number }>();
const $size     = component<{ w: number; h: number }>();

// Entity registry & score atoms
const $gameEntities = entities();
const $playerScore  = atom(0);
const $aiScore      = atom(0);
const $running      = atom(false);

// Game system
const pongSystem = system((scope) => {
  const { atoms } = scope(reactive);
  const { interval, batch } = scope(effects);
  const ecs = scope(world($gameEntities));

  const ball   = ecs.entity('ball');
  const player = ecs.entity('player');
  const ai     = ecs.entity('ai');

  ecs.add(ball); ecs.add(player); ecs.add(ai);

  ecs.set(ball,   $position, { x: 300, y: 200 });
  ecs.set(ball,   $velocity, { vx: 4, vy: 2.4 });
  ecs.set(ball,   $size,     { w: 10, h: 10 });
  ecs.set(player, $position, { x: 20, y: 165 });
  ecs.set(player, $size,     { w: 12, h: 70 });

  // 60fps game loop
  interval(16, () => {
    if (!atoms.get($running)) return;

    for (const e of ecs.with($position, $velocity)) {
      const pos = ecs.get(e, $position)!;
      const vel = ecs.get(e, $velocity)!;
      ecs.set(e, $position, {
        x: pos.x + vel.vx,
        y: pos.y + vel.vy,
      });
    }

    // collision, AI, scoring via batch()...
  });
});`;

// ============================================
// React Component
// ============================================

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [lastTriggered, setLastTriggered] = useState<string[]>([]);

  // Track previous scores for flash detection
  const prevScoresRef = useRef({ playerScore: 0, aiScore: 0, running: false });

  // Initialize store and system
  useEffect(() => {
    const store = createStore();
    storeRef.current = store;
    const dispose = pongSystem(store);
    disposeRef.current = dispose;

    // Render loop
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    function draw() {
      renderFrame(ctx!, store);
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    // Score sync: poll from atoms (lightweight)
    const scoreInterval = setInterval(() => {
      const r = reactive(store);
      const ps = r.atoms.get($playerScore) ?? 0;
      const as_ = r.atoms.get($aiScore) ?? 0;
      const rn = r.atoms.get($running) ?? false;
      r.dispose();

      setPlayerScore(ps);
      setAiScore(as_);
      setRunning(rn);

      // Detect changes for flash
      const prev = prevScoresRef.current;
      const triggered: string[] = [];
      if (ps !== prev.playerScore) {
        triggered.push('atom:playerScore');
        triggered.push('effect:scoring');
      }
      if (as_ !== prev.aiScore) {
        triggered.push('atom:aiScore');
        triggered.push('effect:scoring');
      }
      if (rn !== prev.running) {
        triggered.push('atom:running');
        triggered.push('effect:gameLoop');
      }
      if (triggered.length > 0) {
        setLastTriggered(triggered);
      }
      prevScoresRef.current = { playerScore: ps, aiScore: as_, running: rn };
    }, 100);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(scoreInterval);
      dispose();
    };
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputState.up = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputState.down = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputState.up = false;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputState.down = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const toggleRunning = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;
    const r = reactive(store);
    const current = r.atoms.get($running) ?? false;
    r.atoms.set($running, !current);
    setRunning(!current);
    r.dispose();
  }, []);

  const resetGame = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;
    const r = reactive(store);
    r.atoms.set($playerScore, 0);
    r.atoms.set($aiScore, 0);
    r.atoms.set($running, false);
    setPlayerScore(0);
    setAiScore(0);
    setRunning(false);
    r.dispose();
  }, []);

  const inspectorData: InspectorData = useMemo(
    () => ({
      atoms: [
        { name: 'playerScore', value: playerScore },
        { name: 'aiScore', value: aiScore },
        { name: 'running', value: running },
      ],
      effects: [
        { name: 'gameLoop', deps: ['running'] },
        { name: 'physics', deps: ['position', 'velocity'] },
        { name: 'scoring', deps: ['playerScore', 'aiScore'] },
      ],
      entities: 3,
    }),
    [playerScore, aiScore, running],
  );

  const demoContent = (
    <div>
      <div className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-border">
        <div>
          <span className="text-text-muted text-sm">Player </span>
          <span className="text-green font-mono font-bold text-lg">{playerScore}</span>
        </div>
        <div>
          <span className="text-red font-mono font-bold text-lg">{aiScore}</span>
          <span className="text-text-muted text-sm"> AI</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full block"
        tabIndex={0}
      />
      <div className="flex items-center gap-3 p-3 border-t border-border">
        <button
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
            running ? 'bg-green text-black' : 'bg-bg-code text-text'
          }`}
          onClick={toggleRunning}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-bg-code text-text"
          onClick={resetGame}
        >
          Reset
        </button>
        <span className="text-xs text-text-muted ml-auto">W/S or Arrow Up/Down to move</span>
      </div>
    </div>
  );

  return (
    <DemoLayout
      title="Pong Game"
      description="A fully playable Pong game powered by kho's ECS (Entity Component System). All game state -- paddles, ball, velocities, scores -- lives in kho components and atoms. The game loop runs via effects.interval, and React simply renders the canvas each frame by reading ECS state."
      code={SOURCE_CODE}
      codeTitle="pong-ecs.ts"
      demo={demoContent}
      inspector={<SystemInspector data={inspectorData} lastTriggered={lastTriggered} />}
    />
  );
}
