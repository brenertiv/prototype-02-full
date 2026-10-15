import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../shell/Icon';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warning';
  action?: { label: string; onClick: () => void };
}

const ToastCtx = createContext<((text: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void) | null>(null);

/** Brief confirmations after an action; announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone: opts?.tone ?? 'success', action: opts?.action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === 'success' ? 'check_circle' : t.tone === 'warning' ? 'warning' : 'info'} filled />
            <span>{t.text}</span>
            {t.action && (
              <button type="button" className="text-btn" onClick={t.action.onClick}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
