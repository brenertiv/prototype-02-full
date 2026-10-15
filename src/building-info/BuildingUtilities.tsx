/**
 * Building › Utilities (MOD-BI-10, 11, 13, 61, 63, 67): coverage and completeness as separate
 * measures with their definition, historical and Enertiv-covered periods told apart, tenant
 * coverage by month, data sources and tier with what the next tier unlocks, sold scope and
 * onboarding stage, coverage problems with cause and fix, ENERGY STAR sync with a manual push,
 * and the writer timeline.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import { buildingMonthly } from '../data/series';
import { addMonths } from '../data/rand';
import type { Building, HealthItem, Meter, MonthPoint, Tier, Utility } from '../data/types';
import { UTILITIES } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { ConfirmDialog } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { EmptyState, Kpi, Pill, Section, SeverityPill, TierBadge, tierHelp, Traced } from '../ui/bits';
import { DataTable, RecordTable } from '../ui/DataTable';
import { Legend } from '../ui/charts';
import { fmtAgo, fmtArea, fmtDate, fmtMonth, fmtPct } from '../ui/format';
import { fmtMonthLong, human, nextTierUnlock, reportingState, STAGE_LABEL, STAGES, TODAY, UTIL, useRecordActivity } from './shared';
import { WriterTimeline } from './WriterTimeline';

type CoverageState = 'Covered' | 'Under covered' | 'Over covered' | 'Set up but not flowing' | 'Not covered' | 'Onboarding' | 'Not sold';

interface UtilRow {
  u: Utility;
  sold: boolean;
  stage: string | null;
  tier: Tier | null;
  landlord: number;
  tenant: number;
  state: CoverageState;
  coverage: number | null;
  completeness: number | null;
  months: number;
}

function last12() {
  return Array.from({ length: 12 }, (_, k) => addMonths(`${TODAY.slice(0, 7)}-01`, -(12 - k)).slice(0, 7));
}

export function BuildingUtilitiesTab({ b }: { b: Building }) {
  const { data } = useData();
  const { to } = useNav();
  const months12 = useMemo(last12, []);
  const series = useMemo(() => buildingMonthly(data, b, 36), [data, b]);
  const accounts = useMemo(() => data.accounts.filter((a) => a.buildingId === b.id), [data.accounts, b.id]);
  const bills = useMemo(() => data.bills.filter((x) => x.buildingId === b.id), [data.bills, b.id]);
  const meters = useMemo(() => data.meters.filter((m) => m.buildingId === b.id), [data.meters, b.id]);
  const esMeters = useMemo(() => meters.filter((m) => m.kind === 'energy-star'), [meters]);
  const items = useMemo(() => data.health.filter((h) => h.buildingId === b.id && h.status === 'open'), [data.health, b.id]);
  const integration = b.integrationDate.slice(0, 7);

  const rows = useMemo<UtilRow[]>(() => {
    return UTILITIES.filter((u) => b.sold[u] || accounts.some((a) => a.utility === u)).map((u) => {
      const s = b.sold[u];
      const accts = accounts.filter((a) => a.utility === u);
      const ids = new Set(accts.map((a) => a.id));
      const have = new Set(bills.filter((x) => ids.has(x.accountId) && x.start.slice(0, 7) >= months12[0]).map((x) => x.start.slice(0, 7)));
      const expected = Math.min(12, b.historyMonths);
      const completeness = accts.length ? Math.min(1, have.size / Math.max(1, expected)) : null;
      const over = items.some((h) => h.utility === u && /double counted|above benchmark/.test(h.problem));
      const under = items.some((h) => h.utility === u && /unusually low/.test(h.problem)) || (u === 'electricity' && b.coverage < 0.75);
      let state: CoverageState = 'Covered';
      if (!s?.sold) state = 'Not sold';
      else if (s.stage !== 'live') state = 'Onboarding';
      else if (!accts.length) state = 'Not covered';
      else if (!have.size) state = 'Set up but not flowing';
      else if (over) state = 'Over covered';
      else if (under) state = 'Under covered';
      const coverage = state === 'Not sold' || state === 'Onboarding' ? null : u === 'electricity' ? b.coverage : have.size ? 1 : 0;
      return { u, sold: !!s?.sold, stage: s?.stage ?? null, tier: s?.sold ? b.tierByUtility[u] ?? 0 : null, landlord: accts.filter((a) => a.holder === 'landlord').length, tenant: accts.filter((a) => a.holder !== 'landlord').length, state, coverage, completeness, months: have.size };
    });
  }, [b, accounts, bills, items, months12]);

  const last12Series = series.slice(-12);
  const est12 = last12Series.filter((p) => p.estimated);
  const measured12 = last12Series.filter((p) => p.kwh !== null).length;
  const completeness12 = measured12 / 12;
  const hist = series.filter((p) => p.month < integration);
  const enertiv = series.filter((p) => p.month >= integration);
  const pct = (list: MonthPoint[]) => (list.length ? list.filter((p) => p.kwh !== null).length / list.length : null);
  const elec = rows.find((r) => r.u === 'electricity');

  return (
    <>
      <div className="grid grid--kpis bi-kpis">
        <Kpi
          label="ENERGY STAR score"
          value={b.energyStarScore ?? <span className="muted bi-kpi-none">No score</span>}
          sub={b.esLastSynced ? `Last synced ${fmtDate(b.esLastSynced)} (${fmtAgo(b.esLastSynced)})` : 'Not synced with ENERGY STAR'}
        />
        <Kpi
          label="Coverage"
          value={
            elec?.coverage == null ? (
              <span className="muted bi-kpi-none">Not connected</span>
            ) : (
              <Traced info={{ builtFrom: ['Electricity, gas, water and steam accounts in sold scope', 'Landlord and tenant accounts', 'Space floor areas from the stacking plan'], period: `${fmtMonthLong(months12[0])} to ${fmtMonthLong(months12[11])}`, calculation: 'Measured floor area and energy sources ÷ all in scope; nothing counted twice' }}>
                {fmtPct(elec.coverage)}
              </Traced>
            )
          }
          sub="Is the whole building measured?"
        />
        <Kpi
          label="Completeness, last 12 months"
          value={
            b.tierByUtility.electricity === 0 ? (
              <span className="muted bi-kpi-none">No data yet</span>
            ) : (
              <Traced info={{ builtFrom: ['Monthly electricity periods from bills and meters'], period: `${fmtMonthLong(months12[0])} to ${fmtMonthLong(months12[11])}`, calculation: `${measured12} of 12 months have data`, estimated: est12.length > 0 }}>
                {fmtPct(completeness12)}
              </Traced>
            )
          }
          sub={est12.length ? `Estimated: ${est12.map((p) => fmtMonthLong(p.month)).join(', ')}` : 'No estimated months'}
        />
        <Kpi label="Data tier, electricity" value={<TierBadge tier={b.tierByUtility.electricity} />} sub={tierHelp(b.tierByUtility.electricity ?? 0)} />
      </div>

      <Section title="Coverage and completeness" description="Two separate measures. Coverage: is every space and energy source in scope measured, landlord and tenant, with nothing counted twice? Completeness: does each in-scope account have data for every month of the last 12?">
        <DataTable<UtilRow>
          label="Coverage by utility"
          rows={rows}
          rowKey={(r) => r.u}
          columns={[
            { key: 'u', header: 'Utility', value: (r) => UTIL[r.u] },
            { key: 'held', header: 'Held by', render: (r) => (r.landlord || r.tenant ? [r.landlord ? `Landlord (${r.landlord})` : '', r.tenant ? `Tenants (${r.tenant})` : ''].filter(Boolean).join(', ') : <span className="muted">No accounts</span>) },
            { key: 'state', header: 'Coverage state', value: (r) => r.state, render: (r) => <CoverageStatePill r={r} /> },
            { key: 'coverage', header: 'Coverage', align: 'right' as const, value: (r) => r.coverage, render: (r) => (r.coverage == null ? <span className="muted">—</span> : fmtPct(r.coverage)) },
            { key: 'complete', header: 'Completeness', align: 'right' as const, value: (r) => r.completeness, render: (r) => (r.completeness == null || !r.sold ? <span className="muted">—</span> : `${fmtPct(r.completeness)} (${r.months} of ${Math.min(12, b.historyMonths)} months)`) },
          ]}
        />
        <h3 className="bi-subhead">Electricity by month, last 36 months: historical and Enertiv-covered</h3>
        <DataStrip series={series} integration={integration} />
        <RecordTable
          label="Periods"
          rows={[
            [`Historical, before ${fmtMonthLong(integration)}`, hist.length ? `${fmtPct(pct(hist))} complete · loaded from bills and ENERGY STAR` : 'No historical months in view'],
            [`Enertiv-covered, from ${fmtMonthLong(integration)}`, `${fmtPct(pct(enertiv))} complete · collected by Enertiv`],
          ]}
        />
      </Section>

      <CoverageProblems b={b} items={items} />

      <TenantCoverage b={b} months={months12} series={series.slice(-24)} />

      <DataSources b={b} rows={rows} meters={meters} />

      <EnergyStar b={b} esMeters={esMeters} items={items} />

      <Section title="Writer timeline" description="Who wrote each month to ENERGY STAR, for every ENERGY STAR meter on this building, so you can see the whole building covered once.">
        {esMeters.length === 0 ? (
          <EmptyState icon="timeline" title="No ENERGY STAR meters yet" body="The timeline fills once the building is linked to Portfolio Manager." />
        ) : (
          <WriterTimeline b={b} meters={esMeters} />
        )}
        <p className="muted bi-gap-top">
          Bills behind each period are on the <Link to={to(`/building-info/bills?building=${b.id}`)}>Bills page</Link>.
        </p>
      </Section>
    </>
  );
}

function CoverageStatePill({ r }: { r: UtilRow }) {
  switch (r.state) {
    case 'Covered':
      return <Pill tone="success" icon="check_circle">Covered</Pill>;
    case 'Not sold':
      return <Pill tone="neutral" title="Not in your contract, so gaps here are expected">Not sold: expected</Pill>;
    case 'Onboarding':
      return <Pill tone="info" icon="hourglass_top">Onboarding: {STAGE_LABEL[(r.stage ?? 'scoping') as keyof typeof STAGE_LABEL]}</Pill>;
    case 'Over covered':
      return <Pill tone="danger" icon="error">Over covered</Pill>;
    case 'Under covered':
      return <Pill tone="warning" icon="error">Under covered</Pill>;
    default:
      return <Pill tone="danger" icon="error">{r.state}</Pill>;
  }
}

/** 24 months of electricity: actual, estimated or missing, with the handover marked (SYS-TRUST-06, 11). */
function DataStrip({ series, integration }: { series: MonthPoint[]; integration: string }) {
  return (
    <div className="bi-strip-wrap">
      <ol className="bi-strip" aria-label="Electricity data by month">
        {series.map((p) => {
          const state = p.kwh === null ? 'missing' : p.estimated ? 'estimated' : 'actual';
          const label = `${fmtMonthLong(p.month)}: ${state === 'missing' ? 'no data' : state}${p.month < integration ? ', historical' : ', Enertiv-covered'}`;
          return (
            <li key={p.month} className={`bi-strip-cell bi-strip--${state} ${p.month === integration ? 'is-handover' : ''}`} title={label} aria-label={label}>
              <span aria-hidden="true">{state === 'estimated' ? 'e' : ''}</span>
            </li>
          );
        })}
      </ol>
      <div className="bi-strip-axis" aria-hidden="true">
        <span>{fmtMonthLong(series[0].month)}</span>
        <span>Enertiv from {fmtMonthLong(integration)}</span>
        <span>{fmtMonthLong(series[series.length - 1].month)}</span>
      </div>
      <Legend
        items={[
          { label: 'Actual', color: 'var(--chart-1)' },
          { label: 'Estimated, marked e', color: 'var(--chart-estimated)' },
          { label: 'No data', color: 'var(--chart-missing)', pattern: true },
        ]}
      />
    </div>
  );
}

/* ---------- Coverage problems (MOD-BI-13) ---------- */

function CoverageProblems({ b, items }: { b: Building; items: HealthItem[] }) {
  const { to } = useNav();
  const problems = items.filter((h) => h.family === 'Coverage' || h.family === 'ENERGY STAR');
  const euiLow = b.siteEui !== null && b.siteEui < b.euiBenchmark * 0.5;
  const euiHigh = b.siteEui !== null && b.siteEui > b.euiBenchmark * 1.8;
  const cause = (h: HealthItem) =>
    /double counted|above benchmark/.test(h.problem)
      ? 'Possibly duplicated ENERGY STAR meters (high site EUI)'
      : /unusually low/.test(h.problem)
        ? 'A unit or energy source possibly not measured (low site EUI)'
        : /No electricity data/.test(h.problem)
          ? 'Accounts not connected yet'
          : h.family === 'ENERGY STAR'
            ? 'Portfolio Manager data quality'
            : 'Missing setup information';
  return (
    <Section title="Coverage problems" description="Likely cause and fix for each coverage gap on this building.">
      {problems.length === 0 && !euiLow && !euiHigh ? (
        <p className="muted">No coverage problems. Site EUI is within the expected range for {/^[aeiou]/i.test(b.type) ? 'an' : 'a'} {b.type.toLowerCase()} building.</p>
      ) : (
        <ul className="list">
          {problems.map((h) => (
            <li key={h.id}>
              <Icon name="error" />
              <div className="list-item-main">
                <Link className="list-item-title" to={to(`/building-info/data-health?item=${h.id}`)}>
                  {h.problem}
                </Link>
                <span className="cell-sub">
                  Likely cause: {cause(h)}. Fix: {human(h.fix)}.
                </span>
              </div>
              <SeverityPill severity={h.severity} />
            </li>
          ))}
          {problems.length === 0 && (euiLow || euiHigh) && (
            <li>
              <Icon name="info" />
              <div className="list-item-main">
                <span className="list-item-title">Site EUI {euiLow ? 'unusually low' : 'unusually high'}</span>
                <span className="cell-sub">
                  {b.siteEui} kBtu/ft² against {b.euiBenchmark}. {euiLow ? 'A unit or energy source may not be measured: check the meter mapping.' : 'ENERGY STAR meters may be duplicated: check which are used for metrics.'}
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Tenant coverage (MOD-BI-11) ---------- */

type TCell = 'covered' | 'awaiting' | 'missing' | 'vacant' | 'landlord';
const TCELL_TEXT: Record<TCell, string> = { covered: 'Covered', awaiting: 'Awaiting bill', missing: 'Missing', vacant: 'Vacant', landlord: 'Covered by the landlord account' };

function TenantCoverage({ b, months, series }: { b: Building; months: string[]; series: MonthPoint[] }) {
  const { data } = useData();
  const { tenant } = useLookup();
  const { to } = useNav();
  const rows = useMemo(() => {
    const spaces = data.spaces.filter((s) => s.buildingId === b.id && s.areaType !== 'Common area');
    const tenants = [...new Set(spaces.map((s) => s.tenantId).filter(Boolean) as string[])].map((id) => tenant.get(id)!).filter(Boolean);
    const prior = data.tenants.filter((t) => t.prior && t.buildingIds.includes(b.id) && t.moveOut && t.moveOut.slice(0, 7) >= months[0]);
    const byMonth = new Map(series.map((p) => [p.month, p]));
    const out: { key: string; label: string; sub: string; tenantId: string | null; cells: TCell[] }[] = [];
    for (const t of [...tenants, ...prior]) {
      const accts = data.accounts.filter((a) => a.buildingId === b.id && a.holder === t.id);
      const utilities: Utility[] = accts.length ? [...new Set(accts.map((a) => a.utility))] : ['electricity'];
      for (const u of utilities) {
        const ids = new Set(accts.filter((a) => a.utility === u).map((a) => a.id));
        const billMonths = new Set(data.bills.filter((x) => ids.has(x.accountId)).map((x) => x.start.slice(0, 7)));
        const cells = months.map<TCell>((m, k) => {
          if (m < t.moveIn.slice(0, 7) || (t.moveOut && m > t.moveOut.slice(0, 7))) return 'vacant';
          if (!ids.size) return byMonth.get(m)?.kwh !== null && byMonth.get(m) ? 'landlord' : 'missing';
          if (billMonths.has(m)) return 'covered';
          return k === months.length - 1 ? 'awaiting' : 'missing';
        });
        const spaceNames = data.spaces.filter((s) => t.spaceIds.includes(s.id)).map((s) => s.name).join(', ');
        out.push({ key: `${t.id}-${u}`, label: t.name, sub: `${UTIL[u]} · ${t.prior ? `moved out ${fmtDate(t.moveOut)}` : spaceNames || 'No space'} · ${ids.size ? 'tenant-held account' : 'landlord account'}`, tenantId: t.id, cells });
      }
    }
    for (const s of spaces.filter((x) => !x.tenantId)) {
      out.push({ key: s.id, label: s.name, sub: `Vacant · ${fmtArea(s.sqft)}`, tenantId: null, cells: months.map(() => 'vacant') });
    }
    return out;
  }, [data, b.id, months, series, tenant]);
  const gaps = rows.reduce((a, r) => a + r.cells.filter((c) => c === 'missing').length, 0);

  return (
    <Section title="Tenant coverage" description="Each tenant's utility data by month, tied to their move-in and move-out dates. Months before move-in, after move-out or in a vacant space are vacant, not missing.">
      {rows.length === 0 ? (
        <p className="muted">No leased spaces on record for this building.</p>
      ) : (
        <>
          <p className="table-caption">
            {rows.length} rows · {gaps ? `${gaps} missing tenant-months` : 'no missing tenant-months'} in the last 12 months.
          </p>
          <div className="table-scroll" role="region" aria-label="Tenant coverage" tabIndex={0}>
            <table className="bi-wt-table bi-tc-table">
              <caption className="sr-only">Tenant coverage by month</caption>
              <thead>
                <tr>
                  <th scope="col" className="bi-wt-meter">
                    Tenant
                  </th>
                  {months.map((m) => (
                    <th key={m} scope="col" className="bi-wt-month">
                      {fmtMonth(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="bi-wt-meter">
                      {r.tenantId ? <Link to={to(`/people/tenants/${r.tenantId}`)}>{r.label}</Link> : r.label}
                      <span className="cell-sub">{r.sub}</span>
                    </th>
                    {r.cells.map((c, k) => (
                      <td key={months[k]}>
                        <span className={`bi-wt-cell bi-tc--${c}`} role="img" aria-label={`${fmtMonthLong(months[k])}: ${TCELL_TEXT[c]}`} title={`${fmtMonthLong(months[k])}: ${TCELL_TEXT[c]}`}>
                          {c === 'awaiting' ? '…' : c === 'missing' ? '×' : ''}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Legend
            items={[
              { label: 'Covered (tenant account)', color: 'var(--chart-2)' },
              { label: 'Covered by the landlord account', color: 'var(--chart-1)' },
              { label: 'Awaiting bill (…)', color: 'var(--status-warning)' },
              { label: 'Missing (×)', color: 'var(--status-danger)' },
              { label: 'Vacant', color: 'var(--chart-missing)', pattern: true },
            ]}
          />
        </>
      )}
    </Section>
  );
}

/* ---------- Data sources, tier, sold scope (MOD-BI-61) ---------- */

function DataSources({ b, rows, meters }: { b: Building; rows: UtilRow[]; meters: Meter[] }) {
  const { data } = useData();
  const toast = useToast();
  const record = useRecordActivity();
  const sourcesFor = (u: Utility) => {
    const out: { label: string; connected: boolean; note: string }[] = [];
    const accts = data.accounts.filter((a) => a.buildingId === b.id && a.utility === u);
    if (accts.length) {
      const last = data.bills.filter((x) => accts.some((a) => a.id === x.accountId)).sort((x, y) => y.end.localeCompare(x.end))[0];
      const days = last ? Math.round((Date.parse(TODAY) - Date.parse(last.end)) / 86400000) : null;
      out.push({ label: `Utility bills (${accts.length} ${accts.length === 1 ? 'account' : 'accounts'})`, connected: days !== null && days <= 60, note: last ? `Latest bill ends ${fmtDate(last.end)}` : 'No bills yet' });
    }
    for (const m of meters.filter((x) => x.utility === u && x.kind === 'enertiv' && x.dataSource !== 'Utility bills')) {
      out.push({ label: `${m.dataSource}: ${m.name}`, connected: reportingState(m) === 'Reporting', note: m.daysSinceData === null ? 'No readings yet' : `Last data ${m.daysSinceData === 0 ? 'today' : `${m.daysSinceData} days ago`}` });
    }
    const es = meters.filter((x) => x.utility === u && x.kind === 'energy-star' && x.inScope);
    if (es.length) out.push({ label: `ENERGY STAR (${es.length} ${es.length === 1 ? 'meter' : 'meters'})`, connected: es.some((m) => reportingState(m) === 'Reporting'), note: es.some((m) => reportingState(m) === 'Reporting') ? 'Consumption records arriving' : 'Linked, but no recent consumption record' });
    return out;
  };
  return (
    <Section title="Data sources and tier" description="A source counts as connected only when its data arrived within its expected cadence. The tier per utility comes from the data actually flowing.">
      <div className="bi-source-grid">
        {rows.map((r) => {
          const src = r.sold ? sourcesFor(r.u) : [];
          const unlock = r.sold && r.stage === 'live' && r.tier !== null ? nextTierUnlock(r.tier) : null;
          const stageIdx = r.stage ? STAGES.indexOf(r.stage as (typeof STAGES)[number]) : -1;
          return (
            <div key={r.u} className="card">
              <div className="bi-card-head">
                <h3>{UTIL[r.u]}</h3>
                {r.sold ? r.stage === 'live' ? <TierBadge tier={r.tier} /> : <Pill tone="info">Onboarding</Pill> : <Pill tone="neutral">Not sold</Pill>}
              </div>
              {!r.sold ? (
                <p className="muted">
                  Not in your contract for this building. Any meters the survey found here are listed as expected, not as problems; turning on this data needs a quote and, for a meter, hardware.
                </p>
              ) : (
                <>
                  <ol className="bi-stages" aria-label={`Onboarding stage: ${STAGE_LABEL[(r.stage ?? 'scoping') as keyof typeof STAGE_LABEL]}`}>
                    {STAGES.map((s, k) => (
                      <li key={s} className={k < stageIdx ? 'is-done' : k === stageIdx ? 'is-current' : ''}>
                        {STAGE_LABEL[s]}
                      </li>
                    ))}
                  </ol>
                  <ul className="bi-plain-list bi-card-p">
                    {src.length === 0 && <li className="muted">No sources yet. Enertiv is setting them up.</li>}
                    {src.map((s) => (
                      <li key={s.label} className="bi-source">
                        <Pill tone={s.connected ? 'success' : 'warning'} icon={s.connected ? 'check_circle' : 'error'}>
                          {s.connected ? 'Connected' : 'Not connected'}
                        </Pill>
                        <span>
                          {s.label}
                          <span className="cell-sub">{s.note}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {unlock && (
                    <div className="bi-unlock">
                      <p>
                        <strong>{unlock.next}</strong> would add: {unlock.unlocks}
                      </p>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          record({ kind: 'building', id: b.id, label: b.name }, `Asked the account team about ${unlock.next.toLowerCase()} for ${UTIL[r.u].toLowerCase()}`, b.id);
                          toast('Your Enertiv account team will be in touch about the next tier.');
                        }}
                      >
                        Ask your account team
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- ENERGY STAR (MOD-BI-67) ---------- */

interface PushLog {
  at: string;
  who: string;
  months: number;
  meters: number;
}

function EnergyStar({ b, esMeters, items }: { b: Building; esMeters: Meter[]; items: HealthItem[] }) {
  const { patch, getApp, setApp, user } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const logs = getApp<Record<string, PushLog[]>>('bi.esPushes', {});
  const mine = logs[b.id] ?? [];
  const esItems = items.filter((h) => h.family === 'ENERGY STAR');
  if (!b.pmPropertyId) {
    return (
      <Section title="ENERGY STAR">
        <EmptyState
          icon="link_off"
          title="Not linked to ENERGY STAR"
          body="Enertiv Implementation links the building once the property is shared with Enertiv in Portfolio Manager."
          action={
            <button type="button" className="btn btn--ghost" onClick={() => toast('Enertiv Implementation has been asked to link this building.')}>
              Ask Enertiv to link it
            </button>
          }
        />
      </Section>
    );
  }
  const sourceOfRecord = b.esDirection === 'Portfolio Manager → Enertiv' ? 'Portfolio Manager' : 'Enertiv';
  const inScope = esMeters.filter((m) => m.inScope);
  const doPush = () => {
    const at = `${TODAY}T${new Date().toTimeString().slice(0, 8)}`;
    patch('buildings', b.id, { esLastSynced: TODAY });
    setApp('bi.esPushes', { ...logs, [b.id]: [{ at, who: user.name, months: 12, meters: inScope.length }, ...mine] });
    record({ kind: 'building', id: b.id, label: b.name }, `Pushed 12 months to ENERGY STAR (${inScope.length} meters)`, b.id);
    toast('Pushed to ENERGY STAR. Portfolio Manager updates the score within a day.');
    setConfirm(false);
  };
  return (
    <Section
      title="ENERGY STAR"
      description="The Portfolio Manager link, which way data flows, and when it last synced."
      actions={
        <button type="button" className="btn btn--sm" onClick={() => setConfirm(true)}>
          <Icon name="sync" /> Push now
        </button>
      }
    >
      <RecordTable
        label="ENERGY STAR"
        rows={[
          ['Score', b.energyStarScore ?? <span className="muted">No score for the current period</span>],
          ['Last synced', b.esLastSynced ? `${fmtDate(b.esLastSynced)} (${fmtAgo(b.esLastSynced)})` : 'Never'],
          ['Direction', b.esDirection],
          ['Source of record', `${sourceOfRecord}${sourceOfRecord === 'Portfolio Manager' ? ': Enertiv reads consumption from Portfolio Manager' : ': Enertiv writes consumption to Portfolio Manager'}`],
          ['Portfolio Manager property ID', b.pmPropertyId],
          ['Property type', b.type === 'Industrial' ? 'Distribution center' : b.type === 'Lab' ? 'Laboratory' : b.type],
          ['Year built', b.yearBuilt],
          ['Gross floor area', b.gfa === null ? <Pill tone="warning">Missing</Pill> : fmtArea(b.gfa)],
          ['Irrigated area', <span className="muted">Not recorded</span>],
          ['Meters linked', `${inScope.length} in Enertiv${esMeters.length > inScope.length ? `, ${esMeters.length - inScope.length} only in Portfolio Manager` : ''}`],
        ]}
      />
      {esItems.length > 0 && (
        <p className="banner banner--warning bi-banner-tight bi-gap-top">
          <Icon name="warning" />
          <span>
            {esItems.length} open ENERGY STAR {esItems.length === 1 ? 'item' : 'items'}: {esItems.map((h) => h.problem.toLowerCase()).join(', ')}. A push sends data as it stands.
          </span>
        </p>
      )}
      {mine.length > 0 && (
        <DataTable<PushLog>
          label="Manual pushes"
          rows={mine}
          rowKey={(l) => l.at}
          dense
          caption="Manual pushes this session"
          columns={[
            { key: 'at', header: 'Pushed', value: (l) => l.at, render: (l) => fmtDate(l.at) + ', ' + l.at.slice(11, 16) },
            { key: 'who', header: 'By', value: (l) => l.who },
            { key: 'what', header: 'Sent', render: (l) => `${l.months} months, ${l.meters} meters` },
            { key: 'result', header: 'Result', render: () => <Pill tone="success" icon="check_circle">Accepted</Pill> },
          ]}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Push to ENERGY STAR now?"
          confirmLabel="Push now"
          onCancel={() => setConfirm(false)}
          onConfirm={doPush}
          body={
            <>
              <p>
                Sends the last 12 months for {inScope.length} {inScope.length === 1 ? 'meter' : 'meters'} to Portfolio Manager property {b.pmPropertyId}. Estimated months are sent marked as estimated.
              </p>
              {sourceOfRecord === 'Portfolio Manager' && <p className="muted bi-gap-top">Portfolio Manager is the source of record here, so only Enertiv-collected periods are sent.</p>}
              {esItems.length > 0 && <p className="bi-gap-top">There {esItems.length === 1 ? 'is 1 open ENERGY STAR item' : `are ${esItems.length} open ENERGY STAR items`} on this building.</p>}
            </>
          }
        />
      )}
    </Section>
  );
}
