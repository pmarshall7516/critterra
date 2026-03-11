import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { DuelApp } from '@/duel/DuelApp';
import '@/styles.css';

const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const isSimulation =
  pathname === '/simulation' ||
  pathname === '/simulation.html' ||
  /^\/simulation(\/|$)/i.test(pathname) ||
  pathname === '/duel' ||
  pathname === '/duel.html' ||
  /^\/duel(\/|$)/i.test(pathname);

const Root = isSimulation ? DuelApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
