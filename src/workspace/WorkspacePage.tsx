/** One workspace on the canvas: its header and metadata, state banners and components (MOD-WS-45, 47, 50, 52). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { resolveScope, useNav, useScopeInfo } from '../nav/route';
import { Icon } from '../shell/Icon';
import { usePageControls } from '../shell/pageControls';
import { PHONE_QUERY, useMediaQuery } from '../state/media';
import { usePrefs } from '../state/preferences';
import { ApiView, EmptyState, Hint, Pill } from '../ui/bits';
import { fmtAgo, fmtDate, fmtDateTime } from '../ui/format';
import { ConfirmDialog } from '../ui/Modal';
import { useApi } from '../data/store';
import { useToast } from '../ui/Toast';
import { genSteps, KIND_ICON, KIND_LABEL, ROLE_DEFAULT } from './catalog';
import { WorkspaceComponent } from './components';
import type { CompCtx } from './components/frame';
import { nextRun, RenameDialog, RunHistory, ScheduleDialog, scheduleSummary, ShareDialog, useNameOf } from './dialogs';
import { DEFAULT_PERIOD, downloadCsv, GRESB_COLUMNS, gresbRows, hasData, newBillsSince, periodEnergy, slug } from './logic';
import { msg, useRuntime } from './runtime';
import type { Workspace } from './types';

export function WorkspacePage() {
  const { id = '' } = useParams();
  const rt = useRuntime();
  const ws = rt.get(id);
  const q = useApi(`/workspace/${id}`, () => ws ?? null, [id, ws]);
  if (!ws) return <NotFound />;
  return (
    <article className="page page-wide ws-page">
      <ApiView q={q} what="this workspace">
        {() => <WorkspaceView ws={ws} />}
      </ApiView>
    </article>
  );
}

function NotFound() {
  const { to } = useNav();
  const { user } = useData();
  return (
    <article className="page">
      <EmptyState
        icon="search_off"
        title="This workspace isn’t here"
        body="It may have been deleted, or the link is from another account. Your own workspaces are listed in the panel under Custom Workspaces."
        action={<Link className="btn" to={to(`/workspace/${ROLE_DEFAULT[user.persona]}`)}>Go to your home workspace</Link>}
      />
    </article>
  );
}

function WorkspaceView({ ws }: { ws: Workspace }) {
  const rt = useRuntime();
  const { data, user, patch } = useData();
  const { to, scopeId: globalScope, navigate } = useNav();
  const nav = useNavigate();
  const { set: setPref } = usePrefs();
  const toast = useToast();
  const phone = useMediaQuery(PHONE_QUERY);
  const nameOf = useNameOf();
  const [dialog, setDialog] = useState<'share' | 'schedule' | 'rename' | 'delete' | null>(null);

  const scopeId = ws.prebuilt ? globalScope : ws.scopeId;
  const scope = useScopeInfo(scopeId);
  const globalInfo = useMemo(() => resolveScope(globalScope, data.buildings, data.groups, new Set(data.buildings.map((b) => b.id))), [globalScope, data.buildings, data.groups]);
  const buildings = useMemo(() => data.buildings.filter((b) => scope.buildingIds.includes(b.id)), [data.buildings, scope.buildingIds]);
  const names = useMemo(() => new Map(data.buildings.map((b) => [b.id, b.name])), [data.buildings]);

  useEffect(() => {
    rt.setLastOpened(ws.id);
    if (ws.status === 'ready') rt.markSeen(ws.id);
  }, [ws.id, ws.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = genSteps(ws);
  const step = ws.genStep ?? 0;
  const generating = ws.status === 'generating';
  const compState = (k: number): 'pending' | 'building' | 'ready' => {
    if (ws.status === 'ready') return 'ready';
    if (ws.status === 'waiting') return 'pending';
    if (ws.status === 'failed') return k + 1 < (ws.failedStep ?? 0) ? 'ready' : 'pending';
    return step > k + 1 ? 'ready' : step === k + 1 ? 'building' : 'pending';
  };

  const ctx: CompCtx = { ws, data, scope, buildings, to, readOnly: Boolean(ws.prebuilt), period: ws.period ?? DEFAULT_PERIOD, name: (bid) => names.get(bid) ?? 'Unknown building', phone };
  const plan = ws.planId ? data.plans.find((p) => p.id === ws.planId) : undefined;
  const stale = ws.kind === 'report' && !ws.prebuilt && ws.status === 'ready' ? newBillsSince(data, scope.buildingIds, ws.generatedAt) : 0;
  const owner = ws.prebuilt ? 'Enertiv (ready-made)' : ws.ownerId === user.id ? `You${ws.receivedFrom ? `, from ${ws.receivedFrom.name}` : ''}` : (data.users.find((u) => u.id === ws.ownerId)?.name ?? 'Unknown');

  const editCopy = () => {
    const nid = rt.editCopy(ws.id);
    if (nid) {
      toast(`${ws.name} is now in Custom Workspaces as your own copy.`);
      nav(to(`/workspace/${nid}`));
    }
  };
  const exportCsv = () => {
    const p = ctx.period;
    if (ws.components.some((c) => c.type === 'gresb-table')) {
      downloadCsv(`gresb-asset-table-${slug(scope.name)}-${p.id}.csv`, GRESB_COLUMNS, gresbRows(data, buildings, p, scope.name).map((r) => r.cells));
    } else {
      downloadCsv(`${slug(ws.name)}-${slug(scope.name)}.csv`, ['Building', 'Scope', 'Period start', 'Period end', 'Energy', 'Energy unit', 'Cost', 'Cost unit', 'Emissions', 'Emissions unit', 'Potential fine', 'Fine unit', 'Data coverage', 'Coverage unit', 'Contains estimated values'],
        buildings.map((b) => { const e = periodEnergy(data, b, p); return [b.name, scope.name, p.from, p.to, e.kwh, e.kwh === null ? '' : 'kWh', e.cost, e.cost === null ? '' : 'USD', e.tco2e, e.tco2e === null ? '' : 'tCO2e', b.exposure.status === 'Not covered' ? null : b.exposure.potentialFine, b.exposure.status === 'Not covered' ? '' : 'USD', hasData(b) ? Math.round(b.coverage * 100) : null, hasData(b) ? '%' : '', e.estimated ? 'Yes' : 'No']; }));
    }
    toast('Export downloaded. Scope, period and estimated values are in their own columns.');
  };

  usePageControls(
    <>
      <button type="button" className="btn btn--ghost btn--sm topbar-share" onClick={() => setDialog('share')}>
        <Icon name="ios_share" /> Share
      </button>
      <MoreMenu>
        {(close) => (
          <ul className="ws-menu" role="menu">
              {ws.prebuilt ? (
                <li role="none"><button type="button" role="menuitem" onClick={() => { close(); editCopy(); }}><Icon name="content_copy" /> Edit a copy</button></li>
              ) : (
                <>
                  <li role="none"><button type="button" role="menuitem" onClick={() => { close(); setDialog('rename'); }}><Icon name="edit" /> Rename</button></li>
                  <li role="none"><button type="button" role="menuitem" onClick={() => { close(); const nid = rt.duplicate(ws.id); if (nid) { toast('Duplicated.'); nav(to(`/workspace/${nid}`)); } }}><Icon name="file_copy" /> Duplicate</button></li>
                </>
              )}
              {ws.kind === 'report' && <li role="none"><button type="button" role="menuitem" onClick={() => { close(); setDialog('schedule'); }}><Icon name="schedule" /> {ws.schedule ? 'Edit the schedule' : 'Schedule'}</button></li>}
              <li role="none"><button type="button" role="menuitem" onClick={() => { close(); exportCsv(); }} disabled={ws.status !== 'ready'}><Icon name="download" /> Export as CSV</button></li>
              {!ws.prebuilt && <li role="none"><button type="button" role="menuitem" className="ws-menu-danger" onClick={() => { close(); setDialog('delete'); }}><Icon name="delete" /> Delete</button></li>}
            </ul>
        )}
      </MoreMenu>
    </>,
    [ws.id, ws.prebuilt, ws.kind, ws.schedule, ws.status, ws.name, scope.id, buildings.length],
  );

  const setPlanStatus = (status: 'approved' | 'declined' | 'under-review') => {
    if (!plan) return;
    patch('plans', plan.id, { status });
    rt.push(ws.id, [msg('assistant', 'note', status === 'approved' ? `${user.name} approved the plan. Its projects move to Approved in Capital projects.` : status === 'declined' ? `${user.name} declined the plan. It stays here for the record.` : 'The plan is back under review.')]);
    toast(status === 'approved' ? 'Plan approved.' : status === 'declined' ? 'Plan declined.' : 'Plan back under review.');
  };

  const pendingQuestion = ws.status === 'waiting' ? [...rt.thread(ws.id)].reverse().find((m) => m.kind === 'question' && !m.answered) : undefined;

  return (
    <>
      <header className="ws-header">
        <div className="eyebrow">
          <Icon name={KIND_ICON[ws.kind]} /> {KIND_LABEL[ws.kind]}
          {ws.prebuilt && <Pill tone="neutral" icon="lock">Ready-made, read-only</Pill>}
          {ws.receivedFrom && <Pill tone="info" icon="move_to_inbox">From {ws.receivedFrom.name}</Pill>}
          {plan && <Pill tone={plan.status === 'approved' ? 'success' : plan.status === 'declined' ? 'danger' : 'warning'}>{plan.status === 'approved' ? 'Approved' : plan.status === 'declined' ? 'Declined' : 'Under review'}</Pill>}
        </div>
        <div className="ws-title-row">
          <h1>{ws.name}</h1>
          <div className="ws-title-actions">
            {ws.prebuilt && <button type="button" className="btn btn--sm" onClick={editCopy}><Icon name="content_copy" /> Edit a copy</button>}
            {ws.kind === 'report' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog('schedule')}><Icon name="schedule" /> {ws.schedule ? 'Schedule' : 'Schedule by email'}</button>}
            {plan && plan.status === 'under-review' && !ws.prebuilt && (
              <>
                <button type="button" className="btn btn--sm" onClick={() => setPlanStatus('approved')}><Icon name="check" /> Approve plan</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPlanStatus('declined')}>Decline plan</button>
              </>
            )}
            {plan && plan.status !== 'under-review' && <button type="button" className="text-btn" onClick={() => setPlanStatus('under-review')}>Back to review</button>}
          </div>
        </div>
        {(ws.question || ws.brief) && <p className="page-subtitle">{ws.question ?? `“${ws.brief}”`}</p>}
        <dl className="ws-meta">
          <div><dt>Type</dt><dd>{KIND_LABEL[ws.kind]}</dd></div>
          <div><dt>Owner</dt><dd>{owner}</dd></div>
          <div><dt>Scope</dt><dd>{scope.path.join(' › ')}{scope.kind !== 'property' ? ` · ${scope.buildingIds.length} buildings` : ''}</dd></div>
          <div><dt>Last updated</dt><dd title={fmtDateTime(ws.updatedAt)}>{fmtAgo(ws.updatedAt)}</dd></div>
          {ws.kind === 'report' && <div><dt>Period</dt><dd>{(ws.period ?? DEFAULT_PERIOD).label}</dd></div>}
          {ws.schedule && <div className="ws-meta-wide"><dt>Schedule</dt><dd>{ws.schedule.enabled ? `${scheduleSummary(ws.schedule, nameOf)}. Next run ${fmtDate(nextRun(ws.schedule.cadence))}.` : 'Paused'}</dd></div>}
        </dl>
      </header>

      {!ws.prebuilt && ws.scopeId !== globalScope && (
        <p className="ws-scope-note"><Icon name="my_location" /> This workspace keeps its own scope, {scope.name}. The scope you’re browsing in ({globalInfo.name}) doesn’t change it.</p>
      )}
      {scope.excluded > 0 && <p className="ws-scope-note"><Icon name="visibility_off" /> {scope.excluded} {scope.excluded === 1 ? 'building' : 'buildings'} in this scope {scope.excluded === 1 ? "isn't" : "aren't"} available to you, so totals leave {scope.excluded === 1 ? 'it' : 'them'} out.</p>}
      {ws.prebuilt && <Hint id="ws-prebuilt">Ready-made workspaces stay current for everyone. Select a card with its + button to ask about it, or edit a copy to change it.</Hint>}

      {generating && (
        <div className="banner ws-gen-banner" role="status" aria-live="polite">
          <span className="ws-spinner" aria-hidden="true" />
          <div>
            <strong>Building this workspace</strong> · step {Math.min(step + 1, steps.length)} of {steps.length}: {steps[Math.min(step, steps.length - 1)].label}. It carries on in the background if you leave.
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPref('drawerOpen', true)}>Show steps</button>
        </div>
      )}
      {ws.status === 'waiting' && (
        <div className="banner banner--warning ws-gen-banner" role="status">
          <Icon name="help" />
          <div>
            <strong>One question before it builds:</strong> {pendingQuestion?.text ?? 'the assistant needs an answer.'}
            {pendingQuestion?.options && (
              <div className="ws-answer-row">
                {pendingQuestion.options.map((o) => (
                  <button key={o} type="button" className="btn btn--ghost btn--sm" onClick={() => rt.answer(ws.id, o)}>{o}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPref('drawerOpen', true)}>Answer in the thread</button>
        </div>
      )}
      {ws.status === 'failed' && (
        <div className="banner banner--danger ws-gen-banner" role="alert">
          <Icon name="error" />
          <div>
            <strong>Generation stopped at “{steps[ws.failedStep ?? 0]?.label}”.</strong> The data service didn’t answer in time. Nothing half-built was saved.
          </div>
          <button type="button" className="btn btn--sm" onClick={() => rt.retry(ws.id)}><Icon name="refresh" /> Retry</button>
        </div>
      )}
      {stale > 0 && (
        <div className="banner banner--warning ws-gen-banner" role="status">
          <Icon name="update" />
          <div>
            <strong>The data behind this report has changed.</strong> {stale} new {stale === 1 ? 'bill has' : 'bills have'} arrived since it was generated on {fmtDate(ws.generatedAt)}. The report shows the data as it was then.
          </div>
          <button type="button" className="btn btn--sm" onClick={() => rt.regenerate(ws.id)}><Icon name="refresh" /> Regenerate</button>
        </div>
      )}

      {buildings.length === 0 ? (
        <EmptyState icon="domain_disabled" title="No buildings to show" body={`None of the buildings in ${scope.name} is available to you, so this workspace has nothing to show. Ask an Admin of ${data.company.name} for access.`} />
      ) : (
        <div className="ws-grid">
          {ws.components.map((c, k) => (
            <WorkspaceComponent key={c.id} spec={c} ctx={ctx} state={compState(k)} />
          ))}
        </div>
      )}

      {ws.kind === 'report' && <RunHistory ws={ws} />}

      {dialog === 'share' && <ShareDialog ws={ws} onClose={() => setDialog(null)} onSchedule={() => setDialog('schedule')} />}
      {dialog === 'schedule' && <ScheduleDialog ws={ws} onClose={() => setDialog(null)} />}
      {dialog === 'rename' && <RenameDialog ws={ws} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          title={`Delete ${ws.name}?`}
          body={<p>It leaves your Custom Workspaces with its thread{ws.schedule ? ' and its schedule stops' : ''}. Copies you sent colleagues stay with them.{ws.planId ? ' The carbon plan itself stays in Capital projects.' : ''}</p>}
          confirmLabel="Delete workspace"
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            rt.remove(ws.id);
            setDialog(null);
            toast(`${ws.name} deleted.`);
            navigate(to(`/workspace/${ROLE_DEFAULT[user.persona]}`));
          }}
        />
      )}
    </>
  );
}

/** The top bar's more-actions menu; closes on choice, Escape or a click outside. */
function MoreMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span className="popover-anchor" ref={ref}>
      <button ref={btn} type="button" className="icon-btn topbar-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="more_vert" />
      </button>
      {open && <div className="popover popover--right">{children(() => setOpen(false))}</div>}
    </span>
  );
}
