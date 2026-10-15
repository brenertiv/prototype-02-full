/**
 * The Stacking plan landing page (MOD-BI-45, 02, 73): every building in scope as its stacking
 * plan, compact in a grid at portfolio and group scope, one building large at property scope,
 * with an accessible table alternative (`?view=table`).
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import type { Building, Space } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { ApiView, EmptyState, FilterChips, PageHeader, StatusChip } from '../ui/bits';
import { fmtArea, fmtDate, fmtPct } from '../ui/format';
import { coverCaption, fmtKw, isInterval, Page, spacePower, useLiveStatus, useScoped } from './shared';
import { PlanLegend, SpaceDetail, spaceState, StackingPlan } from './StackingPlan';

export function StackingPlanPage() {
  const { data } = useData();
  const { scope, buildings, showBuilding } = useScoped();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'table' ? 'table' : 'plans';
  const selected = params.get('space');
  const q = useApi(
    `building-info/stacking-plan/${scope.id}`,
    () => {
      const ids = new Set(buildings.map((b) => b.id));
      const spaces = data.spaces.filter((s) => ids.has(s.buildingId));
      const byB = new Map<string, Space[]>();
      for (const s of spaces) byB.set(s.buildingId, [...(byB.get(s.buildingId) ?? []), s]);
      return { spaces, byB };
    },
    [data.spaces, buildings],
  );
  const select = useCallback(
    (s: Space | null) => {
      const next = new URLSearchParams(params);
      if (s && s.id !== selected) next.set('space', s.id);
      else next.delete('space');
      setParams(next, { replace: true });
    },
    [params, selected, setParams],
  );

  return (
    <Page>
      <PageHeader
        title="Stacking plan"
        subtitle={scope.kind === 'property' ? `The floors and spaces of ${scope.name}, with the tenant in each.` : 'Every building in scope, floor by floor, with the tenant in each space. Select a space to see its lease and what feeds it.'}
      />
      <FilterChips
        label="View"
        param="view"
        options={[
          { id: 'plans', label: 'Plans' },
          { id: 'table', label: 'Table' },
        ]}
      />
      <ApiView q={q} what="the stacking plan">
        {({ spaces, byB }) =>
          buildings.length === 0 ? (
            <EmptyState icon="apartment" title="No buildings in this scope" body="Choose another scope from the top bar, or ask your Admin for access to these buildings." />
          ) : view === 'table' ? (
            <SpacesTable spaces={spaces} showBuilding={showBuilding} caption={coverCaption(spaces.length, 'spaces', scope, buildings.length)} />
          ) : scope.kind === 'property' || buildings.length === 1 ? (
            <OnePlan building={buildings[0]} spaces={byB.get(buildings[0].id) ?? []} selected={selected} onSelect={select} />
          ) : (
            <PlanGrid buildings={buildings} byB={byB} selected={selected} onSelect={select} caption={coverCaption(buildings.length, 'buildings', scope, buildings.length)} />
          )
        }
      </ApiView>
    </Page>
  );
}

function OnePlan({ building, spaces, selected, onSelect }: { building: Building; spaces: Space[]; selected: string | null; onSelect: (s: Space | null) => void }) {
  const { to } = useNav();
  const sel = spaces.find((s) => s.id === selected) ?? null;
  return (
    <div className="bi-plan-layout">
      <div className="card">
        <div className="bi-card-head">
          <h3>
            <Link to={to(`/building-info/buildings/${building.id}?tab=spaces`)}>{building.name}</Link>
          </h3>
          <span className="muted">
            {building.city}, {building.state} · {fmtArea(building.gfa)}
          </span>
        </div>
        <StackingPlan building={building} spaces={spaces} size="large" selectedId={selected} onSelect={onSelect} />
        <PlanLegend spaces={spaces} full />
      </div>
      <aside className="bi-plan-aside">{sel ? <SpaceDetail space={sel} onClose={() => onSelect(null)} /> : <p className="muted card card--sunken">Select a space to see its tenant, lease dates, size and the services that feed it.</p>}</aside>
    </div>
  );
}

function PlanGrid({ buildings, byB, selected, onSelect, caption }: { buildings: Building[]; byB: Map<string, Space[]>; selected: string | null; onSelect: (s: Space | null) => void; caption: string }) {
  const { to } = useNav();
  const { space } = useLookup();
  const { status } = useLiveStatus();
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const n = filter.trim().toLowerCase();
    return [...buildings].sort((a, b) => a.name.localeCompare(b.name)).filter((b) => !n || `${b.name} ${b.city} ${b.state}`.toLowerCase().includes(n));
  }, [buildings, filter]);
  const sel = selected ? space.get(selected) ?? null : null;
  return (
    <>
      <div className="table-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">Find a building</span>
          <input type="search" placeholder="Find a building" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <PlanLegend spaces={[]} full={false} />
      </div>
      <p className="table-caption">{caption} Select a building's name to open its spaces; the table view lists every space.</p>
      {shown.length === 0 ? (
        <EmptyState icon="search_off" title={`No buildings match “${filter}”`} body="Try another name or city." />
      ) : (
        <div className="bi-plan-layout">
          <ul className="bi-plan-grid">
            {shown.map((b) => {
              const sp = byB.get(b.id) ?? [];
              const leasable = sp.filter((s) => spaceState(s) !== 'common');
              const leased = leasable.filter((s) => s.tenantId).reduce((a, s) => a + s.sqft, 0);
              const total = leasable.reduce((a, s) => a + s.sqft, 0);
              const tenants = new Set(sp.map((s) => s.tenantId).filter(Boolean)).size;
              return (
                <li key={b.id} className={`card bi-plan-card ${sel?.buildingId === b.id ? 'is-selected' : ''}`}>
                  <div className="bi-card-head">
                    <h3>
                      <Link to={to(`/building-info/buildings/${b.id}?tab=spaces`)}>{b.name}</Link>
                    </h3>
                    <StatusChip status={status.get(b.id) ?? b.status} />
                  </div>
                  <p className="cell-sub">
                    {b.city}, {b.state} · {b.floors === 1 ? '1 floor' : `${b.floors} floors`} · {tenants} {tenants === 1 ? 'tenant' : 'tenants'} · {total ? `${fmtPct(leased / total)} leased` : 'no leasable space'}
                  </p>
                  <StackingPlan building={b} spaces={sp} size="compact" selectedId={selected} onSelect={onSelect} />
                </li>
              );
            })}
          </ul>
          {sel && (
            <aside className="bi-plan-aside">
              <SpaceDetail space={sel} onClose={() => onSelect(null)} showBuilding />
            </aside>
          )}
        </div>
      )}
    </>
  );
}

function SpacesTable({ spaces, showBuilding, caption }: { spaces: Space[]; showBuilding: boolean; caption: string }) {
  const { data } = useData();
  const { building, tenant, equipment } = useLookup();
  const { to } = useNav();
  return (
    <DataTable<Space>
      label="Spaces by building"
      rows={spaces}
      rowKey={(s) => s.id}
      rowHref={(s) => to(`/building-info/buildings/${s.buildingId}?tab=spaces&space=${s.id}`)}
      search={(s) => `${s.name} ${building.get(s.buildingId)?.name ?? ''} ${s.tenantId ? tenant.get(s.tenantId)?.name ?? '' : 'vacant'}`}
      searchPlaceholder="Search spaces, tenants or buildings"
      caption={caption}
      initialSort={showBuilding ? { key: 'building', dir: 'asc' } : { key: 'floor', dir: 'desc' }}
      columns={[
        { key: 'space', header: 'Space', value: (s) => s.name },
        ...(showBuilding ? [{ key: 'building', header: 'Building', value: (s: Space) => building.get(s.buildingId)?.name ?? '' }] : []),
        { key: 'floor', header: 'Floor', value: (s) => s.floor, align: 'right' as const },
        { key: 'area', header: 'Area type', value: (s) => s.areaType, hideOnPhone: true },
        { key: 'size', header: 'Size', value: (s) => s.sqft, render: (s) => fmtArea(s.sqft), align: 'right' as const },
        { key: 'tenant', header: 'Tenant', value: (s) => (s.tenantId ? tenant.get(s.tenantId)?.name ?? '' : spaceState(s) === 'vacant' ? 'Vacant' : 'Common area'), render: (s) => (s.tenantId ? tenant.get(s.tenantId)?.name : <span className="muted">{spaceState(s) === 'vacant' ? 'Vacant' : 'Common area'}</span>) },
        { key: 'start', header: 'Lease start', value: (s) => s.leaseStart, render: (s) => fmtDate(s.leaseStart), hideOnPhone: true },
        { key: 'end', header: 'Lease end', value: (s) => s.leaseEnd, render: (s) => fmtDate(s.leaseEnd), hideOnPhone: true },
        {
          key: 'kw',
          header: 'Deliverable power',
          align: 'right' as const,
          hideOnPhone: true,
          value: (s) => spacePower(s, data.spaces, equipment, false).deliverableKw,
          render: (s) => {
            const b = building.get(s.buildingId);
            const p = spacePower(s, data.spaces, equipment, b ? isInterval(b.tierByUtility.electricity) : false);
            return p.deliverableKw == null ? <span className="muted">Not surveyed</span> : fmtKw(p.deliverableKw);
          },
        },
      ]}
    />
  );
}
