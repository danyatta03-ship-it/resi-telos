import type { ReactNode } from 'react';

interface PanelProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, actions, children, className = '', bodyClassName = '' }: PanelProps) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="panel-title">
        <span className="truncate">{title}</span>
        {actions ? <span className="flex shrink-0 items-center gap-1">{actions}</span> : null}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto p-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
