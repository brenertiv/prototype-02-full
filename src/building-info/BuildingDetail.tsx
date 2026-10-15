/**
 * A building's page (MOD-BI-01, 08, 42): Overview, Spaces, Utilities, Power, Compliance and
 * Activity tabs, kept in `?tab=`. It opens whatever the scope (MOD-BI-40).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import type { Accolade, Building, Policy, Utility } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable, RecordTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ApiView, EmptyState, PageHeader, Pill, Section, StatusChip, Tabs, TierBadge, tierHelp, Traced, useTab } from '../ui/bits';
import { fmtArea, fmtDate, fmtMoney, fmtNum } from '../ui/format';
import { BuildingPowerTab } from './BuildingPower';
import { BuildingSpacesTab } from './BuildingSpaces';
import { BuildingUtilitiesTab } from './BuildingUtilities';
import { ActivityTab, NotFoundObject, Page, STAGE_LABEL, TODAY, UTIL, useLiveStatus, useRecordActivity } from './shared';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'power', label: 'Power' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'activity', label: 'Activity' },
];

export function BuildingDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { to } = useNav();
  const { status } = useLiveStatus();
  const tab = useTab(TABS);
  const q = useApi(`building-info/buildings/${id}`, () => data.buildings.find((b) => b.id === id) ?? null, [data.buildings, id]);
  if (q.status === 'ready' && !q.data) return <NotFoundObject what="building" backTo={to('/building-info/buildings')} backLabel="Back to buildings" />;
  return (
    <Page>
      <ApiView q={q} what="this building">
        {(b) =>
          !accessible.has(b.id) ? (
            <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />
          ) : (
            <>
              <PageHeader
                back={{ to: to('/building-info/buildings'), label: 'Buildings' }}
                eyebrow={`${b.type} building${b.nnn ? ' · tenant-controlled (NNN)' : ''}`}
                title={b.name}
                subtitle={`${b.address}, ${b.city}, ${b.state} ${b.zip}`}
                actions={
                  <>
                    <StatusChip status={status.get(b.id) ?? b.status} to={to(`/building-info/data-health?building=${b.id}`)} />
                    <TierBadge tier={b.tierByUtility.electricity} />
                  </>
                }
              />
              <Tabs label="Building views" tabs={TABS} />
              {tab === 'overview' && <OverviewTab b={b} />}
              {tab === 'spaces' && <BuildingSpacesTab b={b} />}
              {tab === 'utilities' && <BuildingUtilitiesTab b={b} />}
              {tab === 'power' && <BuildingPowerTab b={b} />}
              {tab === 'compliance' && <ComplianceTab b={b} />}
              {tab === 'activity' && <ActivityTab label="Building activity" filter={(a) => a.buildingId === b.id} />}
            </>
          )
        }
      </ApiView>
    </Page>
  );
}

/* ---------- Overview (MOD-BI-01, 08) ---------- */

function OverviewTab({ b }: { b: Building }) {
  const { data, getApp } = useData();
  const { mgmt } = useLookup();
  const { to } = useNav();
  const [editGfa, setEditGfa] = useState(false);
  const { status } = useLiveStatus();
  const confirmed = getApp<Record<string, { who: string; at: string }>>('bi.gfaConfirmed', {})[b.id];
  const items = useMemo(() => data.health.filter((h) => h.buildingId === b.id && h.status === 'open'), [data.health, b.id]);
  const families = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of items) m.set(h.family, (m.get(h.family) ?? 0) + 1);
    return [...m.entries()];
  }, [items]);
  const counts = useMemo(
    () => ({
      spaces: data.spaces.filter((s) => s.buildingId === b.id).length,
      equipment: data.equipment.filter((e) => e.buildingId === b.id).length,
      meters: data.meters.filter((m) => m.buildingId === b.id).length,
      accounts: data.accounts.filter((a) => a.buildingId === b.id).length,
      bills: data.bills.filter((x) => x.buildingId === b.id).length,
      files: data.files.filter((f) => f.buildingId === b.id).length,
    }),
    [data, b.id],
  );
  const met = b.goldStandard.filter((l) => l.state !== 'not-met').length;
  const mc = mgmt.get(b.managementCompanyId);
  const utilities = (Object.keys(b.sold) as Utility[]).filter((u) => b.sold[u]);
  const firstMeasure = `${b.historyMonths} months of history`;

  return (
    <>
      <div className="grid grid--3 bi-kpis">
        <div className="card">
          <h3>Data status</h3>
          <StatusChip status={status.get(b.id) ?? b.status} />
          {items.length === 0 ? (
            <p className="muted bi-card-p">No open data health items.</p>
          ) : (
            <ul className="bi-plain-list bi-card-p">
              {families.map(([f, n]) => (
                <li key={f}>
                  <Link to={to(`/building-info/data-health?building=${b.id}&family=${encodeURIComponent(f)}`)}>
                    {n} {f.toLowerCase()} {n === 1 ? 'item' : 'items'}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="text-btn" to={to(`/building-info/data-health?building=${b.id}`)}>
            Open in Data Health
          </Link>
        </div>
        <div className="card">
          <h3>Setup progress</h3>
          <p className="bi-big">{met} of 9 lines met</p>
          <ul className="bi-plain-list bi-card-p">
            {b.goldStandard
              .filter((l) => l.state !== 'met')
              .map((l) => (
                <li key={l.line}>
                  {l.state === 'exception' ? <Pill tone="neutral">Exception</Pill> : <Pill tone="warning">Not met</Pill>} {l.label}
                </li>
              ))}
          </ul>
          <Link className="text-btn" to={to(`/building-info/data-health?tab=setup&building=${b.id}`)}>
            See setup progress
          </Link>
        </div>
        <div className="card">
          <h3>Data tier per utility</h3>
          <ul className="bi-plain-list">
            {utilities.map((u) => (
              <li key={u} className="bi-tier-row">
                <span>{UTIL[u]}</span>
                {b.sold[u]?.sold ? (
                  b.sold[u]?.stage === 'live' ? (
                    <TierBadge tier={b.tierByUtility[u] ?? 0} />
                  ) : (
                    <Pill tone="info">{STAGE_LABEL[b.sold[u]!.stage ?? 'scoping']}</Pill>
                  )
                ) : (
                  <span className="muted">Not sold</span>
                )}
                <span className="cell-sub">{b.sold[u]?.sold ? tierHelp(b.tierByUtility[u] ?? 0) : 'Not in your contract; gaps are expected'}</span>
              </li>
            ))}
          </ul>
          <Link className="text-btn" to={to(`/building-info/buildings/${b.id}?tab=utilities`)}>
            Open utilities
          </Link>
        </div>
      </div>

      <Section title="Building record">
        <RecordTable
          label="Building record"
          rows={[
            ['Name', b.name],
            ['Address', b.address],
            ['City', b.city],
            ['State', b.state],
            ['ZIP', b.zip],
            ['Country', b.country],
            ['Type', b.type],
            ['Time zone', b.timezone],
            ['Latitude and longitude', `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`],
            ['Gross floor area', (
              <span className="bi-gfa">
                {b.gfa === null ? <Pill tone="warning" icon="error">Missing</Pill> : fmtArea(b.gfa)}
                <span className="cell-sub">{confirmed ? `Confirmed by ${confirmed.who} on ${fmtDate(confirmed.at)}` : 'From ENERGY STAR property details; not yet confirmed'}</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditGfa(true)}>
                  {b.gfa === null ? 'Add floor area' : 'Confirm or correct'}
                </button>
              </span>
            )],
            ['Year built', b.yearBuilt],
            ['Floors', b.floors],
            ['Site EUI', b.siteEui === null ? <span className="muted">Not measured</span> : (
              <Traced info={{ builtFrom: ['Annual site energy from bills and meters', 'Gross floor area'], period: 'Last 12 months', calculation: 'Site energy (kBtu) ÷ gross floor area (ft²)', coverage: `Benchmark for ${b.type.toLowerCase()} buildings: ${b.euiBenchmark} kBtu/ft²` }}>
                {fmtNum(b.siteEui, 0)} kBtu/ft²
              </Traced>
            )],
            ['Emission factor', `${fmtNum(b.energyKwh ? ((b.emissions.scope2 + b.emissions.scope1) / b.energyKwh) * 1000 : 0.35, 3)} tCO₂e per MWh (location-based)`],
            ['Integration date', `${fmtDate(b.integrationDate)} (${firstMeasure})`],
            ['Management company', mc ? (
              <Link to={to(`/people/partners?filter=management-companies`)}>{mc.name}</Link>
            ) : '—'],
            ['Data scope', `${counts.spaces} spaces, utilities ${utilities.filter((u) => b.sold[u]?.sold).map((u) => UTIL[u].toLowerCase()).join(', ')}, ${counts.meters} meters`],
          ]}
        />
      </Section>

      <Section title="Records behind this building">
        <RecordTable
          label="Record counts"
          rows={[
            ['Spaces', <Link to={to(`/building-info/buildings/${b.id}?tab=spaces`)}>{counts.spaces}</Link>],
            ['Equipment and electrical gear', <Link to={to(`/building-info/equipment?building=${b.id}`)}>{counts.equipment}</Link>],
            ['Meters', <Link to={to(`/building-info/meters?building=${b.id}`)}>{counts.meters}</Link>],
            ['Utility accounts', <Link to={to(`/building-info/bills?view=accounts&building=${b.id}`)}>{counts.accounts}</Link>],
            ['Bills', <Link to={to(`/building-info/bills?building=${b.id}`)}>{counts.bills}</Link>],
            ['Files', <Link to={to(`/building-info/files?building=${b.id}`)}>{counts.files}</Link>],
          ]}
        />
      </Section>
      {editGfa && <GfaModal b={b} onClose={() => setEditGfa(false)} />}
    </>
  );
}

/** Confirm or correct square footage (Gold Standard line 7, MOD-BI-01). */
function GfaModal({ b, onClose }: { b: Building; onClose: () => void }) {
  const { patch, setApp, getApp, user, data } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [value, setValue] = useState(b.gfa === null ? '' : String(b.gfa));
  const n = Number(value.replace(/,/g, ''));
  const valid = value.trim() !== '' && Number.isFinite(n) && n > 0;
  const save = (confirmOnly: boolean) => {
    if (!confirmOnly) patch('buildings', b.id, { gfa: n });
    setApp('bi.gfaConfirmed', { ...getApp<Record<string, unknown>>('bi.gfaConfirmed', {}), [b.id]: { who: user.name, at: TODAY } });
    if (b.gfa === null || !confirmOnly) {
      const gl = b.goldStandard.map((l) => (l.line === 7 ? { ...l, state: 'met' as const } : l));
      patch('buildings', b.id, { goldStandard: gl });
      data.health.filter((h) => h.buildingId === b.id && h.problem === 'Square footage missing' && h.status === 'open').forEach((h) => patch('health', h.id, { status: 'resolved', lastChecked: TODAY }));
    }
    record({ kind: 'building', id: b.id, label: b.name }, confirmOnly ? 'Gross floor area confirmed' : `Gross floor area set to ${n.toLocaleString('en-US')} ft²`, b.id);
    toast(confirmOnly ? 'Floor area confirmed.' : 'Floor area updated.');
    onClose();
  };
  return (
    <Modal
      title="Gross floor area"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          {b.gfa !== null && String(b.gfa) === value && (
            <button type="button" className="btn" onClick={() => save(true)}>
              Confirm {fmtArea(b.gfa)}
            </button>
          )}
          {(b.gfa === null || String(b.gfa) !== value) && (
            <button type="button" className="btn" disabled={!valid} onClick={() => save(false)}>
              Save correction
            </button>
          )}
        </>
      }
    >
      <p className="bi-modal-lead">Floor area drives intensity, compliance exposure and ENERGY STAR. Confirm the figure on record, or correct it.</p>
      <label className="field">
        <span>Gross floor area (ft²)</span>
        <input type="text" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </label>
    </Modal>
  );
}

/* ---------- Compliance (MOD-BI-30, 31) ---------- */

function ComplianceTab({ b }: { b: Building }) {
  const { data } = useData();
  const policies = data.policies.filter((p) => p.buildingId === b.id);
  const accolades = data.accolades.filter((a) => a.buildingId === b.id);
  const { to } = useNav();
  const fileFor = (a: Accolade) => data.files.find((f) => f.buildingId === b.id && f.category === 'Certificate' && f.name.startsWith(a.name));
  return (
    <>
      <Section title="Policies" description="Benchmarking and building performance laws that apply to this building. Exposure in dollars is in Workspace.">
        <DataTable<Policy>
          label="Policies"
          rows={policies}
          rowKey={(p) => p.id}
          empty={{ title: 'No benchmarking or performance laws on record', body: `None are recorded for ${b.city}, ${b.state}.`, icon: 'gavel' }}
          columns={[
            { key: 'name', header: 'Policy', value: (p) => p.name },
            { key: 'type', header: 'Type', value: (p) => (p.type === 'BPS' ? 'Performance standard' : 'Benchmarking') },
            { key: 'where', header: 'Jurisdiction', value: (p) => `${p.city}, ${p.state}`, hideOnPhone: true },
            { key: 'year', header: 'Enacted', value: (p) => p.yearEnacted, hideOnPhone: true },
            { key: 'applicable', header: 'Applies', value: (p) => (p.applicable ? 'Yes' : 'No'), render: (p) => (p.applicable ? 'Yes' : <span className="muted">No, under the size threshold</span>) },
            { key: 'verified', header: 'Verified', value: (p) => (p.verified ? 'Yes' : 'No'), hideOnPhone: true },
            { key: 'period', header: 'Compliance period', value: (p) => p.compliancePeriod, hideOnPhone: true },
            { key: 'deadline', header: 'Deadline', value: (p) => p.deadline, render: (p) => fmtDate(p.deadline) },
            { key: 'submission', header: 'Submission', value: (p) => p.submission, render: (p) => <Pill tone={p.submission === 'Overdue' ? 'danger' : p.submission === 'Submitted' ? 'success' : p.submission === 'Due' ? 'warning' : 'neutral'}>{p.submission}</Pill> },
            { key: 'exposure', header: 'Exposure', value: (p) => p.exposure, align: 'right' as const, render: (p) => (p.type === 'BPS' ? fmtMoney(p.exposure, true) : <span className="muted">—</span>), hideOnPhone: true },
          ]}
        />
      </Section>
      <Section title="Accolades" description="Certifications and ratings this building holds. Their files are also listed in Files.">
        <DataTable<Accolade>
          label="Accolades"
          rows={accolades}
          rowKey={(a) => a.id}
          empty={{ title: 'No accolades on record', body: 'LEED, ENERGY STAR certification, BREEAM and similar awards show here once added.', icon: 'workspace_premium' }}
          columns={[
            { key: 'name', header: 'Accolade', value: (a) => a.name },
            { key: 'type', header: 'Type', value: (a) => a.type },
            { key: 'level', header: 'Level', value: (a) => a.level },
            { key: 'score', header: 'Score', value: (a) => a.score, align: 'right' as const },
            { key: 'awarded', header: 'Awarded', value: (a) => a.awarded, render: (a) => fmtDate(a.awarded) },
            { key: 'expiry', header: 'Expires', value: (a) => a.expiry, render: (a) => (a.expiry && a.expiry < TODAY ? <Pill tone="warning">Expired {fmtDate(a.expiry)}</Pill> : fmtDate(a.expiry)) },
            { key: 'source', header: 'Source', value: (a) => a.source, hideOnPhone: true },
            {
              key: 'file',
              header: 'Attachment',
              render: (a) => {
                const f = fileFor(a);
                return f ? (
                  <Link to={to(`/building-info/files/${f.id}`)} className="inline">
                    <Icon name="description" /> {f.fileType}
                  </Link>
                ) : (
                  <span className="muted">None</span>
                );
              },
              hideOnPhone: true,
            },
          ]}
        />
      </Section>
    </>
  );
}
