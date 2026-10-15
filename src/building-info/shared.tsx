/**
 * Shared helpers for Building Info: scope filtering, captions that say what a table covers
 * (SYS-TRUST-23), building status recomputed from live items (SYS-TRUST-35), power computed
 * from the record (MOD-BI-04), connection by cadence (SYS-TRUST-24), and the activity tab (MOD-BI-09).
 */
import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import { AS_OF } from '../data/rand';
import type { ActivityItem, Building, DataStatus, Equipment, HealthItem, Meter, ObjectRef, Space, Tier, Utility } from '../data/types';
import { useNav, useScopeInfo, type ScopeInfo } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { EmptyState, Pill, SelectFilter } from '../ui/bits';
import { fmtDateTime, fmtNum } from '../ui/format';

export const TODAY = AS_OF;

/* ---------- Scope ---------- */

/** Buildings in scope, as a set and a list, plus whether to show a Building column (MOD-BI-40). */
export function useScoped() {
  const scope = useScopeInfo();
  const { data } = useData();
  return useMemo(() => {
    const ids = new Set(scope.buildingIds);
    const buildings = data.buildings.filter((b) => ids.has(b.id));
    return { scope, ids, buildings, showBuilding: scope.kind !== 'property' };
  }, [scope, data.buildings]);
}

/** "142 bills across 15 buildings in Fund I" plus the access note (SYS-TRUST-23, ST-D07). */
export function coverCaption(count: number, noun: string, scope: ScopeInfo, buildingCount?: number, extra?: string) {
  const nb = buildingCount ?? scope.buildingIds.length;
  const where = scope.kind === 'portfolio' ? 'your portfolio' : scope.kind === 'group' ? `${scope.name}` : scope.name;
  const across = scope.kind === 'property' || noun.startsWith('building') ? '' : ` across ${nb} ${nb === 1 ? 'building' : 'buildings'}`;
  const excluded = scope.excluded > 0 ? ` ${scope.excluded} ${scope.excluded === 1 ? 'building' : 'buildings'} in this scope ${scope.excluded === 1 ? "isn't" : "aren't"} included because ${scope.excluded === 1 ? "it's" : "they're"} outside your access.` : '';
  return `${count.toLocaleString('en-US')} ${noun}${across} in ${where}.${extra ? ` ${extra}` : ''}${excluded}`;
}

/** A URL-kept filter value (`?building=` and friends), so filters deep-link. */
export function useParamFilter(key: string, fallback = 'all'): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === fallback) next.delete(key);
    else next.set(key, v);
    setParams(next, { replace: true });
  };
  return [value, set];
}

/** The building select every list page carries at group and portfolio scope. */
export function BuildingFilter({ buildings, value, onChange }: { buildings: Building[]; value: string; onChange: (v: string) => void }) {
  if (buildings.length < 2) return null;
  return (
    <SelectFilter
      label="Building"
      value={value}
      onChange={onChange}
      options={[{ value: 'all', label: 'All buildings' }, ...[...buildings].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.id, label: b.name }))]}
    />
  );
}

/* ---------- Links ---------- */

export function useObjectHref() {
  const { to } = useNav();
  const { space } = useLookup();
  return (ref: ObjectRef | { kind: string; id: string }, tab?: string) => {
    const q = tab ? `?tab=${tab}` : '';
    switch (ref.kind) {
      case 'building':
        return to(`/building-info/buildings/${ref.id}${q}`);
      case 'equipment':
        return to(`/building-info/equipment/${ref.id}${q}`);
      case 'meter':
        return to(`/building-info/meters/${ref.id}${q}`);
      case 'account':
      case 'bill':
        return to(`/building-info/bills/${ref.id}${q}`);
      case 'file':
        return to(`/building-info/files/${ref.id}${q}`);
      case 'tenant':
        return to(`/people/tenants/${ref.id}`);
      case 'space':
        return to(`/building-info/buildings/${space.get(ref.id)?.buildingId ?? ''}?tab=spaces&space=${ref.id}`);
      default:
        return to(`/building-info`);
    }
  };
}

export function BuildingLink({ id, tab }: { id: string; tab?: string }) {
  const { building } = useLookup();
  const href = useObjectHref();
  const b = building.get(id);
  if (!b) return <span className="muted">Unknown building</span>;
  return <Link to={href({ kind: 'building', id }, tab)}>{b.name}</Link>;
}

/* ---------- Not found ---------- */

export function NotFoundObject({ what, backTo, backLabel }: { what: string; backTo: string; backLabel: string }) {
  return (
    <article className="page">
      <EmptyState
        icon="search_off"
        title={`This ${what} isn't here`}
        body={`It may have been removed, or the link points to a ${what} in another account or scenario.`}
        action={
          <Link className="btn" to={backTo}>
            <Icon name="arrow_back" /> {backLabel}
          </Link>
        }
      />
    </article>
  );
}

/* ---------- Status, tier, power ---------- */

/** Building status from its open items, recomputed so marking items changes it (SYS-TRUST-35). */
export function liveStatus(b: Building, health: HealthItem[]): DataStatus {
  const open = health.filter((h) => h.buildingId === b.id && h.status === 'open' && (!h.utility || b.sold[h.utility]?.sold));
  if (b.tierByUtility.electricity === 0 || b.exposure.status === 'Non-compliant') return 'critical';
  if (open.some((h) => h.severity !== 'low')) return 'at-risk';
  return 'healthy';
}

export function useLiveStatus() {
  const { data } = useData();
  return useMemo(() => {
    const byB = new Map<string, HealthItem[]>();
    for (const h of data.health) {
      const list = byB.get(h.buildingId) ?? [];
      list.push(h);
      byB.set(h.buildingId, list);
    }
    const status = new Map<string, DataStatus>();
    const openCount = new Map<string, number>();
    for (const b of data.buildings) {
      const items = byB.get(b.id) ?? [];
      status.set(b.id, liveStatus(b, items));
      openCount.set(b.id, items.filter((h) => h.status === 'open').length);
    }
    return { status, openCount };
  }, [data.health, data.buildings]);
}

export const isInterval = (t: Tier | undefined) => t === '2b' || t === 3;
export const mainTier = (b: Building): Tier => b.tierByUtility.electricity ?? 0;

export interface PowerSummary {
  surveyed: Building['powerSurveyed'];
  services: Equipment[];
  deliverableKw: number | null;
  availableKw: number | null;
  /** Services whose rating is missing or not observable (MOD-BI-72). */
  unverified: Equipment[];
  interval: boolean;
}

/** Deliverable power summed from the services' nameplate ratings, never typed in (MOD-BI-04). */
export function powerFor(b: Building, equipment: Equipment[]): PowerSummary {
  const services = equipment.filter((e) => e.buildingId === b.id && e.kind === 'service');
  const interval = isInterval(b.tierByUtility.electricity);
  // A not-observable service is left out of the sum and named instead (MOD-BI-72).
  const withKw = services.filter((s) => s.ratings?.deliverableKw != null && !s.notObservable);
  const deliverableKw = withKw.length ? withKw.reduce((a, s) => a + (s.ratings!.deliverableKw ?? 0), 0) : null;
  const avail = withKw.filter((s) => s.ratings?.availableKw != null);
  const availableKw = interval && avail.length ? avail.reduce((a, s) => a + (s.ratings!.availableKw ?? 0), 0) : null;
  const unverified = services.filter((s) => s.ratings?.deliverableKw == null || s.notObservable);
  return { surveyed: b.powerSurveyed, services, deliverableKw, availableKw, unverified, interval };
}

/** A space's share of each service that feeds it: computed from the record (MOD-BI-73). */
export function spacePower(space: Space, spaces: Space[], equipment: Map<string, Equipment>, interval: boolean) {
  let deliverable = 0;
  let available = 0;
  let any = false;
  let anyAvail = false;
  for (const sid of space.fedBy) {
    const svc = equipment.get(sid);
    const kw = svc?.ratings?.deliverableKw;
    if (kw == null) continue;
    const share = spaces.filter((s) => s.buildingId === space.buildingId && s.fedBy.includes(sid)).length || 1;
    deliverable += kw / share;
    any = true;
    if (interval && svc?.ratings?.availableKw != null) {
      available += svc.ratings.availableKw / share;
      anyAvail = true;
    }
  }
  return { deliverableKw: any ? Math.round(deliverable) : null, availableKw: anyAvail ? Math.round(available) : null };
}

export const fmtKw = (kw: number | null | undefined) => (kw == null ? '—' : kw >= 1000 ? `${fmtNum(kw / 1000, 2)} MW` : `${fmtNum(kw, 0)} kW`);

/** Available power is never styled like deliverable (MOD-BI-71). */
export function CapacityOnly() {
  return (
    <span className="bi-capacity-only" title="No interval data: this is nameplate capacity only, not available power">
      Capacity only
    </span>
  );
}

/* ---------- Meters: connected by cadence (SYS-TRUST-24, MOD-BI-61) ---------- */

const CADENCE: Record<Meter['dataSource'], number> = {
  'Interval (utility)': 2,
  Submeter: 2,
  BMS: 2,
  'Utility bills': 45,
  'Manual reads': 45,
  'ENERGY STAR': 60,
};

export type ReportingState = 'Reporting' | 'Stale' | 'No data';
export function reportingState(m: Meter): ReportingState {
  if (m.daysSinceData === null) return 'No data';
  if (!m.reporting || m.daysSinceData > CADENCE[m.dataSource]) return 'Stale';
  return 'Reporting';
}
export const cadenceLabel = (m: Meter) => {
  const d = CADENCE[m.dataSource];
  return d <= 2 ? 'every 15 minutes' : `within ${d} days`;
};

export function ReportingPill({ m }: { m: Meter }) {
  const s = reportingState(m);
  return (
    <Pill tone={s === 'Reporting' ? 'success' : s === 'Stale' ? 'danger' : 'neutral'} icon={s === 'Reporting' ? 'check_circle' : s === 'Stale' ? 'error' : 'remove'} title={`Expected ${cadenceLabel(m)}`}>
      {s === 'Stale' ? 'Not reporting' : s}
    </Pill>
  );
}

export function ZerosPill({ zeros }: { zeros: Meter['zeros'] }) {
  if (zeros === 'none') return <span className="muted">None</span>;
  return zeros === 'expected' ? (
    <Pill tone="neutral" icon="info" title="Zeros where zero is expected, such as gas outside the heating season or a vacant space">
      Expected zeros
    </Pill>
  ) : (
    <Pill tone="warning" icon="error">
      Unexpected zeros
    </Pill>
  );
}

/* ---------- Words ---------- */

export const UTIL: Record<Utility, string> = { electricity: 'Electricity', gas: 'Gas', water: 'Water', steam: 'Steam' };
export const KIND_LABEL: Record<Equipment['kind'], string> = { equipment: 'Equipment', service: 'Electrical service', transformer: 'Transformer', panel: 'Panel' };
export const STAGES = ['scoping', 'install', 'schedule', 'ops', 'training', 'live'] as const;
export const STAGE_LABEL: Record<(typeof STAGES)[number], string> = { scoping: 'Scoping', install: 'Install', schedule: 'Schedule', ops: 'Operations', training: 'Training', live: 'Live' };

/** What the next tier would add, from the Insight Unlock Guide (MOD-BI-61). */
export function nextTierUnlock(t: Tier): { next: string; unlocks: string } | null {
  switch (t) {
    case 0:
      return { next: 'Tier 1: bills and ENERGY STAR', unlocks: 'Benchmarking, compliance exposure, ESG reporting and carbon planning, plus 16 bill-level insights such as LL97 emissions risk and year-on-year consumption.' };
    case 1:
      return { next: 'Tier 2b: whole-building interval data', unlocks: 'Load profiles, peak demand and available power, and 8 meter insights such as peak shaving, baseload reduction and vacancy waste.' };
    case '2a':
      return { next: 'Tier 2b: whole-building interval data', unlocks: 'Building-level load profiles, peak demand and available power, and peak-shaving and schedule insights.' };
    case '2b':
      return { next: 'Tier 3: equipment sensors or a BMS connection', unlocks: 'Equipment alerts and fault detection, and 29 equipment insights such as HVAC scheduling, short cycling and simultaneous heating and cooling.' };
    case 3:
      return null;
  }
}

/* ---------- Activity (MOD-BI-09) ---------- */

export function useRecordActivity() {
  const { add, user } = useData();
  return (object: ObjectRef, what: string, buildingId: string | null) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const item: ActivityItem = { id: `act-bi-${Date.now()}-${Math.round(Math.random() * 1e4)}`, at: `${TODAY}T${time}`, who: user.name, what, object, buildingId };
    add('activity', item);
  };
}

export function ActivityTab({ filter, label, extra = [], showObject = true }: { filter: (a: ActivityItem) => boolean; label: string; extra?: ActivityItem[]; showObject?: boolean }) {
  const { data } = useData();
  const href = useObjectHref();
  const rows = useMemo(() => [...data.activity.filter(filter), ...extra].sort((a, b) => b.at.localeCompare(a.at)), [data.activity, filter, extra]);
  return (
    <DataTable<ActivityItem>
      label={label}
      rows={rows}
      rowKey={(a) => a.id}
      caption={`${rows.length} ${rows.length === 1 ? 'change' : 'changes'}, newest first.`}
      empty={{ title: 'No activity yet', body: 'Changes to this record, by people, Enertiv or the Survey App, show here.', icon: 'history' }}
      initialSort={{ key: 'at', dir: 'desc' }}
      columns={[
        { key: 'at', header: 'Date', value: (a) => a.at, render: (a) => <span className="nowrap">{fmtDateTime(a.at)}</span> },
        { key: 'who', header: 'Who', value: (a) => a.who },
        { key: 'what', header: 'What changed', value: (a) => a.what },
        ...(showObject ? [{ key: 'object', header: 'Object', value: (a: ActivityItem) => a.object.label, render: (a: ActivityItem) => <Link to={href(a.object)}>{a.object.label}</Link>, hideOnPhone: true }] : []),
      ]}
    />
  );
}

/* ---------- Small layout bits ---------- */

export function Page({ children, wide = true }: { children: ReactNode; wide?: boolean }) {
  return <article className={`page bi-page ${wide ? 'page-wide' : ''}`}>{children}</article>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="bi-toolbar">{children}</div>;
}

export function YesNo({ v }: { v: boolean }) {
  return <span>{v ? 'Yes' : 'No'}</span>;
}

/** Tenants get a colour by their order in the building, so neighbours differ (MOD-BI-02). */
export function tenantColorIndex(spaces: Space[]) {
  const map = new Map<string, number>();
  for (const s of spaces) if (s.tenantId && !map.has(s.tenantId)) map.set(s.tenantId, map.size % 8);
  return map;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Jul 2024": a month in prose, never mistaken for a day. */
export function fmtMonthLong(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]?.slice(0, 3) ?? ''} ${y}`;
}

/** Customer wording: months written "2026-08" in stored text read as "Aug 2026". */
export function human(text: string) {
  return text.replace(/\b(\d{4})-(\d{2})\b(?!-\d)/g, (_, y: string, m: string) => `${MONTH_NAMES[Number(m) - 1]?.slice(0, 3) ?? m} ${y}`);
}

export function monthOf(iso: string) {
  return iso.slice(0, 7);
}
