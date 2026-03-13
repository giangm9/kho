import { useEffect, useState } from 'react';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let hlReady: Promise<HighlighterCore> | null = null;

function getHL() {
  if (!hlReady) {
    hlReady = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [import('shiki/themes/github-dark.mjs')],
      langs: [
        import('shiki/langs/typescript.mjs'),
        import('shiki/langs/tsx.mjs'),
        import('shiki/langs/vue.mjs'),
        import('shiki/langs/bash.mjs'),
        import('shiki/langs/json.mjs'),
        import('shiki/langs/html.mjs'),
        import('shiki/langs/css.mjs'),
      ],
    });
  }
  return hlReady;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
  title?: string;
}

export function CodeBlock({ code, lang = 'typescript', title }: CodeBlockProps) {
  const [html, setHtml] = useState('');
  const trimmed = code.trim();

  useEffect(() => {
    let cancelled = false;
    getHL().then((h) => {
      if (cancelled) return;
      try {
        setHtml(h.codeToHtml(trimmed, { lang, theme: 'github-dark' }));
      } catch {
        // lang not loaded, render plain
      }
    });
    return () => { cancelled = true; };
  }, [trimmed, lang]);

  return (
    <div className="code-block my-4 rounded-lg overflow-hidden border border-border">
      {title && (
        <div className="text-xs font-semibold text-text-muted px-4 py-2 bg-bg-code border-b border-border font-mono">
          {title}
        </div>
      )}
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre><code>{trimmed}</code></pre>
      )}
    </div>
  );
}
