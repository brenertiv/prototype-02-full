/** Emissions and energy (MOD-WS-05, 13, 16): scopes by control, monthly use that states coverage, target progress, EUI. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../data/store';
import { monthsBack, portfolioMonthly } from '../../data/series';
import type { Goal } from '../../data/types';
import { Icon } from '../../shell/Icon';
import { Kpi, NotMeasured, Pill, Traced } from '../../ui/bits';
import { BarChart, LineChart, StackBar, type BarDatum } from '../../ui/charts';
import { DataTable } from '../../ui/DataTable';
import { fmtEnergy, fmtInt, fmtMoney, fmtMonth, fmtNum, fmtT } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { coverText, hasData, newId } from '../logic';
import type { CompSpec } from '../types';
import { bound, NoneHere, type CompCtx } from './frame';

export function EmissionsSplit({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const all = bound(spec, ctx);
  const bs = all.filter(hasData);
  if (!bs.length) return <NoneHere title="No emissions to show yet" body="Emissions are built from bills, meters and ENERGY STAR data. None has arrived for these buildings; connecting utility logins is the first step." action={<Link className="btn btn--ghost btn--sm" to={ctx.to('/building-info/data-health')}>See what’s missing</Link>} />;
  const s1 = bs.reduce((a, b) => a + b.emissions.scope1, 0);
  const s2 = bs.reduce((a, b) => a + b.emissions.scope2, 0);
  const s3 = bs.reduce((a, b) => a + b.emissions.scope3, 0);
  const landlord = bs.reduce((a, b) => a + (b.emissions.scope1 + b.emissions.scope2 + b.emissions.scope3) * b.emissions.landlordShare, 0);
  const total = s1 + s2 + s3;
  const cover = coverText(bs.length, all.length, 'properties', ctx.scope.excluded);
  const info = (calc: string) => ({ builtFrom: ['Billed and metered energy per building', 'Grid emission factors (eGRID) and fuel factors', 'Lease records for who controls each space'], period: 'Last 12 months', calculation: calc, coverage: cover });
  return (
    <>
      <div className="grid grid--kpis">
        <Kpi label="Total emissions" value={<Traced info={info('Scope 1, 2 and 3 summed across buildings.')}>{fmtT(total)}</Traced>} sub={cover} />
        <Kpi label="Landlord-controlled" value={<Traced info={info('Emissions from spaces and systems the landlord operates (operational control).')}>{fmtT(landlord)}</Traced>} sub={`${Math.round((landlord / total) * 100)}% of the total`} />
        <Kpi label="Tenant-controlled" value={<Traced info={info('Emissions from tenant-operated spaces, including NNN leases; reported as Scope 3 by the landlord.')}>{fmtT(total - landlord)}</Traced>} sub="mostly Scope 3 for you" />
      </div>
      <div className="ws-two">
        <div>
          <p className="ws-mini-title">By scope</p>
          <StackBar label="Emissions by scope" parts={[{ label: 'Scope 1', value: s1, color: 'var(--chart-1)' }, { label: 'Scope 2', value: s2, color: 'var(--chart-2)' }, { label: 'Scope 3', value: s3, color: 'var(--chart-3)' }]} />
        </div>
        <div>
          <p className="ws-mini-title">By operational control</p>
          <StackBar label="Emissions by control" parts={[{ label: 'Landlord', value: landlord, color: 'var(--chart-4)' }, { label: 'Tenant', value: total - landlord, color: 'var(--chart-5)' }]} />
        </div>
      </div>
    </>
  );
}

type Metric = 'kwh' | 'cost' | 'tco2e';
const METRIC_FMT: Record<Metric, (v: number) => string> = { kwh: (v) => fmtEnergy(v), cost: (v) => fmtMoney(v, true), tco2e: (v) => `${fmtInt(v)} t` };
const METRIC_LABEL: Record<Metric, string> = { kwh: 'Energy', cost: 'Energy cost', tco2e: 'Emissions' };

export function EnergyMonthly({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const metric: Metric = spec.metric ?? 'kwh';
  const series = useMemo(() => portfolioMonthly(ctx.data, bs, 36), [ctx.data, bs]);
  const fmt = METRIC_FMT[metric];

  if (spec.utility) {
    const months = monthsBack(12);
    const ids = new Set(bs.map((b) => b.id));
    const accts = new Set(ctx.data.accounts.filter((a) => ids.has(a.buildingId) && a.utility === spec.utility).map((a) => a.id));
    const bills = ctx.data.bills.filter((b) => accts.has(b.accountId));
    const unit = bills[0]?.unit ?? (spec.utility === 'gas' ? 'therms' : 'kWh');
    const rows = months.map((m) => {
      const inMonth = bills.filter((b) => b.start.slice(0, 7) === m);
      return { month: m, value: inMonth.length ? inMonth.reduce((a, b) => a + b.consumption, 0) : null, estimated: inMonth.some((b) => b.estimated), n: new Set(inMonth.map((b) => b.buildingId)).size };
    });
    if (!bills.length) return <NoneHere title={`No ${spec.utility} bills in this scope`} body={`None of these buildings has a ${spec.utility} account with bills yet.`} />;
    return (
      <>
        <BarChart label={`${spec.utility} consumption by month`} data={rows.map((r) => ({ label: fmtMonth(r.month), value: r.value, estimated: r.estimated, title: `${fmtMonth(r.month)}: ${r.value === null ? 'No data' : `${fmtInt(r.value)} ${unit}`}, ${r.n} buildings` }))} format={(v) => fmtNum(v, 0)} />
        <p className="table-caption">{spec.utility === 'gas' ? 'Gas' : 'Electricity'} from utility bills, {unit}, last 12 months. Bars count only buildings with a bill that month; hover a bar for how many.</p>
      </>
    );
  }

  if (!series.some((p) => p.covered > 0)) return <NoneHere title="No energy data yet" body="Monthly use appears once bills or meter data arrive for these buildings." />;

  const last12 = series.slice(-12);
  const val = (p: (typeof series)[number]) => (p.covered ? p[metric] : null);
  const coverNote = (pts: typeof series) => {
    const min = Math.min(...pts.map((p) => p.covered));
    const max = Math.max(...pts.map((p) => p.covered));
    return min === max ? `Each month covers ${max} of ${bs.length} buildings.` : `Months cover between ${min} and ${max} of ${bs.length} buildings; hover a bar for its count.`;
  };

  if (spec.view === 'table') {
    return (
      <DataTable
        label="Energy by month"
        rows={[...last12].reverse()}
        rowKey={(r) => r.month}
        dense
        caption={coverNote(last12)}
        columns={[
          { key: 'm', header: 'Month', value: (r) => r.month, render: (r) => fmtMonth(r.month) },
          { key: 'k', header: 'Energy (kWh)', align: 'right', value: (r) => (r.covered ? r.kwh : null), render: (r) => (r.covered ? <>{fmtInt(r.kwh)}{r.estimated && <span className="est-mark">est.</span>}</> : <NotMeasured />) },
          { key: 'c', header: 'Cost', align: 'right', value: (r) => (r.covered ? r.cost : null), render: (r) => (r.covered ? fmtMoney(r.cost) : <NotMeasured />) },
          { key: 't', header: 'Emissions (tCO₂e)', align: 'right', value: (r) => (r.covered ? r.tco2e : null), render: (r) => (r.covered ? fmtInt(r.tco2e) : <NotMeasured />) },
          { key: 'n', header: 'Buildings covered', align: 'right', value: (r) => r.covered, render: (r) => `${r.covered} of ${r.of}` },
        ]}
      />
    );
  }

  if (spec.period === 'annual') {
    const years = [...new Set(series.map((p) => p.month.slice(0, 4)))];
    const data: BarDatum[] = years.map((y) => {
      const pts = series.filter((p) => p.month.startsWith(y) && p.covered);
      const total = pts.reduce((a, p) => a + (p[metric] ?? 0), 0);
      return { label: `${y}${pts.length < 12 ? ` (${pts.length} mo)` : ''}`, value: pts.length ? total : null, estimated: pts.some((p) => p.estimated), title: `${y}: ${pts.length ? fmt(total) : 'No data'}, ${pts.length} months with data` };
    });
    return (
      <>
        <BarChart label={`${METRIC_LABEL[metric]} by year`} data={data} format={fmt} />
        <p className="table-caption">Calendar years; a year with fewer than 12 months of data says so. {coverNote(series)}</p>
      </>
    );
  }

  if (spec.years?.length) {
    const ys = [...spec.years].sort();
    const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (
      <>
        <LineChart
          label={`${METRIC_LABEL[metric]} by month, ${ys.join(' against ')}`}
          labels={labels}
          format={fmt}
          series={ys.map((y, k) => ({ name: String(y), color: colors[k % colors.length], points: labels.map((_, mi) => { const p = series.find((x) => x.month === `${y}-${String(mi + 1).padStart(2, '0')}`); return p ? val(p) : null; }) }))}
        />
        <p className="table-caption">Months without data are gaps, not zeros. {coverNote(series.filter((p) => ys.some((y) => p.month.startsWith(String(y)))))}</p>
      </>
    );
  }

  return (
    <>
      <BarChart label={`${METRIC_LABEL[metric]} by month, last 12 months`} data={last12.map((p) => ({ label: fmtMonth(p.month), value: val(p), estimated: p.estimated, title: `${fmtMonth(p.month)}: ${p.covered ? fmt(p[metric] ?? 0) : 'No data'} from ${p.covered} of ${p.of} buildings${p.estimated ? ', includes estimated values' : ''}` }))} format={fmt} />
      <p className="table-caption">
        <Traced info={{ builtFrom: ['Utility bills', 'Interval meters at tier 2b and 3', 'ENERGY STAR Portfolio Manager'], period: `${fmtMonth(last12[0].month)} – ${fmtMonth(last12[11].month)}`, calculation: 'Monthly sum across buildings with data that month; never-measured months are left out, not counted as zero.', estimated: last12.some((p) => p.estimated) }}>What this covers</Traced>{' '}
        {coverNote(last12)}
      </p>
    </>
  );
}

function SetGoal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { add, patch } = useData();
  const toast = useToast();
  const [reduction, setReduction] = useState(goal?.reductionPct ?? 50);
  const [baseline, setBaseline] = useState(goal?.baselineYear ?? 2019);
  const [target, setTarget] = useState(goal?.targetYear ?? 2030);
  const [pathway, setPathway] = useState<Goal['pathway']>(goal?.pathway ?? 'CRREM 1.5°C');
  const valid = reduction > 0 && reduction <= 100 && target > baseline && target <= 2060;
  const save = () => {
    const next = { name: `Operational carbon −${reduction}% by ${target}`, baselineYear: baseline, targetYear: target, reductionPct: reduction, pathway };
    if (goal) patch('goals', goal.id, next);
    else add('goals', { id: newId('goal'), ...next });
    toast('Carbon target saved. Carbon plans read the same target.');
    onClose();
  };
  return (
    <Modal title={goal ? 'Change the carbon target' : 'Set a carbon target'} onClose={onClose} size="sm" footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!valid} onClick={save}>Save target</button></>}>
      <div className="field-row">
        <label className="field"><span>Reduction (%)</span><input type="number" min={1} max={100} value={reduction} onChange={(e) => setReduction(Number(e.target.value))} /></label>
        <label className="field"><span>Baseline year</span><input type="number" min={2005} max={2026} value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} /></label>
        <label className="field"><span>Target year</span><input type="number" min={2027} max={2060} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
      </div>
      <label className="field"><span>Pathway</span><select value={pathway} onChange={(e) => setPathway(e.target.value as Goal['pathway'])}><option>CRREM 1.5°C</option><option>SBTi</option><option>Custom</option></select></label>
      {!valid && <p className="muted" role="alert">The target year must come after the baseline, and the reduction must be between 1% and 100%.</p>}
    </Modal>
  );
}

export function GoalProgress({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const [editing, setEditing] = useState(false);
  const goal = ctx.data.goals[0];
  const bs = bound(spec, ctx).filter((b) => hasData(b) && b.historyMonths >= 24);
  const series = useMemo(() => portfolioMonthly(ctx.data, bs, 24), [ctx.data, bs]);
  if (!goal) {
    return (
      <>
        <NoneHere title="No carbon target yet" body="Set a target here and every dashboard and carbon plan measures against the same one." action={<button type="button" className="btn btn--sm" onClick={() => setEditing(true)}><Icon name="flag" /> Set a target</button>} />
        {editing && <SetGoal onClose={() => setEditing(false)} />}
      </>
    );
  }
  const prev = series.slice(0, 12).reduce((a, p) => a + p.tco2e, 0);
  const last = series.slice(12).reduce((a, p) => a + p.tco2e, 0);
  const yoy = prev ? (last - prev) / prev : null;
  const needed = goal.reductionPct / 100 / Math.max(1, goal.targetYear - goal.baselineYear);
  const onTrack = yoy !== null && -yoy >= needed;
  return (
    <>
      <div className="ws-goal">
        <div>
          <p className="ws-mini-title">Target</p>
          <p className="ws-goal-name">{goal.name}</p>
          <p className="muted">Against {goal.baselineYear} · {goal.pathway}</p>
        </div>
        <div>
          <p className="ws-mini-title">Change over the last year</p>
          <p className="ws-big">
            {yoy === null ? <NotMeasured>Not enough history</NotMeasured> : <Traced info={{ builtFrom: [`Emissions for ${bs.length} buildings with 24 months of data (like-for-like)`], period: 'Last 12 months against the 12 before', calculation: 'Change in summed tCO₂e between the two 12-month periods, same buildings in both.', coverage: coverText(bs.length, bound(spec, ctx).length, 'properties', ctx.scope.excluded) }}>{`${yoy <= 0 ? '−' : '+'}${Math.abs(yoy * 100).toFixed(1)}%`}</Traced>}
          </p>
          <p className="muted">Needed: about −{(needed * 100).toFixed(1)}% a year to reach the target</p>
        </div>
        <div className="ws-goal-status">{yoy !== null && <Pill tone={onTrack ? 'success' : 'warning'} icon={onTrack ? 'trending_down' : 'trending_flat'}>{onTrack ? 'On track' : 'Behind the pathway'}</Pill>}</div>
      </div>
      <p className="muted ws-def">Enertiv’s data for these buildings starts after {goal.baselineYear}, so progress is measured year over year, like-for-like. <button type="button" className="text-btn" onClick={() => setEditing(true)}>Change the target</button></p>
      {editing && <SetGoal goal={goal} onClose={() => setEditing(false)} />}
    </>
  );
}

export function EuiRanked({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const measured = bs.filter((b) => b.siteEui !== null && b.gfa).sort((a, b) => (b.siteEui ?? 0) - (a.siteEui ?? 0));
  const unmeasured = bs.filter((b) => !(b.siteEui !== null && b.gfa));
  if (!measured.length) return <NoneHere title="Energy per square foot isn’t measurable yet" body="It needs 12 months of whole-building energy and the gross floor area on the building record." />;
  const info = (b: (typeof bs)[number]) => ({ builtFrom: ['Whole-building energy, all fuels, from bills, meters and ENERGY STAR', `Gross floor area ${fmtInt(b.gfa)} ft²`], period: 'Last 12 months', calculation: 'Site energy in kBtu divided by gross floor area. Benchmark: ENERGY STAR national median for the property type.', links: [{ label: `${b.name} in Building Info`, to: ctx.to(`/building-info/buildings/${b.id}`) }] });
  const foot = unmeasured.length ? `${unmeasured.length} building${unmeasured.length === 1 ? '' : 's'} not shown: no floor area or no energy data yet.` : `All ${bs.length} buildings measured.`;
  if (spec.view === 'table') {
    return (
      <DataTable label="Energy use per square foot" rows={measured} rowKey={(b) => b.id} dense rowHref={(b) => ctx.to(`/building-info/buildings/${b.id}`)} caption={`Site EUI, kBtu/ft², last 12 months. ${foot}`}
        columns={[
          { key: 'n', header: 'Building', value: (b) => b.name },
          { key: 'e', header: 'Site EUI', align: 'right', value: (b) => b.siteEui, render: (b) => <Traced info={info(b)}>{fmtInt(b.siteEui)}</Traced> },
          { key: 'm', header: 'Benchmark', align: 'right', value: (b) => b.euiBenchmark },
          { key: 'r', header: 'Against benchmark', align: 'right', value: (b) => (b.siteEui ?? 0) / b.euiBenchmark, render: (b) => `${Math.round(((b.siteEui ?? 0) / b.euiBenchmark - 1) * 100)}%` },
        ]} />
    );
  }
  const max = Math.max(...measured.map((b) => Math.max(b.siteEui ?? 0, b.euiBenchmark)));
  return (
    <>
      <ol className="ws-rank" aria-label="Buildings ranked by energy use per square foot">
        {measured.slice(0, 8).map((b, k) => (
          <li key={b.id}>
            <span className="ws-rank-n">{k + 1}</span>
            <Link to={ctx.to(`/building-info/buildings/${b.id}`)} className="ws-rank-label">{b.name}</Link>
            <span className="ws-rank-track" aria-hidden="true">
              <span className="ws-rank-fill" style={{ width: `${((b.siteEui ?? 0) / max) * 100}%`, background: (b.siteEui ?? 0) > b.euiBenchmark ? 'var(--chart-3)' : 'var(--chart-1)' }} />
              <span className="ws-rank-mark" style={{ left: `${(b.euiBenchmark / max) * 100}%` }} title={`Benchmark ${b.euiBenchmark}`} />
            </span>
            <span className="ws-rank-value"><Traced info={info(b)}>{`${fmtInt(b.siteEui)} kBtu/ft²`}</Traced></span>
          </li>
        ))}
      </ol>
      <p className="table-caption">The tick on each bar is the benchmark for its property type. {foot}</p>
    </>
  );
}
