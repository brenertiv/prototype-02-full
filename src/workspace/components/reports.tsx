/** Report components: the cover, the GRESB asset table, the energy and ESG summary and the business case (MOD-WS-04, 11, 53). */
import { Link } from 'react-router-dom';
import { Icon } from '../../shell/Icon';
import { EstimatedMark, Kpi, NotMeasured, Pill, Traced } from '../../ui/bits';
import { DataTable } from '../../ui/DataTable';
import { fmtDateTime, fmtEnergy, fmtInt, fmtMoney, fmtNum, fmtPct, fmtT } from '../../ui/format';
import { coverText, downloadCsv, GRESB_COLUMNS, gresbReadiness, gresbRows, hasData, periodEnergy, periodText, slug } from '../logic';
import type { CompSpec } from '../types';
import { NotBought } from './operations';
import { bound, type CompCtx } from './frame';

export const SOURCES = 'Utility bills, interval meters and sensors, ENERGY STAR Portfolio Manager, and Portfolio Diagnostics for compliance';

export function ReportCover({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = ctx.buildings;
  const p = ctx.period;
  const energies = bs.map((b) => ({ b, e: periodEnergy(ctx.data, b, p) }));
  const est = energies.filter((x) => x.e.estimated).length;
  const incomplete = energies.filter((x) => x.e.monthsWithData < x.e.months).length;
  return (
    <div className="ws-cover">
      <dl className="dl ws-cover-dl">
        <dt>Scope</dt>
        <dd>{ctx.scope.path.join(' › ')} · {bs.length} {bs.length === 1 ? 'property' : 'properties'}{ctx.scope.excluded ? ` (${ctx.scope.excluded} more aren’t available to you and are left out)` : ''}</dd>
        <dt>Period</dt>
        <dd>{p.label} · {periodText(p)}</dd>
        {ctx.ws.framework && (<><dt>Framework</dt><dd>{ctx.ws.framework}</dd></>)}
        <dt>Sources</dt>
        <dd>{SOURCES}</dd>
        <dt>Estimated values</dt>
        <dd>{est ? `${est} ${est === 1 ? 'property includes' : 'properties include'} estimated months, marked est. in the tables and flagged in the export` : 'None'}</dd>
        <dt>Generated</dt>
        <dd>{fmtDateTime(ctx.ws.generatedAt ?? ctx.ws.updatedAt)}</dd>
      </dl>
      {incomplete > 0 && (
        <p className="ws-cover-warn">
          <Icon name="warning" /> Data is incomplete for {incomplete} of {bs.length} properties in this period. Their figures cover only the months with data; none is filled with zeros.
        </p>
      )}
    </div>
  );
}

export function GresbTable({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const rows = gresbRows(ctx.data, bs, ctx.period, ctx.scope.name);
  const ready = rows.filter((r) => r.r.ready).length;
  const download = () => downloadCsv(`gresb-asset-table-${slug(ctx.scope.name)}-${ctx.period.id}.csv`, GRESB_COLUMNS, rows.map((r) => r.cells));
  return (
    <>
      <div className="ws-toolbar">
        <p className="ws-comp-sub">{ready} of {rows.length} assets are ready to submit. One value per column, units in their own columns; estimated values are flagged per asset.</p>
        <button type="button" className="btn btn--sm" onClick={download}><Icon name="download" /> Download CSV</button>
      </div>
      <DataTable
        label="GRESB asset table"
        rows={rows}
        rowKey={(r) => r.b.id}
        dense
        caption={`${ctx.period.label}. Energy in kWh, floor area in sq ft, emissions in tCO₂e.`}
        columns={[
          { key: 'n', header: 'Asset', value: (r) => r.b.name, render: (r) => <Link to={ctx.to(`/building-info/buildings/${r.b.id}`)}>{r.b.name}</Link> },
          { key: 'a', header: 'Floor area', align: 'right', hideOnPhone: true, value: (r) => r.b.gfa, render: (r) => (r.b.gfa ? fmtInt(r.b.gfa) : <NotMeasured>Not recorded</NotMeasured>) },
          { key: 'e', header: 'Energy', align: 'right', value: (r) => r.e.kwh, render: (r) => (r.e.kwh === null ? <NotMeasured /> : <Traced info={{ builtFrom: ['Utility bills', 'Interval meters where they exist', 'ENERGY STAR Portfolio Manager'], period: periodText(ctx.period), calculation: 'Sum of whole-building energy over the months with data.', coverage: `${r.e.monthsWithData} of ${r.e.months} months have data.`, estimated: r.e.estimated }}>{fmtInt(r.e.kwh)}</Traced>) },
          { key: 'm', header: 'Months', align: 'right', hideOnPhone: true, value: (r) => r.e.monthsWithData, render: (r) => `${r.e.monthsWithData} of ${r.e.months}` },
          { key: 'c', header: 'Coverage', align: 'right', value: (r) => (hasData(r.b) ? r.b.coverage : null), render: (r) => (hasData(r.b) ? fmtPct(r.b.coverage) : <NotMeasured />) },
          { key: 'l', header: 'Like-for-like', hideOnPhone: true, value: (r) => (r.b.historyMonths >= 24 ? 'Yes' : 'No') },
          { key: 's1', header: 'Scope 1', align: 'right', hideOnPhone: true, value: (r) => r.e.scope1, render: (r) => (r.e.scope1 === null ? <NotMeasured /> : <>{fmtInt(r.e.scope1)}{r.e.estimated && <EstimatedMark />}</>) },
          { key: 's2', header: 'Scope 2', align: 'right', hideOnPhone: true, value: (r) => r.e.scope2, render: (r) => (r.e.scope2 === null ? <NotMeasured /> : <>{fmtInt(r.e.scope2)}{r.e.estimated && <EstimatedMark />}</>) },
          { key: 'r', header: 'Ready', value: (r) => (r.r.ready ? 1 : 0), render: (r) => (r.r.ready ? <Pill tone="success" icon="check_circle">Ready</Pill> : <span className="ws-blocked"><Pill tone="warning" icon="block">Blocked</Pill><span className="muted">{r.r.reasons[0]}</span></span>) },
        ]}
      />
    </>
  );
}

export function SummaryTable({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const rows = bs.map((b) => ({ b, e: periodEnergy(ctx.data, b, ctx.period) }));
  const withData = rows.filter((r) => r.e.kwh !== null);
  const kwh = withData.reduce((a, r) => a + (r.e.kwh ?? 0), 0);
  const cost = withData.reduce((a, r) => a + (r.e.cost ?? 0), 0);
  const t = withData.reduce((a, r) => a + (r.e.tco2e ?? 0), 0);
  const est = rows.some((r) => r.e.estimated);
  const cover = coverText(withData.length, bs.length, 'properties', ctx.scope.excluded);
  const info = (calc: string) => ({ builtFrom: ['Utility bills', 'Interval meters and sensors', 'ENERGY STAR Portfolio Manager'], period: periodText(ctx.period), calculation: calc, coverage: cover, estimated: est });
  const download = () => downloadCsv(`energy-esg-summary-${slug(ctx.scope.name)}-${ctx.period.id}.csv`, ['Property', 'Scope', 'Period start', 'Period end', 'Energy', 'Energy unit', 'Cost', 'Cost unit', 'Emissions', 'Emissions unit', 'Months with data', 'Contains estimated values', 'Source'],
    rows.map((r) => [r.b.name, ctx.scope.name, ctx.period.from, ctx.period.to, r.e.kwh, r.e.kwh === null ? '' : 'kWh', r.e.cost, r.e.cost === null ? '' : 'USD', r.e.tco2e, r.e.tco2e === null ? '' : 'tCO2e', r.e.monthsWithData, r.e.estimated ? 'Yes' : 'No', 'Bills, meters, ENERGY STAR']));
  if (!withData.length) {
    return <p className="ws-cover-warn"><Icon name="info" /> No energy data has arrived for these properties in {ctx.period.label.toLowerCase()}. The report fills in as bills and meter data arrive; connecting utility logins in Building Info is the first step.</p>;
  }
  return (
    <>
      <div className="grid grid--kpis">
        <Kpi label="Energy" value={<Traced info={info('Sum of whole-building energy over the months with data.')}>{fmtEnergy(kwh)}</Traced>} sub={cover} />
        <Kpi label="Energy cost" value={<Traced info={info('Sum of billed energy cost.')}>{fmtMoney(cost, true)}</Traced>} />
        <Kpi label="Emissions" value={<Traced info={info('Energy times grid and fuel factors, Scope 1 and 2 plus tenant Scope 3.')}>{fmtT(t)}</Traced>} />
      </div>
      <div className="ws-toolbar ws-toolbar--end">
        <button type="button" className="btn btn--ghost btn--sm" onClick={download}><Icon name="download" /> Download CSV</button>
      </div>
      <DataTable label="By property" rows={rows} rowKey={(r) => r.b.id} dense initialSort={{ key: 'e', dir: 'desc' }} caption={`${ctx.period.label}. ${cover}`}
        columns={[
          { key: 'n', header: 'Property', value: (r) => r.b.name, render: (r) => <Link to={ctx.to(`/building-info/buildings/${r.b.id}`)}>{r.b.name}</Link> },
          { key: 'e', header: 'Energy (kWh)', align: 'right', value: (r) => r.e.kwh, render: (r) => (r.e.kwh === null ? <NotMeasured /> : <>{fmtInt(r.e.kwh)}{r.e.estimated && <EstimatedMark />}</>) },
          { key: 'c', header: 'Cost', align: 'right', hideOnPhone: true, value: (r) => r.e.cost, render: (r) => (r.e.cost === null ? <NotMeasured /> : fmtMoney(r.e.cost)) },
          { key: 't', header: 'tCO₂e', align: 'right', value: (r) => r.e.tco2e, render: (r) => (r.e.tco2e === null ? <NotMeasured /> : fmtInt(r.e.tco2e)) },
          { key: 'u', header: 'Site EUI', align: 'right', hideOnPhone: true, value: (r) => r.b.siteEui, render: (r) => (r.b.siteEui === null ? <NotMeasured /> : `${fmtInt(r.b.siteEui)} kBtu/ft²`) },
          { key: 'm', header: 'Months with data', align: 'right', hideOnPhone: true, value: (r) => r.e.monthsWithData, render: (r) => `${r.e.monthsWithData} of ${r.e.months}` },
        ]} />
    </>
  );
}

export function BusinessCase({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const ids = new Set(bs.map((b) => b.id));
  const projects = ctx.data.projects.filter((p) => ids.has(p.buildingId) && p.status !== 'Complete');
  const withProjects = new Set(projects.filter((p) => p.year <= 2030).map((p) => p.buildingId));
  const exposureAddressed = bs.filter((b) => withProjects.has(b.id)).reduce((a, b) => a + b.exposure.potentialFine, 0);
  const avoided = bs.reduce((a, b) => a + b.exposure.costAvoided, 0);
  const below = bs.filter((b) => hasData(b) && !gresbReadiness(ctx.data, b).ready && b.coverage < 0.75);
  const items = ctx.data.health.filter((h) => below.some((b) => b.id === h.buildingId) && h.status === 'open');
  const best = [...projects].sort((a, b) => a.paybackYears - b.paybackYears).slice(0, 5);
  return (
    <div className="stack">
      <div className="grid grid--kpis">
        <Kpi label="Fine exposure the plans address" value={ctx.data.entitlements.carbonPlanning ? <Traced info={{ builtFrom: ['Portfolio Diagnostics, per building', 'Carbon plan projects due by 2030'], calculation: 'Potential fines on buildings where a plan has a project before the 2030 compliance period ends.', estimated: projects.some((p) => p.estimated) }}>{fmtMoney(exposureAddressed, true)}</Traced> : <NotMeasured>Needs a carbon plan</NotMeasured>} sub={`plus ${fmtMoney(avoided, true)} already avoided`} tone="success" />
        <Kpi label="Fastest payback" value={best[0] ? <Traced info={{ builtFrom: [best[0].name, 'Carbon plan cost model'], calculation: 'Capital cost divided by annual savings.', estimated: best[0].estimated }}>{`${fmtNum(best[0].paybackYears, 1)} years`}</Traced> : <NotMeasured>No projects yet</NotMeasured>} sub={best[0] ? ctx.name(best[0].buildingId) : undefined} />
        <Kpi label="Coverage to gain" value={`${below.length} of ${bs.length}`} sub="buildings below GRESB’s 75% coverage" tone={below.length ? 'warning' : 'success'} />
      </div>
      {ctx.data.entitlements.carbonPlanning ? (
        best.length ? (
          <DataTable label="Project paybacks" rows={best} rowKey={(p) => p.id} dense caption="The five quickest paybacks among planned projects in this scope."
            columns={[
              { key: 'n', header: 'Project', value: (p) => p.name },
              { key: 'b', header: 'Property', hideOnPhone: true, value: (p) => ctx.name(p.buildingId) },
              { key: 'c', header: 'Cost', align: 'right', value: (p) => p.capex, render: (p) => <>{fmtMoney(p.capex, true)}{p.estimated && <EstimatedMark />}</> },
              { key: 's', header: 'Savings a year', align: 'right', value: (p) => p.savingsUsd, render: (p) => fmtMoney(p.savingsUsd, true) },
              { key: 'p', header: 'Payback', align: 'right', value: (p) => p.paybackYears, render: (p) => `${fmtNum(p.paybackYears, 1)} yr` },
            ]} />
        ) : (
          <p className="muted">No open projects in this scope yet. A carbon plan adds them.</p>
        )
      ) : (
        <NotBought product="Carbon Planning" ctx={{ data: ctx.data, buildings: bs }} />
      )}
      <p className="ws-def">
        {below.length ? (
          <>
            <strong>{below.length} buildings</strong> sit below GRESB’s 75% coverage. Their {items.length} open data problems are the work that brings them in: <Link to={ctx.to('/building-info/data-health?framework=GRESB')}>see them in Data Health</Link>.
          </>
        ) : (
          'Every building with data meets GRESB’s 75% coverage threshold.'
        )}
      </p>
    </div>
  );
}
