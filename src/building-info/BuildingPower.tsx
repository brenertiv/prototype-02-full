/**
 * Building › Power (MOD-BI-04, 70 to 82): deliverable power computed from the services' ratings,
 * available power only where demand is measured (MOD-BI-71), the services record with verified
 * dates and not-observable values (MOD-BI-72), gas service (MOD-BI-75), exports (MOD-BI-74) and
 * the one-line diagram. Not surveyed shows the survey as the fix (ST-Q07).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import { hashString, makeRng } from '../data/rand';
import type { Building, Equipment } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { useToast } from '../ui/Toast';
import { EmptyState, Kpi, NotObservable, Section, Traced } from '../ui/bits';
import { fmtDate } from '../ui/format';
import { OneLineDiagram } from './OneLineDiagram';
import { CapacityOnly, fmtKw, nextTierUnlock, powerFor, TODAY, useRecordActivity } from './shared';

export function BuildingPowerTab({ b }: { b: Building }) {
  const { data } = useData();
  const { equipment: eqMap } = useLookup();
  const { to } = useNav();
  const toast = useToast();
  const record = useRecordActivity();
  const power = useMemo(() => powerFor(b, data.equipment), [b, data.equipment]);
  const spacesBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of data.spaces.filter((x) => x.buildingId === b.id)) for (const f of s.fedBy) m.set(f, [...(m.get(f) ?? []), s.name]);
    return m;
  }, [data.spaces, b.id]);
  const meterFor = useMemo(() => new Map(data.meters.filter((m) => m.feedsEquipmentId).map((m) => [m.feedsEquipmentId!, m])), [data.meters]);

  if (b.powerSurveyed === 'not-surveyed') {
    return (
      <EmptyState
        icon="electrical_services"
        title="Power capacity hasn't been surveyed"
        body="Deliverable power and the one-line diagram come from a survey of the building's electrical services: transformers, services, panels and the spaces they feed. Book a power survey and Enertiv's field team records every nameplate, with photos."
        action={
          <button
            type="button"
            className="btn"
            onClick={() => {
              record({ kind: 'building', id: b.id, label: b.name }, 'Power survey requested', b.id);
              toast('Power survey requested. Your Enertiv account team will schedule the visit.');
            }}
          >
            Request a power survey
          </button>
        }
      />
    );
  }

  const unlock = nextTierUnlock(b.tierByUtility.electricity ?? 0);
  const exportCsv = () => {
    const head = ['Property ID', 'Building', 'Service ID', 'Service', 'Transformer', 'kVA', 'Amperage (A)', 'Voltage', 'Phases', 'Deliverable (kW)', 'Available (kW)', 'Spaces served', 'Verified', 'Not observable'];
    const rows = power.services.map((s) => {
      const tx = s.parentId ? eqMap.get(s.parentId) : undefined;
      return [b.pmPropertyId ?? '', b.name, s.id, s.name, tx?.name ?? '', tx?.ratings?.kva ?? '', s.ratings?.amps ?? '', s.ratings?.voltage ?? '', s.ratings?.phases ?? '', s.ratings?.deliverableKw ?? '', power.interval ? s.ratings?.availableKw ?? '' : '', (spacesBy.get(s.id) ?? []).join('; '), s.surveyedAt ?? '', s.notObservable ? `${s.notObservable.field}: ${s.notObservable.reason}` : ''];
    });
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.name} power record.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {power.unverified.length > 0 && (
        <div className="banner banner--warning">
          <Icon name="warning" />
          <div>
            <strong>{power.unverified.length === 1 ? '1 service is unverified' : `${power.unverified.length} services are unverified`}:</strong> {power.unverified.map((s) => s.name).join(', ')}. Deliverable power for the building leaves {power.unverified.length === 1 ? 'it' : 'them'} out until a return visit or the utility confirms the rating.
          </div>
        </div>
      )}
      <div className="grid grid--kpis bi-kpis">
        <Kpi
          label="Deliverable power"
          value={
            power.deliverableKw == null ? (
              <span className="muted bi-kpi-none">Ratings missing</span>
            ) : (
              <Traced info={{ builtFrom: power.services.map((s) => `${s.name}: ${s.ratings?.deliverableKw != null ? fmtKw(s.ratings.deliverableKw) : s.notObservable ? 'not observable' : 'rating missing'}`), calculation: 'Per service: amperage × voltage × √3 × 0.8 power factor; summed across services', coverage: power.unverified.length ? `Unverified: ${power.unverified.map((s) => s.name).join(', ')}` : 'Every service verified' }}>
                {fmtKw(power.deliverableKw)}
              </Traced>
            )
          }
          sub={`${power.services.length} ${power.services.length === 1 ? 'service' : 'services'}, from nameplate ratings`}
        />
        <Kpi
          label="Available power"
          value={
            power.availableKw != null ? (
              <Traced info={{ builtFrom: ['Deliverable power per service', 'Measured peak demand from 15-minute interval data, last 12 months'], period: `As of ${fmtDate(TODAY)}`, calculation: 'Deliverable power − measured peak demand' }}>
                <span className="bi-available">{fmtKw(power.availableKw)}</span>
              </Traced>
            ) : (
              <CapacityOnly />
            )
          }
          sub={power.availableKw != null ? `As of ${fmtDate(TODAY)}` : unlock ? `${unlock.next} would add measured demand` : 'Needs measured demand'}
        />
        <Kpi label="Survey" value={<span className="bi-kpi-small">{b.powerSurveyed === 'missing-ratings' ? 'Services missing ratings' : power.unverified.length ? 'Surveyed, with values not observable' : 'Every service rated'}</span>} sub={`Last visit ${fmtDate(power.services.map((s) => s.surveyedAt ?? '').sort().reverse()[0] || null)}`} />
      </div>

      <Section
        title="One-line diagram"
        description="Generated from the record below, not drawn: correct the record and the diagram follows."
      >
        <OneLineDiagram b={b} />
      </Section>

      <Section
        title="Electrical services"
        actions={
          <button type="button" className="btn btn--ghost btn--sm" onClick={exportCsv}>
            <Icon name="download" /> Export record
          </button>
        }
      >
        <DataTable<Equipment>
          label="Electrical services"
          rows={power.services}
          rowKey={(s) => s.id}
          rowHref={(s) => to(`/building-info/equipment/${s.id}`)}
          caption="One row per service connection. Values come from the survey; edits overwrite them and show who changed them."
          columns={[
            { key: 'name', header: 'Service', value: (s) => s.name },
            { key: 'provider', header: 'Provider', value: (s) => s.ratings?.provider ?? '', hideOnPhone: true },
            { key: 'feed', header: 'Feed type', value: (s) => s.ratings?.feedType ?? '', hideOnPhone: true },
            { key: 'feeds', header: 'Feeds', value: (s) => s.ratings?.feeds ?? null, align: 'right' as const, hideOnPhone: true },
            { key: 'redundancy', header: 'Redundancy', value: (s) => s.ratings?.redundancy ?? '', hideOnPhone: true },
            { key: 'tx', header: 'Transformer', value: (s) => (s.parentId ? eqMap.get(s.parentId)?.name ?? '' : ''), render: (s) => (s.parentId ? <Link to={to(`/building-info/equipment/${s.parentId}`)}>{eqMap.get(s.parentId)?.name}</Link> : '—') },
            {
              key: 'kva',
              header: 'kVA',
              align: 'right' as const,
              value: (s) => (s.parentId ? eqMap.get(s.parentId)?.ratings?.kva ?? null : null),
              render: (s) => {
                const tx = s.parentId ? eqMap.get(s.parentId) : undefined;
                return tx?.ratings?.kva != null ? tx.ratings.kva.toLocaleString('en-US') : <span className="bi-missing">Missing</span>;
              },
            },
            { key: 'amps', header: 'Amperage', align: 'right' as const, value: (s) => s.ratings?.amps ?? null, render: (s) => (s.ratings?.amps != null ? `${s.ratings.amps.toLocaleString('en-US')} A` : <span className="bi-missing">Missing</span>) },
            { key: 'volts', header: 'Voltage', value: (s) => s.ratings?.voltage ?? '', hideOnPhone: true },
            { key: 'phases', header: 'Phases', value: (s) => s.ratings?.phases ?? null, align: 'right' as const, hideOnPhone: true },
            {
              key: 'meter',
              header: 'Meter account',
              value: (s) => s.ratings?.meterAccount ?? '',
              render: (s) => {
                const m = meterFor.get(s.id);
                return m ? <Link to={to(`/building-info/meters/${m.id}`)}>{s.ratings?.meterAccount}</Link> : s.ratings?.meterAccount ?? '—';
              },
              hideOnPhone: true,
            },
            { key: 'spaces', header: 'Spaces served', value: (s) => (spacesBy.get(s.id) ?? []).join(', '), render: (s) => (spacesBy.get(s.id) ?? []).join(', ') || <span className="muted">None recorded</span> },
            { key: 'deliverable', header: 'Deliverable', align: 'right' as const, value: (s) => s.ratings?.deliverableKw ?? null, render: (s) => (s.ratings?.deliverableKw != null ? fmtKw(s.ratings.deliverableKw) : <span className="bi-missing">Not verified</span>) },
            { key: 'available', header: 'Available', align: 'right' as const, value: (s) => (power.interval ? s.ratings?.availableKw ?? null : null), render: (s) => (power.interval && s.ratings?.availableKw != null ? <span className="bi-available">{fmtKw(s.ratings.availableKw)}</span> : <CapacityOnly />) },
            { key: 'verified', header: 'Verified', value: (s) => s.editedBy?.at ?? s.surveyedAt, render: (s) => (s.editedBy ? `${fmtDate(s.editedBy.at)}, ${s.editedBy.who}` : fmtDate(s.surveyedAt)), hideOnPhone: true },
            { key: 'no', header: 'Not observable', value: (s) => s.notObservable?.field ?? '', render: (s) => (s.notObservable ? <span><NotObservable reason={s.notObservable.reason} /> <span className="cell-sub">{s.notObservable.field}</span></span> : <span className="muted">None</span>) },
          ]}
        />
      </Section>

      <GasService b={b} />
    </>
  );
}

function GasService({ b }: { b: Building }) {
  const { data } = useData();
  const gasAcct = data.accounts.find((a) => a.buildingId === b.id && a.utility === 'gas');
  const gasMeter = data.meters.find((m) => m.buildingId === b.id && m.utility === 'gas' && m.kind === 'enertiv');
  const rng = makeRng(hashString(`${b.id}-gas`));
  const pipe = rng.pick(['Steel', 'Polyethylene', 'Cast iron']);
  const pressure = rng.pick([0.25, 2, 5, 60]);
  const diameter = rng.pick([1.25, 2, 3, 4]);
  const pressureNo = rng.chance(0.25);
  const surveyed = data.equipment.find((e) => e.buildingId === b.id && e.kind === 'service')?.surveyedAt ?? null;
  return (
    <Section title="Gas service">
      {!b.sold.gas?.sold && !gasAcct ? (
        <p className="muted">No gas service on record for this building.</p>
      ) : (
        <div className="table-scroll" role="region" aria-label="Gas service">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Meter number</th>
                <th scope="col">Pressure</th>
                <th scope="col">Pipe diameter</th>
                <th scope="col">Pipe type</th>
                <th scope="col">Verified</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{gasAcct?.provider ?? '—'}</td>
                <td>{gasMeter ? `G-${String(hashString(gasMeter.id)).slice(0, 8)}` : '—'}</td>
                <td>{pressureNo ? <NotObservable reason="Regulator label unreadable; utility confirmation needed" /> : `${pressure} psig`}</td>
                <td>{diameter} in</td>
                <td>{pipe}</td>
                <td>{fmtDate(surveyed)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
