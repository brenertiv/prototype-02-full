import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../shell/Icon';

/**
 * The detail drawer (SYS-NAVPAT-23): an item that needs viewing but not a full page opens over
 * the canvas, leaving the page underneath in place. Insights are the first such item (MOD-WS-31).
 */
export function DetailDrawer({ title, eyebrow, onClose, children, actions }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="detail-drawer-layer">
      <div className="detail-drawer-scrim" onClick={onClose} />
      <aside ref={ref} className="detail-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <header className="detail-drawer-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="detail-drawer-body">{children}</div>
        {actions && <footer className="detail-drawer-footer">{actions}</footer>}
      </aside>
    </div>
  );
}
