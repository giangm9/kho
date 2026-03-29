import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface RouterCtx {
  page: string;
  navigate: (to: string) => void;
}

const Ctx = createContext<RouterCtx>({ page: '', navigate: () => {} });

function getPage() {
  return new URLSearchParams(window.location.search).get('p') || '';
}

export function Router({ children }: { children: ReactNode }) {
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    const [path, hash] = to.split('#');
    const base = import.meta.env.BASE_URL;
    const url = path ? `${base}?p=${encodeURIComponent(path)}` : base;
    window.history.pushState({}, '', hash ? `${url}#${hash}` : url);
    setPage(path || '');

    if (hash) {
      // Wait for new page to render before scrolling to anchor
      const tryScroll = (attempts: number) => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'instant' });
        } else if (attempts > 0) {
          requestAnimationFrame(() => tryScroll(attempts - 1));
        }
      };
      requestAnimationFrame(() => tryScroll(10));
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return <Ctx.Provider value={{ page, navigate }}>{children}</Ctx.Provider>;
}

export function usePage() {
  return useContext(Ctx);
}

export function AppLink({
  to,
  className,
  children,
  ...rest
}: { to: string; className?: string | ((props: { isActive: boolean }) => string); children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>) {
  const { page, navigate } = usePage();
  const path = to.split('#')[0] ?? '';
  const isActive = path === '/' ? page === '' : page === path.replace(/^\//, '');
  const base = import.meta.env.BASE_URL;
  const href = path ? `${base}?p=${encodeURIComponent(path.replace(/^\//, ''))}` : base;

  const cls = typeof className === 'function' ? className({ isActive }) : className;

  return (
    <a
      href={to.includes('#') ? `${href}#${to.split('#')[1]}` : href}
      className={cls}
      onClick={(e) => {
        e.preventDefault();
        navigate(to.replace(/^\//, ''));
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
