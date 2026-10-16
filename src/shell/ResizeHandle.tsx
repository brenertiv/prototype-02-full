import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  /** Which way a rightward drag moves the size: the panel grows, the chat shrinks. */
  direction: 1 | -1;
  onChange: (width: number) => void;
}

/**
 * A draggable column edge. Drag with a pointer, use the arrow keys (Shift for bigger steps),
 * Home and End for the limits, or double-click to restore the default width.
 */
export function ResizeHandle({ label, value, min, max, defaultValue, direction, onChange }: Props) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width: value };
    e.currentTarget.classList.add('is-dragging');
    document.body.classList.add('is-resizing');
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    onChange(clamp(start.current.width + direction * (e.clientX - start.current.x)));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.currentTarget.classList.remove('is-dragging');
    document.body.classList.remove('is-resizing');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') onChange(clamp(value - direction * step));
    else if (e.key === 'ArrowRight') onChange(clamp(value + direction * step));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}. Drag, or use the arrow keys; double-click to reset.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={onKeyDown}
    />
  );
}
