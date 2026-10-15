/** The frame every workspace component sits in: title, binding badge, "Add to thread" (SYS-AI-20, MOD-WS-51). */
import type { ReactNode } from 'react';
import type { Building, Dataset } from '../../data/types';
import type { ScopeInfo } from '../../nav/route';
import { Icon } from '../../shell/Icon';
import { EmptyState } from '../../ui/bits';
import { compTitle, COMP_META } from '../catalog';
import { applyBinding, bindingLabel } from '../logic';
import { useRuntime } from '../runtime';
import type { CompSpec, ReportPeriod, Workspace } from '../types';

export interface CompCtx {
  ws: Workspace;
  data: Dataset;
  /** The workspace's own scope, resolved against the user's access. */
  scope: ScopeInfo;
  /** Accessible buildings in that scope. */
  buildings: Building[];
  to: (inner: string) => string;
  readOnly: boolean;
  period: ReportPeriod;
  name: (buildingId: string) => string;
  phone: boolean;
}

/** The component's own buildings: the scope, a rule or pinned buildings. */
export const bound = (spec: CompSpec, ctx: CompCtx) => applyBinding(spec.binding, ctx.buildings);

export function CompFrame({ spec, ctx, state, children, actions, wide, sub }: { spec: CompSpec; ctx: CompCtx; state: 'pending' | 'building' | 'ready'; children: ReactNode; actions?: ReactNode; wide?: boolean; sub?: ReactNode }) {
  const rt = useRuntime();
  const title = compTitle(spec);
  const selected = rt.selection.some((s) => s.compId === spec.id && s.wsId === ctx.ws.id);
  const badge = bindingLabel(spec.binding, ctx.name);
  return (
    <section
      className={`ws-comp card ${wide ? 'ws-comp--wide' : ''} ${selected ? 'is-selected' : ''} ${state === 'building' ? 'is-building' : ''}`}
      aria-labelledby={`${ctx.ws.id}-${spec.id}-t`}
      aria-busy={state !== 'ready' || undefined}
      data-comp={spec.id}
    >
      <header className="ws-comp-head">
        <div className="ws-comp-title">
          <Icon name={COMP_META[spec.type].icon} />
          <h3 id={`${ctx.ws.id}-${spec.id}-t`}>{title}</h3>
        </div>
        <div className="ws-comp-actions">
          {state === 'ready' && actions}
          {state === 'ready' && (
            <button
              type="button"
              className={`icon-btn icon-btn--sm ws-select ${selected ? 'is-on' : ''}`}
              aria-pressed={selected}
              aria-label={selected ? `Remove ${title} from the thread` : `Add ${title} to the thread`}
              title={selected ? 'Remove from thread' : 'Add to thread'}
              onClick={() => rt.toggleSel({ wsId: ctx.ws.id, compId: spec.id, label: title })}
            >
              <Icon name={selected ? 'check_circle' : 'add_comment'} filled={selected} />
            </button>
          )}
        </div>
      </header>
      {badge && (
        <p className="ws-badge">
          <Icon name={spec.binding?.kind === 'pinned' ? 'push_pin' : 'rule'} />
          {badge}
        </p>
      )}
      {sub && state === 'ready' && <p className="ws-comp-sub">{sub}</p>}
      {state === 'ready' ? (
        children
      ) : (
        <div className="ws-comp-pending" aria-label={state === 'building' ? `Building ${title}` : `${title} comes next`}>
          <div className="skeleton-line" style={{ width: '60%' }} />
          <div className="skeleton-line" style={{ width: '85%' }} />
          <div className="skeleton-line" style={{ width: '40%' }} />
          <span className="muted ws-pending-note">{state === 'building' ? 'Building this now…' : 'Waiting its turn'}</span>
        </div>
      )}
    </section>
  );
}

/** A component whose buildings have no data for it: what the data supports instead (SYS-TRUST-12). */
export function NoneHere({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return <EmptyState icon="info" title={title} body={body} action={action} />;
}
