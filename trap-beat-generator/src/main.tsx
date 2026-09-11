import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Tone from 'tone';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { audioEngine } from './audio/engine';
import { renderWav } from './audio/wav';
import { buildSchedule } from './audio/schedule';
import { useBeatStore } from './store/useBeatStore';
import './index.css';

// Gancio di debug: utile per ispezionare beat e motore audio dalla console.
declare global {
  interface Window {
    __tbg?: {
      store: typeof useBeatStore;
      engine: typeof audioEngine;
      Tone: typeof Tone;
      renderWav: typeof renderWav;
      buildSchedule: typeof buildSchedule;
    };
  }
}
window.__tbg = { store: useBeatStore, engine: audioEngine, Tone, renderWav, buildSchedule };

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Service worker: l'app resta utilizzabile offline dopo il primo caricamento.
registerSW({ immediate: true });
