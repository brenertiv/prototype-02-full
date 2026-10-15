import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../shell/Icon';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the close button (first-login steps that must be answered or skipped). */
  noClose?: boolean;
  labelledBy?: string;
}

/** A native modal dialog: focus trap, Escape and backdrop handled by the browser. */
export function Modal({ title, onClose, children, footer, size = 'md', noClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (!noClose) closeRef.current();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [noClose]);

  const id = `modal-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <dialog ref={ref} className={`modal modal--${size}`} aria-labelledby={id}>
      <header className="modal-header">
        <h2 id={id}>{title}</h2>
        {!noClose && (
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </dialog>
  );
}

/** A confirm step for anything that writes (SYS-AI-16) or overwrites surveyed data (MOD-BI-52). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`btn ${destructive ? 'btn--danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
