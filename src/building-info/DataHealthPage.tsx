/**
 * Data Health (MOD-BI-60, 66, 17, 64, 07, 15, 65): every data health item in scope as a list,
 * filterable by building, utility, family, owner, status and the framework it blocks, each
 * opening a detail drawer with only the actions that fit it; setup progress per building
 * against the nine Gold Standard lines; and meter health.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import type { Building, GoldLine, HealthItem, Meter } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { DetailDrawer } from '../ui/DetailDrawer';
import { ApiView, Hint, Kpi, PageHeader, Pill, Popover, SelectFilter, SeverityPill, StatusChip, Tabs, useTab } from '../ui/bits';
import { useToast } from '../ui/Toast';
import { fmtDate, fmtPct } from '../ui/format';
import { ContactEnertivModal, ContactTenantModal, MarkExpectedModal, STAGE_TEXT, UploadBillsModal } from './actions';
import { BuildingFilter, coverCaption, human, Page, ReportingPill, reportingState, Toolbar, UTIL, useLiveStatus, useObjectHref, useParamFilter, useRecordActivity, useScoped, ZerosPill } from './shared';

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'setup', label: 'Setup progress' },
  { id: 'meters', label: 'Meter health' },
];

export function DataHealthPage() {
  const tab = useTab(TABS);
  const { data } = useData();
  const { ids } = useScoped();
  const open = useMemo(() => data.health.filter((h) => ids.has(h.buildingId) && h.status === 'open').length, [data.health, ids]);
  return (
    <Page>
      <PageHeader title="Data Health" subtitle="Every data problem in scope, what it affects, who fixes it and how. Items are never deleted: resolved and expected ones stay listed under their status." />
      <Hint id="bi-data-health">
        Filter to a reporting framework to see what blocks it, then open an item to fix it: mark it as expected, upload a bill, ask the tenant, or contact Enertiv.
      </Hint>
      <Tabs label="Data Health views" tabs={TABS.map((t) => (t.id === 'items' ? { ...t, count: open } : t))} />
      {tab === 'items' && <ItemsView />}
      {tab === 'setup' && <SetupView />}
      {tab === 'meters' && <MeterHealthView />}
    </Page>
  );
}

/* ---------- Items ---------- */

const FAMILIES: HealthItem['family'][] = ['Bills', 'Utility logins', 'Meters', 'Coverage', 'ENERGY STAR', 'Survey'];
const OWNERS: HealthItem['owner'][] = ['You', 'Enertiv', 'Tenant', 'Client admin', 'Utility'];

export function itemTab(h: HealthItem) {
  if (h.object.kind !== 'building') return undefined;
  if (h.family === 'Survey') return 'power';
  if (h.problem === 'Occupancy hours not set') return 'spaces';
  if (h.problem === 'Square footage missing') return undefined;
  return 'utilities';
}

function ItemsView() {
  const { data } = useData();
  const { building, tenant } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const href = useObjectHref();
  const [params, setParams] = useSearchParams();
  const [fb, setFb] = useParamFilter('building');
  const [fu, setFu] = useParamFilter('utility');
  const [ff, setFf] = useParamFilter('family');
  const [fo, setFo] = useParamFilter('owner');
  const [fs, setFs] = useParamFilter('status', 'open');
  const [fw, setFw] = useParamFilter('framework');
  const itemId = params.get('item');

  const q = useApi(`building-info/data-health/${scope.id}`, () => data.health.filter((h) => ids.has(h.buildingId)), [data.health, ids]);
  const all = q.data ?? [];
  const frameworks = useMemo(() => [...new Set(all.flatMap((h) => h.frameworks))].sort((a, b) => (a === 'GRESB' ? -1 : b === 'GRESB' ? 1 : a === 'ENERGY STAR' ? -1 : b === 'ENERGY STAR' ? 1 : a.localeCompare(b))), [all]);
  const rows = useMemo(
    () =>
      all.filter(
        (h) =>
          (fb === 'all' || h.buildingId === fb) &&
          (fu === 'all' || (fu === 'none' ? !h.utility : h.utility === fu)) &&
          (ff === 'all' || h.family === ff) &&
          (fo === 'all' || h.owner === fo) &&
          (fs === 'all' || h.status === fs) &&
          (fw === 'all' || h.frameworks.includes(fw)),
      ),
    [all, fb, fu, ff, fo, fs, fw],
  );
  const openRows = rows.filter((h) => h.status === 'open');
  const blockedBuildings = new Set(openRows.map((h) => h.buildingId)).size;
  const item = itemId ? data.health.find((h) => h.id === itemId) : undefined;

  const setItem = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set('item', id);
      else next.delete('item');
      setParams(next, { replace: !id });
    },
    [params, setParams],
  );
  const close = useCallback(() => setItem(null), [setItem]);
  const filtered = fb !== 'all' || fu !== 'all' || ff !== 'all' || fo !== 'all' || fs !== 'open' || fw !== 'all';

  return (
    <ApiView q={q} what="data health items">
      {() => (
        <>
          <div className="grid grid--kpis bi-kpis">
            <Kpi label={fw === 'all' ? 'Open items' : `Open items blocking ${fw}`} value={openRows.length} sub={`${blockedBuildings} ${blockedBuildings === 1 ? 'building' : 'buildings'} affected`} />
            <Kpi label="High severity" value={openRows.filter((h) => h.severity === 'high').length} tone={openRows.some((h) => h.severity === 'high') ? 'danger' : undefined} />
            <Kpi label="Yours to fix" value={openRows.filter((h) => h.owner === 'You').length} sub="Owner: you" />
            <Kpi label="With Enertiv" value={openRows.filter((h) => h.ticket && h.ticket.status !== 'Resolved').length} sub="Open tickets or rep requests" />
          </div>
          <Toolbar>
            <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
            <SelectFilter label="Utility" value={fu} onChange={setFu} options={[{ value: 'all', label: 'All utilities' }, ...(['electricity', 'gas', 'water', 'steam'] as const).map((u) => ({ value: u, label: UTIL[u] })), { value: 'none', label: 'No utility' }]} />
            <SelectFilter label="Family" value={ff} onChange={setFf} options={[{ value: 'all', label: 'All families' }, ...FAMILIES.map((f) => ({ value: f, label: f }))]} />
            <SelectFilter label="Owner" value={fo} onChange={setFo} options={[{ value: 'all', label: 'Any owner' }, ...OWNERS.map((o) => ({ value: o, label: o === 'You' ? 'You' : o }))]} />
            <SelectFilter label="Status" value={fs} onChange={setFs} options={[{ value: 'open', label: 'Open' }, { value: 'expected', label: 'Expected' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'Any status' }]} />
            <SelectFilter label="Blocks framework" value={fw} onChange={setFw} options={[{ value: 'all', label: 'Any framework' }, ...frameworks.map((f) => ({ value: f, label: `Blocks ${f}` }))]} />
            {filtered && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  const next = new URLSearchParams();
                  const tab = params.get('tab');
                  if (tab) next.set('tab', tab);
                  setParams(next, { replace: true });
                }}
              >
                <Icon name="filter_alt_off" /> Clear filters
              </button>
            )}
          </Toolbar>
          <DataTable<HealthItem>
            label="Data health items"
            rows={rows}
            rowKey={(h) => h.id}
            selectedKey={itemId}
            search={(h) => `${h.problem} ${h.object.label} ${building.get(h.buildingId)?.name ?? ''} ${h.evidence}`}
            searchPlaceholder="Search items"
            caption={coverCaption(rows.length, rows.length === 1 ? 'item' : 'items', scope, new Set(rows.map((h) => h.buildingId)).size, fw !== 'all' ? `Showing items that block ${fw}.` : undefined)}
            empty={{
              title: filtered ? 'No items match these filters' : 'No open data problems',
              body: filtered ? 'Clear a filter or choose another status. Resolved and expected items are under Status.' : 'Every bill, login and meter in scope is arriving as expected.',
              icon: filtered ? 'filter_alt_off' : 'check_circle',
            }}
            initialSort={{ key: 'severity', dir: 'desc' }}
            columns={[
              {
                key: 'problem',
                header: 'Problem',
                value: (h) => h.problem,
                render: (h) => (
                  <button type="button" className="bi-link-btn" onClick={() => setItem(h.id)} aria-haspopup="dialog">
                    {h.problem}
                  </button>
                ),
              },
              ...(showBuilding ? [{ key: 'building', header: 'Building', value: (h: HealthItem) => building.get(h.buildingId)?.name ?? '' }] : []),
              { key: 'utility', header: 'Utility', value: (h) => (h.utility ? UTIL[h.utility] : '—') },
              { key: 'object', header: 'Object', value: (h) => h.object.label, render: (h) => <Link to={href(h.object, itemTab(h))}>{h.object.label}</Link>, hideOnPhone: true },
              { key: 'family', header: 'Family', value: (h) => h.family, hideOnPhone: true },
              { key: 'severity', header: 'Impact', value: (h) => (h.severity === 'high' ? 3 : h.severity === 'medium' ? 2 : 1), render: (h) => <span title={human(h.impact)}><SeverityPill severity={h.severity} /></span> },
              { key: 'frameworks', header: 'Blocks', value: (h) => h.frameworks.join(', '), render: (h) => (h.frameworks.length ? <span className="bi-frameworks">{h.frameworks.join(', ')}</span> : <span className="muted">Nothing</span>), hideOnPhone: true },
              { key: 'owner', header: 'Owner', value: (h) => (h.owner === 'Tenant' && h.tenantId ? tenant.get(h.tenantId)?.name ?? 'Tenant' : h.owner) },
              { key: 'status', header: 'Status', value: (h) => h.status, render: (h) => <HealthStatusPill h={h} /> },
              { key: 'opened', header: 'Opened', value: (h) => h.opened, render: (h) => <span className="nowrap">{fmtDate(h.opened)}</span>, hideOnPhone: true },
              { key: 'checked', header: 'Last checked', value: (h) => h.lastChecked, render: (h) => <span className="nowrap">{fmtDate(h.lastChecked)}</span>, hideOnPhone: true },
              { key: 'ticket', header: 'Enertiv', value: (h) => h.ticket?.id ?? '', render: (h) => (h.ticket ? <TicketPill t={h.ticket} /> : <span className="muted">—</span>), hideOnPhone: true },
            ]}
          />
          {itemId && !item && (
            <p className="banner banner--neutral" role="status">
              <Icon name="info" /> <span>That data health item isn't in this account any more. It may belong to another scenario.</span>
            </p>
          )}
          {item && <HealthItemDrawer item={item} onClose={close} />}
        </>
      )}
    </ApiView>
  );
}

export function HealthStatusPill({ h }: { h: HealthItem }) {
  return h.status === 'open' ? (
    <Pill tone="warning" icon="error">
      Open
    </Pill>
  ) : h.status === 'expected' ? (
    <Pill tone="neutral" icon="check" title={h.expectedReason}>
      Expected
    </Pill>
  ) : (
    <Pill tone="success" icon="check_circle">
      Resolved
    </Pill>
  );
}

export function TicketPill({ t }: { t: NonNullable<HealthItem['ticket']> }) {
  return (
    <Pill tone={t.status === 'Resolved' ? 'success' : 'info'} icon={t.kind === 'ticket' ? 'confirmation_number' : 'support_agent'}>
      {t.kind === 'ticket' ? `${t.id}: ${t.status}` : `Rep: ${t.status}`}
    </Pill>
  );
}

function HealthItemDrawer({ item, onClose }: { item: HealthItem; onClose: () => void }) {
  const { data, patch } = useData();
  const { building, tenant } = useLookup();
  const href = useObjectHref();
  const record = useRecordActivity();
  const toast = useToast();
  const { to } = useNav();
  const [action, setAction] = useState<null | 'expected' | 'upload' | 'tenant' | 'enertiv'>(null);
  // Escape in an action dialog closes the dialog, not the drawer under it.
  const actionRef = useRef(action);
  actionRef.current = action;
  const closeDrawer = useCallback(() => {
    if (!actionRef.current) onClose();
  }, [onClose]);
  const b = building.get(item.buildingId);
  const t = item.tenantId ? tenant.get(item.tenantId) : undefined;
  const requests = data.requests.filter((r) => r.healthItemId === item.id);
  const month = item.evidence.match(/\d{4}-\d{2}/)?.[0];
  const uploadAccounts = useMemo(() => {
    if (item.object.kind === 'account') return data.accounts.filter((a) => a.id === item.object.id);
    if (item.object.kind === 'bill') {
      const bill = data.bills.find((x) => x.id === item.object.id);
      return data.accounts.filter((a) => a.id === bill?.accountId);
    }
    return data.accounts.filter((a) => a.buildingId === item.buildingId && (!item.utility || a.utility === item.utility));
  }, [data.accounts, data.bills, item]);
  const open = item.status === 'open';
  const ACTION_LABEL = { expected: 'Mark as expected', upload: 'Upload a replacement', tenant: 'Contact the tenant', enertiv: 'Contact Enertiv' } as const;
  const ACTION_ICON = { expected: 'check', upload: 'upload', tenant: 'outgoing_mail', enertiv: 'support_agent' } as const;
  const actions = item.actions.filter((a) => (a === 'enertiv' ? !item.ticket || item.ticket.status === 'Resolved' : true)).filter((a) => a !== 'upload' || uploadAccounts.length > 0);

  return (
    <>
      <DetailDrawer
        title={item.problem}
        eyebrow={`${b?.name ?? 'Unknown building'} · ${item.family}`}
        onClose={closeDrawer}
        actions={
          open ? (
            actions.length ? (
              actions.map((a, k) => (
                <button key={a} type="button" className={`btn ${k === 0 ? '' : 'btn--ghost'}`} onClick={() => setAction(a)}>
                  <Icon name={ACTION_ICON[a]} /> {ACTION_LABEL[a]}
                </button>
              ))
            ) : (
              <p className="muted">Enertiv is on it; nothing for you to do yet.</p>
            )
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                patch('health', item.id, { status: 'open', expectedReason: undefined });
                record(item.object, 'Data health item reopened', item.buildingId);
                toast('Item reopened.');
              }}
            >
              <Icon name="restart_alt" /> Reopen
            </button>
          )
        }
      >
        <div className="btn-row bi-drawer-pills">
          <HealthStatusPill h={item} />
          <SeverityPill severity={item.severity} />
          {item.ticket && <TicketPill t={item.ticket} />}
        </div>
        <dl className="dl bi-drawer-dl">
          <dt>Building</dt>
          <dd>{b ? <Link to={href({ kind: 'building', id: b.id })}>{b.name}</Link> : '—'}</dd>
          <dt>Utility</dt>
          <dd>{item.utility ? UTIL[item.utility] : 'Not utility-specific'}</dd>
          <dt>About</dt>
          <dd>
            <Link to={href(item.object, itemTab(item))}>{item.object.label}</Link>
          </dd>
          <dt>Owner</dt>
          <dd>{item.owner === 'Tenant' && t ? <Link to={to(`/people/tenants/${t.id}`)}>{t.name} (tenant)</Link> : item.owner}</dd>
          <dt>Blocks</dt>
          <dd>{item.frameworks.length ? item.frameworks.join(', ') : 'No reporting framework'}</dd>
          <dt>Opened</dt>
          <dd>{fmtDate(item.opened)}</dd>
          <dt>Last checked</dt>
          <dd>{fmtDate(item.lastChecked)}</dd>
        </dl>
        <h3 className="bi-drawer-h">What we found</h3>
        <p>{human(item.evidence)}.</p>
        <h3 className="bi-drawer-h">Why it matters</h3>
        <p>{human(item.impact)}.</p>
        <h3 className="bi-drawer-h">The fix</h3>
        <p>{human(item.fix)}.</p>
        {item.status === 'expected' && (
          <div className="banner banner--neutral bi-banner-tight">
            <Icon name="check" />
            <div>
              <strong>Marked as expected.</strong> {item.expectedReason ?? 'No reason given.'}
            </div>
          </div>
        )}
        {item.status === 'resolved' && (
          <div className="banner banner--neutral bi-banner-tight">
            <Icon name="check_circle" />
            <div>Resolved: the last check on {fmtDate(item.lastChecked)} found the data in place.</div>
          </div>
        )}
        {item.ticket && (
          <>
            <h3 className="bi-drawer-h">With Enertiv</h3>
            <p>
              {item.ticket.kind === 'ticket' ? `Ticket ${item.ticket.id}` : 'Your account team was asked to get in touch'}, opened {fmtDate(item.ticket.opened)}. Status: <strong>{item.ticket.status}</strong>.
              {item.ticket.status !== 'Resolved' && ' The item resolves itself when the next check finds the data.'}
            </p>
          </>
        )}
        {requests.length > 0 && (
          <>
            <h3 className="bi-drawer-h">Requests to the tenant</h3>
            <ul className="bi-plain-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <strong>{STAGE_TEXT[r.stage]}</strong> to <Link to={to(`/people/tenants/${r.to.id}`)}>{r.to.name}</Link>: {r.what}
                  <span className="cell-sub">
                    {r.lastChased ? `Last chased ${fmtDate(r.lastChased)} by ${r.channel.toLowerCase()}` : r.stage === 'not-sent' ? 'Waiting for a contact on file' : 'Not sent yet'}
                    {r.declineReason ? ` · ${r.declineReason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </DetailDrawer>
      {action === 'expected' && <MarkExpectedModal item={item} onClose={() => setAction(null)} />}
      {action === 'enertiv' && <ContactEnertivModal item={item} onClose={() => setAction(null)} />}
      {action === 'tenant' && <ContactTenantModal item={item} onClose={() => setAction(null)} />}
      {action === 'upload' && <UploadBillsModal accounts={uploadAccounts} item={item} month={month} onClose={() => setAction(null)} />}
    </>
  );
}

/* ---------- Setup progress (MOD-BI-07, ST-O03, ST-O10) ---------- */

const NEXT_STEP: Record<number, { text: string; link?: { label: string; path: (b: Building) => string } }> = {
  1: { text: "Enertiv tags the building's meters to their utilities once a source is connected." },
  2: { text: 'Enertiv connects the remaining accounts so whole-building totals add up.' },
  3: { text: 'Enertiv confirms which accounts the tenants hold; you may be asked for a tenant contact.' },
  4: { text: 'Upload older bills, or Enertiv requests them from the utility.', link: { label: 'Open bills', path: (b) => `/building-info/bills?view=accounts&building=${b.id}` } },
  5: { text: 'Enertiv Implementation links the building once you share the property in Portfolio Manager.' },
  6: { text: 'Your Admin places the building in its fund and region.' },
  7: { text: "Confirm the gross floor area on the building's Overview.", link: { label: 'Open the Overview', path: (b) => `/building-info/buildings/${b.id}` } },
  8: { text: 'Your Admin invites the sponsor and project lead.', link: { label: 'Open Team', path: () => '/people/team' } },
  9: { text: 'Your Admin names the on-site building contact.', link: { label: 'Open Building contacts', path: () => '/people/contacts' } },
};

function SetupView() {
  const { scope, buildings, showBuilding } = useScoped();
  const { user } = useData();
  const { to } = useNav();
  const toast = useToast();
  const [fb, setFb] = useParamFilter('building');
  const q = useApi(`building-info/setup/${scope.id}`, () => buildings, [buildings]);
  const isAdmin = user.role === 'admin';
  return (
    <ApiView q={q} what="setup progress">
      {(list) => {
        const rows = list.filter((b) => fb === 'all' || b.id === fb);
        const complete = rows.filter((b) => b.goldStandard.every((l) => l.state !== 'not-met')).length;
        return (
          <>
            <p className="muted bi-intro">
              Gold Standard setup: nine lines that make a building's data ready to trust. Lines 1 to 5 are Enertiv's to close; lines 6 to 9 are your Admin's, with the chase agent following up. Select a line to see who to contact and the next step.
            </p>
            <Toolbar>
              <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
            </Toolbar>
            <DataTable<Building>
              label="Setup progress"
              rows={rows}
              rowKey={(b) => b.id}
              caption={coverCaption(rows.length, rows.length === 1 ? 'building' : 'buildings', scope, rows.length, `${complete} of ${rows.length} meet every line or have a known exception.`)}
              initialSort={{ key: 'met', dir: 'asc' }}
              rowHref={(b) => to(`/building-info/buildings/${b.id}`)}
              columns={[
                { key: 'name', header: showBuilding ? 'Building' : 'Property', value: (b) => b.name },
                ...b9().map((n) => ({
                  key: `l${n}`,
                  header: `${n}`,
                  value: (b: Building) => b.goldStandard[n - 1]?.state ?? '',
                  render: (b: Building) => <LineCell line={b.goldStandard[n - 1]} b={b} canAct={n >= 6 ? isAdmin : n === 4} onContact={() => toast(`Your Enertiv account team has been asked about “${b.goldStandard[n - 1]?.label}” at ${b.name}.`)} />,
                  sortable: false,
                })),
                { key: 'met', header: 'Met', value: (b) => b.goldStandard.filter((l) => l.state !== 'not-met').length, render: (b) => `${b.goldStandard.filter((l) => l.state !== 'not-met').length} of 9`, align: 'right' as const },
              ]}
            />
            <ul className="bi-line-key" aria-label="The nine lines">
              {(list[0]?.goldStandard ?? []).map((l) => (
                <li key={l.line}>
                  <strong>{l.line}</strong> {l.label}
                </li>
              ))}
            </ul>
          </>
        );
      }}
    </ApiView>
  );
}

const b9 = () => [1, 2, 3, 4, 5, 6, 7, 8, 9];

function LineCell({ line, b, canAct, onContact }: { line: GoldLine | undefined; b: Building; canAct: boolean; onContact: () => void }) {
  const { to } = useNav();
  if (!line) return <span className="muted">—</span>;
  const icon = line.state === 'met' ? 'check_circle' : line.state === 'exception' ? 'do_not_disturb_on' : 'radio_button_unchecked';
  const word = line.state === 'met' ? 'Met' : line.state === 'exception' ? 'Exception' : 'Not met';
  const step = NEXT_STEP[line.line];
  return (
    <Popover
      label={`${line.label}: ${word}`}
      trigger={(open, toggle) => (
        <button type="button" className={`bi-line bi-line--${line.state}`} aria-expanded={open} aria-label={`Line ${line.line}, ${line.label}: ${word}`} onClick={toggle}>
          <Icon name={icon} filled={line.state === 'met'} />
          <span className="bi-line-word">{word}</span>
        </button>
      )}
    >
      <p className="provenance-title">
        {line.line}. {line.label}
      </p>
      <p>
        <strong>{word}</strong>
        {line.note ? `: ${line.note}` : ''}
      </p>
      {line.state === 'not-met' && (
        <>
          <p>
            <strong>Next step:</strong> {step.text}
          </p>
          {!canAct && (
            <p>
              <strong>Who to contact:</strong> {line.contact}
            </p>
          )}
          <p className="provenance-links">
            {step.link && canAct && <Link to={to(step.link.path(b))}>{step.link.label}</Link>}
            {!canAct && (
              <button type="button" className="text-btn" onClick={onContact}>
                Contact {line.line <= 5 ? 'your account team' : 'your Admin'}
              </button>
            )}
          </p>
        </>
      )}
    </Popover>
  );
}

/* ---------- Meter health (MOD-BI-15) ---------- */

function MeterHealthView() {
  const { data } = useData();
  const { building } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const { status } = useLiveStatus();
  const [fb, setFb] = useParamFilter('building');
  const [fu, setFu] = useParamFilter('utility');
  const [fsrc, setFsrc] = useParamFilter('source');
  const [frep, setFrep] = useParamFilter('reporting');
  const q = useApi(`building-info/meter-health/${scope.id}`, () => data.meters.filter((m) => ids.has(m.buildingId) && m.kind === 'enertiv'), [data.meters, ids]);
  const tickets = useMemo(() => {
    const map = new Map<string, NonNullable<HealthItem['ticket']>>();
    for (const h of data.health) if (h.object.kind === 'meter' && h.ticket) map.set(h.object.id, h.ticket);
    return map;
  }, [data.health]);
  return (
    <ApiView q={q} what="meter health">
      {(all) => {
        const sources = [...new Set(all.map((m) => m.dataSource))];
        const rows = all.filter((m) => (fb === 'all' || m.buildingId === fb) && (fu === 'all' || m.utility === fu) && (fsrc === 'all' || m.dataSource === fsrc) && (frep === 'all' || reportingState(m) === frep));
        const stale = rows.filter((m) => reportingState(m) !== 'Reporting').length;
        return (
          <>
            <p className="muted bi-intro">Whether each meter is reporting within its expected cadence, by meter name. Expected zeros, such as gas in summer or a vacant space, count as reporting.</p>
            <Toolbar>
              <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
              <SelectFilter label="Utility" value={fu} onChange={setFu} options={[{ value: 'all', label: 'All utilities' }, ...(['electricity', 'gas', 'water', 'steam'] as const).map((u) => ({ value: u, label: UTIL[u] }))]} />
              <SelectFilter label="Source" value={fsrc} onChange={setFsrc} options={[{ value: 'all', label: 'All sources' }, ...sources.map((s) => ({ value: s, label: s }))]} />
              <SelectFilter label="Reporting" value={frep} onChange={setFrep} options={[{ value: 'all', label: 'Any state' }, { value: 'Reporting', label: 'Reporting' }, { value: 'Stale', label: 'Not reporting' }, { value: 'No data', label: 'No data' }]} />
            </Toolbar>
            <DataTable<Meter>
              label="Meter health"
              rows={rows}
              rowKey={(m) => m.id}
              rowHref={(m) => to(`/building-info/meters/${m.id}?tab=health`)}
              search={(m) => `${m.name} ${building.get(m.buildingId)?.name ?? ''}`}
              searchPlaceholder="Search meters"
              caption={coverCaption(rows.length, 'meters', scope, undefined, `${stale} not reporting within their cadence. Uptime and completeness cover the last 30 days.`)}
              initialSort={{ key: 'days', dir: 'desc' }}
              columns={[
                { key: 'name', header: 'Meter', value: (m) => m.name },
                ...(showBuilding ? [{ key: 'building', header: 'Building', value: (m: Meter) => building.get(m.buildingId)?.name ?? '', render: (m: Meter) => <span className="inline">{building.get(m.buildingId)?.name} <StatusChip status={status.get(m.buildingId) ?? 'healthy'} /></span> }] : []),
                { key: 'utility', header: 'Utility', value: (m) => UTIL[m.utility] },
                { key: 'source', header: 'Source', value: (m) => m.dataSource, hideOnPhone: true },
                { key: 'reporting', header: 'Reporting', value: (m) => reportingState(m), render: (m) => <ReportingPill m={m} /> },
                { key: 'days', header: 'Days since data', value: (m) => m.daysSinceData, align: 'right' as const, render: (m) => (m.daysSinceData === null ? <span className="muted">Never</span> : m.daysSinceData) },
                { key: 'zeros', header: 'Run of zeros', value: (m) => m.zeros, render: (m) => <ZerosPill zeros={m.zeros} />, hideOnPhone: true },
                { key: 'uptime', header: 'Uptime', value: (m) => m.uptime, align: 'right' as const, render: (m) => (m.uptime === null ? <span className="muted" title="Uptime applies to interval meters">n/a</span> : fmtPct(m.uptime)) },
                { key: 'complete', header: 'Completeness', value: (m) => m.completeness, align: 'right' as const, render: (m) => fmtPct(m.completeness) },
                { key: 'ticket', header: 'Enertiv', value: (m) => tickets.get(m.id)?.id ?? '', render: (m) => (tickets.get(m.id) ? <TicketPill t={tickets.get(m.id)!} /> : <span className="muted">—</span>), hideOnPhone: true },
              ]}
            />
          </>
        );
      }}
    </ApiView>
  );
}
