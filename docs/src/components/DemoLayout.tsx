import { ReactNode, useState } from 'react';
import { CodeBlock } from './CodeBlock';

interface CodeTab {
  label: string;
  code: string;
  lang?: string;
}

interface DemoLayoutProps {
  title: string;
  description: string;
  code: string | CodeTab[];
  codeTitle?: string;
  demo: ReactNode;
  inspector: ReactNode;
}

type PanelTab = 'code' | 'inspector';

export function DemoLayout({
  title,
  description,
  code,
  codeTitle,
  demo,
  inspector,
}: DemoLayoutProps) {
  const tabs = typeof code === 'string' ? [{ label: codeTitle ?? 'Code', code }] : code;
  const [activeCodeTab, setActiveCodeTab] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelTab>('code');

  return (
    <article className="max-w-none">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{title}</h1>
        <p className="text-text-muted text-sm leading-relaxed max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start w-full">
        {/* Left: Live Demo */}
        <div className="min-w-0 rounded-lg border border-border bg-bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-bg-code flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green" />
            <span className="text-xs font-semibold text-text-muted font-mono">Live Demo</span>
          </div>
          <div className="p-4">{demo}</div>
        </div>

        {/* Right: Source Code / Inspector tabs */}
        <div className="min-w-0 max-h-[80vh] overflow-auto rounded-lg border border-border">
          {/* Panel switcher + code sub-tabs */}
          <div className="flex bg-bg-code border-b border-border sticky top-0 z-[1]">
            {/* Source tab (with code sub-tabs when active) */}
            <button
              onClick={() => setActivePanel('code')}
              className={`px-4 py-2 text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
                activePanel === 'code'
                  ? 'text-text-secondary bg-bg-subtle'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan" />
              Source
            </button>
            {/* Code sub-tabs */}
            {activePanel === 'code' && tabs.length > 1 && (
              <>
                <span className="self-center mx-1 text-border">|</span>
                {tabs.map((t, i) => (
                  <button
                    key={t.label}
                    onClick={() => setActiveCodeTab(i)}
                    className={`px-3 py-2 text-xs font-medium font-mono transition-colors ${
                      i === activeCodeTab
                        ? 'text-text-secondary'
                        : 'text-text-dim hover:text-text-muted'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </>
            )}
            {/* Inspector tab */}
            <button
              onClick={() => setActivePanel('inspector')}
              className={`ml-auto px-4 py-2 text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
                activePanel === 'inspector'
                  ? 'text-text-secondary bg-bg-subtle'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber" />
              Inspector
            </button>
          </div>

          {/* Panel content */}
          {activePanel === 'code' ? (
            <div className="[&>.code-block]:my-0 [&>.code-block]:border-0 [&>.code-block]:rounded-none">
              <CodeBlock
                code={tabs[activeCodeTab]!.code}
                lang={tabs[activeCodeTab]!.lang}
                title={tabs.length === 1 ? codeTitle : undefined}
              />
            </div>
          ) : (
            <div className="p-3 text-xs">{inspector}</div>
          )}
        </div>
      </div>
    </article>
  );
}
