import { useEffect, useRef, useCallback, useState } from 'react';

// ─── Types ───

export interface InspectorAtom {
  name: string;
  value: unknown;
}

export interface InspectorEffect {
  name: string;
  deps: string[];
}

export interface InspectorData {
  atoms: InspectorAtom[];
  effects: InspectorEffect[];
  entities?: number;
}

// ─── Flash Hook ───

function useFlashSet() {
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const flash = useCallback((key: string) => {
    setFlashing((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);

    timersRef.current.set(
      key,
      setTimeout(() => {
        setFlashing((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        timersRef.current.delete(key);
      }, 600),
    );
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { flashing, flash };
}

// ─── Component ───

interface SystemInspectorProps {
  data: InspectorData;
  lastTriggered?: string[];
}

export function SystemInspector({ data, lastTriggered }: SystemInspectorProps) {
  const { flashing, flash } = useFlashSet();
  const prevTriggeredRef = useRef<string[]>([]);

  useEffect(() => {
    if (!lastTriggered) return;
    const prev = prevTriggeredRef.current;
    for (const key of lastTriggered) {
      if (!prev.includes(key)) {
        flash(key);
      }
    }
    prevTriggeredRef.current = lastTriggered;
  }, [lastTriggered, flash]);

  return (
    <div className="flex flex-col gap-3">
      {/* Atoms Section */}
      <section>
        <h4 className="text-[0.65rem] uppercase tracking-widest text-text-muted font-semibold mb-1.5">
          Atoms
        </h4>
        <div className="flex flex-col gap-1">
          {data.atoms.map((a) => {
            const isFlashing = flashing.has(`atom:${a.name}`);
            return (
              <div
                key={a.name}
                className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
                  isFlashing ? 'bg-accent/30' : 'bg-bg-code/50'
                }`}
              >
                <span className="text-accent font-mono font-medium">${a.name}</span>
                <span className="text-text-muted font-mono truncate ml-2 max-w-[160px] text-right">
                  {formatValue(a.value)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Effects Section */}
      <section>
        <h4 className="text-[0.65rem] uppercase tracking-widest text-text-muted font-semibold mb-1.5">
          Effects
        </h4>
        <div className="flex flex-col gap-1">
          {data.effects.map((e) => {
            const isFlashing = flashing.has(`effect:${e.name}`);
            return (
              <div
                key={e.name}
                className={`px-2 py-1 rounded transition-colors ${
                  isFlashing ? 'bg-green/30' : 'bg-bg-code/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFlashing ? 'bg-green animate-pulse' : 'bg-text-muted/40'
                    }`}
                  />
                  <span className="font-mono font-medium text-text">{e.name}</span>
                </div>
                <div className="mt-0.5 ml-3 text-text-muted">
                  deps: [{e.deps.map((d) => `$${d}`).join(', ')}]
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Entity Count */}
      {data.entities !== undefined && (
        <section>
          <h4 className="text-[0.65rem] uppercase tracking-widest text-text-muted font-semibold mb-1.5">
            Entities
          </h4>
          <div className="px-2 py-1 rounded bg-bg-code/50 font-mono">
            <span className="text-cyan">{data.entities.toLocaleString()}</span>
            <span className="text-text-muted ml-1">active</span>
          </div>
        </section>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v.length > 20 ? `"${v.slice(0, 20)}..."` : `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }
  return String(v);
}
