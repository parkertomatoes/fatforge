import React from 'react';
import { createRoot } from 'react-dom/client';
import '98.css';
import 'dockview/dist/styles/dockview.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
