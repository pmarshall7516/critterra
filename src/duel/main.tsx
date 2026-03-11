import React from 'react';
import ReactDOM from 'react-dom/client';
import { DuelApp } from '@/duel/DuelApp';
import '@/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DuelApp />
  </React.StrictMode>,
);
