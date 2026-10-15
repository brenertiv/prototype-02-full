import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DataStatus, Tier } from '../data/types';
import { Icon } from '../shell/Icon';
import { usePrefs } from '../state/preferences';

/* ---------- Page structure ---------- */

/** Each page owns its title in the canvas (SYS-NAVPAT-20, 21). */
export function PageHeader({ eyebrow, title, subtitle, actions, back }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link to={back.to} className="back-link">
            <Icon name="arrow_back" />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, description, actions, children, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div className="section-head">
          <div>
            {title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}
            {description && <p className="muted">{description}</p>}
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Tabs kept in the URL as `?tab=` so a tab deep-links (SYS-NAVPAT-02). */
export function Tabs({ tabs, param = 'tab', label }: { tabs: { id: string; label: string; count?: number; hidden?: boolean }[]; param?: string; label: string }) {
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const active = params.get(param) && visible.some((t) => t.id === params.get(param)) ? params.get(param)! : visible[0]?.id;
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {visible.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className="tab"
          onClick={() => {
            const next = new URLSearchParams(params);
            if (t.id === visible[0].id) next.delete(param);
            else next.set(param, t.id);
            setParams(next, { replace: false });
          }}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function useTab(tabs: { id: string; hidden?: boolean }[], param = 'tab') {
  const [params] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const p = params.get(param);
  return p && visible.some((t) => t.id === p) ? p : visible[0]?.id;
}

/** Filter chips over a page's records, kept in the URL (`?filter=` in People). */
export function FilterChips({ options, param = 'filter', label }: { options: { id: string; label: string; count?: number }[]; param?: string; label: string }) {
  const [params, setParams] = useSearchParams();
  const active = params.get(param) ?? options[0]?.id;
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="filter-chip"
          aria-pressed={o.id === active}
          onClick={() => {
            const next = new URLSearchParams(params);
            if (o.id === options[0].id) next.delete(param);
            else next.set(param, o.id);
            setParams(next);
          }}
        >
          {o.id === active && <Icon name="check" />}
          {o.label}
          {o.count !== undefined && <span className="tab-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A labelled select used in table toolbars. */
export function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="select-filter">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- Status and data states ---------- */

const STATUS_LABEL: Record<DataStatus, string> = { healthy: 'Healthy', 'at-risk': 'At risk', critical: 'Critical' };
const STATUS_ICON: Record<DataStatus, string> = { healthy: 'check_circle', 'at-risk': 'error', critical: 'cancel' };

/** Building data status, never a score (SYS-TRUST-35). Icon and word, not colour alone. */
export function StatusChip({ status, to }: { status: DataStatus; to?: string }) {
  const inner = (
    <>
      <Icon name={STATUS_ICON[status]} filled />
      {STATUS_LABEL[status]}
    </>
  );
  return to ? (
    <Link to={to} className={`status-chip status-chip--${status}`}>
      {inner}
    </Link>
  ) : (
    <span className={`status-chip status-chip--${status}`}>{inner}</span>
  );
}

export function TierBadge({ tier, title }: { tier: Tier | null | undefined; title?: string }) {
  if (tier === null || tier === undefined) return <span className="muted">—</span>;
  return (
    <span className={`tier-badge tier-badge--${String(tier)}`} title={title ?? tierHelp(tier)}>
      Tier {tier}
    </span>
  );
}

export function tierHelp(t: Tier) {
  switch (t) {
    case 0:
      return 'Nothing connected yet';
    case 1:
      return 'Bills and ENERGY STAR';
    case '2a':
      return 'Tenant submetered';
    case '2b':
      return 'Whole-building interval data';
    case 3:
      return 'Instrumented: sensors or BMS';
  }
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function Pill({ tone = 'neutral', icon, children, title }: { tone?: Tone; icon?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`pill pill--${tone}`} title={title}>
      {icon && <Icon name={icon} filled />}
      {children}
    </span>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  return (
    <Pill tone={s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'neutral'} icon={s === 'high' ? 'priority_high' : s === 'medium' ? 'error' : 'info'}>
      {severity[0].toUpperCase() + severity.slice(1)}
    </Pill>
  );
}

/** Estimated values are always marked (SYS-TRUST-11). */
export function EstimatedMark() {
  return (
    <span className="est-mark" title="Estimated">
      est.
    </span>
  );
}

/** Never-measured data never renders as zero (SYS-TRUST-10). */
export function NotMeasured({ children = 'Not measured' }: { children?: ReactNode }) {
  return <span className="not-measured">{children}</span>;
}

/** A surveyed value that could not be read (SYS-TRUST-14, MOD-BI-72). */
export function NotObservable({ reason }: { reason: string }) {
  return (
    <span className="not-observable" title={reason}>
      <Icon name="visibility_off" /> Not observable
    </span>
  );
}

/* ---------- States every view handles (ST-X01 to ST-X03) ---------- */

export function EmptyState({ icon = 'inbox', title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <p className="empty-title">{title}</p>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="loading-state" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, k) => (
        <div key={k} className="skeleton-line" style={{ width: `${70 + ((k * 13) % 30)}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, what = 'this page' }: { onRetry?: () => void; what?: string }) {
  return (
    <div className="empty-state empty-state--error" role="alert">
      <Icon name="cloud_off" />
      <p className="empty-title">Couldn't load {what}</p>
      <p className="muted">The data service didn't respond. Nothing you entered was lost.</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </button>
      )}
    </div>
  );
}

/** Wraps a simulated API read (useApi) with its loading and error states. */
export function ApiView<T>({ q, children, what }: { q: { status: 'loading' | 'error' | 'ready'; data: T | null; retry: () => void }; children: (data: T) => ReactNode; what?: string }) {
  if (q.status === 'loading') return <LoadingState />;
  if (q.status === 'error' || q.data === null) return <ErrorState onRetry={q.retry} what={what} />;
  return <>{children(q.data)}</>;
}

/* ---------- Numbers ---------- */

export function Kpi({ label, value, sub, tone, children, onSelect, selected, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; children?: ReactNode; onSelect?: () => void; selected?: boolean; icon?: string }) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ''} ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="kpi-label">
        {icon && <Icon name={icon} />}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Meter({ value, label, tone }: { value: number; label?: string; tone?: Tone }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <span className="meter-bar" role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <span className={`meter-fill meter-fill--${tone ?? (pct >= 0.9 ? 'success' : pct >= 0.7 ? 'warning' : 'danger')}`} style={{ width: `${pct * 100}%` }} />
      <span className="meter-text">{Math.round(pct * 100)}%</span>
    </span>
  );
}

/* ---------- First-use hints (SYS-ONB-06) ---------- */

export function Hint({ id, children }: { id: string; children: ReactNode }) {
  const { prefs, seeHint } = usePrefs();
  if (prefs.hintsSeen.includes(id)) return null;
  return (
    <div className="hint" role="note">
      <Icon name="tips_and_updates" />
      <span>{children}</span>
      <button type="button" className="icon-btn icon-btn--sm" aria-label="Dismiss hint" onClick={() => seeHint(id)}>
        <Icon name="close" />
      </button>
    </div>
  );
}

/* ---------- Popover ---------- */

export function Popover({ trigger, children, label, align = 'left' }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: ReactNode; label: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Fixed position so a scrolling table or card never clips it.
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const w = popRef.current?.offsetWidth ?? 300;
      const h = popRef.current?.offsetHeight ?? 160;
      let left = align === 'right' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, align]);
  return (
    <span className="popover-anchor" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div ref={popRef} className="popover" role="dialog" aria-label={label} style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
          {children}
        </div>
      )}
    </span>
  );
}

/* ---------- Provenance (SYS-TRUST-01) ---------- */

export interface ProvenanceInfo {
  builtFrom: string[];
  period?: string;
  calculation?: string;
  coverage?: string;
  estimated?: boolean;
  links?: { label: string; to: string }[];
}

/** A number with one click to what it's built from, the period and the calculation. */
export function Traced({ children, info, label = 'Where this number comes from' }: { children: ReactNode; info: ProvenanceInfo; label?: string }) {
  return (
    <Popover
      label={label}
      trigger={(open, toggle) => (
        <button
          type="button"
          className={`traced ${open ? 'is-open' : ''}`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          {children}
          {info.estimated && <EstimatedMark />}
          <Icon name="info" className="traced-icon" />
        </button>
      )}
    >
      <div className="provenance">
        <p className="provenance-title">Built from</p>
        <ul>
          {info.builtFrom.map((b) => (
            <li key={b}>
              <Icon name="subdirectory_arrow_right" /> {b}
            </li>
          ))}
        </ul>
        {info.period && (
          <p>
            <strong>Period:</strong> {info.period}
          </p>
        )}
        {info.calculation && (
          <p>
            <strong>Calculation:</strong> {info.calculation}
          </p>
        )}
        {info.coverage && <p className="muted">{info.coverage}</p>}
        {info.estimated && <p className="muted">Includes estimated values, marked “est.”</p>}
        {info.links && (
          <p className="provenance-links">
            {info.links.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
          </p>
        )}
      </div>
    </Popover>
  );
}
