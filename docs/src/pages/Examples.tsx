import { type ReactNode } from 'react';
import { AppLink } from '../router';
import { LuListTodo, LuGamepad2 } from 'react-icons/lu';

const DEMOS: { icon: ReactNode; title: string; desc: string; to: string; tags: string[] }[] = [
  {
    icon: <LuListTodo />,
    title: 'Todo App',
    desc: 'Step-by-step guide building a todo app from scratch. Start with atoms & signals, add a React UI, then layer on undo/redo and localStorage persistence as independent systems.',
    to: '/examples/todo',
    tags: ['atoms', 'signals', 'effects', 'React'],
  },
  {
    icon: <LuGamepad2 />,
    title: 'Space Shooter',
    desc: 'Canvas game with ECS architecture. Entities (ship, bullets, asteroids) are composed from data components. Five independent systems handle input, physics, spawning, collisions, and rendering.',
    to: '/examples/space-shooter',
    tags: ['ECS', 'component', 'world', 'signals', 'canvas'],
  },
];

export function Examples() {
  return (
    <article className="prose">
      <h1>Examples</h1>
      <p>
        Interactive demos running entirely in the browser. Each example uses kho for all
        state management — click through to see live demos with source code.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 mt-8">
        {DEMOS.map((d) => (
          <AppLink key={d.to} to={d.to} className="block p-5 border border-border rounded-xl bg-bg-card transition-all hover:border-border-bright hover:-translate-y-0.5 no-underline text-inherit">
            <span className="text-xl text-cyan block mb-2">{d.icon}</span>
            <h3 className="text-sm font-semibold mb-1.5 text-text">{d.title}</h3>
            <p className="text-xs text-text-muted leading-relaxed">{d.desc}</p>
            <div className="mt-3 flex gap-1.5 flex-wrap">
              {d.tags.map((t) => (
                <span
                  key={t}
                  className="text-[0.65rem] px-2 py-0.5 rounded-full bg-bg-subtle text-text-dim font-mono border border-border"
                >
                  {t}
                </span>
              ))}
            </div>
          </AppLink>
        ))}
      </div>
    </article>
  );
}
