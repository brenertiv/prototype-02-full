/**
 * A building's stacking plan (MOD-BI-02, 45): floors bottom-up, spaces sized by area and coloured
 * by tenant, vacant shown as vacant, common areas distinct. Selecting a space shows its tenant,
 * lease, size and the services and panels that feed it with deliverable power (MOD-BI-73).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import type { Building, Space } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { fmtArea, fmtDate } from '../ui/format';
import { CapacityOnly, fmtKw, isInterval, KIND_LABEL, spacePower, tenantColorIndex } from './shared';

export function spaceState(s: Space) {
  if (s.areaType === 'Common area') return 'common' as const;
  if (!s.tenantId) return 'vacant' as const;
  return 'leased' as const;
}

export function StackingPlan({
  building,
  spaces,
  size,
  selectedId,
  onSelect,
}: {
  building: Building;
  spaces: Space[];
  size: 'large' | 'compact';
  selectedId?: string | null;
  onSelect?: (s: Space) => void;
}) {
  const { tenant } = useLookup();
  const colors = useMemo(() => tenantColorIndex(spaces), [spaces]);
  const floors = useMemo(() => {
    const by = new Map<number, Space[]>();
    for (const s of spaces) by.set(s.floor, [...(by.get(s.floor) ?? []), s]);
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }, [spaces]);
  const compact = size === 'compact';

  if (!spaces.length) {
    return <p className="muted bi-plan-empty">No spaces recorded for this building yet.</p>;
  }

  return (
    <div className={`bi-plan bi-plan--${size}`} role={compact ? 'img' : 'group'} aria-label={compact ? `${building.name}: ${floors.length} ${floors.length === 1 ? 'floor' : 'floors'}, ${spaces.length} spaces` : `Stacking plan of ${building.name}`}>
      {floors.map(([floor, list]) => (
        <div className="bi-plan-floor" key={floor}>
          {!compact && <span className="bi-plan-floor-label">{floors.length === 1 && building.floors === 1 ? 'Ground' : `Floor ${floor}`}</span>}
          <div className="bi-plan-row">
            {list.map((s) => {
              const st = spaceState(s);
              const t = s.tenantId ? tenant.get(s.tenantId) : undefined;
              const cls = `bi-space bi-space--${st} ${st === 'leased' ? `bi-tenant-${colors.get(s.tenantId!) ?? 0}` : ''} ${selectedId === s.id ? 'is-selected' : ''}`;
              const label = `${s.name}, ${st === 'leased' ? (t?.name ?? 'Tenant') : st === 'vacant' ? 'vacant' : 'common area'}, ${fmtArea(s.sqft)}`;
              const body = compact ? null : (
                <>
                  <span className="bi-space-name">{s.name}</span>
                  <span className="bi-space-tenant">{st === 'leased' ? t?.name : st === 'vacant' ? 'Vacant' : 'Common area'}</span>
                </>
              );
              return onSelect ? (
                <button
                  key={s.id}
                  type="button"
                  className={cls}
                  style={{ flexGrow: Math.max(1, s.sqft) }}
                  aria-pressed={selectedId === s.id}
                  aria-label={label}
                  title={label}
                  tabIndex={compact ? -1 : 0}
                  onClick={() => onSelect(s)}
                >
                  {body}
                </button>
              ) : (
                <span key={s.id} className={cls} style={{ flexGrow: Math.max(1, s.sqft) }} title={label}>
                  {body}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanLegend({ spaces, full }: { spaces: Space[]; full: boolean }) {
  const { tenant } = useLookup();
  const colors = useMemo(() => tenantColorIndex(spaces), [spaces]);
  return (
    <ul className="legend bi-plan-legend" aria-label="Legend">
      {full &&
        [...colors.entries()].map(([id, c]) => (
          <li key={id}>
            <span className={`legend-swatch bi-tenant-${c} bi-swatch`} />
            {tenant.get(id)?.name ?? 'Tenant'}
          </li>
        ))}
      {!full && (
        <li>
          <span className="legend-swatch bi-tenant-0 bi-swatch" />
          Leased (a colour per tenant)
        </li>
      )}
      <li>
        <span className="legend-swatch bi-space--vacant bi-swatch" />
        Vacant
      </li>
      <li>
        <span className="legend-swatch bi-space--common bi-swatch" />
        Common area
      </li>
    </ul>
  );
}

/** The selected space: tenant, lease, size and its feeds, each opening its own page. */
export function SpaceDetail({ space, onClose, showBuilding }: { space: Space; onClose?: () => void; showBuilding?: boolean }) {
  const { data } = useData();
  const { tenant, equipment, building } = useLookup();
  const { to } = useNav();
  const b = building.get(space.buildingId);
  const t = space.tenantId ? tenant.get(space.tenantId) : undefined;
  const interval = b ? isInterval(b.tierByUtility.electricity) : false;
  const power = spacePower(space, data.spaces, equipment, interval);
  const feeds = space.fedBy.map((id) => equipment.get(id)).filter(Boolean);
  const panels = data.equipment.filter((e) => e.kind === 'panel' && space.fedBy.includes(e.parentId ?? ''));
  const meters = data.meters.filter((m) => m.spaceId === space.id);
  const st = spaceState(space);
  return (
    <div className="card bi-space-detail" aria-live="polite">
      <div className="bi-space-detail-head">
        <div>
          {showBuilding && b && <div className="eyebrow">{b.name}</div>}
          <h3>{space.name}</h3>
        </div>
        {onClose && (
          <button type="button" className="icon-btn icon-btn--sm" aria-label="Clear selection" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </div>
      <dl className="dl">
        <dt>Tenant</dt>
        <dd>{t ? <Link to={to(`/people/tenants/${t.id}`)}>{t.name}</Link> : st === 'vacant' ? 'Vacant' : 'Common area'}</dd>
        {t && (
          <>
            <dt>Lease</dt>
            <dd>
              {fmtDate(space.leaseStart)} to {fmtDate(space.leaseEnd)}
            </dd>
          </>
        )}
        <dt>Size</dt>
        <dd>{fmtArea(space.sqft)}</dd>
        <dt>Area type</dt>
        <dd>
          {space.areaType}, floor {space.floor}
        </dd>
        <dt>Deliverable power</dt>
        <dd>{power.deliverableKw == null ? <span className="muted">Not surveyed</span> : fmtKw(power.deliverableKw)}</dd>
        <dt>Available power</dt>
        <dd>{power.availableKw != null ? <strong className="bi-available">{fmtKw(power.availableKw)}</strong> : power.deliverableKw != null ? <CapacityOnly /> : <span className="muted">—</span>}</dd>
      </dl>
      <p className="bi-detail-sub">Fed by</p>
      {feeds.length === 0 ? (
        <p className="muted">No services recorded for this space. A power survey would add them.</p>
      ) : (
        <ul className="bi-feed-list">
          {feeds.map((e) => (
            <li key={e!.id}>
              <Link to={to(`/building-info/equipment/${e!.id}`)}>{e!.name}</Link>
              <span className="muted">
                {' '}
                · {KIND_LABEL[e!.kind]} · {e!.ratings?.deliverableKw != null ? `${fmtKw(e!.ratings.deliverableKw)} deliverable` : 'rating missing'}
              </span>
            </li>
          ))}
          {panels.map((p) => (
            <li key={p.id}>
              <Link to={to(`/building-info/equipment/${p.id}`)}>{p.name}</Link>
              <span className="muted"> · Panel · {p.capacity ?? 'rating missing'}</span>
            </li>
          ))}
          {meters.map((m) => (
            <li key={m.id}>
              <Link to={to(`/building-info/meters/${m.id}`)}>{m.name}</Link>
              <span className="muted"> · Meter</span>
            </li>
          ))}
        </ul>
      )}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <Link className="btn btn--ghost btn--sm" to={to(`/building-info/buildings/${space.buildingId}?tab=power&space=${space.id}`)}>
          <Icon name="account_tree" /> Show in one-line diagram
        </Link>
        {showBuilding && (
          <Link className="btn btn--ghost btn--sm" to={to(`/building-info/buildings/${space.buildingId}?tab=spaces&space=${space.id}`)}>
            Open building spaces
          </Link>
        )}
      </div>
    </div>
  );
}
