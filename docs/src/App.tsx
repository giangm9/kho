import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { GettingStarted } from './pages/GettingStarted';
import { CoreConcepts } from './pages/CoreConcepts';
import { Examples } from './pages/Examples';
import { ApiReference } from './pages/ApiReference';
import { TodoApp } from './pages/demos/TodoApp';
import { SpaceShooter } from './pages/demos/SpaceShooter';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="getting-started" element={<GettingStarted />} />
        <Route path="concepts" element={<CoreConcepts />} />
        <Route path="examples" element={<Examples />} />
        <Route path="examples/todo" element={<TodoApp />} />
        <Route path="examples/space-shooter" element={<SpaceShooter />} />
        <Route path="api" element={<ApiReference />} />
      </Route>
    </Routes>
  );
}
