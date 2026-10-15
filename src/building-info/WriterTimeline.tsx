/**
 * The ENERGY STAR writer timeline (MOD-BI-63, ST-Q14): each ENERGY STAR meter's months coloured
 * by who wrote them (the client or their consultant, Enertiv, both, or missing), the point
 * Enertiv took over marked, overlaps flagged, and each period opening the bill behind it.
 * A table, so it reads as rows and columns to assistive technology.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { buildingMonthly } from '../data/series';
import type { Bill, Building, Meter, MonthPoint } from '../data/types';
import { useNav } from '../nav/route';
import { Legend } from '../ui/charts';
import { fmtMonth } from '../ui/format';
import { fmtMonthLong } from './shared';

const WRITER_TEXT: Record<MonthPoint['writer'], string> = { client: 'Written by the client', enertiv: 'Written by Enertiv', both: 'Written by both: overlap', missing: 'Missing' };

export function useWriterGrid(b: Building, meters: Meter[], months = 36) {
  const { data } = useData();
  return useMemo(() => {
    const series = buildingMonthly(data, b, months);
    const integration = b.integrationDate.slice(0, 7);
    const billsByAccountMonth = new Map<string, Bill>();
    for (const bill of data.bills) if (bill.buildingId === b.id) billsByAccountMonth.set(`${bill.accountId}|${bill.start.slice(0, 7)}`, bill);
    const meterById = new Map(data.meters.map((m) => [m.id, m]));
    const rows = meters.map((m) => {
      const twin = m.mappedTo ? meterById.get(m.mappedTo) : undefined;
      const cells = series.map((p) => {
        let writer: MonthPoint['writer'] = p.writer;
        if (!m.inScope) writer = p.month >= (m.esFirstBillDate ?? '2000-01').slice(0, 7) ? 'client' : 'missing';
        else if (m.utility !== 'electricity' && writer === 'both') writer = 'enertiv';
        const bill = twin?.accountId ? billsByAccountMonth.get(`${twin.accountId}|${p.month}`) : undefined;
        return { month: p.month, writer, bill, estimated: p.estimated && writer !== 'missing' };
      });
      return { meter: m, cells };
    });
    const overlaps = rows.reduce((a, r) => a + r.cells.filter((c) => c.writer === 'both').length, 0);
    const missing = rows.reduce((a, r) => a + r.cells.filter((c) => c.writer === 'missing').length, 0);
    return { rows, months: series.map((p) => p.month), integration, overlaps, missing };
  }, [data, b, meters, months]);
}

export function WriterTimeline({ b, meters, compact }: { b: Building; meters: Meter[]; compact?: boolean }) {
  const { to } = useNav();
  const grid = useWriterGrid(b, meters);
  if (!meters.length) return <p className="muted">No ENERGY STAR meters for this building yet.</p>;
  return (
    <div className="bi-wt">
      <p className="table-caption">
        Enertiv took over writing to ENERGY STAR in {fmtMonthLong(grid.integration)}. {grid.overlaps ? `${grid.overlaps} ${grid.overlaps === 1 ? 'period was' : 'periods were'} written by both, so may be counted twice. ` : 'No overlaps. '}
        {grid.missing ? `${grid.missing} ${grid.missing === 1 ? 'period is' : 'periods are'} missing.` : 'No missing periods.'} Select a period to open its bill.
      </p>
      <div className="table-scroll bi-wt-scroll" role="region" aria-label="Writer timeline" tabIndex={0}>
        <table className="bi-wt-table">
          <caption className="sr-only">Who wrote each month to ENERGY STAR, per meter</caption>
          <thead>
            <tr>
              <th scope="col" className="bi-wt-meter">
                Meter
              </th>
              {grid.months.map((m, k) => (
                <th key={m} scope="col" className={`bi-wt-month ${m === grid.integration ? 'is-handover' : ''}`}>
                  <span aria-hidden={k % 3 !== 0 && m !== grid.integration}>{k % 3 === 0 || m === grid.integration ? fmtMonth(m) : ''}</span>
                  <span className="sr-only">{fmtMonth(m)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r) => (
              <tr key={r.meter.id}>
                <th scope="row" className="bi-wt-meter">
                  {compact ? r.meter.name : <Link to={to(`/building-info/meters/${r.meter.id}?tab=writer`)}>{r.meter.name}</Link>}
                  {!r.meter.inScope && <span className="cell-sub">Not in Enertiv</span>}
                </th>
                {r.cells.map((c) => {
                  const label = `${fmtMonthLong(c.month)}: ${WRITER_TEXT[c.writer]}${c.estimated ? ', estimated' : ''}${c.bill ? '. Open the bill' : ''}`;
                  const cls = `bi-wt-cell bi-wt--${c.writer} ${c.month === grid.integration ? 'is-handover' : ''}`;
                  return (
                    <td key={c.month} className={c.month === grid.integration ? 'is-handover' : undefined}>
                      {c.bill ? (
                        <Link className={cls} to={to(`/building-info/bills/${c.bill.id}`)} aria-label={label} title={label}>
                          {c.writer === 'both' ? '!' : c.estimated ? 'e' : ''}
                        </Link>
                      ) : (
                        <span className={cls} title={label} role="img" aria-label={label}>
                          {c.writer === 'both' ? '!' : c.estimated ? 'e' : ''}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend
        items={[
          { label: 'Client or consultant', color: 'var(--writer-client)' },
          { label: 'Enertiv', color: 'var(--writer-enertiv)' },
          { label: 'Both (overlap, marked !)', color: 'var(--writer-both)' },
          { label: 'Missing', color: 'var(--writer-missing)', pattern: true },
          { label: 'Estimated, marked e', color: 'var(--chart-estimated)' },
        ]}
      />
    </div>
  );
}
