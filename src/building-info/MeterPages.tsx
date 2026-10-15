/**
 * Meters (MOD-BI-68, 14, 15, 51, 62): Enertiv and ENERGY STAR meters in one list, told apart by a
 * Type column; health columns by cadence; out-of-scope ENERGY STAR meters shown as an opportunity.
 * One page per meter with its inventory, ENERGY STAR mapping, account, readings, health, writer
 * timeline, data (tier 2b and 3), alerts and activity together (SYS-DATA-03).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import { loadProfile, meterReadings } from '../data/series';
import type { Alert, Building, HealthItem, Meter } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { LineChart } from '../ui/charts';
import { DataTable, RecordTable } from '../ui/DataTable';
import { useToast } from '../ui/Toast';
import { ApiView, EmptyState, EstimatedMark, PageHeader, Pill, Section, SelectFilter, SeverityPill, Tabs, TierBadge, useTab } from '../ui/bits';
import { fmtDate, fmtInt, fmtPct } from '../ui/format';
import { TicketPill } from './DataHealthPage';
import { ActivityTab, BuildingFilter, cadenceLabel, coverCaption, isInterval, nextTierUnlock, NotFoundObject, Page, ReportingPill, reportingState, Toolbar, UTIL, useParamFilter, useRecordActivity, useScoped, ZerosPill } from './shared';
import { WriterTimeline } from './WriterTimeline';

const TYPE_LABEL = (m: Meter) => (m.kind === 'enertiv' ? 'Enertiv meter' : 'ENERGY STAR meter');

export function MetersPage() {
  const { data } = useData();
  const { building, account, meter: meterMap } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const toast = useToast();
  const [fb, setFb] = useParamFilter('building');
  const [fty, setFty] = useParamFilter('type');
  const [fu, setFu] = useParamFilter('utility');
  const [frep, setFrep] = useParamFilter('reporting');
  const [fsrc, setFsrc] = useParamFilter('source');
  const q = useApi(`building-info/meters/${scope.id}`, () => data.meters.filter((m) => ids.has(m.buildingId)), [data.meters, ids]);
  const all = q.data ?? [];
  const sources = useMemo(() => [...new Set(all.map((m) => m.dataSource))].sort(), [all]);
  const rows = all.filter((m) => (fb === 'all' || m.buildingId === fb) && (fty === 'all' || m.kind === fty) && (fu === 'all' || m.utility === fu) && (frep === 'all' || reportingState(m) === frep) && (fsrc === 'all' || m.dataSource === fsrc));
  const opportunities = all.filter((m) => m.kind === 'energy-star' && !m.inScope);
  return (
    <Page>
      <PageHeader title="Meters" subtitle="Enertiv meters and ENERGY STAR meters in one list, with their mapping, utility account and whether each is reporting on time." />
      <ApiView q={q} what="meters">
        {() => (
          <>
            {opportunities.length > 0 && (
              <div className="banner banner--neutral">
                <Icon name="lightbulb" />
                <div>
                  <strong>
                    {opportunities.length} ENERGY STAR {opportunities.length === 1 ? 'meter is' : 'meters are'} in Portfolio Manager but not in Enertiv
                  </strong>{' '}
                  ({[...new Set(opportunities.map((m) => building.get(m.buildingId)?.name))].join(', ')}). Bringing {opportunities.length === 1 ? 'it' : 'them'} in would cover more of the building.
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => toast('Your Enertiv account team will follow up on these meters.')}>
                  Talk to your account team
                </button>
              </div>
            )}
            <Toolbar>
              <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
              <SelectFilter label="Type" value={fty} onChange={setFty} options={[{ value: 'all', label: 'Enertiv and ENERGY STAR' }, { value: 'enertiv', label: 'Enertiv meters' }, { value: 'energy-star', label: 'ENERGY STAR meters' }]} />
              <SelectFilter label="Utility" value={fu} onChange={setFu} options={[{ value: 'all', label: 'All utilities' }, ...(['electricity', 'gas', 'water', 'steam'] as const).map((u) => ({ value: u, label: UTIL[u] }))]} />
              <SelectFilter label="Source" value={fsrc} onChange={setFsrc} options={[{ value: 'all', label: 'All sources' }, ...sources.map((s) => ({ value: s, label: s }))]} />
              <SelectFilter label="Reporting" value={frep} onChange={setFrep} options={[{ value: 'all', label: 'Any state' }, { value: 'Reporting', label: 'Reporting' }, { value: 'Stale', label: 'Not reporting' }, { value: 'No data', label: 'No data' }]} />
            </Toolbar>
            <DataTable<Meter>
              label="Meters"
              rows={rows}
              rowKey={(m) => m.id}
              rowHref={(m) => to(`/building-info/meters/${m.id}`)}
              search={(m) => `${m.name} ${building.get(m.buildingId)?.name ?? ''} ${m.accountId ? account.get(m.accountId)?.accountNumber ?? '' : ''}`}
              searchPlaceholder="Search meters or account numbers"
              caption={coverCaption(rows.length, 'meters', scope, buildings.length, `${rows.filter((m) => m.kind === 'enertiv').length} Enertiv, ${rows.filter((m) => m.kind === 'energy-star').length} ENERGY STAR.`)}
              empty={{ title: all.length ? 'No meters match these filters' : 'No meters yet', body: all.length ? 'Clear a filter to see more.' : 'Meters appear once a utility account or ENERGY STAR property is connected.', icon: 'speed' }}
              columns={[
                { key: 'name', header: 'Meter', value: (m) => m.name, render: (m) => (
                  <>
                    {m.name}
                    {!m.inScope && <span className="cell-sub">Not in Enertiv: an opportunity</span>}
                  </>
                ) },
                { key: 'type', header: 'Type', value: (m) => TYPE_LABEL(m), render: (m) => <Pill tone={m.kind === 'enertiv' ? 'info' : 'neutral'}>{TYPE_LABEL(m)}</Pill> },
                ...(showBuilding ? [{ key: 'building', header: 'Building', value: (m: Meter) => building.get(m.buildingId)?.name ?? '' }] : []),
                { key: 'utility', header: 'Utility', value: (m) => UTIL[m.utility] },
                { key: 'source', header: 'Data source', value: (m) => m.dataSource, hideOnPhone: true },
                { key: 'unit', header: 'Unit', value: (m) => m.unit, hideOnPhone: true },
                { key: 'account', header: 'Utility account', value: (m) => (m.accountId ? account.get(m.accountId)?.accountNumber ?? '' : ''), render: (m) => (m.accountId ? <Link to={to(`/building-info/bills/${m.accountId}`)}>{account.get(m.accountId)?.accountNumber}</Link> : <span className="muted">None</span>), hideOnPhone: true },
                {
                  key: 'mapping',
                  header: 'ENERGY STAR mapping',
                  value: (m) => (m.mappedTo ? meterMap.get(m.mappedTo)?.name ?? '' : ''),
                  render: (m) =>
                    m.mappedTo ? (
                      <span>
                        <Link to={to(`/building-info/meters/${m.mappedTo}`)}>{m.kind === 'enertiv' ? 'Mapped' : 'Mapped to Enertiv'}</Link>
                        <span className="cell-sub">{m.usedForMetrics ? 'Used for metrics' : 'Not used for metrics'}</span>
                      </span>
                    ) : m.kind === 'energy-star' && !m.inScope ? (
                      <Pill tone="info" icon="lightbulb">Opportunity</Pill>
                    ) : (
                      <span className="muted">Not mapped</span>
                    ),
                  hideOnPhone: true,
                },
                { key: 'reporting', header: 'Reporting', value: (m) => reportingState(m), render: (m) => <ReportingPill m={m} /> },
                { key: 'days', header: 'Days since data', value: (m) => m.daysSinceData, align: 'right' as const, render: (m) => (m.daysSinceData === null ? <span className="muted">Never</span> : m.daysSinceData) },
                { key: 'uptime', header: 'Uptime', value: (m) => m.uptime, align: 'right' as const, render: (m) => (m.uptime === null ? <span className="muted">n/a</span> : fmtPct(m.uptime)), hideOnPhone: true },
              ]}
            />
          </>
        )}
      </ApiView>
    </Page>
  );
}

/* ---------- Detail ---------- */

export function MeterDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { building } = useLookup();
  const { to } = useNav();
  const q = useApi(`building-info/meters/${id}`, () => data.meters.find((m) => m.id === id) ?? null, [data.meters, id]);
  const m = q.data;
  const b = m ? building.get(m.buildingId) : undefined;
  const tier = b?.tierByUtility.electricity ?? 0;
  const hasData = !!m && m.kind === 'enertiv' && isInterval(tier) && (m.dataSource === 'Interval (utility)' || m.dataSource === 'Submeter' || m.dataSource === 'BMS');
  const hasWriter = !!m && (m.kind === 'energy-star' || !!m.mappedTo);
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'readings', label: 'Readings' },
    { id: 'health', label: 'Health' },
    { id: 'writer', label: 'Writer timeline', hidden: !hasWriter },
    { id: 'data', label: 'Data', hidden: !hasData },
    { id: 'alerts', label: 'Alerts', hidden: tier !== 3 || m?.kind !== 'enertiv' },
    { id: 'activity', label: 'Activity' },
  ];
  const tab = useTab(tabs);
  if (q.status === 'ready' && !m) return <NotFoundObject what="meter" backTo={to('/building-info/meters')} backLabel="Back to meters" />;
  return (
    <Page>
      <ApiView q={q} what="this meter">
        {(meter) =>
          !b || !accessible.has(b.id) ? (
            <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />
          ) : (
            <>
              <PageHeader
                back={{ to: to('/building-info/meters'), label: 'Meters' }}
                eyebrow={
                  <>
                    {TYPE_LABEL(meter)} · {UTIL[meter.utility]} · <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                  </>
                }
                title={meter.name}
                actions={<ReportingPill m={meter} />}
              />
              <Tabs label="Meter views" tabs={tabs} />
              {tab === 'summary' && <MeterSummary m={meter} b={b} />}
              {tab === 'readings' && <Readings m={meter} />}
              {tab === 'health' && <MeterHealth m={meter} />}
              {tab === 'writer' && <MeterWriter m={meter} b={b} />}
              {tab === 'data' && <MeterData m={meter} b={b} />}
              {tab === 'alerts' && <MeterAlerts m={meter} />}
              {tab === 'activity' && <ActivityTab label="Meter activity" filter={(a) => a.object.id === meter.id} showObject={false} />}
            </>
          )
        }
      </ApiView>
    </Page>
  );
}

function MeterSummary({ m, b }: { m: Meter; b: Building }) {
  const { patch } = useData();
  const { account, meter: meterMap, space, equipment } = useLookup();
  const { to } = useNav();
  const record = useRecordActivity();
  const toast = useToast();
  const acct = m.accountId ? account.get(m.accountId) : undefined;
  const twin = m.mappedTo ? meterMap.get(m.mappedTo) : undefined;
  const es = m.kind === 'energy-star' ? m : twin;
  const sp = m.spaceId ? space.get(m.spaceId) : undefined;
  const feeds = m.feedsEquipmentId ? equipment.get(m.feedsEquipmentId) : undefined;
  const tier = b.tierByUtility[m.utility] ?? 0;
  const unlock = nextTierUnlock(tier);
  const toggleMetrics = () => {
    if (!es) return;
    patch('meters', es.id, { usedForMetrics: !es.usedForMetrics });
    record({ kind: 'meter', id: es.id, label: es.name }, es.usedForMetrics ? 'Unmarked as used for metrics' : 'Marked as used for metrics', b.id);
    toast(es.usedForMetrics ? 'No longer used for metrics in ENERGY STAR.' : 'Now used for metrics in ENERGY STAR.');
  };
  return (
    <>
      {m.kind === 'enertiv' && !isInterval(b.tierByUtility.electricity) && (
        <div className="banner banner--neutral">
          <Icon name="info" />
          <div>
            This meter's building is <TierBadge tier={tier} /> for {UTIL[m.utility].toLowerCase()}, so its readings come from bills, ENERGY STAR or manual reads, without interval data.{unlock ? ` ${unlock.next} would add: ${unlock.unlocks}` : ''}
          </div>
        </div>
      )}
      {!m.inScope && (
        <div className="banner banner--neutral">
          <Icon name="lightbulb" />
          <div>This ENERGY STAR meter isn't in Enertiv yet. Bringing it in would add its consumption to the building's coverage; your account team can set it up.</div>
        </div>
      )}
      <Section title="Inventory">
        <RecordTable
          label="Meter record"
          rows={[
            ['Name', m.name],
            ['Type', TYPE_LABEL(m)],
            ['Building', <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>],
            ['Space', sp ? <Link to={to(`/building-info/buildings/${b.id}?tab=spaces&space=${sp.id}`)}>{sp.name}, floor {sp.floor}</Link> : <span className="muted">Whole building</span>],
            ['Utility', UTIL[m.utility]],
            ['Unit', m.unit],
            ['Data source', m.dataSource],
            ['Utility account', acct ? <Link to={to(`/building-info/bills/${acct.id}`)}>{acct.provider} {acct.accountNumber}</Link> : <span className="muted">No account. A meter without an account is listed in Data Health.</span>],
            ['Feeds', feeds ? <Link to={to(`/building-info/equipment/${feeds.id}`)}>{feeds.name}</Link> : <span className="muted">Not linked to the electrical record</span>],
          ]}
        />
      </Section>
      <Section
        title="ENERGY STAR mapping"
        actions={
          es ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={toggleMetrics}>
              {es.usedForMetrics ? 'Stop using for metrics' : 'Use for metrics'}
            </button>
          ) : undefined
        }
      >
        {!es ? (
          <p className="muted">Not mapped to an ENERGY STAR meter. {b.pmPropertyId ? 'Enertiv maps it once the matching Portfolio Manager meter is confirmed.' : 'The building is not linked to ENERGY STAR yet.'}</p>
        ) : (
          <RecordTable
            label="ENERGY STAR mapping"
            rows={[
              [m.kind === 'enertiv' ? 'ENERGY STAR meter' : 'Enertiv meter', twin ? <Link to={to(`/building-info/meters/${twin.id}`)}>{twin.name}</Link> : <span className="muted">Not mapped</span>],
              ['Used for metrics', es.usedForMetrics ? 'Yes' : 'No'],
              ['Meter type', `${UTIL[es.utility]}, ${es.inScope ? 'grid purchase' : 'tenant-held'}`],
              ['First bill date', fmtDate(es.esFirstBillDate)],
              ['In use', 'Yes'],
              ['Inactive date', <span className="muted">None</span>],
              ['Metered', 'Yes'],
              ['Portfolio Manager property', b.pmPropertyId ?? '—'],
            ]}
          />
        )}
      </Section>
    </>
  );
}

function Readings({ m }: { m: Meter }) {
  const { data } = useData();
  const rows = useMemo(() => meterReadings(data, m.id).map((r, k) => ({ ...r, key: `${r.period}-${k}` })), [data, m.id]);
  const est = rows.filter((r) => r.estimated).length;
  return (
    <DataTable
      label="Readings"
      rows={rows}
      rowKey={(r) => r.key}
      caption={`${rows.length} readings, newest first.${est ? ` ${est} estimated, marked “est.”` : ' None estimated.'}`}
      empty={{ title: 'No readings yet', body: 'Readings appear once the first bill, ENERGY STAR record or manual read arrives.', icon: 'speed' }}
      columns={[
        { key: 'period', header: 'Period', value: (r) => r.period },
        { key: 'value', header: 'Value', align: 'right' as const, value: (r) => r.value, render: (r) => <span className="num">{fmtInt(r.value)} {r.unit}{r.estimated && <> <EstimatedMark /></>}</span> },
        { key: 'source', header: 'Source', value: (r) => r.source },
        { key: 'est', header: 'Estimated', value: (r) => (r.estimated ? 'Yes' : 'No'), hideOnPhone: true },
      ]}
    />
  );
}

function MeterHealth({ m }: { m: Meter }) {
  const { data } = useData();
  const { to } = useNav();
  const items = data.health.filter((h) => h.object.id === m.id || (m.accountId && h.object.id === m.accountId));
  const ticket = items.find((h) => h.ticket)?.ticket;
  return (
    <>
      <Section title="Health" description={`Expected to report ${cadenceLabel(m)}. Uptime and completeness cover the last 30 days.`}>
        <RecordTable
          label="Meter health"
          rows={[
            ['Reporting', <ReportingPill m={m} />],
            ['Days since last data', m.daysSinceData === null ? 'Never reported' : m.daysSinceData === 0 ? 'Today' : `${m.daysSinceData} days`],
            ['Run of zeros', <ZerosPill zeros={m.zeros} />],
            ['Uptime', m.uptime === null ? <span className="muted">Applies to interval meters only</span> : fmtPct(m.uptime)],
            ['Completeness', fmtPct(m.completeness)],
            ['With Enertiv', ticket ? <TicketPill t={ticket} /> : <span className="muted">No open ticket</span>],
          ]}
        />
      </Section>
      <Section title="Data health items">
        <DataTable<HealthItem>
          label="Data health items for this meter"
          rows={items}
          rowKey={(h) => h.id}
          rowHref={(h) => to(`/building-info/data-health?item=${h.id}&status=all`)}
          empty={{ title: 'No data health items', body: 'Nothing has been flagged on this meter or its account.', icon: 'check_circle' }}
          columns={[
            { key: 'problem', header: 'Problem', value: (h) => h.problem },
            { key: 'severity', header: 'Impact', value: (h) => h.severity, render: (h) => <SeverityPill severity={h.severity} /> },
            { key: 'status', header: 'Status', value: (h) => h.status, render: (h) => (h.status === 'open' ? 'Open' : h.status === 'expected' ? 'Expected' : 'Resolved') },
            { key: 'opened', header: 'Opened', value: (h) => h.opened, render: (h) => fmtDate(h.opened) },
          ]}
        />
      </Section>
    </>
  );
}

function MeterWriter({ m, b }: { m: Meter; b: Building }) {
  const { meter: meterMap } = useLookup();
  const es = m.kind === 'energy-star' ? m : m.mappedTo ? meterMap.get(m.mappedTo) : undefined;
  const list = useMemo(() => (es ? [es] : []), [es]);
  return (
    <Section title="Writer timeline" description="Who wrote each month of this meter to ENERGY STAR. Select a period to open its bill.">
      <WriterTimeline b={b} meters={list} compact />
    </Section>
  );
}

function MeterData({ m, b }: { m: Meter; b: Building }) {
  const profile = useMemo(() => loadProfile(b, m.id), [b, m.id]);
  const peak = Math.max(...profile.map((p) => p.kw));
  return (
    <Section title="Demand, last 24 hours" description={`15-minute interval data. Peak ${peak.toLocaleString('en-US')} kW. Cross-asset analysis lives in Workspace.`}>
      <LineChart label={`Demand on ${m.name}, kW, last 24 hours`} labels={profile.map((p) => p.t)} series={[{ name: 'Demand (kW)', color: 'var(--chart-1)', points: profile.map((p) => p.kw) }]} />
    </Section>
  );
}

function MeterAlerts({ m }: { m: Meter }) {
  const { data } = useData();
  const { equipment } = useLookup();
  const { to } = useNav();
  const ids = new Set([m.feedsEquipmentId, ...data.equipment.filter((e) => e.parentId === m.feedsEquipmentId).map((e) => e.id)].filter(Boolean) as string[]);
  const alerts = data.alerts.filter((a) => ids.has(a.equipmentId));
  return (
    <DataTable<Alert>
      label="Alerts"
      rows={alerts}
      rowKey={(a) => a.id}
      rowHref={(a) => to(`/building-info/equipment/${a.equipmentId}?tab=alerts`)}
      caption="Alerts on the equipment this meter feeds. Acknowledge and resolve them on the equipment's page."
      empty={{ title: 'No alerts on this meter', body: 'Alerts on the equipment it feeds show here.', icon: 'notifications_off' }}
      columns={[
        { key: 'title', header: 'Alert', value: (a) => a.title },
        { key: 'eq', header: 'Equipment', value: (a) => equipment.get(a.equipmentId)?.name ?? '' },
        { key: 'severity', header: 'Severity', value: (a) => a.severity, render: (a) => <SeverityPill severity={a.severity} /> },
        { key: 'start', header: 'Started', value: (a) => a.start, render: (a) => fmtDate(a.start) },
        { key: 'state', header: 'State', value: (a) => (a.resolved ? 'Resolved' : a.acknowledged ? 'Acknowledged' : 'New') },
      ]}
    />
  );
}
