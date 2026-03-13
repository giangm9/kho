import { usePage } from './router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { GettingStarted } from './pages/GettingStarted';
import { CoreConcepts } from './pages/CoreConcepts';
import { Examples } from './pages/Examples';
import { ApiReference } from './pages/ApiReference';
import { TodoApp } from './pages/demos/TodoApp';
import { SpaceShooter } from './pages/demos/SpaceShooter';

const PAGES: Record<string, React.FC> = {
  '': Home,
  'getting-started': GettingStarted,
  'concepts': CoreConcepts,
  'examples': Examples,
  'examples/todo': TodoApp,
  'examples/space-shooter': SpaceShooter,
  'api': ApiReference,
};

export function App() {
  const { page } = usePage();
  const Page = PAGES[page] || Home;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
