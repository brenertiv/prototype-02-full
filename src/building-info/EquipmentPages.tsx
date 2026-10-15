/**
 * Equipment (MOD-BI-50, 44, 20, 21, 52, 53): every piece of equipment and electrical gear in
 * scope, and a page per item with its nameplate, condition and end of life, data (tier 2b and 3),
 * files, alerts and alert rules (tier 3) and activity. Edits overwrite surveyed values behind a
 * destructive warning, and then show who changed them and when.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import { loadProfile } from '../data/series';
import type { Alert, AlertRule, Building, Equipment, FileRec } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { LineChart } from '../ui/charts';
import { DataTable, RecordTable } from '../ui/DataTable';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ApiView, EmptyState, NotObservable, PageHeader, Pill, Section, SelectFilter, SeverityPill, Tabs, TierBadge, useTab } from '../ui/bits';
import { fmtDate } from '../ui/format';
import { ActivityTab, BuildingFilter, coverCaption, fmtKw, isInterval, KIND_LABEL, nextTierUnlock, NotFoundObject, Page, TODAY, Toolbar, useParamFilter, useRecordActivity, useScoped } from './shared';

const CONDITIONS: NonNullable<Equipment['condition']>[] = ['Good', 'Fair', 'Poor', 'Critical'];

export function ConditionPill({ c }: { c: Equipment['condition'] }) {
  if (!c) return <span className="muted">Not assessed</span>;
  return (
    <Pill tone={c === 'Good' ? 'success' : c === 'Fair' ? 'neutral' : c === 'Poor' ? 'warning' : 'danger'} icon={c === 'Good' ? 'check_circle' : c === 'Critical' ? 'error' : undefined}>
      {c}
    </Pill>
  );
}

/* ---------- List ---------- */

export function EquipmentPage() {
  const { data } = useData();
  const { building, space } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const [fb, setFb] = useParamFilter('building');
  const [fk, setFk] = useParamFilter('kind');
  const [ft, setFt] = useParamFilter('type');
  const [fc, setFc] = useParamFilter('condition');
  const [fs, setFs] = useParamFilter('source');
  const [fa, setFa] = useParamFilter('alerts');
  const [adding, setAdding] = useState(false);
  const q = useApi(`building-info/equipment/${scope.id}`, () => data.equipment.filter((e) => ids.has(e.buildingId)), [data.equipment, ids]);
  const ruleSet = useMemo(() => new Set(data.alertRules.map((r) => r.equipmentId)), [data.alertRules]);
  const openAlerts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of data.alerts) if (!a.resolved) m.set(a.equipmentId, (m.get(a.equipmentId) ?? 0) + 1);
    return m;
  }, [data.alerts]);
  const all = q.data ?? [];
  const types = useMemo(() => [...new Set(all.map((e) => e.type).filter(Boolean) as string[])].sort(), [all]);
  const rows = all.filter(
    (e) =>
      (fb === 'all' || e.buildingId === fb) &&
      (fk === 'all' || (fk === 'gear' ? e.kind !== 'equipment' : e.kind === fk)) &&
      (ft === 'all' || (ft === 'none' ? !e.type : e.type === ft)) &&
      (fc === 'all' || (fc === 'none' ? !e.condition : e.condition === fc)) &&
      (fs === 'all' || e.dataSource === fs) &&
      (fa === 'all' || (fa === 'open' ? (openAlerts.get(e.id) ?? 0) > 0 : ruleSet.has(e.id))),
  );
  return (
    <Page>
      <PageHeader
        title="Equipment"
        subtitle="Every piece of equipment and electrical gear in scope, from the building surveys. Open one for its nameplate, condition, files and, where monitored, its data and alerts."
        actions={
          <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)} disabled={!buildings.length}>
            <Icon name="add" /> Add equipment
          </button>
        }
      />
      <ApiView q={q} what="equipment">
        {() => (
          <>
            <Toolbar>
              <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
              <SelectFilter label="Kind" value={fk} onChange={setFk} options={[{ value: 'all', label: 'Equipment and gear' }, { value: 'equipment', label: 'Equipment' }, { value: 'gear', label: 'Electrical gear' }, { value: 'service', label: 'Services' }, { value: 'transformer', label: 'Transformers' }, { value: 'panel', label: 'Panels' }]} />
              <SelectFilter label="Type" value={ft} onChange={setFt} options={[{ value: 'all', label: 'Any type' }, ...types.map((t) => ({ value: t, label: t })), { value: 'none', label: 'No type' }]} />
              <SelectFilter label="Condition" value={fc} onChange={setFc} options={[{ value: 'all', label: 'Any condition' }, ...CONDITIONS.map((c) => ({ value: c, label: c })), { value: 'none', label: 'Not assessed' }]} />
              <SelectFilter label="Data source" value={fs} onChange={setFs} options={[{ value: 'all', label: 'Any source' }, ...['Survey', 'BMS', 'Enertiv sensors', 'None'].map((s) => ({ value: s, label: s }))]} />
              <SelectFilter label="Alerts" value={fa} onChange={setFa} options={[{ value: 'all', label: 'Alerts: any' }, { value: 'open', label: 'With open alerts' }, { value: 'rules', label: 'With an alert rule' }]} />
            </Toolbar>
            <DataTable<Equipment>
              label="Equipment"
              rows={rows}
              rowKey={(e) => e.id}
              rowHref={(e) => to(`/building-info/equipment/${e.id}`)}
              search={(e) => `${e.name} ${e.type ?? ''} ${e.description} ${e.make ?? ''} ${building.get(e.buildingId)?.name ?? ''}`}
              searchPlaceholder="Search equipment, types or makes"
              caption={coverCaption(rows.length, rows.length === 1 ? 'item' : 'items', scope, buildings.length, buildings.some((b) => !b.hasEquipmentSurvey) ? `${buildings.filter((b) => !b.hasEquipmentSurvey).length} buildings have no equipment survey yet.` : undefined)}
              empty={{ title: all.length ? 'Nothing matches these filters' : 'No equipment surveyed yet', body: all.length ? 'Clear a filter to see more.' : 'Equipment is recorded in the Survey App during a building survey. Ask your account team to book one.', icon: 'hvac' }}
              columns={[
                { key: 'name', header: 'Name', value: (e) => e.name, render: (e) => (
                  <>
                    {e.name}
                    {e.retired && <span className="cell-sub">Retired</span>}
                  </>
                ) },
                { key: 'kind', header: 'Kind', value: (e) => KIND_LABEL[e.kind] },
                ...(showBuilding ? [{ key: 'building', header: 'Building', value: (e: Equipment) => building.get(e.buildingId)?.name ?? '' }] : []),
                { key: 'floor', header: 'Floor', value: (e) => e.floor, align: 'right' as const, hideOnPhone: true },
                { key: 'space', header: 'Space', value: (e) => (e.spaceId ? space.get(e.spaceId)?.name ?? '' : ''), hideOnPhone: true },
                { key: 'type', header: 'Type', value: (e) => e.type ?? '', render: (e) => e.type ?? <Pill tone="warning" title="No primary tag to derive a type from">No type</Pill> },
                { key: 'components', header: 'Components', value: (e) => e.components, align: 'right' as const, hideOnPhone: true },
                { key: 'source', header: 'Data source', value: (e) => e.dataSource, hideOnPhone: true },
                { key: 'condition', header: 'Condition', value: (e) => (e.condition ? CONDITIONS.indexOf(e.condition) : -1), render: (e) => <ConditionPill c={e.condition} /> },
                { key: 'retired', header: 'Retired', value: (e) => (e.retired ? 'Yes' : 'No'), hideOnPhone: true },
                { key: 'rule', header: 'Alert rule', value: (e) => (ruleSet.has(e.id) ? 'Set' : ''), render: (e) => (ruleSet.has(e.id) ? 'Set' : <span className="muted">None</span>), hideOnPhone: true },
                { key: 'alerts', header: 'Open alerts', value: (e) => openAlerts.get(e.id) ?? 0, align: 'right' as const, render: (e) => (openAlerts.get(e.id) ? <Pill tone="warning" icon="warning">{openAlerts.get(e.id)}</Pill> : <span className="muted">0</span>) },
              ]}
            />
          </>
        )}
      </ApiView>
      {adding && <AddEquipmentModal buildings={buildings} defaultBuilding={fb !== 'all' ? fb : buildings[0]?.id} onClose={() => setAdding(false)} />}
    </Page>
  );
}

function AddEquipmentModal({ buildings, defaultBuilding, onClose }: { buildings: Building[]; defaultBuilding?: string; onClose: () => void }) {
  const { data, add, user } = useData();
  const { to, navigate } = useNav();
  const record = useRecordActivity();
  const toast = useToast();
  const [bid, setBid] = useState(defaultBuilding ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [condition, setCondition] = useState<Equipment['condition']>('Good');
  const spaces = data.spaces.filter((s) => s.buildingId === bid);
  const types = [...new Set(data.equipment.map((e) => e.type).filter(Boolean) as string[])].sort();
  const save = () => {
    const sp = spaces.find((s) => s.id === spaceId);
    const e: Equipment = {
      id: `eq-new-${Date.now()}`, buildingId: bid, spaceId: sp?.id ?? null, floor: sp?.floor ?? null, name: name.trim(), description: type || 'Added in the web app', type: type || null, kind: 'equipment', parentId: null,
      dataSource: 'None', make: null, model: null, capacity: null, installDate: null, condition, expectedEol: null, retired: false, surveyedAt: null, editedBy: { who: user.name, at: TODAY }, components: 0,
    };
    add('equipment', e);
    record({ kind: 'equipment', id: e.id, label: e.name }, 'Equipment added in the web app', bid);
    toast(`${e.name} added.`);
    onClose();
    navigate(to(`/building-info/equipment/${e.id}`));
  };
  return (
    <Modal
      title="Add equipment"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!bid || !name.trim()} onClick={save}>
            Add equipment
          </button>
        </>
      }
    >
      <label className="field">
        <span>Building</span>
        <select value={bid} onChange={(e) => setBid(e.target.value)}>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="AHU-12" autoFocus />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Type</span>
          <input type="text" list="bi-eq-types" value={type} onChange={(e) => setType(e.target.value)} />
          <datalist id="bi-eq-types">
            {types.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Space</span>
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">No space</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}, floor {s.floor}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Condition</span>
          <select value={condition ?? ''} onChange={(e) => setCondition((e.target.value || null) as Equipment['condition'])}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted bi-modal-note">Nameplate details and photos usually come from the Survey App; you can add them on the equipment's page.</p>
    </Modal>
  );
}

/* ---------- Detail ---------- */

export function EquipmentDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { building } = useLookup();
  const { to } = useNav();
  const q = useApi(`building-info/equipment/${id}`, () => data.equipment.find((e) => e.id === id) ?? null, [data.equipment, id]);
  const e = q.data;
  const b = e ? building.get(e.buildingId) : undefined;
  const tier = b?.tierByUtility.electricity ?? 0;
  const dataTab = isInterval(tier);
  const alertsTab = tier === 3;
  const alertCount = data.alerts.filter((a) => a.equipmentId === id && !a.resolved).length;
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'data', label: 'Data', hidden: !dataTab },
    { id: 'files', label: 'Files' },
    { id: 'alerts', label: 'Alerts', hidden: !alertsTab, count: alertCount || undefined },
    { id: 'activity', label: 'Activity' },
  ];
  const tab = useTab(tabs);
  const [editing, setEditing] = useState(false);
  if (q.status === 'ready' && !e) return <NotFoundObject what="piece of equipment" backTo={to('/building-info/equipment')} backLabel="Back to equipment" />;
  return (
    <Page>
      <ApiView q={q} what="this equipment">
        {(eq) =>
          !b || !accessible.has(b.id) ? (
            <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />
          ) : (
            <>
              <PageHeader
                back={{ to: to('/building-info/equipment'), label: 'Equipment' }}
                eyebrow={
                  <>
                    {KIND_LABEL[eq.kind]} · <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                  </>
                }
                title={eq.name}
                subtitle={eq.description}
                actions={
                  <>
                    <ConditionPill c={eq.condition} />
                    <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                      <Icon name="edit" /> Edit
                    </button>
                  </>
                }
              />
              <Tabs label="Equipment views" tabs={tabs} />
              {tab === 'summary' && <SummaryTab e={eq} b={b} />}
              {tab === 'data' && <DataTab e={eq} b={b} />}
              {tab === 'files' && <FilesFor e={eq} />}
              {tab === 'alerts' && <AlertsTab e={eq} b={b} />}
              {tab === 'activity' && <ActivityTab label="Equipment activity" filter={(a) => a.object.id === eq.id} showObject={false} />}
              {editing && <EditEquipment e={eq} onClose={() => setEditing(false)} />}
            </>
          )
        }
      </ApiView>
    </Page>
  );
}

/** A surveyed value, with where it came from (MOD-BI-52, SYS-TRUST-14). */
function Sv({ e, children }: { e: Equipment; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return <span className="muted">Not recorded</span>;
  return (
    <span>
      {children}
      <span className="cell-sub">{e.editedBy ? `Changed by ${e.editedBy.who}, ${fmtDate(e.editedBy.at)}` : e.surveyedAt ? `Surveyed ${fmtDate(e.surveyedAt)}` : 'Not surveyed'}</span>
    </span>
  );
}

function SummaryTab({ e, b }: { e: Equipment; b: Building }) {
  const { data } = useData();
  const { space, equipment } = useLookup();
  const { to } = useNav();
  const tier = b.tierByUtility.electricity ?? 0;
  const unlock = nextTierUnlock(tier);
  const parent = e.parentId ? equipment.get(e.parentId) : undefined;
  const children = data.equipment.filter((x) => x.parentId === e.id);
  const served = data.spaces.filter((s) => s.fedBy.includes(e.id));
  const sp = e.spaceId ? space.get(e.spaceId) : undefined;
  const yearsLeft = e.expectedEol ? e.expectedEol - Number(TODAY.slice(0, 4)) : null;
  const gear = e.kind !== 'equipment';
  const r = e.ratings ?? {};
  return (
    <>
      {!isInterval(tier) && (
        <div className="banner banner--neutral">
          <Icon name="info" />
          <div>
            <strong>
              This building is <TierBadge tier={tier} />, so this page shows the survey record.
            </strong>{' '}
            {unlock ? `${unlock.next} would add ${tier === 1 || tier === '2a' ? 'load profiles for this equipment and peak demand' : 'data'}; equipment sensors or a BMS connection would add alerts and fault detection.` : ''}
          </div>
        </div>
      )}
      <div className="grid grid--3 bi-kpis">
        <div className="card">
          <h3>Condition</h3>
          <ConditionPill c={e.condition} />
          <p className="cell-sub bi-card-p">Last checked: {e.editedBy ? `${fmtDate(e.editedBy.at)} by ${e.editedBy.who}` : e.surveyedAt ? `${fmtDate(e.surveyedAt)}, Survey App` : 'never'}</p>
        </div>
        <div className="card">
          <h3>Expected end of life</h3>
          <p className="bi-big">{e.expectedEol ?? <span className="muted">Not estimated</span>}</p>
          {yearsLeft !== null && <p className="cell-sub">{yearsLeft <= 0 ? 'At or past end of life: a candidate for the capital plan' : `About ${yearsLeft} ${yearsLeft === 1 ? 'year' : 'years'} left`}</p>}
        </div>
        <div className="card">
          <h3>Data source</h3>
          <p className="bi-big">{e.dataSource}</p>
          <p className="cell-sub">{e.dataSource === 'Survey' || e.dataSource === 'None' ? 'Record only, no live data' : 'Live data on the Data tab'}</p>
        </div>
      </div>
      <Section title={gear ? 'Record' : 'Summary and nameplate'}>
        <RecordTable
          label="Equipment record"
          rows={[
            ['Name', e.name],
            ['Description', e.description],
            ['Building', <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>],
            ['Space', sp ? <Link to={to(`/building-info/buildings/${b.id}?tab=spaces&space=${sp.id}`)}>{sp.name}, floor {sp.floor}</Link> : <span className="muted">No space</span>],
            ['Type', e.type ?? <span><Pill tone="warning">No type</Pill><span className="cell-sub">No primary tag to derive a type from; set one with Edit</span></span>],
            ['Kind', KIND_LABEL[e.kind]],
            ['Parent', parent ? <Link to={to(`/building-info/equipment/${parent.id}`)}>{parent.name}</Link> : <span className="muted">None</span>],
            ['Make', <Sv e={e}>{e.make}</Sv>],
            ['Model', <Sv e={e}>{e.model}</Sv>],
            ['Capacity', <Sv e={e}>{e.capacity}</Sv>],
            ['Install date', <Sv e={e}>{e.installDate ? fmtDate(e.installDate) : null}</Sv>],
            ['Condition', <Sv e={e}><ConditionPill c={e.condition} /></Sv>],
            ['Expected end of life', e.expectedEol ?? null],
            ['Retired', e.retired ? 'Yes' : 'No'],
            ['Created', e.surveyedAt ? `${fmtDate(e.surveyedAt)}, Survey App` : 'In the web app'],
            ['Last changed', e.editedBy ? `${fmtDate(e.editedBy.at)} by ${e.editedBy.who}` : e.surveyedAt ? `${fmtDate(e.surveyedAt)}, survey` : '—'],
          ]}
        />
      </Section>
      {gear && (
        <Section title="Ratings">
          <RecordTable
            label="Gear ratings"
            rows={[
              ...(e.kind === 'transformer'
                ? ([
                    ['Capacity', r.kva != null ? `${r.kva.toLocaleString('en-US')} kVA` : <span className="bi-missing">Missing</span>],
                    ['Primary voltage', r.primaryV ? `${r.primaryV.toLocaleString('en-US')} V` : null],
                    ['Secondary voltage', r.secondaryV ? `${r.secondaryV} V` : null],
                    ['Utility provider', r.provider ?? null],
                  ] as [string, ReactNode][])
                : []),
              ...(e.kind === 'service'
                ? ([
                    ['Provider', r.provider ?? null],
                    ['Feed type', r.feedType ?? null],
                    ['Feeds', r.feeds ?? null],
                    ['Redundancy', r.redundancy ?? null],
                    ['Amperage', r.amps != null ? `${r.amps.toLocaleString('en-US')} A` : <span className="bi-missing">Missing</span>],
                    ['Voltage', r.voltage ?? null],
                    ['Phases', r.phases ?? null],
                    ['Meter account', r.meterAccount ?? null],
                    ['Deliverable power', r.deliverableKw != null ? fmtKw(r.deliverableKw) : <span className="bi-missing">Not verified</span>],
                    ['Available power', isInterval(tier) && r.availableKw != null ? <span className="bi-available">{fmtKw(r.availableKw)}</span> : <span className="bi-capacity-only">Capacity only</span>],
                  ] as [string, ReactNode][])
                : []),
              ...(e.kind === 'panel'
                ? ([
                    ['Distribution type', 'Panelboard'],
                    ['Voltage', r.voltage ?? null],
                    ['Voltage type', 'Line-to-line'],
                    ['Mounting', 'Surface'],
                    ['Rating', r.amps != null ? `${r.amps} A` : <span className="bi-missing">Missing</span>],
                    ['Phases', r.phases ?? null],
                    ['Breaker', 'Main lugs only'],
                  ] as [string, ReactNode][])
                : []),
              ['Verified', e.editedBy ? `${fmtDate(e.editedBy.at)}, changed by ${e.editedBy.who}` : fmtDate(e.surveyedAt)],
              ['Not observable', e.notObservable ? <span><NotObservable reason={e.notObservable.reason} /> {e.notObservable.field}: {e.notObservable.reason}{e.notObservable.photo ? ' (photo on file)' : ''}</span> : 'None'],
            ]}
          />
          {(children.length > 0 || served.length > 0) && (
            <div className="grid grid--2 bi-gap-top">
              {children.length > 0 && (
                <div className="card">
                  <h3>Feeds</h3>
                  <ul className="bi-plain-list">
                    {children.map((c) => (
                      <li key={c.id}>
                        <Link to={to(`/building-info/equipment/${c.id}`)}>{c.name}</Link> <span className="muted">· {KIND_LABEL[c.kind]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {served.length > 0 && (
                <div className="card">
                  <h3>Spaces served</h3>
                  <ul className="bi-plain-list">
                    {served.map((s) => (
                      <li key={s.id}>
                        <Link to={to(`/building-info/buildings/${b.id}?tab=spaces&space=${s.id}`)}>{s.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <p className="bi-gap-top">
            <Link to={to(`/building-info/buildings/${b.id}?tab=power`)}>Show in the one-line diagram</Link>
          </p>
        </Section>
      )}
    </>
  );
}

function DataTab({ e, b }: { e: Equipment; b: Building }) {
  const profile = useMemo(() => loadProfile(b, e.id), [b, e.id]);
  const scale = e.kind === 'equipment' ? 0.06 : e.kind === 'panel' ? 0.2 : 0.5;
  const pts = profile.map((p) => Math.round(p.kw * scale));
  const peak = Math.max(...pts);
  return (
    <Section title="Demand, last 24 hours" description={`15-minute interval data from ${e.dataSource === 'Survey' ? 'the building meter, apportioned' : e.dataSource}. Peak ${peak.toLocaleString('en-US')} kW. Cross-asset analysis lives in Workspace.`}>
      <LineChart label={`Demand of ${e.name}, kW, last 24 hours`} labels={profile.map((p) => p.t)} series={[{ name: 'Demand (kW)', color: 'var(--chart-1)', points: pts }]} format={(v) => `${Math.round(v)}`} />
    </Section>
  );
}

function FilesFor({ e }: { e: Equipment }) {
  const { data } = useData();
  const { to } = useNav();
  const files = data.files.filter((f) => f.attachedTo.kind === 'equipment' && f.attachedTo.id === e.id);
  return (
    <DataTable<FileRec>
      label="Files"
      rows={files}
      rowKey={(f) => f.id}
      rowHref={(f) => to(`/building-info/files/${f.id}`)}
      empty={{ title: 'No files on this equipment', body: 'Nameplate photos and manuals added in the Survey App show here.', icon: 'folder' }}
      columns={[
        { key: 'name', header: 'File', value: (f) => f.name },
        { key: 'cat', header: 'Category', value: (f) => f.category },
        { key: 'uploaded', header: 'Uploaded', value: (f) => f.uploaded, render: (f) => fmtDate(f.uploaded) },
        { key: 'by', header: 'By', value: (f) => f.uploadedBy, hideOnPhone: true },
      ]}
    />
  );
}

/* ---------- Alerts and alert rules (MOD-BI-20, 21; tier 3) ---------- */

function AlertsTab({ e, b }: { e: Equipment; b: Building }) {
  const { data, patch } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const alerts = data.alerts.filter((a) => a.equipmentId === e.id).sort((x, y) => Number(x.resolved) - Number(y.resolved) || y.start.localeCompare(x.start));
  const rules = data.alertRules.filter((r) => r.equipmentId === e.id);
  const act = (a: Alert, what: 'ack' | 'resolve') => {
    patch('alerts', a.id, what === 'ack' ? { acknowledged: true } : { resolved: true, acknowledged: true, end: TODAY });
    record({ kind: 'equipment', id: e.id, label: e.name }, `${what === 'ack' ? 'Acknowledged' : 'Resolved'} alert: ${a.title}`, b.id);
    toast(what === 'ack' ? 'Alert acknowledged.' : 'Alert resolved.');
  };
  return (
    <>
      <Section title="Alerts" description={data.entitlements.maintenance ? 'Acknowledge, resolve or create a ticket.' : 'Acknowledge an alert when you are on it, and resolve it when it is fixed.'}>
        <DataTable<Alert>
          label="Alerts"
          rows={alerts}
          rowKey={(a) => a.id}
          empty={{ title: 'No alerts on this equipment', body: 'Alerts from rules and fault detection show here.', icon: 'notifications_off' }}
          columns={[
            { key: 'title', header: 'Alert', value: (a) => a.title },
            { key: 'severity', header: 'Severity', value: (a) => a.severity, render: (a) => <SeverityPill severity={a.severity} /> },
            { key: 'cat', header: 'Category', value: (a) => a.category, hideOnPhone: true },
            { key: 'start', header: 'Started', value: (a) => a.start, render: (a) => fmtDate(a.start) },
            { key: 'end', header: 'Ended', value: (a) => a.end, render: (a) => fmtDate(a.end), hideOnPhone: true },
            { key: 'state', header: 'State', value: (a) => (a.resolved ? 'Resolved' : a.acknowledged ? 'Acknowledged' : 'New'), render: (a) => (a.resolved ? <Pill tone="success">Resolved</Pill> : a.acknowledged ? <Pill tone="info">Acknowledged</Pill> : <Pill tone="warning">New</Pill>) },
            {
              key: 'actions',
              header: 'Actions',
              render: (a) =>
                a.resolved ? (
                  <span className="muted">—</span>
                ) : (
                  <span className="btn-row">
                    {!a.acknowledged && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(a, 'ack')}>
                        Acknowledge
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(a, 'resolve')}>
                      Resolve
                    </button>
                  </span>
                ),
            },
          ]}
        />
      </Section>
      <Section
        title="Alert rules"
        description="Rules you set on this equipment's data. An alert a rule fires is listed above and in Notifications."
        actions={
          <button type="button" className="btn btn--sm" onClick={() => setCreating(true)}>
            <Icon name="add" /> New alert rule
          </button>
        }
      >
        <DataTable<AlertRule>
          label="Alert rules"
          rows={rules}
          rowKey={(r) => r.id}
          empty={{ title: 'No alert rules yet', body: 'Add a rule, such as a temperature threshold, to be alerted when it is crossed.', icon: 'rule' }}
          columns={[
            { key: 'title', header: 'Rule', value: (r) => r.title, render: (r) => (
              <>
                {r.title}
                <span className="cell-sub">{r.threshold}</span>
              </>
            ) },
            { key: 'severity', header: 'Severity', value: (r) => r.severity, render: (r) => <SeverityPill severity={r.severity} /> },
            { key: 'days', header: 'Days', value: (r) => r.days, hideOnPhone: true },
            { key: 'time', header: 'Time', value: (r) => r.time, hideOnPhone: true },
            { key: 'repeat', header: 'Repeat after', value: (r) => r.repeatMinutes, render: (r) => `${r.repeatMinutes} min`, hideOnPhone: true },
            { key: 'to', header: 'Send to', value: (r) => r.sendTo, hideOnPhone: true },
            { key: 'created', header: 'Created', value: (r) => r.created, render: (r) => fmtDate(r.created), hideOnPhone: true },
            { key: 'modified', header: 'Modified', value: (r) => r.modified, render: (r) => fmtDate(r.modified), hideOnPhone: true },
            {
              key: 'enabled',
              header: 'Enabled',
              value: (r) => (r.enabled ? 1 : 0),
              render: (r) => (
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    aria-label={`${r.enabled ? 'Disable' : 'Enable'} ${r.title}`}
                    onChange={(ev) => {
                      patch('alertRules', r.id, { enabled: ev.target.checked, modified: TODAY });
                      record({ kind: 'equipment', id: e.id, label: e.name }, `Alert rule ${ev.target.checked ? 'enabled' : 'disabled'}: ${r.title}`, b.id);
                    }}
                  />
                  <span />
                </label>
              ),
            },
          ]}
        />
      </Section>
      {creating && <NewRuleModal e={e} b={b} onClose={() => setCreating(false)} />}
    </>
  );
}

function NewRuleModal({ e, b, onClose }: { e: Equipment; b: Building; onClose: () => void }) {
  const { add, user } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [metric, setMetric] = useState('Return air temperature');
  const [op, setOp] = useState('>');
  const [value, setValue] = useState('85');
  const [unit, setUnit] = useState('°F');
  const [minutes, setMinutes] = useState('15');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<AlertRule['severity']>('Medium');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState('07:00');
  const [to, setTo] = useState('19:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repeat, setRepeat] = useState('120');
  const [description, setDescription] = useState('');
  const [sendTo, setSendTo] = useState(user.name);
  const threshold = `${metric} ${op} ${value} ${unit} for ${minutes} min`;
  const label = title.trim() || `${e.name} ${metric.toLowerCase()} ${op === '>' ? 'above' : 'below'} ${value} ${unit}`;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const valid = value.trim() !== '' && !Number.isNaN(Number(value)) && days.length > 0;
  const save = () => {
    const rule: AlertRule = {
      id: `ar-new-${Date.now()}`, equipmentId: e.id, title: label, threshold, severity,
      days: days.length === 7 ? 'Every day' : days.join(', '), time: allDay ? 'All day' : `${from}–${to}`, repeatMinutes: Number(repeat) || 120,
      sendTo, description: `${description}${startDate || endDate ? ` (active ${startDate ? fmtDate(startDate) : 'now'} to ${endDate ? fmtDate(endDate) : 'no end date'})` : ''}`.trim(), created: TODAY, modified: TODAY, enabled: true,
    };
    add('alertRules', rule);
    record({ kind: 'equipment', id: e.id, label: e.name }, `Alert rule created: ${rule.title}`, b.id);
    toast('Alert rule created and enabled.');
    onClose();
  };
  return (
    <Modal
      title="New alert rule"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!valid} onClick={save}>
            Create rule
          </button>
        </>
      }
    >
      <fieldset className="bi-fieldset">
        <legend>Threshold</legend>
        <div className="field-row">
          <label className="field">
            <span>Measure</span>
            <select value={metric} onChange={(ev) => setMetric(ev.target.value)}>
              {['Return air temperature', 'Supply air temperature', 'Power', 'Run status', 'Discharge pressure'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Condition</span>
            <select value={op} onChange={(ev) => setOp(ev.target.value)}>
              <option value=">">Above</option>
              <option value="<">Below</option>
            </select>
          </label>
          <label className="field">
            <span>Value</span>
            <input type="number" value={value} onChange={(ev) => setValue(ev.target.value)} />
          </label>
          <label className="field">
            <span>Unit</span>
            <select value={unit} onChange={(ev) => setUnit(ev.target.value)}>
              {['°F', 'kW', 'psi', 'on/off'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>For at least (min)</span>
            <input type="number" min={0} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
          </label>
        </div>
      </fieldset>
      <div className="field-row">
        <label className="field">
          <span>Label</span>
          <input type="text" value={title} placeholder={label} onChange={(ev) => setTitle(ev.target.value)} />
        </label>
        <label className="field">
          <span>Severity</span>
          <select value={severity} onChange={(ev) => setSeverity(ev.target.value as AlertRule['severity'])}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
      </div>
      <fieldset className="bi-fieldset">
        <legend>When it applies</legend>
        <div className="bi-days" role="group" aria-label="Days of the week">
          {DAYS.map((d) => (
            <label key={d} className="check">
              <input type="checkbox" checked={days.includes(d)} onChange={(ev) => setDays((x) => (ev.target.checked ? DAYS.filter((y) => x.includes(y) || y === d) : x.filter((y) => y !== d)))} />
              <span>{d}</span>
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(ev) => setAllDay(ev.target.checked)} />
          <span>All day</span>
        </label>
        {!allDay && (
          <div className="field-row">
            <label className="field">
              <span>From</span>
              <input type="time" value={from} onChange={(ev) => setFrom(ev.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="time" value={to} onChange={(ev) => setTo(ev.target.value)} />
            </label>
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span>Active from (optional)</span>
            <input type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} />
          </label>
          <label className="field">
            <span>Until (optional)</span>
            <input type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} />
          </label>
          <label className="field">
            <span>Repeat the alert after</span>
            <select value={repeat} onChange={(ev) => setRepeat(ev.target.value)}>
              {[['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours'], ['240', '4 hours'], ['1440', '1 day']].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <label className="field">
        <span>Description of the issue</span>
        <textarea value={description} placeholder="Possible economizer or cooling fault" onChange={(ev) => setDescription(ev.target.value)} />
      </label>
      <label className="field">
        <span>Send to</span>
        <input type="text" value={sendTo} onChange={(ev) => setSendTo(ev.target.value)} />
      </label>
      <p className="muted bi-modal-note">Preview: {threshold}, {days.length === 7 ? 'every day' : days.join(', ')}, {allDay ? 'all day' : `${from} to ${to}`}.</p>
    </Modal>
  );
}

/* ---------- Edit behind the destructive warning (MOD-BI-52) ---------- */

function EditEquipment({ e, onClose }: { e: Equipment; onClose: () => void }) {
  const { data, patch, user } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [form, setForm] = useState({ name: e.name, make: e.make ?? '', model: e.model ?? '', capacity: e.capacity ?? '', installDate: e.installDate ?? '', type: e.type ?? '', spaceId: e.spaceId ?? '', condition: e.condition ?? '', retired: e.retired });
  const [confirm, setConfirm] = useState(false);
  const spaces = data.spaces.filter((s) => s.buildingId === e.buildingId);
  const types = [...new Set(data.equipment.map((x) => x.type).filter(Boolean) as string[])].sort();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const changed = (
    [
      ['name', 'name', e.name],
      ['make', 'make', e.make ?? ''],
      ['model', 'model', e.model ?? ''],
      ['capacity', 'capacity', e.capacity ?? ''],
      ['installDate', 'install date', e.installDate ?? ''],
      ['type', 'type', e.type ?? ''],
      ['spaceId', 'space', e.spaceId ?? ''],
      ['condition', 'condition', e.condition ?? ''],
      ['retired', 'retired', e.retired],
    ] as [keyof typeof form, string, unknown][]
  ).filter(([k, , v]) => form[k] !== v);
  const surveyed = e.surveyedAt && !e.editedBy;
  const apply = () => {
    const sp = spaces.find((s) => s.id === form.spaceId);
    patch('equipment', e.id, {
      name: form.name.trim() || e.name,
      make: form.make || null,
      model: form.model || null,
      capacity: form.capacity || null,
      installDate: form.installDate || null,
      type: form.type || null,
      spaceId: sp?.id ?? null,
      floor: sp?.floor ?? e.floor,
      condition: (form.condition || null) as Equipment['condition'],
      retired: form.retired,
      editedBy: { who: user.name, at: TODAY },
    });
    record({ kind: 'equipment', id: e.id, label: form.name || e.name }, `Edited ${changed.map(([, l]) => l).join(', ')}${surveyed ? ', overwriting the surveyed values' : ''}`, e.buildingId);
    toast('Changes saved. The record now shows who changed it and when.');
    onClose();
  };
  return (
    <>
      <Modal
        title={`Edit ${e.name}`}
        size="lg"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={`btn ${surveyed ? 'btn--danger' : ''}`} disabled={changed.length === 0} onClick={() => (surveyed ? setConfirm(true) : apply())}>
              Save changes
            </button>
          </>
        }
      >
        {e.surveyedAt && (
          <p className="banner banner--warning bi-banner-tight">
            <Icon name="warning" />
            <span>These values were recorded in the Survey App on {fmtDate(e.surveyedAt)}. Saving overwrites what the survey recorded, and the record then shows your name and today's date instead.</span>
          </p>
        )}
        <div className="field-row">
          <label className="field">
            <span>Name</span>
            <input type="text" value={form.name} onChange={(ev) => set('name', ev.target.value)} />
          </label>
          <label className="field">
            <span>Type</span>
            <input type="text" list="bi-edit-types" value={form.type} onChange={(ev) => set('type', ev.target.value)} />
            <datalist id="bi-edit-types">
              {types.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Space</span>
            <select value={form.spaceId} onChange={(ev) => set('spaceId', ev.target.value)}>
              <option value="">No space</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}, floor {s.floor}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Make</span>
            <input type="text" value={form.make} onChange={(ev) => set('make', ev.target.value)} />
          </label>
          <label className="field">
            <span>Model</span>
            <input type="text" value={form.model} onChange={(ev) => set('model', ev.target.value)} />
          </label>
          <label className="field">
            <span>Capacity</span>
            <input type="text" value={form.capacity} onChange={(ev) => set('capacity', ev.target.value)} />
          </label>
          <label className="field">
            <span>Install date</span>
            <input type="date" value={form.installDate} onChange={(ev) => set('installDate', ev.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Condition</span>
            <select value={form.condition} onChange={(ev) => set('condition', ev.target.value)}>
              <option value="">Not assessed</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="check bi-check-field">
            <input type="checkbox" checked={form.retired} onChange={(ev) => set('retired', ev.target.checked)} />
            <span>Retired</span>
          </label>
        </div>
      </Modal>
      {confirm && (
        <ConfirmDialog
          title="Overwrite surveyed values?"
          destructive
          confirmLabel="Overwrite"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            apply();
          }}
          body={
            <p>
              You're changing {changed.map(([, l]) => l).join(', ')}. The survey's values from {fmtDate(e.surveyedAt)} will be replaced, and this can't be undone from the web app.
            </p>
          }
        />
      )}
    </>
  );
}

export function useAlertsFor(equipmentIds: string[]) {
  const { data } = useData();
  return useMemo(() => data.alerts.filter((a) => equipmentIds.includes(a.equipmentId)), [data.alerts, equipmentIds]);
}

