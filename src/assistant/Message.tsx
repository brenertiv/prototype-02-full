/** The drawer's message kinds, fixed by the drawer spec (CMP-DRAWER-04). */
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { Traced } from '../ui/bits';
import { fmtDateTime } from '../ui/format';
import { genSteps, KIND_LABEL } from '../workspace/catalog';
import { NotBought } from '../workspace/components/operations';
import { useRuntime } from '../workspace/runtime';
import type { Msg } from '../workspace/types';

function Steps({ m, live }: { m: Msg; live: boolean }) {
  const rt = useRuntime();
  const ws = m.wsId ? rt.get(m.wsId) : undefined;
  if (!ws) return <p>{m.text}</p>;
  const steps = genSteps(ws);
  const at = ws.genStep ?? 0;
  const state = (k: number) => {
    if (!live || ws.status === 'ready') return 'done';
    if (ws.status === 'failed') return k < (ws.failedStep ?? 0) ? 'done' : k === ws.failedStep ? 'failed' : 'todo';
    if (ws.status === 'waiting') return 'todo';
    return k < at ? 'done' : k === at ? 'now' : 'todo';
  };
  const selected = new Set(rt.selection.filter((s) => s.wsId === ws.id).map((s) => s.compId));
  const focusComp = (compId?: string) => {
    if (!compId) return;
    const el = document.querySelector<HTMLElement>(`[data-comp="${compId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return (
    <>
      <p>{m.text}</p>
      <ol className="as-steps" aria-label="Generation steps">
        {steps.map((s, k) => {
          const st = state(k);
          return (
            <li key={k} className={`as-step as-step--${st} ${s.compId && selected.has(s.compId) ? 'is-selected' : ''}`}>
              <Icon name={st === 'done' ? 'check_circle' : st === 'failed' ? 'error' : st === 'now' ? 'progress_activity' : 'radio_button_unchecked'} filled={st === 'done'} className={st === 'now' ? 'as-spin' : ''} />
              {s.compId && rt.openId === ws.id ? (
                <button type="button" className="text-btn as-step-btn" onClick={() => focusComp(s.compId)}>{s.label}</button>
              ) : (
                <span>{s.label}</span>
              )}
              <span className="sr-only">{st === 'done' ? ', done' : st === 'now' ? ', in progress' : st === 'failed' ? ', failed' : ', to do'}</span>
            </li>
          );
        })}
      </ol>
      {live && ws.status === 'failed' && (
        <button type="button" className="btn btn--sm" onClick={() => rt.retry(ws.id)}><Icon name="refresh" /> Retry</button>
      )}
      {live && ws.status === 'ready' && <p className="as-done"><Icon name="task_alt" /> Ready. Every number on it opens its source.</p>}
    </>
  );
}

export function MessageView({ m, liveSteps, onConfirm, onCancel, onAnswer, onEditCopy }: { m: Msg; liveSteps: boolean; onConfirm: (m: Msg) => void; onCancel: (m: Msg) => void; onAnswer: (text: string) => void; onEditCopy: (wsId: string) => void }) {
  const { to } = useNav();
  const { data } = useData();
  const rt = useRuntime();
  if (m.role === 'user') {
    return (
      <li className="as-msg as-msg--user">
        {m.chips && m.chips.length > 0 && (
          <ul className="as-msg-chips" aria-label="About">
            {m.chips.map((c) => <li key={c.compId} className="as-chip as-chip--static"><Icon name="widgets" /> {c.label}</li>)}
          </ul>
        )}
        <p>{m.text}</p>
      </li>
    );
  }
  const tone = m.tone === 'low-confidence' ? { icon: 'help', label: 'Low confidence' } : m.tone === 'no-data' ? { icon: 'database', label: 'No data yet' } : m.tone === 'scope' ? { icon: 'visibility_off', label: 'Limited to your access' } : null;
  const created = m.kind === 'created' && m.wsId ? rt.get(m.wsId) : undefined;
  return (
    <li className={`as-msg as-msg--assistant as-msg--${m.kind}`}>
      {tone && <p className="as-tone"><Icon name={tone.icon} /> {tone.label}</p>}
      {m.kind === 'steps' ? (
        <Steps m={m} live={liveSteps} />
      ) : m.kind === 'not-bought' ? (
        <>
          <p>{m.text}</p>
          <NotBought product="Carbon Planning" ctx={{ data, buildings: data.buildings }} />
        </>
      ) : m.kind === 'edit' ? (
        <p><Icon name="edit" className="as-inline-icon" /> {m.text}</p>
      ) : (
        <p>{m.text}</p>
      )}
      {m.facts && (
        <dl className="as-facts">
          {m.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd><Traced info={f.info}>{f.value}</Traced></dd>
            </div>
          ))}
        </dl>
      )}
      {m.items && m.items.length > 0 && (
        <ul className="as-items">
          {m.items.map((it) => (
            <li key={it.label + (it.detail ?? '')}>
              {it.to ? <Link to={to(it.to)}>{it.label}</Link> : <strong>{it.label}</strong>}
              {it.detail && <span className="muted"> · {it.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {m.kind === 'question' && m.options && (
        m.answered ? (
          <p className="muted as-answered">Answered: {m.answered}</p>
        ) : (
          <div className="as-options" role="group" aria-label="Answers">
            {m.options.map((o) => <button key={o} type="button" className="btn btn--ghost btn--sm" onClick={() => onAnswer(o)}>{o}</button>)}
          </div>
        )
      )}
      {m.kind === 'confirm' && m.confirm && (
        <div className="as-confirm" role="group" aria-label="Confirm action">
          <p className="as-confirm-label"><Icon name="edit_note" /> {m.confirm.label}</p>
          {m.confirm.state === 'pending' ? (
            <div className="btn-row">
              <button type="button" className="btn btn--sm" onClick={() => onConfirm(m)}>Confirm</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCancel(m)}>Cancel</button>
            </div>
          ) : (
            <p className="muted">{m.confirm.state === 'done' ? 'Done.' : 'Cancelled. Nothing changed.'}</p>
          )}
        </div>
      )}
      {created && (
        <div className="as-created">
          <span><Icon name={created.status === 'generating' ? 'progress_activity' : created.status === 'waiting' ? 'help' : created.status === 'failed' ? 'error' : 'task_alt'} className={created.status === 'generating' ? 'as-spin' : ''} /> {created.name} · {KIND_LABEL[created.kind]} · {created.status === 'generating' ? 'building in the background' : created.status === 'waiting' ? 'waiting on one answer' : created.status === 'failed' ? 'generation failed' : 'ready'}</span>
          <Link className="btn btn--ghost btn--sm" to={to(`/workspace/${created.id}`)}>Open</Link>
        </div>
      )}
      {m.action && m.action.kind === 'edit-copy' && rt.get(m.action.wsId)?.prebuilt && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEditCopy(m.action!.wsId)}><Icon name="content_copy" /> {m.action.label}</button>
      )}
      {m.sources && m.sources.length > 0 && (
        <p className="as-sources">
          <span className="muted">Source</span>
          {m.sources.map((s) => <Link key={s.to} to={to(s.to)}>{s.label}</Link>)}
        </p>
      )}
      <span className="as-time">{fmtDateTime(m.at)}</span>
    </li>
  );
}
