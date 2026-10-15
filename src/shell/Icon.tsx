import type { CSSProperties } from 'react';

/** One icon component over the Material Symbols font (CMP-ICON-01). Decorative by default; the control carries the label. */
export function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  // Only the fill changes per icon, so the weight token still applies to filled icons.
  const style = filled ? ({ '--icon-fill': 1 } as CSSProperties) : undefined;
  return (
    <span className={`msym ${className}`} aria-hidden="true" style={style}>
      {name}
    </span>
  );
}
