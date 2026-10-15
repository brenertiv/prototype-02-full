/** The plan workspace: the Create Plan wizard's output, restyled (MOD-WS-20 to 23). */
import { Link } from 'react-router-dom';
import type { Plan } from '../../data/types';
import { EstimatedMark, Kpi, Pill, Traced } from '../../ui/bits';
import { LineChart } from '../../ui/charts';
import { DataTable } from '../../ui/DataTable';
import { fmtDate, fmtInt, fmtMoney, fmtNum, fmtT } from '../../ui/format';
import { planFigures } from '../logic';
import type { CompSpec } from '../types';
import { NoneHere, type CompCtx } from './frame';

export const usePlan = (ctx: CompCtx): Plan | undefined => ctx.data.plans.find((p) => p.id === ctx.ws.planId);

function Missing() {
  return <NoneHere title="This plan isn’t available" body="The plan behind this workspace was removed, or its buildings are outside your access." />;
}

export function PlanOverview({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const plan = usePlan(ctx);
  if (!plan) return <Missing />;
  const f = planFigures(ctx.data, plan.id);
  const bs = ctx.data.buildings.filter((b) => plan.buildingIds.includes(b.id));
  const current = bs.reduce((a, b) => a + b.emissions.scope1 + b.emissions.scope2, 0);
  const info = (calc: string) => ({ builtFrom: [`${f.projects.length} projects on ${bs.length} buildings`, 'Equipment records and condition from Building Info', 'The planner’s cost and savings model'], calculation: calc, estimated: f.estimated, coverage: f.estimated ? 'Buildings without an equipment survey use building-level estimates.' : undefined });
  return (
    <div className="grid grid--kpis">
      <Kpi label="Total investment" value={<Traced info={info('Sum of project capital costs.')}>{fmtMoney(f.capex, true)}</Traced>} sub={`${f.projects.length} projects`} />
      <Kpi label="Emissions reduction" value={<Traced info={info('Sum of each project’s annual tCO₂e reduction once complete.')}>{fmtT(f.tco2e)}</Traced>} sub={current ? `${Math.round((f.tco2e / current) * 100)}% of today’s ${fmtT(current)}` : undefined} tone="success" />
      <Kpi label="Annual savings" value={<Traced info={info('Sum of projected annual energy cost savings.')}>{fmtMoney(f.savings, true)}</Traced>} />
      <Kpi label="Payback" value={f.payback === null ? '—' : <Traced info={info('Total investment divided by annual savings.')}>{`${fmtNum(f.payback, 1)} years`}</Traced>} />
    </div>
  );
}

export function PlanNarrative({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const plan = usePlan(ctx);
  if (!plan) return <Missing />;
  const f = planFigures(ctx.data, plan.id);
  return (
    <div className="ws-narrative">
      <dl className="dl">
        <dt>Strategy</dt>
        <dd>{plan.strategy}</dd>
        <dt>Conditions</dt>
        <dd>{plan.conditions.join(' · ')}</dd>
        <dt>Properties</dt>
        <dd>{plan.buildingIds.map((id) => ctx.name(id)).join(', ')}</dd>
        <dt>Target</dt>
        <dd>−{plan.reductionPct}% by {plan.targetYear}</dd>
        <dt>Created</dt>
        <dd>{fmtDate(plan.created)}</dd>
      </dl>
      <p>{plan.narrative}</p>
      {f.estimated && <p className="muted">Projects marked est. use building-level estimates because the building has no equipment survey yet.</p>}
    </div>
  );
}

export function PlanPathway({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const plan = usePlan(ctx);
  if (!plan) return <Missing />;
  const f = planFigures(ctx.data, plan.id);
  const bs = ctx.data.buildings.filter((b) => plan.buildingIds.includes(b.id));
  const current = bs.reduce((a, b) => a + b.emissions.scope1 + b.emissions.scope2, 0);
  const years = Array.from({ length: 16 }, (_, k) => 2025 + k);
  const goal = ctx.data.goals[0];
  const targetPct = (goal?.reductionPct ?? plan.reductionPct) / 100;
  const targetYear = goal?.targetYear ?? plan.targetYear;
  const planLine = years.map((y) => Math.max(0, Math.round(current - f.projects.filter((p) => p.year <= y).reduce((a, p) => a + p.tco2e, 0))));
  const target = years.map((y) => Math.round(y >= targetYear ? current * (1 - targetPct) : current * (1 - (targetPct * (y - 2025)) / Math.max(1, targetYear - 2025))));
  const crrem = years.map((y) => Math.round(current * Math.pow(0.93, y - 2025)));
  const firstYear = (id: string) => Math.min(...f.projects.filter((p) => p.buildingId === id).map((p) => p.year));
  const exposureRows = bs.filter((b) => b.exposure.potentialFine > 0 || ctx.data.policies.some((p) => p.buildingId === b.id && p.type === 'BPS'));
  const addressed = exposureRows.filter((b) => Number.isFinite(firstYear(b.id)) && firstYear(b.id) <= 2029);
  return (
    <>
      <LineChart
        label="Emissions pathway for the plan's buildings, against the target and a CRREM 1.5°C pathway"
        labels={years.map(String)}
        format={(v) => `${fmtInt(v)} t`}
        series={[
          { name: 'This plan', color: 'var(--chart-1)', points: planLine },
          { name: `Target: −${Math.round(targetPct * 100)}% by ${targetYear}`, color: 'var(--chart-target)', points: target, dashed: true },
          { name: 'CRREM 1.5°C pathway', color: 'var(--chart-3)', points: crrem, dashed: true },
        ]}
      />
      <p className="table-caption">
        <Traced info={{ builtFrom: [`Scope 1 and 2 today for ${bs.length} buildings: ${fmtT(current)}`, 'Each project’s reduction from its year of completion', goal ? `Target: ${goal.name}` : 'The plan’s own target', 'CRREM 1.5°C decarbonisation pathway'], calculation: 'Today’s emissions less the reductions of projects completed by each year.', estimated: f.estimated }}>How the pathway is built</Traced>
      </p>
      {exposureRows.length > 0 && (
        <>
          <p className="ws-mini-title">BPS fine exposure across the plan</p>
          <p className="muted">{addressed.length} of {exposureRows.length} buildings with a BPS have a project before the 2029 compliance period ends, covering {fmtMoney(addressed.reduce((a, b) => a + b.exposure.potentialFine, 0), true)} of {fmtMoney(exposureRows.reduce((a, b) => a + b.exposure.potentialFine, 0), true)} in potential fines.</p>
          <DataTable label="BPS exposure in the plan" rows={exposureRows} rowKey={(b) => b.id} dense
            columns={[
              { key: 'n', header: 'Building', value: (b) => b.name, render: (b) => <Link to={ctx.to(`/building-info/buildings/${b.id}`)}>{b.name}</Link> },
              { key: 'x', header: 'Potential fine today', align: 'right', value: (b) => b.exposure.potentialFine, render: (b) => fmtMoney(b.exposure.potentialFine, true) },
              { key: 'y', header: 'First project', align: 'right', value: (b) => (Number.isFinite(firstYear(b.id)) ? firstYear(b.id) : null), render: (b) => (Number.isFinite(firstYear(b.id)) ? firstYear(b.id) : '—') },
              { key: 's', header: 'In the scenario', render: (b) => (Number.isFinite(firstYear(b.id)) && firstYear(b.id) <= 2029 ? <Pill tone="success">Addressed by {firstYear(b.id)}</Pill> : <Pill tone="warning">Not addressed</Pill>) },
            ]} />
        </>
      )}
    </>
  );
}

export function PlanProjects({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const plan = usePlan(ctx);
  if (!plan) return <Missing />;
  const { projects } = planFigures(ctx.data, plan.id);
  const types = [...new Set(projects.map((p) => p.type))];
  return (
    <>
      <ul className="ws-type-totals">
        {types.map((t) => {
          const list = projects.filter((p) => p.type === t);
          return (
            <li key={t}>
              <span className="ws-mini-title">{t}</span>
              <strong>{fmtMoney(list.reduce((a, p) => a + p.capex, 0), true)}</strong>
              <span className="muted">{list.length} {list.length === 1 ? 'project' : 'projects'} · {fmtT(list.reduce((a, p) => a + p.tco2e, 0))}</span>
            </li>
          );
        })}
      </ul>
      <DataTable label="Projects in this plan" rows={projects} rowKey={(p) => p.id} dense initialSort={{ key: 'y', dir: 'asc' }}
        empty={{ title: 'No projects yet', body: 'The planner found no equipment to replace in these buildings.' }}
        columns={[
          { key: 'n', header: 'Project', value: (p) => p.name, render: (p) => (p.equipmentId ? <Link to={ctx.to(`/building-info/equipment/${p.equipmentId}`)}>{p.name}</Link> : <>{p.name} <span className="muted">(building-level)</span></>) },
          { key: 'b', header: 'Property', hideOnPhone: true, value: (p) => ctx.name(p.buildingId) },
          { key: 't', header: 'Type', hideOnPhone: true, value: (p) => p.type },
          { key: 'y', header: 'Year', align: 'right', value: (p) => p.year },
          { key: 'c', header: 'Cost', align: 'right', value: (p) => p.capex, render: (p) => <>{fmtMoney(p.capex, true)}{p.estimated && <EstimatedMark />}</> },
          { key: 'r', header: 'tCO₂e a year', align: 'right', hideOnPhone: true, value: (p) => p.tco2e },
          { key: 's', header: 'Status', value: (p) => p.status },
        ]} />
    </>
  );
}
