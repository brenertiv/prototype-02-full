/** The persona-neutral workspace (SYS-ONB-07): the account's buildings, setup progress and templates. */
import { Link } from 'react-router-dom';
import { useData } from '../../data/store';
import { Icon } from '../../shell/Icon';
import { Kpi, Meter, NotMeasured, StatusChip, TierBadge, Traced } from '../../ui/bits';
import { DataTable } from '../../ui/DataTable';
import { fmtArea, fmtInt } from '../../ui/format';
import { KIND_ICON, templatesFor } from '../catalog';
import { hasData, tierMix } from '../logic';
import type { CompSpec } from '../types';
import { bound, type CompCtx } from './frame';

export function BuildingsOverview({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const withArea = bs.filter((b) => b.gfa);
  const area = withArea.reduce((a, b) => a + (b.gfa ?? 0), 0);
  const connected = bs.filter(hasData).length;
  return (
    <>
      <div className="grid grid--kpis">
        <Kpi label="Buildings" value={fmtInt(bs.length)} sub={ctx.scope.excluded ? `${ctx.scope.excluded} more aren’t available to you` : ctx.scope.name} />
        <Kpi label="Floor area" value={withArea.length ? <Traced info={{ builtFrom: ['Gross floor area on each building record'], calculation: 'Sum of recorded floor area.', coverage: withArea.length < bs.length ? `${bs.length - withArea.length} buildings have no floor area recorded yet.` : undefined }}>{fmtArea(area)}</Traced> : <NotMeasured>Not recorded yet</NotMeasured>} sub={withArea.length < bs.length ? `${withArea.length} of ${bs.length} recorded` : 'all recorded'} />
        <Kpi label="Sending data" value={`${connected} of ${bs.length}`} sub={tierMix(bs) || 'Nothing connected yet'} />
      </div>
      <DataTable label="Buildings" rows={bs} rowKey={(b) => b.id} dense rowHref={(b) => ctx.to(`/building-info/buildings/${b.id}`)} pageSize={10}
        columns={[
          { key: 'n', header: 'Building', value: (b) => b.name },
          { key: 'c', header: 'City', hideOnPhone: true, value: (b) => `${b.city}, ${b.state}` },
          { key: 't', header: 'Electricity data', render: (b) => <TierBadge tier={b.tierByUtility.electricity} /> },
          { key: 's', header: 'Data status', value: (b) => b.status, render: (b) => <StatusChip status={b.status} /> },
        ]} />
    </>
  );
}

export function SetupProgress({ spec, ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const bs = bound(spec, ctx);
  const lines = bs.flatMap((b) => b.goldStandard);
  const met = lines.filter((l) => l.state !== 'not-met').length;
  const rows = bs.map((b) => ({ b, met: b.goldStandard.filter((l) => l.state !== 'not-met').length, total: b.goldStandard.length, next: b.goldStandard.find((l) => l.state === 'not-met') })).sort((a, b) => a.met / (a.total || 1) - b.met / (b.total || 1));
  return (
    <>
      <p className="ws-comp-sub">
        <Traced info={{ builtFrom: ['The nine Gold Standard lines per building'], calculation: 'Lines met or excepted, out of all lines across buildings.', links: [{ label: 'Data Health', to: ctx.to('/building-info/data-health') }] }}>{`${met} of ${lines.length}`}</Traced>{' '}
        setup lines done across {bs.length} buildings.
      </p>
      <ul className="ws-list">
        {rows.slice(0, 8).map(({ b, met: m, total, next }) => (
          <li key={b.id}>
            <div className="ws-list-main">
              <Link to={ctx.to(`/building-info/data-health?building=${b.id}`)}>{b.name}</Link>
              <span className="muted">{next ? `Next: ${next.label}${next.contact ? ` · ${next.contact}` : ''}` : 'Setup complete'}</span>
            </div>
            <Meter value={total ? m / total : 0} label={`${m} of ${total} lines`} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function Templates({ ctx }: { spec: CompSpec; ctx: CompCtx }) {
  const { user } = useData();
  const { mine, rest } = templatesFor(user.persona);
  const list = [...mine, ...rest].slice(0, 6);
  return (
    <ul className="ws-template-list">
      {list.map((d) => (
        <li key={d.id}>
          <Link to={ctx.to(`/workspace/new?template=${d.id}`)} className="ws-template-link">
            <Icon name={KIND_ICON[d.kind]} />
            <span>
              <strong>{d.name}</strong>
              <span className="muted">{d.question}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
