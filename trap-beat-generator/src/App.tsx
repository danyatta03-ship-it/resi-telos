import { useEffect, useState } from 'react';
import { useBeatStore } from './store/useBeatStore';
import { useAudioSync } from './hooks/useAudio';
import { SetupScreen } from './components/SetupScreen';
import { TopBar } from './components/TopBar';
import { Timeline } from './components/Timeline';
import { StepSequencer } from './components/StepSequencer';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { GeneratorPanel } from './components/GeneratorPanel';
import { ExportPanel } from './components/ExportPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { Toasts } from './components/Toasts';
import { audioEngine } from './audio/engine';

type Tab = 'drums' | 'piano' | 'mixer' | 'gen' | 'export';

const TABS: { id: Tab; label: string }[] = [
  { id: 'drums', label: 'Drums' },
  { id: 'piano', label: 'Piano' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'gen', label: 'Gen' },
  { id: 'export', label: 'Export' },
];

export default function App() {
  const phase = useBeatStore((s) => s.phase);
  const beat = useBeatStore((s) => s.beat);
  const [tab, setTab] = useState<Tab>('drums');
  const [projectsOpen, setProjectsOpen] = useState(false);

  useAudioSync();

  // Barra spaziatrice = play/pausa, come in un DAW.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      event.preventDefault();
      if (audioEngine.state === 'playing') audioEngine.pause();
      else void audioEngine.play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'setup' || !beat) {
    return (
      <div className="min-h-full">
        <SetupScreen />
        <Toasts />
      </div>
    );
  }

  const panelClass = (id: Tab) => (tab === id ? 'flex' : 'hidden lg:flex');

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950">
      <TopBar onOpenProjects={() => setProjectsOpen(true)} />

      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
          <Timeline />

          <nav className="flex gap-1 lg:hidden">
            {TABS.map((item) => (
              <button
                key={item.id}
                className={`btn btn-xs flex-1 ${tab === item.id ? 'btn-primary' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
              <div className={`${panelClass('drums')} flex-col`}>
                <StepSequencer />
              </div>
              <div className={`${panelClass('piano')} flex-col`}>
                <PianoRoll />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className={`${panelClass('gen')} flex-col`}>
                <GeneratorPanel />
              </div>
              <div className={`${panelClass('mixer')} flex-col`}>
                <Mixer />
              </div>
              <div className={`${panelClass('export')} flex-col`}>
                <ExportPanel />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProjectsPanel open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <Toasts />
    </div>
  );
}
