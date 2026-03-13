import { useState } from 'react';
import { LuBox, LuGithub, LuPackage, LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { usePage, AppLink } from '../router';

interface NavChild { to: string; label: string }
interface NavItem { to: string; label: string; end?: boolean; children?: NavChild[] }
interface NavSection { section: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    section: 'Guide',
    items: [
      { to: '/', label: 'Home', end: true },
      {
        to: '/getting-started',
        label: 'Getting Started',
        children: [
          { to: '/getting-started#installation', label: 'Installation' },
          { to: '/getting-started#first-app', label: 'Your First App' },
          { to: '/getting-started#react', label: 'React Integration' },
          { to: '/getting-started#vue', label: 'Vue Integration' },
          { to: '/getting-started#typescript', label: 'TypeScript Tips' },
        ],
      },
      {
        to: '/concepts',
        label: 'Core Concepts',
        children: [
          { to: '/concepts#atoms', label: 'Atoms' },
          { to: '/concepts#store', label: 'Store' },
          { to: '/concepts#reactive', label: 'Reactive' },
          { to: '/concepts#effects', label: 'Effects' },
          { to: '/concepts#signals', label: 'Signals' },
          { to: '/concepts#systems', label: 'Systems' },
          { to: '/concepts#ecs', label: 'ECS' },
          { to: '/concepts#attributes', label: 'Attributes' },
        ],
      },
    ],
  },
  {
    section: 'Examples',
    items: [
      { to: '/examples', label: 'Overview', end: true },
      { to: '/examples/todo', label: 'Todo App' },
      { to: '/examples/space-shooter', label: 'Space Shooter' },
    ],
  },
  {
    section: 'Reference',
    items: [
      {
        to: '/api',
        label: 'API Reference',
        children: [
          { to: '/api#data', label: 'Data Layer' },
          { to: '/api#system', label: 'System Layer' },
          { to: '/api#effects', label: 'Effects' },
          { to: '/api#ecs', label: 'ECS' },
          { to: '/api#attributes', label: 'Attributes' },
        ],
      },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { page } = usePage();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav
        className={`fixed top-0 left-0 h-screen flex flex-col bg-bg border-r border-border z-10 transition-[width] duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo */}
        <AppLink to="/" className="flex items-center gap-2.5 px-4 pt-5 pb-4 !text-text hover:!text-text no-underline">
          <LuBox className="text-xl text-accent shrink-0" />
          {!collapsed && (
            <>
              <span className="text-lg font-bold tracking-tight">Kho</span>
              <span className="text-[0.6rem] bg-bg-subtle text-text-muted px-1.5 py-0.5 rounded-md font-medium border border-border">
                v1.6
              </span>
            </>
          )}
        </AppLink>

        {/* Nav */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-4">
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="nav-section-label">{group.section}</div>
                {group.items.map((item) => {
                  const itemPath = item.to.replace(/^\//, '');
                  const isExact = itemPath === '' ? page === '' : page === itemPath;
                  const isParentActive = isExact || (!item.end && item.children && page.startsWith(itemPath));
                  return (
                    <div key={item.to}>
                      <AppLink
                        to={item.to}
                        className={({ isActive }) => `nav-link ${isActive && (item.end ? isExact : true) ? 'active' : ''}`}
                      >
                        {item.label}
                      </AppLink>
                      {item.children && isParentActive && (
                        <div className="mt-0.5 mb-1">
                          {item.children.map((child) => (
                            <AppLink
                              key={child.to}
                              to={child.to}
                              className="nav-sub-link"
                            >
                              {child.label}
                            </AppLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Spacer when collapsed */}
        {collapsed && <div className="flex-1" />}

        {/* Footer */}
        <div className={`py-3 border-t border-border flex items-center ${collapsed ? 'flex-col gap-3 px-0 justify-center' : 'gap-4 px-5'}`}>
          {!collapsed && (
            <>
              <a href="https://github.com/giangm9/kho" target="_blank" rel="noreferrer" className="text-text-dim hover:text-text-muted transition-colors">
                <LuGithub className="text-base" />
              </a>
              <a href="https://www.npmjs.com/package/kho" target="_blank" rel="noreferrer" className="text-text-dim hover:text-text-muted transition-colors">
                <LuPackage className="text-base" />
              </a>
            </>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`text-text-dim hover:text-text-muted transition-colors ${collapsed ? '' : 'ml-auto'}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <LuPanelLeftOpen className="text-base" /> : <LuPanelLeftClose className="text-base" />}
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className={`flex-1 px-10 py-8 transition-[margin] duration-200 ${collapsed ? 'ml-14' : 'ml-56'}`}>
        {children}
      </main>
    </div>
  );
}
