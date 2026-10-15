/** The Sustainability Lead's role default: coverage gaps, ENERGY STAR sync and reporting readiness (MOD-WS-01, 10). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../shell/Icon';
import { Kpi, Meter, NotMeasured, Pill, Traced } from '../../ui/bits';
import { DataTable } from '../../ui/DataTable';
import { fmtDate, fmtPct } from '../../ui/format';
import { coverText, energyStarReadiness, esSync, gresbReadiness, hasData, localReadiness, tierMix, type Readiness } from '../logic';
import type { CompSpec } from '../types';
import { bound, type CompCtx } from './frame';

const GRESB_RULE = 'Ready when coverage is at least 75%, there are 24 months of data for like-for-like, and no open problem above low severity affects GRESB.';
const ES_RULE = 'Ready when the building is linked to Portfolio Manager, has 12 consecutive months of whole-building data, and no open problem affects ENERGY STAR.';
const LOCAL_RULE = 'Ready when no applicable benchmarking or BPS submission is overdue and the data covers the period due.';

export function ReadinessKpis({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const g = bs.filter((b) => gresbReadiness(ctx.data, b).ready).length;
  const e = bs.filter((b) => energyStarReadiness(ctx.data, b).ready).length;
  const local = bs.map((b) => localReadiness(ctx.data, b)).filter((r) => !r.notApplicable);
  const l = local.filter((r) => r.ready).length;
  const connected = bs.filter(hasData);
  const avg = connected.length ? connected.reduce((a, b) => a + b.coverage, 0) / connected.length : null;
  const of = (n: number, d: number) => `${n} of ${d}`;
  return (
    <div className="grid grid--kpis">
      <Kpi label="Ready for GRESB" value={<Traced info={{ builtFrom: ['Coverage per building', 'Months of history per building', 'Open data problems that affect GRESB'], period: 'Last 12 months, and 24 for like-for-like', calculation: GRESB_RULE, coverage: coverText(bs.length, bs.length, 'buildings', ctx.scope.excluded), links: [{ label: 'GRESB problems in Data Health', to: ctx.to('/building-info/data-health?framework=GRESB') }] }}>{of(g, bs.length)}</Traced>} sub="buildings" tone={g === bs.length ? 'success' : 'warning'} />
      <Kpi label="Ready for ENERGY STAR" value={<Traced info={{ builtFrom: ['Portfolio Manager links', 'Months of history', 'Open ENERGY STAR problems'], period: '12 consecutive months', calculation: ES_RULE, links: [{ label: 'ENERGY STAR problems in Data Health', to: ctx.to('/building-info/data-health?framework=ENERGY%20STAR') }] }}>{of(e, bs.length)}</Traced>} sub="buildings" tone={e === bs.length ? 'success' : 'warning'} />
      <Kpi label="Ready for local laws" value={local.length ? <Traced info={{ builtFrom: ['Benchmarking and BPS policies on each building', 'Submission status and deadlines'], calculation: LOCAL_RULE, coverage: `${bs.length - local.length} buildings have no local law that applies.` }}>{of(l, local.length)}</Traced> : <NotMeasured>No local law applies</NotMeasured>} sub="buildings with a local law" tone={local.length && l < local.length ? 'warning' : undefined} />
      <Kpi
        label="Average coverage"
        value={avg === null ? <NotMeasured>No data yet</NotMeasured> : <Traced info={{ builtFrom: ['Bills, meters and ENERGY STAR data per building and utility'], period: 'Last 12 months', calculation: 'Share of each building’s floor area and sold utilities (landlord and tenant) with data in the period, averaged across connected buildings. Coverage is separate from completeness.', coverage: coverText(connected.length, bs.length, 'buildings', ctx.scope.excluded) }}>{fmtPct(avg)}</Traced>}
        sub={tierMix(bs)}
      />
    </div>
  );
}

type Fw = 'all' | 'gresb' | 'es' | 'local';

function Cell({ r, to, label }: { r: Readiness & { notApplicable?: boolean }; to: string; label: string }) {
  if (r.notApplicable) return <span className="muted">Doesn’t apply</span>;
  if (r.ready) return <Pill tone="success" icon="check_circle">Ready</Pill>;
  return (
    <div className="ws-blocked">
      <Pill tone="warning" icon="block">Blocked</Pill>
      <ul>
        {r.reasons.slice(0, 2).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <Link to={to} className="ws-small-link" aria-label={`Fix ${label}`}>
        Fix in Building Info
      </Link>
    </div>
  );
}

export function FrameworkReadiness({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const [fw, setFw] = useState<Fw>('all');
  const rows = bound(spec, ctx).map((b) => ({ b, g: gresbReadiness(ctx.data, b), e: energyStarReadiness(ctx.data, b), l: localReadiness(ctx.data, b) }));
  const blocked = (r: (typeof rows)[number]) => (fw === 'gresb' ? !r.g.ready : fw === 'es' ? !r.e.ready : fw === 'local' ? !r.l.ready : true);
  const shown = rows.filter(blocked);
  const counts = { gresb: rows.filter((r) => !r.g.ready).length, es: rows.filter((r) => !r.e.ready).length, local: rows.filter((r) => !r.l.ready).length };
  const fwName = fw === 'gresb' ? 'GRESB' : fw === 'es' ? 'ENERGY STAR' : fw === 'local' ? 'local laws' : '';
  return (
    <>
      <div className="filters" role="group" aria-label="Show buildings blocked for">
        {([['all', 'All buildings'], ['gresb', `Blocking GRESB (${counts.gresb})`], ['es', `Blocking ENERGY STAR (${counts.es})`], ['local', `Blocking local laws (${counts.local})`]] as [Fw, string][]).map(([id, label]) => (
          <button key={id} type="button" className="filter-chip" aria-pressed={fw === id} onClick={() => setFw(id)}>
            {fw === id && <Icon name="check" />}
            {label}
          </button>
        ))}
      </div>
      <DataTable
        label="Readiness by building"
        rows={shown}
        rowKey={(r) => r.b.id}
        dense
        caption={
          <>
            {fw === 'all' ? `${rows.length} buildings in ${ctx.scope.name}.` : `${shown.length} of ${rows.length} buildings would block ${fwName}.`}{' '}
            <Link to={ctx.to(`/building-info/data-health?framework=${fw === 'es' ? 'ENERGY%20STAR' : fw === 'local' ? 'Local%20laws' : 'GRESB'}`)}>Open these problems in Data Health</Link>
          </>
        }
        empty={{ title: `Nothing blocks ${fwName || 'reporting'}`, body: 'Every building in this scope meets the framework’s thresholds today.', icon: 'task_alt' }}
        columns={[
          { key: 'b', header: 'Building', value: (r) => r.b.name, render: (r) => <Link to={ctx.to(`/building-info/buildings/${r.b.id}`)}>{r.b.name}</Link> },
          { key: 'g', header: 'GRESB', value: (r) => (r.g.ready ? 1 : 0), render: (r) => <Cell r={r.g} label={`GRESB at ${r.b.name}`} to={ctx.to(`/building-info/data-health?framework=GRESB&building=${r.b.id}`)} /> },
          { key: 'e', header: 'ENERGY STAR', value: (r) => (r.e.ready ? 1 : 0), render: (r) => <Cell r={r.e} label={`ENERGY STAR at ${r.b.name}`} to={ctx.to(`/building-info/buildings/${r.b.id}?tab=utilities`)} /> },
          { key: 'l', header: 'Local laws', value: (r) => (r.l.ready ? 1 : 0), hideOnPhone: true, render: (r) => <Cell r={r.l} label={`local laws at ${r.b.name}`} to={ctx.to(`/building-info/data-health?framework=${encodeURIComponent(r.l.policies[0] ?? 'Local laws')}&building=${r.b.id}`)} /> },
        ]}
      />
    </>
  );
}

export function CoverageGaps({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const gaps = bs.filter((b) => !hasData(b) || b.coverage < 0.9).sort((a, b) => (hasData(a) ? a.coverage : -1) - (hasData(b) ? b.coverage : -1));
  if (!gaps.length) return <p className="ws-good"><Icon name="task_alt" /> Every building has at least 90% coverage over the last 12 months.</p>;
  return (
    <>
      <p className="muted ws-def">Coverage: share of floor area and sold utilities, landlord and tenant, with data in the last 12 months. {gaps.length} of {bs.length} buildings are below 90%.</p>
      <ul className="ws-list">
        {gaps.slice(0, 8).map((b) => {
          const open = ctx.data.health.filter((h) => h.buildingId === b.id && h.status === 'open' && (h.family === 'Coverage' || h.family === 'Bills' || h.family === 'Utility logins'));
          return (
            <li key={b.id}>
              <div className="ws-list-main">
                <Link to={ctx.to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                <span className="muted">{open.length ? `${open[0].problem}${open.length > 1 ? ` and ${open.length - 1} more` : ''}` : b.nnn ? 'Tenant-held accounts not yet shared' : 'No open problem explains it yet'}</span>
              </div>
              {hasData(b) ? <Meter value={b.coverage} label={`Coverage ${fmtPct(b.coverage)}`} /> : <NotMeasured>Not connected</NotMeasured>}
            </li>
          );
        })}
      </ul>
      {gaps.length > 8 && <p className="muted">And {gaps.length - 8} more. <Link to={ctx.to('/building-info/data-health')}>See all in Data Health</Link></p>}
    </>
  );
}

export function EsSync({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx).map((b) => ({ b, s: esSync(ctx.data, b) }));
  const n = (st: string) => bs.filter((x) => x.s.state === st).length;
  const out = bs.filter((x) => x.s.state !== 'in-sync');
  return (
    <>
      <div className="ws-split-figures">
        <div><span className="ws-big">{n('in-sync')}</span><span className="muted">in sync</span></div>
        <div><span className="ws-big ws-big--warn">{n('out-of-sync')}</span><span className="muted">out of sync</span></div>
        <div><span className="ws-big">{n('not-linked')}</span><span className="muted">not linked</span></div>
      </div>
      {out.length > 0 && (
        <ul className="ws-list">
          {out.slice(0, 6).map(({ b, s }) => (
            <li key={b.id}>
              <div className="ws-list-main">
                <Link to={ctx.to(`/building-info/buildings/${b.id}?tab=utilities`)}>{b.name}</Link>
                <span className="muted">
                  {s.reason}
                  {b.esLastSynced ? ` · last push ${fmtDate(b.esLastSynced)}` : ''}
                  {b.esDirection ? ` · ${b.esDirection}` : ''}
                </span>
              </div>
              <Link to={ctx.to(`/building-info/buildings/${b.id}?tab=utilities`)} className="btn btn--ghost btn--sm">
                Check sync
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="muted ws-def">Sync and the manual push are on each building’s Utilities tab in Building Info.</p>
    </>
  );
}
