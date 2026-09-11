import { useEffect, useRef, useState } from 'react';
import { TICKS_PER_BAR } from '../types';
import { audioEngine } from '../audio/engine';
import type { TransportState } from '../audio/engine';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { autosave } from '../store/persistence';

/** Tiene il motore audio allineato al beat nello store. */
export function useAudioSync(): void {
  const beat = useBeatStore((s) => s.beat);
  const loopSection = useBeatStore((s) => s.loopSection);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);

  const sections = beat?.sections;
  const humanize = beat?.meta.humanize;
  const seed = beat?.meta.seed;

  // Ricostruzione della timeline audio: solo quando cambiano le note.
  useEffect(() => {
    if (!beat) return;
    const handle = window.setTimeout(() => audioEngine.load(beat), 120);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, humanize, seed]);

  // Mixer e master: applicati subito, senza ricostruire nulla.
  useEffect(() => {
    if (!beat) return;
    audioEngine.applyMixer(beat.mixer, beat.masterVolume);
  }, [beat, beat?.mixer, beat?.masterVolume]);

  useEffect(() => {
    if (!beat) return;
    audioEngine.setBpm(beat.meta.bpm);
  }, [beat, beat?.meta.bpm]);

  // Loop sulla sezione selezionata.
  useEffect(() => {
    if (!beat) return;
    if (!loopSection || !selectedSectionId) {
      audioEngine.setLoop(null);
      return;
    }
    const offsets = sectionOffsets(beat);
    const range = offsets[selectedSectionId];
    if (range) audioEngine.setLoop({ startTick: range.startTick, endTick: range.endTick });
  }, [beat, loopSection, selectedSectionId]);

  // Salvataggio automatico della sessione.
  useEffect(() => {
    if (!beat) return;
    const handle = window.setTimeout(() => autosave(beat), 900);
    return () => window.clearTimeout(handle);
  }, [beat]);
}

export function useTransportState(): TransportState {
  const [state, setState] = useState<TransportState>(audioEngine.state);
  useEffect(() => audioEngine.onStateChange(setState), []);
  return state;
}

/** Posizione di riproduzione in tick, aggiornata con requestAnimationFrame. */
export function usePlayhead(active: boolean): number {
  const [ticks, setTicks] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) {
      setTicks(audioEngine.getPositionTicks());
      return;
    }
    let last = 0;
    const loop = (time: number) => {
      if (time - last > 32) {
        last = time;
        setTicks(audioEngine.getPositionTicks());
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [active]);

  return ticks;
}

export function formatPosition(ticks: number): string {
  const bar = Math.floor(ticks / TICKS_PER_BAR) + 1;
  const beat = Math.floor((ticks % TICKS_PER_BAR) / (TICKS_PER_BAR / 4)) + 1;
  return `${String(bar).padStart(3, '0')}.${beat}`;
}
