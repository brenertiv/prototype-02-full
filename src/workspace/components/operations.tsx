/** Data problems, equipment end of life, insights, load profiles and capital projects (MOD-WS-01, 17, 20, 25, 30). */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../data/store';
import { loadProfile } from '../../data/series';
import type { Equipment, Insight, Project } from '../../data/types';
import { Icon } from '../../shell/Icon';
import { Kpi, NotMeasured, Pill, SelectFilter, SeverityPill, StatusChip, Traced } from '../../ui/bits';
import { LineChart } from '../../ui/charts';
import { DataTable } from '../../ui/DataTable';
import { fmtDate, fmtInt, fmtMoney, fmtNum, fmtT } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { InsightDrawer } from '../InsightDrawer';
import { downloadCsv, newId, nowIso, slug, tierMix } from '../logic';
import { useRuntime } from '../runtime';
import type { CompSpec } from '../types';
import { bound, NoneHere, type CompCtx } from './frame';

/* ---------- Not bought (ST-E03, ST-W12, SYS-ACCESS-06) ---------- */

export function NotBought({ product, ctx, evidence }: { product: 'Carbon Planning' | 'Equipment Optimization'; ctx: Pick<CompCtx, 'data' | 'buildings'>; evidence?: string }) {
  const { getApp, setApp, user } = useData();
  const toast = useToast();
  const key = `ws.asked.${user.id}.${slug(product)}`;
  const asked = getApp<string | null>(key, null);
  const surveyed = ctx.buildings.filter((b) => b.hasEquipmentSurvey).length;
  const poor = ctx.data.equipment.filter((e) => ctx.buildings.some((b) => b.id === e.buildingId) && (e.condition === 'Poor' || e.condition === 'Critical')).length;
  const ready = evidence ?? (product === 'Carbon Planning' ? `Your data is ready for it: ${surveyed} of ${ctx.buildings.length} buildings have an equipment survey, and ${poor} pieces of equipment are in poor or critical condition.` : `${tierMix(ctx.buildings)}. Insights need instrumented buildings, with sensors or a BMS connected.`);
  return (
    <div className="ws-notbought" role="note">
      <Icon name="inventory_2" />
      <div>
        <p className="ws-notbought-title">Data-ready, not in your account yet</p>
        <p>{product} isn’t part of {ctx.data.company.name}’s account. {ready}</p>
        {asked ? (
          <p className="muted"><Icon name="check" /> You asked your account team on {fmtDate(asked)}. They’ll be in touch.</p>
        ) : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setApp(key, nowIso()); toast('Your account team will get in touch about ' + product + '.'); }}>
            Ask your account team about it
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Data problems (PM role default) ---------- */

export function DataProblems({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const ids = new Set(bs.map((b) => b.id));
  const open = ctx.data.health.filter((h) => ids.has(h.buildingId) && h.status === 'open');
  const sevRank = { high: 0, medium: 1, low: 2 };
  const byBuilding = bs.map((b) => ({ b, items: open.filter((h) => h.buildingId === b.id).sort((x, y) => sevRank[x.severity] - sevRank[y.severity]) })).filter((x) => x.items.length).sort((x, y) => y.items.filter((h) => h.severity === 'high').length - x.items.filter((h) => h.severity === 'high').length || y.items.length - x.items.length);
  const mine = open.filter((h) => h.owner === 'You').length;
  return (
    <>
      <div className="grid grid--kpis">
        <Kpi label="Open problems" value={<Traced info={{ builtFrom: ['Data Health checks: bills, logins, meters, coverage, ENERGY STAR, survey'], period: 'As of the last check', calculation: 'Count of open items; expected and resolved items are left out.', links: [{ label: 'Open Data Health', to: ctx.to('/building-info/data-health') }] }}>{fmtInt(open.length)}</Traced>} sub={`on ${byBuilding.length} of ${bs.length} buildings`} tone={open.length ? 'warning' : 'success'} />
        <Kpi label="High severity" value={fmtInt(open.filter((h) => h.severity === 'high').length)} sub="fix these first" tone={open.some((h) => h.severity === 'high') ? 'danger' : undefined} />
        <Kpi label="Yours to fix" value={fmtInt(mine)} sub={`${open.length - mine} are with Enertiv, tenants or the utility`} />
      </div>
      {!byBuilding.length ? (
        <p className="ws-good"><Icon name="task_alt" /> Nothing open on these buildings. New problems appear here as the checks find them.</p>
      ) : (
        <div className="ws-groups">
          {byBuilding.slice(0, 12).map(({ b, items }) => (
            <div key={b.id} className="ws-group">
              <div className="ws-group-head">
                <Link to={ctx.to(`/building-info/buildings/${b.id}`)} className="ws-group-name">{b.name}</Link>
                <StatusChip status={b.status} to={ctx.to(`/building-info/data-health?building=${b.id}`)} />
                <span className="muted">{items.length} open</span>
              </div>
              <ul className="ws-list">
                {items.slice(0, 4).map((h) => (
                  <li key={h.id}>
                    <div className="ws-list-main">
                      <Link to={ctx.to(`/building-info/data-health?item=${h.id}`)}>{h.problem}{h.utility ? ` · ${h.utility}` : ''}</Link>
                      <span className="muted">{h.fix} · {h.owner === 'You' ? 'yours' : `with ${h.owner}`}</span>
                    </div>
                    <SeverityPill severity={h.severity} />
                  </li>
                ))}
              </ul>
              {items.length > 4 && <Link className="ws-small-link" to={ctx.to(`/building-info/data-health?building=${b.id}`)}>{items.length - 4} more on {b.name}</Link>}
            </div>
          ))}
          {byBuilding.length > 12 && <p className="muted">And {byBuilding.length - 12} more buildings. <Link to={ctx.to('/building-info/data-health')}>See all in Data Health</Link></p>}
        </div>
      )}
    </>
  );
}

/* ---------- Equipment end of life (MOD-WS-25) ---------- */

const CAPEX_BY_TYPE: Record<Project['type'], number> = { HVAC: 180000, Lighting: 60000, Electrification: 240000, Envelope: 150000, Controls: 45000, Solar: 200000 };
const projectType = (e: Equipment): Project['type'] => (/light/i.test(e.type ?? '') ? 'Lighting' : /boiler|furnace|heat/i.test(e.type ?? '') ? 'Electrification' : /bms|control/i.test(e.type ?? '') ? 'Controls' : 'HVAC');

function SendToPlan({ equipment, onClose, ctx }: { equipment: Equipment[]; onClose: () => void; ctx: CompCtx }) {
  const { add } = useData();
  const rt = useRuntime();
  const toast = useToast();
  const navigate = useNavigate();
  const [planId, setPlanId] = useState(ctx.data.plans.find((p) => p.status !== 'declined')?.id ?? ctx.data.plans[0]?.id ?? '');
  if (!ctx.data.entitlements.carbonPlanning) {
    return (
      <Modal title="Send to a carbon plan" onClose={onClose} size="sm">
        <NotBought product="Carbon Planning" ctx={ctx} />
      </Modal>
    );
  }
  const send = () => {
    equipment.forEach((e) => {
      const type = projectType(e);
      const capex = CAPEX_BY_TYPE[type];
      const savings = Math.round(capex * 0.11);
      const project: Project = { id: newId('pr'), planId, buildingId: e.buildingId, equipmentId: e.id, name: `Replace ${e.name}`, type, status: 'Proposed', priority: e.condition === 'Critical' ? 'High' : 'Medium', capex, savingsUsd: savings, tco2e: Math.round(capex / 2500), paybackYears: Math.round((capex / savings) * 10) / 10, year: Math.min(2030, e.expectedEol ?? 2027), estimated: true };
      add('projects', project);
    });
    const ws = rt.custom.find((w) => w.planId === planId);
    toast(`${equipment.length} ${equipment.length === 1 ? 'project' : 'projects'} added to ${ctx.data.plans.find((p) => p.id === planId)?.name}, with estimated costs until quoted.`, ws ? { action: { label: 'Open the plan', onClick: () => navigate(ctx.to(`/workspace/${ws.id}`)) } } : undefined);
    onClose();
  };
  return (
    <Modal title="Send to a carbon plan" onClose={onClose} size="sm" footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!planId} onClick={send}>Add {equipment.length} {equipment.length === 1 ? 'project' : 'projects'}</button></>}>
      {ctx.data.plans.length ? (
        <>
          <p>Each piece of equipment becomes a proposed replacement project, with a building-level cost estimate until you add a quote.</p>
          <label className="field"><span>Plan</span><select value={planId} onChange={(e) => setPlanId(e.target.value)}>{ctx.data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        </>
      ) : (
        <p>There’s no carbon plan yet. Create one from New in Custom Workspaces, then send equipment to it.</p>
      )}
    </Modal>
  );
}

export function EquipmentEol({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const [years, setYears] = useState(spec.window ?? 5);
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const bs = bound(spec, ctx);
  const names = new Map(bs.map((b) => [b.id, b.name]));
  const year = Number(ctx.data.asOf.slice(0, 4));
  const rows = ctx.data.equipment
    .filter((e) => names.has(e.buildingId) && !e.retired && e.kind === 'equipment' && (e.condition === 'Poor' || e.condition === 'Critical' || (e.expectedEol !== null && e.expectedEol <= year + years)))
    .sort((a, b) => (names.get(a.buildingId) ?? '').localeCompare(names.get(b.buildingId) ?? '') || (a.expectedEol ?? 9999) - (b.expectedEol ?? 9999));
  const surveyed = bs.filter((b) => b.hasEquipmentSurvey).length;
  const exportCsv = () =>
    downloadCsv(`equipment-end-of-life-${slug(ctx.scope.name)}.csv`, ['Building', 'Equipment', 'Type', 'Make', 'Model', 'Condition', 'Expected end of life', 'Last surveyed', 'Last edited', 'Edited by', 'Scope', 'Window (years)'],
      rows.map((e) => [names.get(e.buildingId), e.name, e.type, e.make, e.model, e.condition, e.expectedEol, e.surveyedAt, e.editedBy?.at.slice(0, 10), e.editedBy?.who, ctx.scope.name, years]));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <>
      <div className="table-toolbar ws-toolbar">
        <SelectFilter label="End of life within" value={String(years)} onChange={(v) => setYears(Number(v))} options={[1, 3, 5, 10].map((n) => ({ value: String(n), label: `Poor condition, or end of life within ${n} year${n === 1 ? '' : 's'}` }))} />
        <button type="button" className="btn btn--ghost btn--sm" onClick={exportCsv} disabled={!rows.length}><Icon name="download" /> Export CSV</button>
        <button type="button" className="btn btn--sm" disabled={!picked.length} onClick={() => setSending(true)}><Icon name="eco" /> Send {picked.length || ''} to a carbon plan</button>
      </div>
      <DataTable
        label="Equipment due for replacement"
        rows={rows}
        rowKey={(e) => e.id}
        dense
        search={(e) => `${e.name} ${e.type ?? ''} ${names.get(e.buildingId)}`}
        caption={`${rows.length} pieces of equipment across ${new Set(rows.map((r) => r.buildingId)).size} buildings, by building. ${surveyed < bs.length ? `${bs.length - surveyed} buildings have no equipment survey, so they can’t appear here yet.` : ''}`}
        empty={{ title: 'Nothing due in this window', body: surveyed ? 'No surveyed equipment is in poor condition or due to reach end of life. Widen the window to look further out.' : 'None of these buildings has an equipment survey yet. The Survey App records condition and age.', icon: 'hvac' }}
        columns={[
          { key: 'sel', header: 'Select', render: (e) => <input type="checkbox" aria-label={`Select ${e.name}`} checked={picked.includes(e.id)} onChange={() => toggle(e.id)} /> },
          { key: 'b', header: 'Building', value: (e) => names.get(e.buildingId) },
          { key: 'n', header: 'Equipment', value: (e) => e.name, render: (e) => <Link to={ctx.to(`/building-info/equipment/${e.id}`)}>{e.name}</Link> },
          { key: 't', header: 'Type', hideOnPhone: true, value: (e) => e.type, render: (e) => e.type ?? <span className="muted">No type tag</span> },
          { key: 'c', header: 'Condition', value: (e) => e.condition, render: (e) => (e.condition ? <Pill tone={e.condition === 'Critical' ? 'danger' : e.condition === 'Poor' ? 'warning' : 'neutral'}>{e.condition}</Pill> : <NotMeasured>Not surveyed</NotMeasured>) },
          { key: 'eol', header: 'End of life', align: 'right', value: (e) => e.expectedEol, render: (e) => e.expectedEol ?? <NotMeasured>Unknown</NotMeasured> },
          { key: 's', header: 'Surveyed or edited', hideOnPhone: true, value: (e) => e.editedBy?.at ?? e.surveyedAt, render: (e) => (e.editedBy ? `Edited ${fmtDate(e.editedBy.at)} by ${e.editedBy.who}` : e.surveyedAt ? `Surveyed ${fmtDate(e.surveyedAt)}` : <span className="muted">Never</span>) },
        ]}
      />
      {sending && <SendToPlan equipment={rows.filter((r) => picked.includes(r.id))} ctx={ctx} onClose={() => { setSending(false); setPicked([]); }} />}
    </>
  );
}

/* ---------- Insights (MOD-WS-30, 31) ---------- */

const STATUS_LABEL: Record<Insight['status'], string> = { new: 'New', 'in-progress': 'In progress', implemented: 'Implemented' };
export const insightStatusTone = (s: Insight['status']) => (s === 'implemented' ? 'success' : s === 'in-progress' ? 'info' : 'neutral');

export function InsightsRanked({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const [status, setStatus] = useState<'all' | Insight['status']>('all');
  const [open, setOpen] = useState<string | null>(null);
  const bs = bound(spec, ctx);
  const tier3 = bs.filter((b) => Object.values(b.tierByUtility).includes(3));
  if (!ctx.data.entitlements.equipmentOptimization) return <NotBought product="Equipment Optimization" ctx={ctx} />;
  if (!tier3.length) return <NoneHere title="Insights need an instrumented building" body={`Insights come from sensor or BMS data (tier 3). None of the ${bs.length} buildings here is instrumented yet: ${tierMix(bs)}.`} />;
  const ids = new Set(tier3.map((b) => b.id));
  const all = ctx.data.insights.filter((i) => ids.has(i.buildingId)).sort((a, b) => b.valueUsd - a.valueUsd);
  const list = all.filter((i) => status === 'all' || i.status === status);
  const total = list.reduce((a, i) => a + i.valueUsd, 0);
  const t = list.reduce((a, i) => a + i.valueTco2e, 0);
  const info = (_i: Insight) => ({ builtFrom: ['Sensor and BMS data on the equipment', 'The building’s tariff for the dollar value', 'Grid emission factor for tCO₂e'], period: 'Projected over 12 months', calculation: 'Estimated annual value if the change is made. Verified savings after the change aren’t measured.', estimated: true });
  return (
    <>
      <div className="ws-toolbar">
        <div className="filters" role="group" aria-label="Insight status">
          {(['all', 'new', 'in-progress', 'implemented'] as const).map((s) => (
            <button key={s} type="button" className="filter-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {status === s && <Icon name="check" />}
              {s === 'all' ? `All (${all.length})` : `${STATUS_LABEL[s]} (${all.filter((i) => i.status === s).length})`}
            </button>
          ))}
        </div>
      </div>
      <p className="ws-comp-sub">
        <Traced info={{ builtFrom: [`${list.length} insights on ${tier3.length} instrumented buildings`], period: 'Projected over 12 months', calculation: 'Sum of each insight’s estimated annual value.', estimated: true, coverage: `${bs.length - tier3.length} buildings here aren’t instrumented, so they have no insights.` }}>{`${fmtMoney(total, true)} and ${fmtT(t)} a year`}</Traced>{' '}
        if every insight shown is acted on.
      </p>
      {spec.view === 'table' ? (
        <DataTable label="Insights" rows={list} rowKey={(i) => i.id} dense onRowClick={(i) => setOpen(i.id)}
          columns={[
            { key: 't', header: 'Insight', value: (i) => i.title, render: (i) => <button type="button" className="text-btn" onClick={(e) => { e.stopPropagation(); setOpen(i.id); }}>{i.title}</button> },
            { key: 'b', header: 'Building', hideOnPhone: true, value: (i) => ctx.name(i.buildingId) },
            { key: 'v', header: 'Value a year', align: 'right', value: (i) => i.valueUsd, render: (i) => <Traced info={info(i)}>{fmtMoney(i.valueUsd)}</Traced> },
            { key: 'c', header: 'tCO₂e a year', align: 'right', value: (i) => i.valueTco2e, render: (i) => fmtNum(i.valueTco2e, 1) },
            { key: 's', header: 'Status', value: (i) => i.status, render: (i) => <Pill tone={insightStatusTone(i.status)}>{STATUS_LABEL[i.status]}</Pill> },
          ]} />
      ) : (
        <ol className="ws-insights">
          {list.slice(0, 8).map((i, k) => (
            <li key={i.id}>
              <span className="ws-rank-n">{k + 1}</span>
              <div className="ws-list-main">
                <button type="button" className="text-btn ws-insight-title" onClick={() => setOpen(i.id)}>{i.title}</button>
                <span className="muted">{ctx.name(i.buildingId)} · {i.category}</span>
              </div>
              <span className="ws-insight-value"><Traced info={info(i)}>{fmtMoney(i.valueUsd, true)}</Traced><span className="muted">{fmtNum(i.valueTco2e, 1)} tCO₂e</span></span>
              <Pill tone={insightStatusTone(i.status)}>{STATUS_LABEL[i.status]}</Pill>
            </li>
          ))}
          {!list.length && <li className="muted">No insights with this status.</li>}
        </ol>
      )}
      {open && <InsightDrawer insightId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/* ---------- Load profiles (MOD-WS-17) ---------- */

export function LoadProfiles({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx).filter((b) => b.tierByUtility.electricity === '2b' || b.tierByUtility.electricity === 3);
  const [id, setId] = useState(bs[0]?.id ?? '');
  const b = bs.find((x) => x.id === id) ?? bs[0];
  const profile = useMemo(() => (b ? loadProfile(b) : []), [b]);
  if (!b) return <NoneHere title="Load profiles need interval data" body={`They appear for buildings with whole-building interval data or sensors (tier 2b or 3). Here: ${tierMix(bound(spec, ctx))}.`} />;
  const peak = Math.max(...profile.map((p) => p.kw));
  const base = Math.min(...profile.map((p) => p.kw));
  const avg = profile.reduce((a, p) => a + p.kw, 0) / profile.length;
  const info = { builtFrom: [`15-minute interval data, ${b.name}`], period: 'A typical weekday, last 30 days', calculation: 'Demand in kW per 15-minute interval.', links: [{ label: 'Meters in Building Info', to: ctx.to('/building-info/meters') }] };
  return (
    <>
      <div className="ws-toolbar">
        <SelectFilter label="Building" value={b.id} onChange={setId} options={bs.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
      <div className="ws-split-figures">
        <div><span className="ws-big"><Traced info={info}>{`${fmtInt(peak)} kW`}</Traced></span><span className="muted">peak demand</span></div>
        <div><span className="ws-big">{fmtInt(base)} kW</span><span className="muted">base load overnight</span></div>
        <div><span className="ws-big">{Math.round((avg / peak) * 100)}%</span><span className="muted">load factor</span></div>
      </div>
      {spec.view === 'table' ? (
        <DataTable label="Demand by hour" rows={profile.filter((_, k) => k % 4 === 0)} rowKey={(p) => p.t} dense columns={[{ key: 't', header: 'Time', value: (p) => p.t }, { key: 'k', header: 'Demand (kW)', align: 'right', value: (p) => p.kw }]} />
      ) : (
        <LineChart label={`Load profile for ${b.name}`} labels={profile.map((p) => p.t)} series={[{ name: 'Demand (kW)', color: 'var(--chart-1)', points: profile.map((p) => p.kw) }]} format={(v) => `${fmtInt(v)} kW`} />
      )}
      <p className="table-caption">{bs.length} of {bound(spec, ctx).length} buildings here have interval data; the rest have bills only, so no load profile.</p>
    </>
  );
}

/* ---------- Capital projects (MOD-WS-20, 22, 24) ---------- */

export function CapitalProjects({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const rt = useRuntime();
  const bs = bound(spec, ctx);
  if (!ctx.data.entitlements.carbonPlanning) return <NotBought product="Carbon Planning" ctx={{ data: ctx.data, buildings: bs }} />;
  if (!ctx.data.plans.length) return <NoneHere title="No carbon plans yet" body="Capital projects come from carbon plans. Create a plan and its projects appear here, across plans." action={<Link className="btn btn--sm" to={ctx.to('/workspace/new?start=plan')}><Icon name="eco" /> Create a carbon plan</Link>} />;
  const ids = new Set(bs.map((b) => b.id));
  const projects = ctx.data.projects.filter((p) => ids.has(p.buildingId));
  const capex = projects.reduce((a, p) => a + p.capex, 0);
  const savings = projects.reduce((a, p) => a + p.savingsUsd, 0);
  const t = projects.reduce((a, p) => a + p.tco2e, 0);
  const est = projects.filter((p) => p.estimated).length;
  const planName = (id: string) => ctx.data.plans.find((p) => p.id === id)?.name ?? 'Plan';
  const planWs = (id: string) => rt.custom.find((w) => w.planId === id);
  const pinfo = (p: Project) => ({ builtFrom: [p.equipmentId ? `Equipment record: ${ctx.data.equipment.find((e) => e.id === p.equipmentId)?.name}` : 'Building-level estimate (no equipment survey)', `Carbon plan: ${planName(p.planId)}`], calculation: 'Capital cost from the planner’s cost model; payback is cost divided by annual savings.', estimated: p.estimated });
  return (
    <>
      <div className="grid grid--kpis">
        <Kpi label="Capital cost" value={<Traced info={{ builtFrom: [`${projects.length} projects in ${new Set(projects.map((p) => p.planId)).size} plans`], calculation: 'Sum of project capital costs.', estimated: est > 0, coverage: est ? `${est} projects use building-level estimates.` : undefined }}>{fmtMoney(capex, true)}</Traced>} sub={`${projects.length} projects`} />
        <Kpi label="Annual savings" value={fmtMoney(savings, true)} sub={savings ? `simple payback ${fmtNum(capex / savings, 1)} years` : undefined} />
        <Kpi label="Emissions reduction" value={fmtT(t)} sub="a year, once complete" />
      </div>
      <DataTable
        label="Capital projects"
        rows={projects}
        rowKey={(p) => p.id}
        dense
        search={(p) => `${p.name} ${ctx.name(p.buildingId)} ${p.type}`}
        initialSort={{ key: 'cap', dir: 'desc' }}
        caption={`Every project across your carbon plans in ${ctx.scope.name}.${est ? ` ${est} use building-level estimates, marked est.` : ''}`}
        empty={{ title: 'No projects on these buildings', body: 'The carbon plans don’t include any building in this scope.' }}
        columns={[
          { key: 'n', header: 'Project', value: (p) => p.name, render: (p) => (p.equipmentId ? <Link to={ctx.to(`/building-info/equipment/${p.equipmentId}`)}>{p.name}</Link> : p.name) },
          { key: 'b', header: 'Property', value: (p) => ctx.name(p.buildingId), hideOnPhone: true },
          { key: 'pl', header: 'Plan', hideOnPhone: true, value: (p) => planName(p.planId), render: (p) => { const w = planWs(p.planId); return w ? <Link to={ctx.to(`/workspace/${w.id}`)}>{planName(p.planId)}</Link> : planName(p.planId); } },
          { key: 's', header: 'Status', value: (p) => p.status },
          { key: 'pr', header: 'Priority', hideOnPhone: true, value: (p) => p.priority },
          { key: 'ty', header: 'Type', hideOnPhone: true, value: (p) => p.type },
          { key: 'cap', header: 'Cost', align: 'right', value: (p) => p.capex, render: (p) => <Traced info={pinfo(p)}>{fmtMoney(p.capex, true)}</Traced> },
          { key: 'pb', header: 'Payback', align: 'right', value: (p) => p.paybackYears, render: (p) => `${fmtNum(p.paybackYears, 1)} yr` },
        ]}
      />
    </>
  );
}
