/**
 * The Buildings list (MOD-BI-43): status, tier, open items, coverage, deliverable and available
 * power (available only where demand is measured, MOD-BI-71), type and floor area; sorts and
 * filters by each, and states the tier mix (SYS-TRUST-22).
 */
import { useMemo } from 'react';
import { useApi, useData } from '../data/store';
import type { Building, DataStatus, Tier } from '../data/types';
import { useNav } from '../nav/route';
import { DataTable } from '../ui/DataTable';
import { ApiView, PageHeader, SelectFilter, StatusChip, TierBadge, Traced } from '../ui/bits';
import { fmtArea, fmtDate, fmtPct } from '../ui/format';
import { CapacityOnly, coverCaption, fmtKw, mainTier, Page, powerFor, type PowerSummary, Toolbar, UTIL, useLiveStatus, useParamFilter, useScoped } from './shared';

interface Row {
  b: Building;
  status: DataStatus;
  open: number;
  tier: Tier;
  power: PowerSummary;
}

const STATUS_RANK: Record<DataStatus, number> = { critical: 3, 'at-risk': 2, healthy: 1 };
const TIER_RANK = (t: Tier) => (t === '2a' ? 2 : t === '2b' ? 2.5 : (t as number));

export function BuildingsPage() {
  const { data } = useData();
  const { scope, buildings } = useScoped();
  const { status, openCount } = useLiveStatus();
  const { to } = useNav();
  const [fs, setFs] = useParamFilter('status');
  const [ft, setFt] = useParamFilter('tier');
  const [fty, setFty] = useParamFilter('type');
  const [fp, setFp] = useParamFilter('power');
  const q = useApi(
    `building-info/buildings/${scope.id}`,
    () => buildings.map<Row>((b) => ({ b, status: status.get(b.id) ?? b.status, open: openCount.get(b.id) ?? 0, tier: mainTier(b), power: powerFor(b, data.equipment) })),
    [buildings, status, openCount, data.equipment],
  );
  const all = q.data ?? [];
  const types = useMemo(() => [...new Set(all.map((r) => r.b.type))].sort(), [all]);
  const rows = all.filter(
    (r) =>
      (fs === 'all' || r.status === fs) &&
      (ft === 'all' || String(r.tier) === ft) &&
      (fty === 'all' || r.b.type === fty) &&
      (fp === 'all' || (fp === 'available' ? r.power.availableKw != null : fp === 'capacity' ? r.power.deliverableKw != null && r.power.availableKw == null : r.power.deliverableKw == null)),
  );
  const mix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of all) counts.set(String(r.tier), (counts.get(String(r.tier)) ?? 0) + 1);
    return ['3', '2b', '2a', '1', '0']
      .filter((t) => counts.get(t))
      .map((t) => `${fmtPct((counts.get(t) ?? 0) / Math.max(1, all.length))} tier ${t}`)
      .join(', ');
  }, [all]);

  return (
    <Page>
      <PageHeader title="Buildings" subtitle="Each building's data status, tier, open data health items, coverage and power. Open a building for its record, spaces, utilities and power." />
      <ApiView q={q} what="buildings">
        {() => (
          <>
            <Toolbar>
              <SelectFilter label="Status" value={fs} onChange={setFs} options={[{ value: 'all', label: 'Any status' }, { value: 'critical', label: 'Critical' }, { value: 'at-risk', label: 'At risk' }, { value: 'healthy', label: 'Healthy' }]} />
              <SelectFilter label="Tier" value={ft} onChange={setFt} options={[{ value: 'all', label: 'Any tier' }, ...['3', '2b', '2a', '1', '0'].map((t) => ({ value: t, label: `Tier ${t}` }))]} />
              <SelectFilter label="Type" value={fty} onChange={setFty} options={[{ value: 'all', label: 'Any type' }, ...types.map((t) => ({ value: t, label: t }))]} />
              <SelectFilter label="Power" value={fp} onChange={setFp} options={[{ value: 'all', label: 'Any power record' }, { value: 'available', label: 'Available power measured' }, { value: 'capacity', label: 'Capacity only' }, { value: 'none', label: 'Not surveyed' }]} />
            </Toolbar>
            <DataTable<Row>
              label="Buildings"
              rows={rows}
              rowKey={(r) => r.b.id}
              rowHref={(r) => to(`/building-info/buildings/${r.b.id}`)}
              search={(r) => `${r.b.name} ${r.b.address} ${r.b.city} ${r.b.state}`}
              searchPlaceholder="Search buildings"
              caption={coverCaption(rows.length, rows.length === 1 ? 'building' : 'buildings', scope, rows.length, `Tier mix: ${mix || 'none'}.`)}
              initialSort={{ key: 'status', dir: 'desc' }}
              empty={{ title: 'No buildings match these filters', body: 'Clear a filter to see more.', icon: 'filter_alt_off' }}
              columns={[
                { key: 'name', header: 'Building', value: (r) => r.b.name, render: (r) => (
                  <>
                    {r.b.name}
                    <span className="cell-sub">
                      {r.b.city}, {r.b.state}
                    </span>
                  </>
                ) },
                { key: 'status', header: 'Status', value: (r) => STATUS_RANK[r.status], render: (r) => <StatusChip status={r.status} to={to(`/building-info/data-health?building=${r.b.id}`)} /> },
                {
                  key: 'tier',
                  header: 'Tier',
                  value: (r) => TIER_RANK(r.tier),
                  render: (r) => <TierBadge tier={r.tier} title={(Object.keys(r.b.tierByUtility) as (keyof typeof UTIL)[]).map((u) => `${UTIL[u]}: tier ${r.b.tierByUtility[u]}`).join(', ')} />,
                },
                { key: 'open', header: 'Open items', value: (r) => r.open, align: 'right' as const },
                {
                  key: 'coverage',
                  header: 'Coverage',
                  value: (r) => r.b.coverage,
                  align: 'right' as const,
                  render: (r) =>
                    r.tier === 0 ? (
                      <span className="muted">Not connected</span>
                    ) : (
                      <Traced info={{ builtFrom: ['Utility accounts and meters in scope, landlord and tenant', 'Floor area by space from the stacking plan'], period: 'Last 12 months', calculation: 'Measured floor area and energy sources ÷ all in scope', links: [{ label: 'Open utilities', to: to(`/building-info/buildings/${r.b.id}?tab=utilities`) }] }}>
                        {fmtPct(r.b.coverage)}
                      </Traced>
                    ),
                },
                {
                  key: 'deliverable',
                  header: 'Deliverable power',
                  value: (r) => r.power.deliverableKw,
                  align: 'right' as const,
                  render: (r) =>
                    r.power.deliverableKw == null ? (
                      <span className="muted">{r.power.surveyed === 'not-surveyed' ? 'Not surveyed' : 'Ratings missing'}</span>
                    ) : (
                      <Traced info={{ builtFrom: r.power.services.map((s) => `${s.name}: ${s.ratings?.deliverableKw != null ? fmtKw(s.ratings.deliverableKw) : 'not verified'}`), calculation: 'Amperage × voltage × √3 × 0.8 power factor, per service, summed', coverage: r.power.unverified.length ? `${r.power.unverified.map((s) => s.name).join(', ')} unverified, so excluded or uncertain.` : 'Every service verified.', links: [{ label: 'Open power', to: to(`/building-info/buildings/${r.b.id}?tab=power`) }] }}>
                        {fmtKw(r.power.deliverableKw)}
                      </Traced>
                    ),
                },
                {
                  key: 'available',
                  header: 'Available power',
                  value: (r) => r.power.availableKw,
                  align: 'right' as const,
                  render: (r) =>
                    r.power.availableKw != null ? (
                      <Traced info={{ builtFrom: ['Deliverable power per service', 'Measured peak demand, 15-minute interval data'], period: `As of ${fmtDate('2026-10-15')}`, calculation: 'Deliverable power − measured peak demand' }}>
                        <strong className="bi-available">{fmtKw(r.power.availableKw)}</strong>
                      </Traced>
                    ) : r.power.deliverableKw != null ? (
                      <CapacityOnly />
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
                { key: 'type', header: 'Type', value: (r) => r.b.type, hideOnPhone: true },
                { key: 'gfa', header: 'Floor area', value: (r) => r.b.gfa, align: 'right' as const, render: (r) => (r.b.gfa === null ? <span className="muted">Missing</span> : fmtArea(r.b.gfa)), hideOnPhone: true },
              ]}
            />
          </>
        )}
      </ApiView>
    </Page>
  );
}
