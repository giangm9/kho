import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from './router';
import { App } from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
