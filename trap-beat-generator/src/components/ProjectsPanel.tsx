import { useEffect, useState } from 'react';
import { keyLabel } from '../music/theory';
import { useBeatStore } from '../store/useBeatStore';
import { Modal } from './ui/Modal';

interface ProjectsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectsPanel({ open, onClose }: ProjectsPanelProps) {
  const beat = useBeatStore((s) => s.beat);
  const savedBeats = useBeatStore((s) => s.savedBeats);
  const refreshProjects = useBeatStore((s) => s.refreshProjects);
  const saveProject = useBeatStore((s) => s.saveProject);
  const loadProject = useBeatStore((s) => s.loadProject);
  const deleteProject = useBeatStore((s) => s.deleteProject);
  const duplicateProject = useBeatStore((s) => s.duplicateProject);

  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      void refreshProjects();
      setName(beat?.name ?? '');
    }
  }, [open, refreshProjects, beat?.name]);

  return (
    <Modal
      open={open}
      title="Progetti"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Chiudi
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              void saveProject(name.trim() || undefined);
            }}
            disabled={!beat}
          >
            Salva beat
          </button>
        </>
      }
    >
      <label className="mb-4 block">
        <span className="label">Nome del progetto</span>
        <input
          className="field mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dark Tony Beat"
        />
      </label>

      {savedBeats.length === 0 ? (
        <p className="text-sm text-ink-400">Nessun progetto salvato. I beat restano su questo dispositivo.</p>
      ) : (
        <ul className="space-y-1.5">
          {savedBeats.map((saved) => (
            <li
              key={saved.id}
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                saved.id === beat?.id ? 'border-acid-600/60 bg-ink-800' : 'border-ink-700/60 bg-ink-900/60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{saved.name}</p>
                <p className="font-mono text-[10px] text-ink-400">
                  {saved.meta.bpm} BPM · {keyLabel(saved.meta.rootPc, saved.meta.scaleId)} ·{' '}
                  {saved.sections.reduce((s, sec) => s + sec.bars, 0)} bars ·{' '}
                  {new Date(saved.updatedAt).toLocaleDateString('it-IT')}
                </p>
              </div>
              <button className="btn btn-xs" onClick={() => void loadProject(saved.id).then(onClose)}>
                Apri
              </button>
              <button className="btn btn-xs" onClick={() => void duplicateProject(saved.id)} title="Duplica">
                ⧉
              </button>
              <button
                className="btn btn-xs text-flame-400"
                onClick={() => void deleteProject(saved.id)}
                title="Elimina"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
