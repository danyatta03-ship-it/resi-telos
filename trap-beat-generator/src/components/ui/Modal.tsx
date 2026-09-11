import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="panel w-full max-w-lg animate-fade-up rounded-b-none sm:rounded-xl">
        <header className="panel-title text-sm normal-case tracking-normal text-slate-100">
          <span>{title}</span>
          <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>
        <div className="max-h-[65vh] overflow-auto p-4">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-ink-700/60 p-3">{footer}</footer> : null}
      </div>
    </div>
  );
}
