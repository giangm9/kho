import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  atom,
  component,
  entities,
  query,
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
  const ecs = scope(query($gameEntities));

  // Create entities
  ecs.add('ball');
  ecs.add('player');
  ecs.add('ai');

  // Player paddle (left)
  ecs.set('player', $position, { x: PADDLE_MARGIN, y: CANVAS_H / 2 - PADDLE_H / 2 });
  ecs.set('player', $size, { w: PADDLE_W, h: PADDLE_H });

  // AI paddle (right)
  ecs.set('ai', $position, { x: CANVAS_W - PADDLE_MARGIN - PADDLE_W, y: CANVAS_H / 2 - PADDLE_H / 2 });
  ecs.set('ai', $size, { w: PADDLE_W, h: PADDLE_H });

  // Ball
  ecs.set('ball', $position, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
  ecs.set('ball', $velocity, { vx: INITIAL_BALL_SPEED, vy: INITIAL_BALL_SPEED * 0.6 });
  ecs.set('ball', $size, { w: BALL_SIZE, h: BALL_SIZE });

  function resetBall(direction: number) {
    const angle = (Math.random() - 0.5) * Math.PI / 3;
    ecs.set('ball', $position, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    ecs.set('ball', $velocity, {
      vx: INITIAL_BALL_SPEED * direction * Math.cos(angle),
      vy: INITIAL_BALL_SPEED * Math.sin(angle),
    });
  }

  // Game loop at ~60fps
  interval(16, () => {
    if (!atoms.get($running)) return;

    const ballPos = ecs.get('ball', $position)!;
    const ballVel = ecs.get('ball', $velocity)!;
    const ballSz = ecs.get('ball', $size)!;
    const playerPos = ecs.get('player', $position)!;
    const playerSz = ecs.get('player', $size)!;
    const aiPos = ecs.get('ai', $position)!;
    const aiSz = ecs.get('ai', $size)!;

    // --- Player paddle movement ---
    let playerY = playerPos.y;
    if (inputState.up) playerY -= PADDLE_SPEED;
    if (inputState.down) playerY += PADDLE_SPEED;
    playerY = Math.max(0, Math.min(CANVAS_H - playerSz.h, playerY));
    ecs.set('player', $position, { x: playerPos.x, y: playerY });

    // --- AI paddle movement ---
    const aiCenter = aiPos.y + aiSz.h / 2;
    const ballCenter = ballPos.y + ballSz.h / 2;
    let aiY = aiPos.y;
    if (aiCenter < ballCenter - 10) aiY += AI_SPEED;
    else if (aiCenter > ballCenter + 10) aiY -= AI_SPEED;
    aiY = Math.max(0, Math.min(CANVAS_H - aiSz.h, aiY));
    ecs.set('ai', $position, { x: aiPos.x, y: aiY });

    // --- Ball movement ---
    let ballX = ballPos.x + ballVel.vx;
    let ballY = ballPos.y + ballVel.vy;
    let ballVelX = ballVel.vx;
    let ballVelY = ballVel.vy;

    // Top/bottom wall bounce
    if (ballY <= 0) {
      ballY = 0;
      ballVelY = Math.abs(ballVelY);
    } else if (ballY + ballSz.h >= CANVAS_H) {
      ballY = CANVAS_H - ballSz.h;
      ballVelY = -Math.abs(ballVelY);
    }

    // Player paddle collision
    if (
      ballX <= playerPos.x + playerSz.w &&
      ballX + ballSz.w >= playerPos.x &&
      ballY + ballSz.h >= playerY &&
      ballY <= playerY + playerSz.h &&
      ballVelX < 0
    ) {
      ballX = playerPos.x + playerSz.w;
      const hitRatio = ((ballY + ballSz.h / 2) - (playerY + playerSz.h / 2)) / (playerSz.h / 2);
      const speed = Math.sqrt(ballVelX * ballVelX + ballVelY * ballVelY) + SPEED_INCREMENT;
      const angle = hitRatio * (Math.PI / 4);
      ballVelX = speed * Math.cos(angle);
      ballVelY = speed * Math.sin(angle);
    }

    // AI paddle collision
    if (
      ballX + ballSz.w >= aiPos.x &&
      ballX <= aiPos.x + aiSz.w &&
      ballY + ballSz.h >= aiY &&
      ballY <= aiY + aiSz.h &&
      ballVelX > 0
    ) {
      ballX = aiPos.x - ballSz.w;
      const hitRatio = ((ballY + ballSz.h / 2) - (aiY + aiSz.h / 2)) / (aiSz.h / 2);
      const speed = Math.sqrt(ballVelX * ballVelX + ballVelY * ballVelY) + SPEED_INCREMENT;
      const angle = hitRatio * (Math.PI / 4);
      ballVelX = -(speed * Math.cos(angle));
      ballVelY = speed * Math.sin(angle);
    }

    ecs.set('ball', $position, { x: ballX, y: ballY });
    ecs.set('ball', $velocity, { vx: ballVelX, vy: ballVelY });

    // --- Scoring ---
    if (ballX + ballSz.w < 0) {
      batch(() => {
        atoms.set($aiScore, (atoms.get($aiScore) ?? 0) + 1);
      });
      resetBall(1);
    } else if (ballX > CANVAS_W) {
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
  const reactiveOps = reactive(store);
  const ecs = query($gameEntities)(store);

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
  for (const entityId of ecs.select($position, $size)) {
    const pos = ecs.get(entityId, $position)!;
    const sz = ecs.get(entityId, $size)!;

    if (entityId === 'ball') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x + sz.w / 2, pos.y + sz.h / 2, sz.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = entityId === 'player' ? '#4ade80' : '#f87171';
      ctx.fillRect(pos.x, pos.y, sz.w, sz.h);
    }
  }

  // Score display on canvas
  const playerScoreValue = reactiveOps.atoms.get($playerScore) ?? 0;
  const aiScoreValue = reactiveOps.atoms.get($aiScore) ?? 0;
  ctx.fillStyle = '#555';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(playerScoreValue), CANVAS_W / 4, 60);
  ctx.fillText(String(aiScoreValue), (3 * CANVAS_W) / 4, 60);

  reactiveOps.dispose();
  ecs.dispose();
}

// ============================================
// Source code for display
// ============================================

const SOURCE_CODE = `import { atom, component, entities, query, system, effects, reactive } from 'kho';

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
  const ecs = scope(query($gameEntities));

  ecs.add('ball'); ecs.add('player'); ecs.add('ai');

  ecs.set('ball',   $position, { x: 300, y: 200 });
  ecs.set('ball',   $velocity, { vx: 4, vy: 2.4 });
  ecs.set('ball',   $size,     { w: 10, h: 10 });
  ecs.set('player', $position, { x: 20, y: 165 });
  ecs.set('player', $size,     { w: 12, h: 70 });

  // 60fps game loop
  interval(16, () => {
    if (!atoms.get($running)) return;

    for (const entityId of ecs.select($position, $velocity)) {
      const pos = ecs.get(entityId, $position)!;
      const vel = ecs.get(entityId, $velocity)!;
      ecs.set(entityId, $position, {
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
      const reactiveOps = reactive(store);
      const currentPlayerScore = reactiveOps.atoms.get($playerScore) ?? 0;
      const currentAiScore = reactiveOps.atoms.get($aiScore) ?? 0;
      const currentRunning = reactiveOps.atoms.get($running) ?? false;
      reactiveOps.dispose();

      setPlayerScore(currentPlayerScore);
      setAiScore(currentAiScore);
      setRunning(currentRunning);

      // Detect changes for flash
      const prev = prevScoresRef.current;
      const triggered: string[] = [];
      if (currentPlayerScore !== prev.playerScore) {
        triggered.push('atom:playerScore');
        triggered.push('effect:scoring');
      }
      if (currentAiScore !== prev.aiScore) {
        triggered.push('atom:aiScore');
        triggered.push('effect:scoring');
      }
      if (currentRunning !== prev.running) {
        triggered.push('atom:running');
        triggered.push('effect:gameLoop');
      }
      if (triggered.length > 0) {
        setLastTriggered(triggered);
      }
      prevScoresRef.current = { playerScore: currentPlayerScore, aiScore: currentAiScore, running: currentRunning };
    }, 100);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(scoreInterval);
      dispose();
    };
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        inputState.up = true;
        event.preventDefault();
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        inputState.down = true;
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        inputState.up = false;
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
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
    const reactiveOps = reactive(store);
    const current = reactiveOps.atoms.get($running) ?? false;
    reactiveOps.atoms.set($running, !current);
    setRunning(!current);
    reactiveOps.dispose();
  }, []);

  const resetGame = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;
    const reactiveOps = reactive(store);
    reactiveOps.atoms.set($playerScore, 0);
    reactiveOps.atoms.set($aiScore, 0);
    reactiveOps.atoms.set($running, false);
    setPlayerScore(0);
    setAiScore(0);
    setRunning(false);
    reactiveOps.dispose();
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
