import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Small SVG charts in the design system's chart colours (`02-building/design-system/colors.md`).
 * Missing data draws as a hatched stub labelled "No data", never as zero (SYS-TRUST-10);
 * estimated values draw lighter and are named in the tooltip (SYS-TRUST-11).
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(Math.max(200, Math.floor(entries[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

export interface BarDatum {
  label: string;
  value: number | null;
  estimated?: boolean;
  color?: string;
  title?: string;
}

export function BarChart({ data, height = 200, format = (v: number) => v.toLocaleString(), label, onBar, highlight }: { data: BarDatum[]; height?: number; format?: (v: number) => string; label: string; onBar?: (d: BarDatum, i: number) => void; highlight?: number | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pad = { l: 52, r: 8, t: 10, b: 28 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.value ?? 0)));
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const bw = iw / Math.max(1, data.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 48)));
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} role="img" aria-label={label}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-missing)" strokeWidth="3" />
          </pattern>
        </defs>
        {ticks.map((t) => {
          const y = pad.t + ih - (t / max) * ih;
          return (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--chart-grid)" />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" className="chart-tick">
                {format(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.15;
          const w = Math.max(2, bw * 0.7);
          const missing = d.value === null;
          const h = missing ? 10 : (d.value! / max) * ih;
          const y = pad.t + ih - h;
          const fill = missing ? 'url(#hatch)' : d.estimated ? 'var(--chart-estimated)' : (d.color ?? 'var(--chart-1)');
          return (
            <g key={i} className={onBar ? 'chart-clickable' : undefined} onClick={onBar ? () => onBar(d, i) : undefined} opacity={highlight !== undefined && highlight !== null && highlight !== i ? 0.35 : 1}>
              <rect x={x} y={y} width={w} height={h} rx={2} fill={fill}>
                <title>{d.title ?? `${d.label}: ${missing ? 'No data' : format(d.value!)}${d.estimated ? ' (estimated)' : ''}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + w / 2} y={height - 8} textAnchor="middle" className="chart-tick">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface Series {
  name: string;
  color: string;
  points: (number | null)[];
  dashed?: boolean;
}

export function LineChart({ labels, series, height = 220, format = (v: number) => v.toLocaleString(), label, yMin }: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; label: string; yMin?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const all = series.flatMap((s) => s.points.filter((p): p is number => p !== null));
  const max = niceMax(Math.max(1, ...all));
  const min = yMin ?? 0;
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(iw / 56)));
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} role="img" aria-label={label}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = min + f * (max - min);
          return (
            <g key={f}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="chart-tick">
                {format(v)}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="chart-tick">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          let d = '';
          s.points.forEach((p, i) => {
            if (p === null) return;
            const prev = i > 0 ? s.points[i - 1] : null;
            d += `${prev === null || i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)} `;
          });
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} />
              {s.points.map((p, i) =>
                p === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(p)} r={labels.length > 30 ? 0 : 2.5} fill={s.color}>
                    <title>{`${s.name}, ${labels[i]}: ${format(p)}`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color, dashed: s.dashed }))} />
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; pattern?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`legend-swatch ${i.dashed ? 'legend-swatch--dashed' : ''} ${i.pattern ? 'legend-swatch--hatch' : ''}`} style={{ background: i.dashed || i.pattern ? undefined : i.color, borderColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars ranked, one row per item: the "one number per asset" view. */
export function RankBars({ rows, format, label, max: maxArg }: { rows: { key: string; label: ReactNode; value: number | null; note?: ReactNode; color?: string; onClick?: () => void }[]; format: (v: number) => string; label: string; max?: number }) {
  const max = maxArg ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="rank-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={r.onClick ? 'is-clickable' : undefined} onClick={r.onClick}>
          <span className="rank-label">{r.label}</span>
          <span className="rank-track">
            {r.value === null ? (
              <span className="rank-missing">No data</span>
            ) : (
              <span className="rank-fill" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: r.color ?? 'var(--chart-1)' }} />
            )}
          </span>
          <span className="rank-value">{r.value === null ? '—' : format(r.value)}</span>
          {r.note && <span className="rank-note">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ points, color = 'var(--chart-1)', width = 96, height = 24 }: { points: (number | null)[]; color?: string; width?: number; height?: number }) {
  const vals = points.filter((p): p is number => p !== null);
  if (!vals.length) return <span className="muted">—</span>;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const d = points
    .map((p, i) => (p === null ? null : `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - 2 - ((p - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

/** A segmented bar for shares (landlord vs tenant, scopes). */
export function StackBar({ parts, label }: { parts: { label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="stack-bar-wrap">
      <div className="stack-bar" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}`}>
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${Math.round((p.value / total) * 100)}%`} />
        ))}
      </div>
      <Legend items={parts.map((p) => ({ label: `${p.label} ${Math.round((p.value / total) * 100)}%`, color: p.color }))} />
    </div>
  );
}
