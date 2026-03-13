import { useState } from 'react';
import { CodeBlock } from './CodeBlock';

interface Tab {
  label: string;
  code: string;
  lang?: string;
}

export function CodeTabs({ tabs, defaultActive = 0 }: { tabs: Tab[]; defaultActive?: number }) {
  const [active, setActive] = useState(defaultActive);

  return (
    <div className="code-block my-4 rounded-lg overflow-hidden border border-border">
      <div className="flex bg-bg-code border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-xs font-medium font-mono transition-colors ${
              i === active
                ? 'text-text-secondary bg-bg-code'
                : 'text-text-dim hover:text-text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="[&>.code-block]:my-0 [&>.code-block]:rounded-none [&>.code-block]:border-0">
        <CodeBlock code={tabs[active]!.code} lang={tabs[active]!.lang ?? 'bash'} />
      </div>
    </div>
  );
}
