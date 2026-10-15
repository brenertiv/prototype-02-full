/**
 * Writes Building Info makes to the per-session overlay: bill uploads with their queue
 * (MOD-BI-12, 69), and the data health item actions (MOD-BI-17, 64): mark as expected,
 * upload a replacement, contact the tenant through the chase agent, contact Enertiv.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import { addDays, addMonths } from '../data/rand';
import type { Bill, ChaseRequest, HealthItem, UtilityAccount } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { Pill } from '../ui/bits';
import { fmtDateTime, fmtMonth } from '../ui/format';
import { human, TODAY, UTIL, useRecordActivity } from './shared';

/* ---------- Upload queue ---------- */

export interface UploadEntry {
  id: string;
  file: string;
  accountId: string;
  buildingId: string;
  by: string;
  at: string;
  createdMs: number;
  billId: string;
  month: string;
}

const UPLOADS_KEY = 'bi.uploads';

export function useUploads() {
  const { getApp } = useData();
  return getApp<UploadEntry[]>(UPLOADS_KEY, []);
}

/** Creates the bill an upload yields and resolves the bill items it answers. */
export function useUploadBill() {
  const { data, add, patch, setApp, getApp, user } = useData();
  const { account } = useLookup();
  const record = useRecordActivity();
  return (accountId: string, files: string[], opts?: { month?: string; item?: HealthItem }) => {
    const a = account.get(accountId);
    if (!a) return [];
    const existing = data.bills.filter((b) => b.accountId === a.id).sort((x, y) => y.start.localeCompare(x.start));
    const have = new Set(existing.map((b) => b.start.slice(0, 7)));
    const recent = existing.slice(0, 3);
    const avgC = recent.length ? Math.round(recent.reduce((s, b) => s + b.consumption, 0) / recent.length) : a.utility === 'electricity' ? 42000 : 1800;
    const avgCost = recent.length ? Math.round(recent.reduce((s, b) => s + b.cost, 0) / recent.length) : Math.round(avgC * 0.15);
    const queue = getApp<UploadEntry[]>(UPLOADS_KEY, []);
    const created: UploadEntry[] = [];
    let taken = new Set(have);
    files.forEach((file, k) => {
      // The period: the one asked for, else the most recent missing month in the last year.
      let month = k === 0 ? opts?.month : undefined;
      if (!month) {
        for (let m = 1; m <= 12; m++) {
          const ym = addMonths(`${TODAY.slice(0, 7)}-01`, -m).slice(0, 7);
          if (!taken.has(ym)) {
            month = ym;
            break;
          }
        }
      }
      if (!month) month = addMonths(`${TODAY.slice(0, 7)}-01`, -1).slice(0, 7);
      taken = new Set([...taken, month]);
      const start = `${month}-01`;
      const end = addDays(addMonths(start, 1), -1);
      const billId = `bill-up-${Date.now()}-${k}`;
      const cost = avgCost;
      const bill: Bill = {
        id: billId,
        accountId: a.id,
        buildingId: a.buildingId,
        start,
        end,
        issued: addDays(end, 6),
        cost,
        consumption: avgC,
        unit: existing[0]?.unit ?? (a.utility === 'electricity' ? 'kWh' : a.utility === 'gas' ? 'therms' : a.utility === 'water' ? 'kgal' : 'Mlb'),
        estimated: false,
        source: 'Uploaded',
        lines: [
          { charge: 'Energy charge', amount: Math.round(cost * 0.62), mapsTo: 'Consumption cost' },
          { charge: 'Demand charge', amount: Math.round(cost * 0.21), mapsTo: 'Demand cost' },
          { charge: 'Distribution', amount: Math.round(cost * 0.12), mapsTo: 'Delivery cost' },
          { charge: 'Taxes and fees', amount: cost - Math.round(cost * 0.62) - Math.round(cost * 0.21) - Math.round(cost * 0.12), mapsTo: 'Taxes' },
        ],
      };
      add('bills', bill);
      const entry: UploadEntry = { id: `up-${Date.now()}-${k}`, file, accountId: a.id, buildingId: a.buildingId, by: user.name, at: `${TODAY}T${new Date().toTimeString().slice(0, 8)}`, createdMs: Date.now(), billId, month };
      created.push(entry);
      record({ kind: 'account', id: a.id, label: `${UTIL[a.utility]} account ${a.accountNumber}` }, `Bill for ${fmtMonth(month)} uploaded (${file})`, a.buildingId);
      // Resolve the bill items this upload answers (missing, late or $0 for that month).
      for (const h of data.health) {
        if (h.status !== 'open' || h.family !== 'Bills') continue;
        const onAccount = h.object.id === a.id || (h.object.kind === 'bill' && existing.some((b) => b.id === h.object.id));
        const hm = h.evidence.match(/\d{4}-\d{2}/)?.[0];
        if ((onAccount && (!hm || hm === month)) || opts?.item?.id === h.id) {
          patch('health', h.id, { status: 'resolved', lastChecked: TODAY });
        }
      }
    });
    if (opts?.item && opts.item.status === 'open') patch('health', opts.item.id, { status: 'resolved', lastChecked: TODAY });
    setApp(UPLOADS_KEY, [...created, ...queue]);
    return created;
  };
}

function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => set((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [active]);
}

export function uploadStatus(u: UploadEntry) {
  return Date.now() - u.createdMs < 4000 ? 'Extracting' : 'Extracted';
}

export function UploadQueue({ accountIds, buildingIds }: { accountIds?: string[]; buildingIds: Set<string> }) {
  const uploads = useUploads();
  const { account, building } = useLookup();
  const { to } = useNav();
  const rows = useMemo(() => uploads.filter((u) => buildingIds.has(u.buildingId) && (!accountIds || accountIds.includes(u.accountId))), [uploads, accountIds, buildingIds]);
  useTick(rows.some((u) => Date.now() - u.createdMs < 5000));
  if (!rows.length) return null;
  return (
    <DataTable<UploadEntry>
      label="Upload queue"
      rows={rows}
      rowKey={(u) => u.id}
      caption="Bills uploaded this session. Enertiv reads each one and adds it to its account."
      dense
      columns={[
        { key: 'file', header: 'File', value: (u) => u.file },
        { key: 'account', header: 'Account', value: (u) => account.get(u.accountId)?.accountNumber ?? '', render: (u) => <Link to={to(`/building-info/bills/${u.accountId}`)}>{account.get(u.accountId)?.accountNumber}</Link> },
        { key: 'building', header: 'Building', value: (u) => building.get(u.buildingId)?.name ?? '', hideOnPhone: true },
        { key: 'by', header: 'Uploaded by', value: (u) => u.by, hideOnPhone: true },
        { key: 'at', header: 'Uploaded', value: (u) => u.at, render: (u) => fmtDateTime(u.at) },
        {
          key: 'status',
          header: 'Status',
          render: (u) =>
            uploadStatus(u) === 'Extracting' ? (
              <Pill tone="info" icon="hourglass_top">
                Reading the bill
              </Pill>
            ) : (
              <span className="inline">
                <Pill tone="success" icon="check_circle">
                  Added
                </Pill>
                <Link to={to(`/building-info/bills/${u.billId}`)}>{fmtMonth(u.month)} bill</Link>
              </span>
            ),
        },
      ]}
    />
  );
}

/** Upload bills to an account (MOD-BI-12, 69). Credentials are never asked for here. */
export function UploadBillsModal({ accounts, defaultAccountId, item, month, onClose }: { accounts: UtilityAccount[]; defaultAccountId?: string; item?: HealthItem; month?: string; onClose: () => void }) {
  const { building, tenant } = useLookup();
  const upload = useUploadBill();
  const toast = useToast();
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '');
  const [files, setFiles] = useState<string[]>([]);
  const sorted = useMemo(() => [...accounts].sort((a, b) => (building.get(a.buildingId)?.name ?? '').localeCompare(building.get(b.buildingId)?.name ?? '') || a.utility.localeCompare(b.utility)), [accounts, building]);
  const holder = (a: UtilityAccount) => (a.holder === 'landlord' ? 'Landlord' : tenant.get(a.holder)?.name ?? 'Tenant');
  const submit = () => {
    const made = upload(accountId, files, { month, item });
    toast(`${made.length} ${made.length === 1 ? 'bill' : 'bills'} uploaded. Enertiv is reading ${made.length === 1 ? 'it' : 'them'} now.`);
    onClose();
  };
  return (
    <Modal
      title={item ? 'Upload a replacement bill' : 'Upload bills'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!accountId || !files.length} onClick={submit}>
            <Icon name="upload" /> Upload {files.length ? files.length : ''} {files.length === 1 ? 'bill' : 'bills'}
          </button>
        </>
      }
    >
      {item && (
        <p className="bi-modal-lead">
          {item.problem}: {human(item.evidence)}. The uploaded bill goes on the account below and resolves this item.
        </p>
      )}
      <label className="field">
        <span>Utility account</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {sorted.map((a) => (
            <option key={a.id} value={a.id}>
              {building.get(a.buildingId)?.name} · {UTIL[a.utility]} · {a.provider} {a.accountNumber} · {holder(a)}
            </option>
          ))}
        </select>
      </label>
      {month && <p className="muted">Billing period: {human(month)}</p>}
      <label className="field">
        <span>Bill files (PDF)</span>
        <input type="file" accept=".pdf,image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </label>
      <button type="button" className="text-btn" onClick={() => setFiles([`${UTIL[(accounts.find((a) => a.id === accountId) ?? accounts[0])?.utility ?? 'electricity']} bill ${month ?? 'latest'}.pdf`])}>
        Use a sample bill instead
      </button>
      {files.length > 0 && (
        <ul className="bi-file-list">
          {files.map((f) => (
            <li key={f}>
              <Icon name="description" /> {f}
            </li>
          ))}
        </ul>
      )}
      <p className="muted bi-modal-note">Files stay in this prototype session; nothing is sent anywhere.</p>
    </Modal>
  );
}

/* ---------- Data health item actions (MOD-BI-17, 64) ---------- */

const EXPECTED_REASONS = ['Space was vacant that month', 'Utility not sold for this building', 'Gas off outside the heating season', 'Building closed for renovation', 'Other'];

export function MarkExpectedModal({ item, onClose }: { item: HealthItem; onClose: () => void }) {
  const { patch } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [reason, setReason] = useState(EXPECTED_REASONS[0]);
  const [other, setOther] = useState('');
  const text = reason === 'Other' ? other.trim() : reason;
  return (
    <Modal
      title="Mark as expected"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={!text}
            onClick={() => {
              patch('health', item.id, { status: 'expected', expectedReason: text, lastChecked: TODAY });
              record(item.object, `Data health item marked as expected: ${text}`, item.buildingId);
              toast('Marked as expected. The reason stays on the item.');
              onClose();
            }}
          >
            Mark as expected
          </button>
        </>
      }
    >
      <p className="bi-modal-lead">“{item.problem}” stops counting against this building. It stays listed under Expected with your reason, and you can reopen it.</p>
      <fieldset className="bi-radios">
        <legend>Why is this expected?</legend>
        {EXPECTED_REASONS.map((r) => (
          <label key={r} className="check">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </fieldset>
      {reason === 'Other' && (
        <label className="field">
          <span>Reason</span>
          <input type="text" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
        </label>
      )}
    </Modal>
  );
}

export function ContactEnertivModal({ item, onClose }: { item: HealthItem; onClose: () => void }) {
  const { patch } = useData();
  const record = useRecordActivity();
  const toast = useToast();
  const [kind, setKind] = useState<'ticket' | 'rep'>('ticket');
  const [note, setNote] = useState('');
  return (
    <Modal
      title="Contact Enertiv"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const id = `TCK-${4830 + (Date.now() % 900)}`;
              patch('health', item.id, { ticket: { id, status: 'Open', kind, opened: TODAY } });
              record(item.object, kind === 'ticket' ? `Ticket ${id} created with Enertiv${note ? `: ${note}` : ''}` : `Enertiv account team asked to get in touch${note ? `: ${note}` : ''}`, item.buildingId);
              toast(kind === 'ticket' ? `Ticket ${id} created. Its status shows on the item.` : 'Your account team will get in touch. The request shows on the item.');
              onClose();
            }}
          >
            {kind === 'ticket' ? 'Create ticket' : 'Contact my rep'}
          </button>
        </>
      }
    >
      <fieldset className="bi-radios">
        <legend className="sr-only">How to contact Enertiv</legend>
        <label className="check bi-radio-card">
          <input type="radio" name="kind" checked={kind === 'ticket'} onChange={() => setKind('ticket')} />
          <span>
            <strong>Create a ticket</strong>
            <span className="cell-sub">Enertiv's support team investigates. The ticket carries this item, its building, object and evidence; you don't need to describe it.</span>
          </span>
        </label>
        <label className="check bi-radio-card">
          <input type="radio" name="kind" checked={kind === 'rep'} onChange={() => setKind('rep')} />
          <span>
            <strong>Contact your rep</strong>
            <span className="cell-sub">Your Enertiv account team gets in touch, for questions about scope, contracts or setup.</span>
          </span>
        </label>
      </fieldset>
      <label className="field">
        <span>Anything to add (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Modal>
  );
}

export const STAGE_TEXT: Record<ChaseRequest['stage'], string> = {
  'not-sent': 'Not sent',
  sent: 'Sent',
  reminded: 'Reminded',
  escalated: 'Escalated',
  completed: 'Completed',
  declined: 'Declined',
  'contact-unknown': 'No contact on file',
  'moved-out': 'Tenant moved out',
};

export function ContactTenantModal({ item, onClose }: { item: HealthItem; onClose: () => void }) {
  const { add } = useData();
  const { tenant } = useLookup();
  const { to } = useNav();
  const record = useRecordActivity();
  const toast = useToast();
  const t = item.tenantId ? tenant.get(item.tenantId) : undefined;
  const month = item.evidence.match(/\d{4}-\d{2}/)?.[0];
  const what = item.problem === 'Utility login is failing' ? 'Updated utility login or a letter of authorisation' : `${item.utility ? UTIL[item.utility] : 'Utility'} bill${month ? ` for ${human(month)}` : 's for the last 12 months'}`;
  const contact = t?.contacts[0];
  return (
    <Modal
      title="Contact the tenant"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={!t}
            onClick={() => {
              if (!t) return;
              const req: ChaseRequest = {
                id: `rq-bi-${Date.now()}`,
                to: { kind: 'tenant', id: t.id, name: t.name },
                what,
                buildingId: item.buildingId,
                spaceId: t.spaceIds[0] ?? null,
                period: month ?? 'Last 12 months',
                stage: contact ? 'sent' : 'not-sent',
                lastChased: contact ? TODAY : null,
                channel: contact ? 'Email' : 'None',
                needsApproval: null,
                healthItemId: item.id,
              };
              add('requests', req);
              record(item.object, contact ? `Chase agent asked ${t.name} for: ${what}` : `Request to ${t.name} created, not sent: no contact on file`, item.buildingId);
              toast(contact ? `Request sent to ${t.name}. The chase agent follows up after 7 days.` : `Request saved but not sent: ${t.name} has no contact on file.`, { tone: contact ? 'success' : 'warning' });
              onClose();
            }}
          >
            {contact ? 'Send request' : 'Save request'}
          </button>
        </>
      }
    >
      {!t ? (
        <p>This item isn't linked to a tenant.</p>
      ) : (
        <>
          <p className="bi-modal-lead">The chase agent asks {t.name} for what's missing, with a secure link to upload it. No Enertiv login needed.</p>
          <dl className="dl">
            <dt>To</dt>
            <dd>{contact ? `${contact.name}, ${contact.role} (${contact.email ?? contact.phone})` : <span>No contact on file</span>}</dd>
            <dt>Asking for</dt>
            <dd>{what}</dd>
            <dt>Why</dt>
            <dd>{human(item.impact)}</dd>
            <dt>Follow-up</dt>
            <dd>Reminders after 7 and 14 days; escalates to your account owner at 30 days.</dd>
          </dl>
          {!contact && (
            <p className="banner banner--warning bi-banner-tight">
              <Icon name="warning" />
              <span>
                The request is saved but can't be sent until {t.name} has a contact. <Link to={to(`/people/tenants/${t.id}`)}>Add one on the tenant's page</Link>.
              </span>
            </p>
          )}
          <p className="muted bi-modal-note">In this prototype, messages go to a simulated outbox, never to a real person.</p>
        </>
      )}
    </Modal>
  );
}
