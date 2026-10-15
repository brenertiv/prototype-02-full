/**
 * Building › Spaces (MOD-BI-02, 03, 73): the stacking plan with the selected space's tenant,
 * lease and feeds; the spaces table; and occupancy hours, a weekly grid plus one-off exceptions.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import type { Building, OccupancyDay, Space } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { useToast } from '../ui/Toast';
import { EmptyState, Section } from '../ui/bits';
import { fmtArea, fmtDate } from '../ui/format';
import { fmtKw, isInterval, spacePower, TODAY, useRecordActivity } from './shared';
import { PlanLegend, SpaceDetail, spaceState, StackingPlan } from './StackingPlan';

export function BuildingSpacesTab({ b }: { b: Building }) {
  const { data } = useData();
  const { tenant, equipment } = useLookup();
  const [params, setParams] = useSearchParams();
  const { to } = useNav();
  const spaces = useMemo(() => data.spaces.filter((s) => s.buildingId === b.id), [data.spaces, b.id]);
  const selectedId = params.get('space');
  const selected = spaces.find((s) => s.id === selectedId) ?? null;
  const interval = isInterval(b.tierByUtility.electricity);
  const select = useCallback(
    (s: Space | null) => {
      const next = new URLSearchParams(params);
      if (s && s.id !== selectedId) next.set('space', s.id);
      else next.delete('space');
      setParams(next, { replace: true });
    },
    [params, selectedId, setParams],
  );
  const counts = useMemo(() => {
    const eq = new Map<string, number>();
    const mt = new Map<string, number>();
    for (const e of data.equipment) if (e.spaceId) eq.set(e.spaceId, (eq.get(e.spaceId) ?? 0) + 1);
    for (const m of data.meters) if (m.spaceId) mt.set(m.spaceId, (mt.get(m.spaceId) ?? 0) + 1);
    return { eq, mt };
  }, [data.equipment, data.meters]);

  return (
    <>
      <Section title="Stacking plan" description="Floors from the ground up, each space sized by its area and coloured by tenant. Select a space to see its lease and what feeds it.">
        {spaces.length === 0 ? (
          <EmptyState icon="stacks" title="No spaces recorded yet" body="Spaces come from the building survey and the tenant records in People. Enertiv adds them during setup." />
        ) : (
          <div className="bi-plan-layout">
            <div className="card">
              <StackingPlan building={b} spaces={spaces} size="large" selectedId={selectedId} onSelect={select} />
              <PlanLegend spaces={spaces} full />
            </div>
            <aside className="bi-plan-aside">{selected ? <SpaceDetail space={selected} onClose={() => select(null)} /> : <p className="muted card card--sunken">Select a space to see its tenant, lease dates, size and the services and panels that feed it.</p>}</aside>
          </div>
        )}
      </Section>

      <Section title="Spaces">
        <DataTable<Space>
          label="Spaces"
          rows={spaces}
          rowKey={(s) => s.id}
          selectedKey={selectedId}
          caption={`${spaces.length} spaces, ${fmtArea(spaces.reduce((a, s) => a + s.sqft, 0))} in total.`}
          initialSort={{ key: 'floor', dir: 'desc' }}
          empty={{ title: 'No spaces recorded yet', icon: 'stacks' }}
          columns={[
            {
              key: 'name',
              header: 'Space',
              value: (s) => s.name,
              render: (s) => (
                <button type="button" className="bi-link-btn" aria-pressed={s.id === selectedId} onClick={() => select(s)}>
                  {s.name}
                </button>
              ),
            },
            { key: 'floor', header: 'Floor', value: (s) => s.floor, align: 'right' as const },
            { key: 'area', header: 'Area type', value: (s) => s.areaType, hideOnPhone: true },
            { key: 'size', header: 'Size', value: (s) => s.sqft, align: 'right' as const, render: (s) => fmtArea(s.sqft) },
            { key: 'capacity', header: 'Capacity', value: (s) => s.capacity, align: 'right' as const, hideOnPhone: true, render: (s) => (s.capacity ? `${s.capacity} people` : '—') },
            {
              key: 'tenant',
              header: 'Tenant',
              value: (s) => (s.tenantId ? tenant.get(s.tenantId)?.name ?? '' : ''),
              render: (s) => (s.tenantId ? <Link to={to(`/people/tenants/${s.tenantId}`)}>{tenant.get(s.tenantId)?.name}</Link> : <span className="muted">{spaceState(s) === 'vacant' ? 'Vacant' : 'Common area'}</span>),
            },
            { key: 'start', header: 'Lease start', value: (s) => s.leaseStart, render: (s) => fmtDate(s.leaseStart), hideOnPhone: true },
            { key: 'end', header: 'Lease end', value: (s) => s.leaseEnd, render: (s) => fmtDate(s.leaseEnd), hideOnPhone: true },
            { key: 'kw', header: 'Deliverable power', align: 'right' as const, value: (s) => spacePower(s, data.spaces, equipment, interval).deliverableKw, render: (s) => fmtKw(spacePower(s, data.spaces, equipment, interval).deliverableKw), hideOnPhone: true },
            { key: 'eq', header: 'Equipment', value: (s) => counts.eq.get(s.id) ?? 0, align: 'right' as const, hideOnPhone: true },
            { key: 'mt', header: 'Meters', value: (s) => counts.mt.get(s.id) ?? 0, align: 'right' as const, hideOnPhone: true },
          ]}
        />
      </Section>

      <OccupancyHours b={b} />
    </>
  );
}

/* ---------- Occupancy hours (MOD-BI-03) ---------- */

interface OccException {
  id: string;
  date: string;
  label: string;
  closed: boolean;
  from: string | null;
  to: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_WEEK: OccupancyDay[] = DAYS.map((day, k) => ({ day, from: k < 5 ? '07:00' : null, to: k < 5 ? '19:00' : null, semiFrom: null, semiTo: null }));

function OccupancyHours({ b }: { b: Building }) {
  const { data, patch, getApp, setApp } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OccupancyDay[]>(b.occupancyHours ?? DEFAULT_WEEK);
  const all = getApp<Record<string, OccException[]>>('bi.occExceptions', {});
  const exceptions = (all[b.id] ?? []).slice().sort((x, y) => x.date.localeCompare(y.date));
  const [exDate, setExDate] = useState('');
  const [exLabel, setExLabel] = useState('');
  const [exClosed, setExClosed] = useState(true);
  const [exFrom, setExFrom] = useState('09:00');
  const [exTo, setExTo] = useState('14:00');

  const setDay = (k: number, field: keyof OccupancyDay, v: string | null) => setDraft((d) => d.map((x, i) => (i === k ? { ...x, [field]: v } : x)));
  const save = () => {
    patch('buildings', b.id, { occupancyHours: draft });
    data.health.filter((h) => h.buildingId === b.id && h.problem === 'Occupancy hours not set' && h.status === 'open').forEach((h) => patch('health', h.id, { status: 'resolved', lastChecked: TODAY }));
    record({ kind: 'building', id: b.id, label: b.name }, 'Occupancy hours updated', b.id);
    toast('Occupancy hours saved. Energy baselines use them from today.');
    setEditing(false);
  };
  const addException = () => {
    if (!exDate || !exLabel.trim()) return;
    const ex: OccException = { id: `occ-${Date.now()}`, date: exDate, label: exLabel.trim(), closed: exClosed, from: exClosed ? null : exFrom, to: exClosed ? null : exTo };
    setApp('bi.occExceptions', { ...all, [b.id]: [...(all[b.id] ?? []), ex] });
    record({ kind: 'building', id: b.id, label: b.name }, `Occupancy exception added: ${ex.label} on ${fmtDate(ex.date)}`, b.id);
    setExDate('');
    setExLabel('');
  };
  const removeException = (id: string) => {
    setApp('bi.occExceptions', { ...all, [b.id]: (all[b.id] ?? []).filter((e) => e.id !== id) });
  };
  const hours = editing ? draft : b.occupancyHours;
  const fmtRange = (f?: string | null, t?: string | null) => (f && t ? `${f} to ${t}` : <span className="muted">Closed</span>);

  return (
    <Section
      title="Occupancy hours"
      description="The building's standing weekly hours set its energy baselines and after-hours insights. Add exceptions for holidays and closures."
      actions={
        hours && !editing ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setDraft(b.occupancyHours ?? DEFAULT_WEEK);
              setEditing(true);
            }}
          >
            <Icon name="edit" /> Edit hours
          </button>
        ) : undefined
      }
    >
      {!hours ? (
        <EmptyState
          icon="schedule"
          title="Occupancy hours aren't set"
          body="Until they are, baselines and after-hours insights use a default 7am to 7pm weekday schedule."
          action={
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraft(DEFAULT_WEEK);
                setEditing(true);
              }}
            >
              Set hours
            </button>
          }
        />
      ) : (
        <>
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">Weekly occupancy hours</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Occupied</th>
                  <th scope="col">Semi-occupied</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((d, k) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
                    <td>
                      {editing ? (
                        <span className="bi-time-pair">
                          <label className="check">
                            <input type="checkbox" checked={!d.from} onChange={(e) => (e.target.checked ? (setDay(k, 'from', null), setDay(k, 'to', null)) : (setDay(k, 'from', '07:00'), setDay(k, 'to', '19:00')))} />
                            <span>Closed</span>
                          </label>
                          {d.from && (
                            <>
                              <input type="time" aria-label={`${d.day} occupied from`} value={d.from ?? ''} onChange={(e) => setDay(k, 'from', e.target.value)} />
                              <span>to</span>
                              <input type="time" aria-label={`${d.day} occupied to`} value={d.to ?? ''} onChange={(e) => setDay(k, 'to', e.target.value)} />
                            </>
                          )}
                        </span>
                      ) : (
                        fmtRange(d.from, d.to)
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <span className="bi-time-pair">
                          <input type="time" aria-label={`${d.day} semi-occupied from`} value={d.semiFrom ?? ''} onChange={(e) => setDay(k, 'semiFrom', e.target.value || null)} />
                          <span>to</span>
                          <input type="time" aria-label={`${d.day} semi-occupied to`} value={d.semiTo ?? ''} onChange={(e) => setDay(k, 'semiTo', e.target.value || null)} />
                        </span>
                      ) : d.semiFrom && d.semiTo ? (
                        `${d.semiFrom} to ${d.semiTo}`
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing && (
            <div className="btn-row bi-gap-top">
              <button type="button" className="btn" onClick={save}>
                Save hours
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      <h3 className="bi-subhead">Exceptions</h3>
      {exceptions.length === 0 ? (
        <p className="muted">No exceptions. Holidays and closures you add here override the weekly hours for that day.</p>
      ) : (
        <ul className="list bi-gap-bottom">
          {exceptions.map((e) => (
            <li key={e.id}>
              <div className="list-item-main">
                <span className="list-item-title">{e.label}</span>
                <span className="cell-sub">
                  {fmtDate(e.date)} · {e.closed ? 'Closed all day' : `Open ${e.from} to ${e.to}`}
                </span>
              </div>
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${e.label}`} onClick={() => removeException(e.id)}>
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="card card--sunken bi-exception-form">
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Name</span>
            <input type="text" placeholder="Thanksgiving" value={exLabel} onChange={(e) => setExLabel(e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={exClosed} onChange={(e) => setExClosed(e.target.checked)} />
          <span>Closed all day</span>
        </label>
        {!exClosed && (
          <span className="bi-time-pair">
            <input type="time" aria-label="Exception open from" value={exFrom} onChange={(e) => setExFrom(e.target.value)} />
            <span>to</span>
            <input type="time" aria-label="Exception open to" value={exTo} onChange={(e) => setExTo(e.target.value)} />
          </span>
        )}
        <div className="btn-row bi-gap-top">
          <button type="button" className="btn btn--ghost btn--sm" disabled={!exDate || !exLabel.trim()} onClick={addException}>
            <Icon name="add" /> Add exception
          </button>
        </div>
      </div>
    </Section>
  );
}
