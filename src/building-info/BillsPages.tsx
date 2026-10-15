/**
 * Bills (MOD-BI-12, 69): two views of one page, Bills and Accounts (`?view=accounts`). Bills
 * lists only bills that exist, with "awaiting bill" for the missing half of a supply and delivery
 * pair (ST-D20); a missing bill is a Data Health item. Upload targets an account, with a queue.
 * Accounts name their holder, the landlord or a tenant. Credentials are never shown.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import type { ActivityItem, Bill, BillLine, Meter, UtilityAccount, Utility } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable, RecordTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ApiView, EmptyState, EstimatedMark, FilterChips, PageHeader, Pill, Section, SelectFilter, SeverityPill, Tabs, useTab } from '../ui/bits';
import { fmtDate, fmtInt, fmtMoney, fmtMonth } from '../ui/format';
import { UploadBillsModal, UploadQueue } from './actions';
import { ActivityTab, BuildingFilter, coverCaption, fmtMonthLong, NotFoundObject, Page, ReportingPill, Toolbar, UTIL, useParamFilter, useRecordActivity, useScoped } from './shared';

type BillRow = { kind: 'bill'; id: string; bill: Bill; account: UtilityAccount | undefined } | { kind: 'awaiting'; id: string; account: UtilityAccount; month: string; partner: Bill };

/** For each supply and delivery pair, the half whose bill hasn't come yet (ST-D20). */
function awaitingRows(accounts: UtilityAccount[], bills: Bill[]): BillRow[] {
  const byAcct = new Map<string, Bill[]>();
  for (const b of bills) byAcct.set(b.accountId, [...(byAcct.get(b.accountId) ?? []), b]);
  const out: BillRow[] = [];
  for (const a of accounts) {
    if (!a.pairedWith) continue;
    const mine = new Set((byAcct.get(a.id) ?? []).map((b) => b.start.slice(0, 7)));
    for (const p of byAcct.get(a.pairedWith) ?? []) {
      const m = p.start.slice(0, 7);
      if (!mine.has(m)) out.push({ kind: 'awaiting', id: `await-${a.id}-${m}`, account: a, month: m, partner: p });
    }
  }
  return out;
}

export function holderName(a: UtilityAccount, tenantName: (id: string) => string | undefined) {
  return a.holder === 'landlord' ? 'Landlord' : tenantName(a.holder) ?? 'Tenant';
}

export function BillsPage() {
  const [params] = useSearchParams();
  const view = params.get('view') === 'accounts' ? 'accounts' : 'bills';
  const { data } = useData();
  const { ids } = useScoped();
  const [upload, setUpload] = useState(false);
  const [adding, setAdding] = useState(false);
  const accounts = useMemo(() => data.accounts.filter((a) => ids.has(a.buildingId)), [data.accounts, ids]);
  return (
    <Page>
      <PageHeader
        title="Bills"
        subtitle={view === 'bills' ? 'Every utility bill in scope, with its account, period, cost and consumption. A bill that should exist but doesn\'t is listed in Data Health.' : 'Every utility account in scope, who holds it, and whether Enertiv can get its data.'}
        actions={
          view === 'bills' ? (
            <button type="button" className="btn" disabled={!accounts.length} onClick={() => setUpload(true)}>
              <Icon name="upload" /> Upload bills
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              <Icon name="add" /> Add account
            </button>
          )
        }
      />
      <FilterChips
        label="View"
        param="view"
        options={[
          { id: 'bills', label: 'Bills' },
          { id: 'accounts', label: 'Accounts', count: accounts.length },
        ]}
      />
      {view === 'bills' ? <BillsView /> : <AccountsView />}
      {upload && <UploadBillsModal accounts={accounts} defaultAccountId={params.get('building') ? accounts.find((a) => a.buildingId === params.get('building'))?.id : undefined} onClose={() => setUpload(false)} />}
      {adding && <AddAccountModal onClose={() => setAdding(false)} />}
    </Page>
  );
}

function BillsView() {
  const { data } = useData();
  const { building } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const [fb, setFb] = useParamFilter('building');
  const [fu, setFu] = useParamFilter('utility');
  const [fm, setFm] = useParamFilter('month');
  const [fs, setFs] = useParamFilter('source');
  const [fe, setFe] = useParamFilter('estimated');
  const q = useApi(
    `building-info/bills/${scope.id}`,
    () => {
      const accts = data.accounts.filter((a) => ids.has(a.buildingId));
      const acctMap = new Map(accts.map((a) => [a.id, a]));
      const bills = data.bills.filter((b) => ids.has(b.buildingId));
      const rows: BillRow[] = bills.map((b) => ({ kind: 'bill', id: b.id, bill: b, account: acctMap.get(b.accountId) }));
      return { rows: [...rows, ...awaitingRows(accts, bills)], months: [...new Set(bills.map((b) => b.start.slice(0, 7)))].sort().reverse() };
    },
    [data.accounts, data.bills, ids],
  );
  const acctOf = (r: BillRow) => (r.kind === 'bill' ? r.account : r.account);
  const monthOf = (r: BillRow) => (r.kind === 'bill' ? r.bill.start.slice(0, 7) : r.month);
  const rows = useMemo(
    () =>
      (q.data?.rows ?? []).filter((r) => {
        const a = acctOf(r);
        return (
          (fb === 'all' || a?.buildingId === fb) &&
          (fu === 'all' || a?.utility === fu) &&
          (fm === 'all' || monthOf(r) === fm) &&
          (fs === 'all' || (r.kind === 'bill' && r.bill.source === fs)) &&
          (fe === 'all' || (r.kind === 'bill' && r.bill.estimated))
        );
      }),
    [q.data, fb, fu, fm, fs, fe],
  );
  const total = rows.reduce((s, r) => s + (r.kind === 'bill' ? r.bill.cost : 0), 0);
  const est = rows.filter((r) => r.kind === 'bill' && r.bill.estimated).length;
  return (
    <ApiView q={q} what="bills">
      {(d) => (
        <>
          <Toolbar>
            <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
            <SelectFilter label="Utility" value={fu} onChange={setFu} options={[{ value: 'all', label: 'All utilities' }, ...(['electricity', 'gas', 'water', 'steam'] as const).map((u) => ({ value: u, label: UTIL[u] }))]} />
            <SelectFilter label="Billing month" value={fm} onChange={setFm} options={[{ value: 'all', label: 'Any month' }, ...d.months.map((m) => ({ value: m, label: fmtMonthLong(m) }))]} />
            <SelectFilter label="Source" value={fs} onChange={setFs} options={[{ value: 'all', label: 'Extracted or uploaded' }, { value: 'Extracted', label: 'Extracted' }, { value: 'Uploaded', label: 'Uploaded' }]} />
            <SelectFilter label="Estimated" value={fe} onChange={setFe} options={[{ value: 'all', label: 'Actual and estimated' }, { value: 'yes', label: 'Estimated only' }]} />
          </Toolbar>
          <DataTable<BillRow>
            label="Bills"
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => to(`/building-info/bills/${r.kind === 'bill' ? r.bill.id : r.account.id}`)}
            search={(r) => {
              const a = acctOf(r);
              return `${a?.accountNumber ?? ''} ${a?.provider ?? ''} ${building.get(a?.buildingId ?? '')?.name ?? ''}`;
            }}
            searchPlaceholder="Search account numbers, providers or buildings"
            caption={coverCaption(rows.filter((r) => r.kind === 'bill').length, 'bills', scope, buildings.length, `Total ${fmtMoney(total)}${est ? `, including ${est} estimated` : ''}.${rows.some((r) => r.kind === 'awaiting') ? ' Rows marked “Awaiting bill” are the missing half of a supply and delivery pair.' : ''}`)}
            initialSort={{ key: 'start', dir: 'desc' }}
            empty={{ title: d.rows.length ? 'No bills match these filters' : 'No bills yet', body: d.rows.length ? 'Clear a filter to see more.' : 'Bills arrive once a utility account is connected, or upload them yourself.', icon: 'receipt_long' }}
            columns={[
              {
                key: 'period',
                header: 'Bill',
                value: (r) => monthOf(r),
                render: (r) =>
                  r.kind === 'bill' ? (
                    <>
                      {UTIL[r.account?.utility ?? 'electricity']}, {fmtMonth(monthOf(r))}
                    </>
                  ) : (
                    <span className="inline">
                      {UTIL[r.account.utility]}, {fmtMonth(r.month)} <Pill tone="warning" icon="hourglass_top">Awaiting bill</Pill>
                    </span>
                  ),
              },
              ...(showBuilding ? [{ key: 'building', header: 'Building', value: (r: BillRow) => building.get(acctOf(r)?.buildingId ?? '')?.name ?? '' }] : []),
              { key: 'provider', header: 'Provider', value: (r) => acctOf(r)?.provider ?? '', hideOnPhone: true },
              { key: 'utility', header: 'Utility', value: (r) => UTIL[acctOf(r)?.utility ?? 'electricity'], hideOnPhone: true },
              { key: 'account', header: 'Account', value: (r) => acctOf(r)?.accountNumber ?? '', render: (r) => (acctOf(r) ? <Link to={to(`/building-info/bills/${acctOf(r)!.id}`)}>{acctOf(r)!.accountNumber}{acctOf(r)!.role !== 'Bundled' ? ` (${acctOf(r)!.role.toLowerCase()})` : ''}</Link> : '—') },
              { key: 'start', header: 'Start', value: (r) => (r.kind === 'bill' ? r.bill.start : `${r.month}-01`), render: (r) => <span className="nowrap">{fmtDate(r.kind === 'bill' ? r.bill.start : r.partner.start)}</span>, hideOnPhone: true },
              { key: 'end', header: 'End', value: (r) => (r.kind === 'bill' ? r.bill.end : r.partner.end), render: (r) => <span className="nowrap">{fmtDate(r.kind === 'bill' ? r.bill.end : r.partner.end)}</span>, hideOnPhone: true },
              { key: 'issued', header: 'Issued', value: (r) => (r.kind === 'bill' ? r.bill.issued : null), render: (r) => (r.kind === 'bill' ? <span className="nowrap">{fmtDate(r.bill.issued)}</span> : <span className="muted">Not yet</span>), hideOnPhone: true },
              { key: 'cost', header: 'Cost', align: 'right' as const, value: (r) => (r.kind === 'bill' ? r.bill.cost : null), render: (r) => (r.kind === 'bill' ? <span className="num">{fmtMoney(r.bill.cost)}{r.bill.estimated && <> <EstimatedMark /></>}</span> : <span className="muted">Awaiting bill</span>) },
              { key: 'use', header: 'Consumption', align: 'right' as const, value: (r) => (r.kind === 'bill' ? r.bill.consumption : null), render: (r) => (r.kind === 'bill' ? <span className="num">{fmtInt(r.bill.consumption)} {r.bill.unit}</span> : <span className="muted">Awaiting bill</span>) },
              { key: 'est', header: 'Estimated', value: (r) => (r.kind === 'bill' && r.bill.estimated ? 'Yes' : 'No'), hideOnPhone: true },
              { key: 'source', header: 'Source', value: (r) => (r.kind === 'bill' ? r.bill.source : ''), hideOnPhone: true },
            ]}
          />
          <UploadQueue buildingIds={ids} />
        </>
      )}
    </ApiView>
  );
}

function CredentialsPill({ a }: { a: UtilityAccount }) {
  if (a.credentials === 'Failed') return <Pill tone="danger" icon="error">Login failing</Pill>;
  if (a.credentials === 'Working') return <Pill tone="success" icon="check_circle">Working</Pill>;
  return <span className="muted">Not needed</span>;
}

function ExtractionPill({ a }: { a: UtilityAccount }) {
  const tone = a.extraction === 'Successful' ? 'success' : a.extraction === 'Failed' ? 'danger' : a.extraction === 'Paused' ? 'neutral' : 'info';
  return <Pill tone={tone}>{a.extraction}</Pill>;
}

function AccountsView() {
  const { data } = useData();
  const { building, tenant } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const [fb, setFb] = useParamFilter('building');
  const [fu, setFu] = useParamFilter('utility');
  const [fh, setFh] = useParamFilter('holder');
  const [fx, setFx] = useParamFilter('state');
  const q = useApi(`building-info/accounts/${scope.id}`, () => data.accounts.filter((a) => ids.has(a.buildingId)), [data.accounts, ids]);
  const all = q.data ?? [];
  const rows = all.filter(
    (a) =>
      (fb === 'all' || a.buildingId === fb) &&
      (fu === 'all' || a.utility === fu) &&
      (fh === 'all' || (fh === 'landlord' ? a.holder === 'landlord' : a.holder !== 'landlord')) &&
      (fx === 'all' || (fx === 'failing' ? a.credentials === 'Failed' || a.extraction === 'Failed' : a.extraction === fx)),
  );
  const failing = all.filter((a) => a.credentials === 'Failed' || a.extraction === 'Failed').length;
  return (
    <ApiView q={q} what="utility accounts">
      {() => (
        <>
          {failing > 0 && fx !== 'failing' && (
            <div className="banner banner--warning">
              <Icon name="warning" />
              <div>
                <strong>
                  {failing} {failing === 1 ? 'account' : 'accounts'} can't be read
                </strong>{' '}
                because the utility login is failing or extraction failed. New bills stop arriving until the login is updated.
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFx('failing')}>
                Show them
              </button>
            </div>
          )}
          <Toolbar>
            <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
            <SelectFilter label="Utility" value={fu} onChange={setFu} options={[{ value: 'all', label: 'All utilities' }, ...(['electricity', 'gas', 'water', 'steam'] as const).map((u) => ({ value: u, label: UTIL[u] }))]} />
            <SelectFilter label="Account holder" value={fh} onChange={setFh} options={[{ value: 'all', label: 'Any holder' }, { value: 'landlord', label: 'Landlord' }, { value: 'tenant', label: 'Tenants' }]} />
            <SelectFilter label="Data" value={fx} onChange={setFx} options={[{ value: 'all', label: 'Any extraction state' }, { value: 'failing', label: "Can't get data" }, { value: 'Successful', label: 'Successful' }, { value: 'Pending', label: 'Pending' }, { value: 'Paused', label: 'Paused' }]} />
          </Toolbar>
          <DataTable<UtilityAccount>
            label="Utility accounts"
            rows={rows}
            rowKey={(a) => a.id}
            rowHref={(a) => to(`/building-info/bills/${a.id}`)}
            search={(a) => `${a.accountNumber} ${a.provider} ${building.get(a.buildingId)?.name ?? ''} ${holderName(a, (id) => tenant.get(id)?.name)}`}
            searchPlaceholder="Search account numbers, providers or holders"
            caption={coverCaption(rows.length, rows.length === 1 ? 'account' : 'accounts', scope, buildings.length, `${failing} can't be read.`)}
            initialSort={{ key: 'state', dir: 'asc' }}
            empty={{ title: all.length ? 'No accounts match these filters' : 'No utility accounts yet', body: all.length ? 'Clear a filter to see more.' : 'Add an account, or Enertiv adds them during onboarding.', icon: 'account_balance' }}
            columns={[
              { key: 'number', header: 'Account', value: (a) => a.accountNumber, render: (a) => (
                <>
                  {a.accountNumber}
                  {a.role !== 'Bundled' && <span className="cell-sub">{a.role}, paired</span>}
                </>
              ) },
              ...(showBuilding ? [{ key: 'building', header: 'Building', value: (a: UtilityAccount) => building.get(a.buildingId)?.name ?? '' }] : []),
              { key: 'provider', header: 'Provider', value: (a) => a.provider, hideOnPhone: true },
              { key: 'utility', header: 'Utility', value: (a) => UTIL[a.utility] },
              { key: 'holder', header: 'Account holder', value: (a) => holderName(a, (id) => tenant.get(id)?.name), render: (a) => (a.holder === 'landlord' ? 'Landlord' : <Link to={to(`/people/tenants/${a.holder}`)}>{tenant.get(a.holder)?.name ?? 'Tenant'}</Link>) },
              { key: 'creds', header: 'Utility login', value: (a) => a.credentials, render: (a) => <CredentialsPill a={a} /> },
              { key: 'state', header: 'Extraction', value: (a) => (a.extraction === 'Failed' ? 0 : a.extraction === 'Pending' ? 1 : 2), render: (a) => <ExtractionPill a={a} /> },
              { key: 'last', header: 'Last extracted', value: (a) => a.lastExtracted, render: (a) => fmtDate(a.lastExtracted), hideOnPhone: true },
              { key: 'ok', header: 'Last successful', value: (a) => a.lastSuccessful, render: (a) => fmtDate(a.lastSuccessful), hideOnPhone: true },
              { key: 'next', header: 'Next bill expected', value: (a) => a.nextExpected, render: (a) => fmtDate(a.nextExpected), hideOnPhone: true },
              { key: 'enabled', header: 'Enabled', value: (a) => (a.enabled ? 'Yes' : 'No'), hideOnPhone: true },
            ]}
          />
        </>
      )}
    </ApiView>
  );
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const { data, add } = useData();
  const { buildings } = useScoped();
  const { to, navigate } = useNav();
  const record = useRecordActivity();
  const toast = useToast();
  const [bid, setBid] = useState(buildings[0]?.id ?? '');
  const [utility, setUtility] = useState<Utility>('electricity');
  const [provider, setProvider] = useState('');
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('landlord');
  const [role, setRole] = useState<UtilityAccount['role']>('Bundled');
  const tenants = data.tenants.filter((t) => !t.prior && t.buildingIds.includes(bid));
  const providers = [...new Set(data.accounts.filter((a) => a.utility === utility).map((a) => a.provider))].sort();
  const valid = bid && provider.trim() && number.trim();
  const save = () => {
    const a: UtilityAccount = {
      id: `acct-new-${Date.now()}`, buildingId: bid, provider: provider.trim(), utility, accountNumber: number.trim(), holder, tariff: 'To be confirmed', credentials: 'Not needed', enrolment: 'Pending', extraction: 'Pending',
      lastExtracted: null, lastSuccessful: null, nextExpected: null, enabled: true, closed: false, meterIds: [], pairedWith: null, role,
    };
    add('accounts', a);
    record({ kind: 'account', id: a.id, label: `${UTIL[utility]} account ${a.accountNumber}` }, 'Utility account added in the web app', bid);
    toast('Account added. Enertiv will contact you to connect it.');
    onClose();
    navigate(to(`/building-info/bills/${a.id}`));
  };
  return (
    <Modal
      title="Add a utility account"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!valid} onClick={save}>
            Add account
          </button>
        </>
      }
    >
      <label className="field">
        <span>Building</span>
        <select value={bid} onChange={(e) => { setBid(e.target.value); setHolder('landlord'); }}>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Utility</span>
          <select value={utility} onChange={(e) => setUtility(e.target.value as Utility)}>
            {(['electricity', 'gas', 'water', 'steam'] as const).map((u) => (
              <option key={u} value={u}>
                {UTIL[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Provider</span>
          <input type="text" list="bi-providers" value={provider} onChange={(e) => setProvider(e.target.value)} />
          <datalist id="bi-providers">
            {providers.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Account number</span>
          <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Account holder</span>
          <select value={holder} onChange={(e) => setHolder(e.target.value)}>
            <option value="landlord">Landlord</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (tenant)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Billing</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UtilityAccount['role'])}>
            <option value="Bundled">Supply and delivery on one bill</option>
            <option value="Delivery">Delivery only</option>
            <option value="Supply">Supply only</option>
          </select>
        </label>
      </div>
      <p className="muted bi-modal-note">No utility login is needed here. Enertiv contacts you, or the tenant who holds the account, to connect it.</p>
    </Modal>
  );
}

/* ---------- Detail: a bill or an account ---------- */

export function BillOrAccountDetail({ id }: { id: string }) {
  return id.startsWith('acct-') ? <AccountDetail id={id} /> : <BillDetail id={id} />;
}

function BillDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { account, building, tenant } = useLookup();
  const { to } = useNav();
  const q = useApi(`building-info/bills/${id}`, () => data.bills.find((b) => b.id === id) ?? null, [data.bills, id]);
  if (q.status === 'ready' && !q.data) return <NotFoundObject what="bill" backTo={to('/building-info/bills')} backLabel="Back to bills" />;
  return (
    <Page>
      <ApiView q={q} what="this bill">
        {(bill) => {
          const a = account.get(bill.accountId);
          const b = building.get(bill.buildingId);
          if (!b || !accessible.has(b.id)) return <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />;
          const meters = data.meters.filter((m) => a?.meterIds.includes(m.id));
          const created: ActivityItem = { id: `act-bill-${bill.id}`, at: `${bill.issued}T09:00:00`, who: bill.source === 'Uploaded' ? 'Uploaded bill' : 'Enertiv extraction', what: bill.source === 'Uploaded' ? 'Bill uploaded and read' : `Bill extracted from ${a?.provider ?? 'the utility'}`, object: { kind: 'bill', id: bill.id, label: `Bill ${fmtMonth(bill.start.slice(0, 7))}` }, buildingId: b.id };
          return (
            <>
              <PageHeader
                back={{ to: to('/building-info/bills'), label: 'Bills' }}
                eyebrow={
                  <>
                    {UTIL[a?.utility ?? 'electricity']} bill · <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                  </>
                }
                title={`${a?.provider ?? 'Utility'}, ${fmtDate(bill.start)} to ${fmtDate(bill.end)}`}
                actions={bill.estimated ? <Pill tone="warning">Estimated</Pill> : <Pill tone="success">Actual</Pill>}
              />
              <div className="bi-bill-layout">
                <div>
                  <Section title="Bill">
                    <RecordTable
                      label="Bill record"
                      rows={[
                        ['Account', a ? <Link to={to(`/building-info/bills/${a.id}`)}>{a.accountNumber}</Link> : '—'],
                        ['Building', <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>],
                        ['Provider', a?.provider],
                        ['Utility', UTIL[a?.utility ?? 'electricity']],
                        ['Tariff', a?.tariff],
                        ['Start', fmtDate(bill.start)],
                        ['End', fmtDate(bill.end)],
                        ['Issued', fmtDate(bill.issued)],
                        ['Total cost', <span className="num">{fmtMoney(bill.cost)}{bill.estimated && <> <EstimatedMark /></>}</span>],
                        ['Consumption', `${fmtInt(bill.consumption)} ${bill.unit}`],
                        ['Allocation', a ? (a.holder === 'landlord' ? 'Landlord, whole building' : `Tenant: ${tenant.get(a.holder)?.name ?? 'tenant'}`) : '—'],
                        ['Estimated', bill.estimated ? 'Yes, the utility estimated this read' : 'No'],
                        ['Source', bill.source === 'Uploaded' ? 'Uploaded' : 'Extracted from the utility'],
                      ]}
                    />
                  </Section>
                  <Section title="Line items">
                    <DataTable<BillLine & { k: number }>
                      label="Line items"
                      rows={bill.lines.map((l, k) => ({ ...l, k }))}
                      rowKey={(l) => String(l.k)}
                      caption={`Line items add up to ${fmtMoney(bill.lines.reduce((s, l) => s + l.amount, 0))}.`}
                      columns={[
                        { key: 'charge', header: 'Charge', value: (l) => l.charge },
                        { key: 'amount', header: 'Amount', align: 'right' as const, value: (l) => l.amount, render: (l) => <span className="num">{fmtMoney(l.amount)}</span> },
                        { key: 'maps', header: 'Maps to', value: (l) => l.mapsTo },
                      ]}
                    />
                  </Section>
                  <Section title="Meters on this bill">
                    <MetersTable meters={meters} />
                  </Section>
                </div>
                <aside>
                  <div className="bi-pdf" role="img" aria-label={`Preview of the ${a?.provider ?? ''} bill PDF`}>
                    <div className="bi-pdf-head">
                      <strong>{a?.provider}</strong>
                      <span>Account {a?.accountNumber}</span>
                    </div>
                    <div className="bi-pdf-line" />
                    <p>
                      Service period {fmtDate(bill.start)} – {fmtDate(bill.end)}
                    </p>
                    <p className="bi-pdf-total">Amount due {fmtMoney(bill.cost)}</p>
                    {bill.lines.map((l) => (
                      <p key={l.charge} className="bi-pdf-row">
                        <span>{l.charge}</span>
                        <span>{fmtMoney(l.amount)}</span>
                      </p>
                    ))}
                    <div className="bi-pdf-line" />
                    <p className="muted">PDF preview. The original opens from the utility's portal in the live app.</p>
                  </div>
                </aside>
              </div>
              <Section title="Activity">
                <ActivityTab label="Bill activity" filter={(x) => x.object.id === bill.id} extra={[created]} showObject={false} />
              </Section>
            </>
          );
        }}
      </ApiView>
    </Page>
  );
}

function MetersTable({ meters }: { meters: Meter[] }) {
  const { to } = useNav();
  return (
    <DataTable<Meter>
      label="Meters"
      rows={meters}
      rowKey={(m) => m.id}
      rowHref={(m) => to(`/building-info/meters/${m.id}`)}
      empty={{ title: 'No meters mapped', body: 'An account without a meter is listed in Data Health; Enertiv maps it during setup.', icon: 'speed' }}
      columns={[
        { key: 'name', header: 'Meter', value: (m) => m.name },
        { key: 'utility', header: 'Utility', value: (m) => UTIL[m.utility] },
        { key: 'source', header: 'Data source', value: (m) => m.dataSource, hideOnPhone: true },
        { key: 'reporting', header: 'Reporting', render: (m) => <ReportingPill m={m} /> },
      ]}
    />
  );
}

const ACCT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'bills', label: 'Bills' },
  { id: 'activity', label: 'Activity' },
];

function AccountDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { account, building, tenant } = useLookup();
  const { to } = useNav();
  const tab = useTab(ACCT_TABS);
  const [upload, setUpload] = useState(false);
  const q = useApi(`building-info/accounts/${id}`, () => data.accounts.find((a) => a.id === id) ?? null, [data.accounts, id]);
  if (q.status === 'ready' && !q.data) return <NotFoundObject what="utility account" backTo={to('/building-info/bills?view=accounts')} backLabel="Back to accounts" />;
  return (
    <Page>
      <ApiView q={q} what="this account">
        {(a) => {
          const b = building.get(a.buildingId);
          if (!b || !accessible.has(b.id)) return <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />;
          const partner = a.pairedWith ? account.get(a.pairedWith) : undefined;
          const bills = data.bills.filter((x) => x.accountId === a.id);
          const meters = data.meters.filter((m) => a.meterIds.includes(m.id) || (partner && partner.meterIds.includes(m.id)));
          const items = data.health.filter((h) => h.object.id === a.id || bills.some((x) => x.id === h.object.id));
          const firstExtraction = bills.map((x) => x.issued).sort()[0] ?? null;
          const awaiting = partner ? awaitingRows([a], [...bills, ...data.bills.filter((x) => x.accountId === partner.id)]) : [];
          return (
            <>
              <PageHeader
                back={{ to: to('/building-info/bills?view=accounts'), label: 'Accounts' }}
                eyebrow={
                  <>
                    {UTIL[a.utility]} account · <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                  </>
                }
                title={`${a.provider} ${a.accountNumber}`}
                subtitle={a.holder === 'landlord' ? 'Held by the landlord' : `Held by ${tenant.get(a.holder)?.name ?? 'a tenant'}`}
                actions={
                  <button type="button" className="btn btn--ghost" onClick={() => setUpload(true)}>
                    <Icon name="upload" /> Upload bills
                  </button>
                }
              />
              {(a.credentials === 'Failed' || a.extraction === 'Failed') && (
                <div className="banner banner--danger">
                  <Icon name="error" />
                  <div>
                    <strong>Enertiv can't get this account's data.</strong> The utility rejected the saved login; the last successful extraction was {fmtDate(a.lastSuccessful)}.
                    {items.find((h) => h.status === 'open') && (
                      <>
                        {' '}
                        <Link to={to(`/building-info/data-health?item=${items.find((h) => h.status === 'open')!.id}`)}>Open the data health item</Link> to fix it.
                      </>
                    )}
                  </div>
                </div>
              )}
              <Tabs label="Account views" tabs={ACCT_TABS.map((t) => (t.id === 'bills' ? { ...t, count: bills.length } : t))} />
              {tab === 'summary' && (
                <>
                  <Section title="Account">
                    <RecordTable
                      label="Account record"
                      rows={[
                        ['Provider', a.provider],
                        ['Account number', a.accountNumber],
                        ['Account holder', a.holder === 'landlord' ? 'Landlord' : <Link to={to(`/people/tenants/${a.holder}`)}>{tenant.get(a.holder)?.name ?? 'Tenant'}</Link>],
                        ['Utility', UTIL[a.utility]],
                        ['Tariff', a.tariff],
                        ['Billing', a.role === 'Bundled' ? 'Supply and delivery on one bill' : `${a.role} only, paired with ${partner ? partner.accountNumber : 'another account'}`],
                        ['Enabled', a.enabled ? 'Yes' : 'No'],
                        ['Enrolment', a.enrolment],
                        ['Utility login', <CredentialsPill a={a} />],
                        ['Extraction', <ExtractionPill a={a} />],
                        ['Monitoring', a.enabled && a.extraction !== 'Paused' ? 'On' : 'Off'],
                        ['First extraction', fmtDate(firstExtraction)],
                        ['Last extraction', fmtDate(a.lastExtracted)],
                        ['Last successful', fmtDate(a.lastSuccessful)],
                        ['Next bill expected', fmtDate(a.nextExpected)],
                        ['Closed', a.closed ? 'Yes' : 'No'],
                      ]}
                    />
                  </Section>
                  {partner && (
                    <Section title="Supply and delivery pair">
                      <p>
                        This {a.role.toLowerCase()} account pairs with the {partner.role.toLowerCase()} account <Link to={to(`/building-info/bills/${partner.id}`)}>{partner.provider} {partner.accountNumber}</Link>. Both bills make up the month's cost.
                        {awaiting.length > 0 && (
                          <>
                            {' '}
                            <Pill tone="warning" icon="hourglass_top">
                              Awaiting bill
                            </Pill>{' '}
                            for {awaiting.map((r) => (r.kind === 'awaiting' ? fmtMonth(r.month) : '')).join(', ')}.
                          </>
                        )}
                      </p>
                    </Section>
                  )}
                  <Section title="Meters">
                    <MetersTable meters={meters} />
                  </Section>
                  <Section title="Data health items">
                    <DataTable
                      label="Data health items for this account"
                      rows={items}
                      rowKey={(h) => h.id}
                      rowHref={(h) => to(`/building-info/data-health?item=${h.id}&status=all`)}
                      empty={{ title: 'Nothing flagged on this account', icon: 'check_circle' }}
                      columns={[
                        { key: 'problem', header: 'Problem', value: (h) => h.problem },
                        { key: 'severity', header: 'Impact', value: (h) => h.severity, render: (h) => <SeverityPill severity={h.severity} /> },
                        { key: 'status', header: 'Status', value: (h) => h.status, render: (h) => (h.status === 'open' ? 'Open' : h.status === 'expected' ? 'Expected' : 'Resolved') },
                        { key: 'opened', header: 'Opened', value: (h) => h.opened, render: (h) => fmtDate(h.opened) },
                      ]}
                    />
                  </Section>
                </>
              )}
              {tab === 'bills' && (
                <>
                  <DataTable<BillRow>
                    label="Bills on this account"
                    rows={[...bills.map<BillRow>((x) => ({ kind: 'bill', id: x.id, bill: x, account: a })), ...awaiting]}
                    rowKey={(r) => r.id}
                    rowHref={(r) => (r.kind === 'bill' ? to(`/building-info/bills/${r.bill.id}`) : undefined)}
                    initialSort={{ key: 'start', dir: 'desc' }}
                    empty={{ title: 'No bills yet', body: 'Bills arrive once the account is connected, or upload them.', icon: 'receipt_long' }}
                    columns={[
                      { key: 'start', header: 'Period', value: (r) => (r.kind === 'bill' ? r.bill.start : `${r.month}-01`), render: (r) => (r.kind === 'bill' ? `${fmtDate(r.bill.start)} – ${fmtDate(r.bill.end)}` : <span className="inline">{fmtMonth(r.month)} <Pill tone="warning" icon="hourglass_top">Awaiting bill</Pill></span>) },
                      { key: 'issued', header: 'Issued', value: (r) => (r.kind === 'bill' ? r.bill.issued : null), render: (r) => (r.kind === 'bill' ? fmtDate(r.bill.issued) : '—'), hideOnPhone: true },
                      { key: 'cost', header: 'Cost', align: 'right' as const, value: (r) => (r.kind === 'bill' ? r.bill.cost : null), render: (r) => (r.kind === 'bill' ? <span className="num">{fmtMoney(r.bill.cost)}{r.bill.estimated && <> <EstimatedMark /></>}</span> : <span className="muted">Awaiting bill</span>) },
                      { key: 'use', header: 'Consumption', align: 'right' as const, value: (r) => (r.kind === 'bill' ? r.bill.consumption : null), render: (r) => (r.kind === 'bill' ? `${fmtInt(r.bill.consumption)} ${r.bill.unit}` : '—') },
                      { key: 'source', header: 'Source', value: (r) => (r.kind === 'bill' ? r.bill.source : ''), hideOnPhone: true },
                    ]}
                  />
                  <UploadQueue buildingIds={new Set([b.id])} accountIds={[a.id]} />
                </>
              )}
              {tab === 'activity' && <ActivityTab label="Account activity" filter={(x) => x.object.id === a.id} showObject={false} />}
              {upload && <UploadBillsModal accounts={[a]} defaultAccountId={a.id} onClose={() => setUpload(false)} />}
            </>
          );
        }}
      </ApiView>
    </Page>
  );
}

