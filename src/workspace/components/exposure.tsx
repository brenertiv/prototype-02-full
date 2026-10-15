/** The Asset Manager's role default: one defensible number per asset (MOD-WS-01, 14). */
import { Link } from 'react-router-dom';
import type { Building, Dataset } from '../../data/types';
import { Kpi, Meter, NotMeasured, Pill, Traced, type ProvenanceInfo } from '../../ui/bits';
import { DataTable } from '../../ui/DataTable';
import { fmtInt, fmtMoney, fmtPct, fmtT } from '../../ui/format';
import { coverText, hasData } from '../logic';
import type { CompSpec } from '../types';
import { bound, NoneHere, type CompCtx } from './frame';

export function exposureInfo(data: Dataset, b: Building, to: (p: string) => string): ProvenanceInfo {
  const ps = data.policies.filter((p) => p.buildingId === b.id && p.applicable);
  return {
    builtFrom: ['Portfolio Diagnostics: potential violation cost', ...ps.map((p) => `${p.name} (${p.type}, ${p.compliancePeriod})`), `Site EUI ${b.siteEui ?? '—'} kBtu/ft² against ${b.euiBenchmark} for the law’s limit`],
    period: ps.find((p) => p.type === 'BPS')?.compliancePeriod ?? 'Current compliance period',
    calculation: 'Potential fine for the compliance period at the building’s current site EUI against each law’s limit, summed across the policies that apply.',
    coverage: hasData(b) && b.coverage < 0.9 ? `Built on ${fmtPct(b.coverage)} data coverage; filling the gaps could change it.` : undefined,
    estimated: hasData(b) && b.coverage < 0.75,
    links: [
      { label: `${b.name} in Building Info`, to: to(`/building-info/buildings/${b.id}`) },
      { label: 'Its data problems', to: to(`/building-info/data-health?building=${b.id}`) },
    ],
  };
}

export function ExposureKpis({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const covered = bs.filter((b) => b.exposure.status !== 'Not covered');
  const total = bs.reduce((a, b) => a + b.exposure.potentialFine, 0);
  const avoided = bs.reduce((a, b) => a + b.exposure.costAvoided, 0);
  const atRisk = bs.filter((b) => b.exposure.status === 'At risk' || b.exposure.status === 'Non-compliant');
  const thin = bs.filter((b) => b.exposure.potentialFine > 0 && b.coverage < 0.9).length;
  const top = [...bs].sort((a, b) => b.exposure.potentialFine - a.exposure.potentialFine)[0];
  if (!covered.length) return <NoneHere title="No local law applies to these buildings" body="Fine exposure comes from benchmarking and BPS laws. None that Enertiv tracks covers the buildings in this scope." />;
  return (
    <div className="grid grid--kpis">
      <Kpi
        label="Potential fines"
        value={<Traced info={{ builtFrom: ['Portfolio Diagnostics, per building', `${ctx.data.policies.filter((p) => p.applicable && p.type === 'BPS' && bs.some((b) => b.id === p.buildingId)).length} BPS policies`], period: 'Current compliance periods', calculation: 'Sum of each building’s potential violation cost.', coverage: coverText(covered.length, bs.length, 'buildings', ctx.scope.excluded).replace('missing data', 'not covered by a law'), estimated: thin > 0 }}>{fmtMoney(total, true)}</Traced>}
        sub={thin ? `${thin} of these buildings have coverage gaps that could change it` : `${atRisk.length} at risk or non-compliant`}
        tone={total > 0 ? 'danger' : 'success'}
      />
      <Kpi label="Highest exposure" value={top && top.exposure.potentialFine > 0 ? <Traced info={exposureInfo(ctx.data, top, ctx.to)}>{fmtMoney(top.exposure.potentialFine, true)}</Traced> : <NotMeasured>None</NotMeasured>} sub={top && top.exposure.potentialFine > 0 ? <Link to={ctx.to(`/building-info/buildings/${top.id}`)}>{top.name}</Link> : 'No building has a fine at risk'} />
      <Kpi label="Fines already avoided" value={<Traced info={{ builtFrom: ['Portfolio Diagnostics: cost avoided'], period: 'Current compliance periods', calculation: 'Sum of fines avoided by work already done, per building.' }}>{fmtMoney(avoided, true)}</Traced>} sub="from work already done" tone="success" />
    </div>
  );
}

export function ExposureRanked({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx).filter((b) => b.exposure.status !== 'Not covered').sort((a, b) => b.exposure.potentialFine - a.exposure.potentialFine);
  if (!bs.length) return <NoneHere title="No exposure to rank" body="No benchmarking or BPS law that Enertiv tracks applies to these buildings." />;
  const max = Math.max(1, ...bs.map((b) => b.exposure.potentialFine));
  if (spec.view === 'table') {
    return (
      <DataTable
        label="Exposure by asset"
        rows={bs}
        rowKey={(b) => b.id}
        dense
        rowHref={(b) => ctx.to(`/building-info/buildings/${b.id}`)}
        caption={`${bs.length} buildings with a law that applies, highest exposure first.`}
        columns={[
          { key: 'n', header: 'Building', value: (b) => b.name },
          { key: 'x', header: 'Potential fine', align: 'right', value: (b) => b.exposure.potentialFine, render: (b) => <Traced info={exposureInfo(ctx.data, b, ctx.to)}>{fmtMoney(b.exposure.potentialFine)}</Traced> },
          { key: 's', header: 'Status', value: (b) => b.exposure.status, render: (b) => <Pill tone={b.exposure.status === 'Non-compliant' ? 'danger' : b.exposure.status === 'At risk' ? 'warning' : 'success'}>{b.exposure.status}</Pill> },
          { key: 'p', header: 'Policies', hideOnPhone: true, render: (b) => ctx.data.policies.filter((p) => p.buildingId === b.id && p.applicable).map((p) => p.name).join(', ') },
          { key: 'c', header: 'Coverage', hideOnPhone: true, value: (b) => b.coverage, render: (b) => (hasData(b) ? fmtPct(b.coverage) : <NotMeasured />) },
        ]}
      />
    );
  }
  return (
    <ol className="ws-rank" aria-label="Buildings ranked by potential fine">
      {bs.slice(0, 10).map((b, k) => (
        <li key={b.id}>
          <span className="ws-rank-n">{k + 1}</span>
          <Link to={ctx.to(`/building-info/buildings/${b.id}`)} className="ws-rank-label">{b.name}</Link>
          <span className="ws-rank-track" aria-hidden="true">
            <span className="ws-rank-fill" style={{ width: `${Math.max(1, (b.exposure.potentialFine / max) * 100)}%` }} />
          </span>
          <span className="ws-rank-value">
            <Traced info={exposureInfo(ctx.data, b, ctx.to)}>{b.exposure.potentialFine ? fmtMoney(b.exposure.potentialFine, true) : '$0'}</Traced>
          </span>
          {hasData(b) && b.coverage < 0.9 && <span className="ws-rank-note">Coverage {fmtPct(b.coverage)}: the figure could rise as gaps fill</span>}
        </li>
      ))}
      {bs.length > 10 && <li className="muted ws-rank-more">And {bs.length - 10} more with a law that applies. Show it as a table to see them all.</li>}
    </ol>
  );
}

export function AssetFigures({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const connected = bs.filter(hasData).length;
  return (
    <DataTable
      label="Cost, carbon and coverage by asset"
      rows={bs}
      rowKey={(b) => b.id}
      dense
      rowHref={(b) => ctx.to(`/building-info/buildings/${b.id}`)}
      initialSort={{ key: 'x', dir: 'desc' }}
      caption={`Last 12 months. ${coverText(connected, bs.length, 'properties', ctx.scope.excluded)}`}
      columns={[
        { key: 'n', header: 'Building', value: (b) => b.name },
        { key: 'x', header: 'Fine exposure', align: 'right', value: (b) => b.exposure.potentialFine, render: (b) => (b.exposure.status === 'Not covered' ? <span className="muted">No law applies</span> : <Traced info={exposureInfo(ctx.data, b, ctx.to)}>{fmtMoney(b.exposure.potentialFine, true)}</Traced>) },
        { key: 'cost', header: 'Energy cost', align: 'right', value: (b) => (hasData(b) ? b.energyCost : null), render: (b) => (hasData(b) ? <Traced info={{ builtFrom: ['Utility bills', 'Interval data where it exists'], period: 'Last 12 months', calculation: 'Sum of billed energy cost across sold utilities.', coverage: b.coverage < 0.9 ? `Coverage ${fmtPct(b.coverage)}` : undefined }}>{fmtMoney(b.energyCost, true)}</Traced> : <NotMeasured />) },
        { key: 't', header: 'Emissions', align: 'right', value: (b) => (hasData(b) ? b.emissions.scope1 + b.emissions.scope2 : null), render: (b) => (hasData(b) ? <Traced info={{ builtFrom: ['Metered and billed energy', 'Grid emission factors (eGRID)'], period: 'Last 12 months', calculation: 'Scope 1 and 2: fuel burned on site plus purchased electricity times its grid factor.' }}>{fmtT(b.emissions.scope1 + b.emissions.scope2)}</Traced> : <NotMeasured />) },
        { key: 'c', header: 'Coverage', hideOnPhone: true, value: (b) => (hasData(b) ? b.coverage : null), render: (b) => (hasData(b) ? <Meter value={b.coverage} /> : <NotMeasured>Not connected</NotMeasured>) },
        { key: 'g', header: 'Floor area', hideOnPhone: true, align: 'right', value: (b) => b.gfa, render: (b) => (b.gfa ? `${fmtInt(b.gfa)} ft²` : <NotMeasured>Not recorded</NotMeasured>) },
      ]}
    />
  );
}
