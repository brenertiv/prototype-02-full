/**
 * People › Tenants: the roster and Requests (MOD-PPL-05, 06, 07, 10, 17, 40; ST-U06, U07).
 * The tenant page shows spaces, dates, contacts, LOA, the utility accounts it holds and its requests.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { ChaseRequest, Contact, Tenant } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { usePrefs } from '../state/preferences';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { ApiView, EmptyState, FilterChips, PageHeader, Pill, Section, SelectFilter } from '../ui/bits';
import { cap, fmtArea, fmtDate } from '../ui/format';
import { useToast } from '../ui/Toast';
import { ContactRulesEditor, type ContactRules } from './ContactRules';
import { RequestsList } from './Requests';
import { BuildingLinks, Initials, isEmail, isOpenRequest, KeyValue, newId, TODAY, usePermissions, useScopeBuildings } from './common';

export function TenantsPage() {
  const [params] = useSearchParams();
  const filter = params.get('filter') === 'requests' ? 'requests' : 'tenants';
  return (
    <article className="page page-wide ppl-page">
      <PageHeader
        title="Tenants"
        subtitle={filter === 'requests' ? 'Everything the chase agent is asking tenants and contacts for, by who owes it.' : 'Who leases space in your buildings, now and before.'}
      />
      <FilterChips
        label="Show"
        options={[
          { id: 'tenants', label: 'Tenants' },
          { id: 'requests', label: 'Requests' },
        ]}
      />
      {filter === 'requests' ? <RequestsList /> : <TenantList />}
    </article>
  );
}

function TenantList() {
  const { data } = useData();
  const { to } = useNav();
  const { prefs } = usePrefs();
  const { scope, inScope, rollUp } = useScopeBuildings();
  const [status, setStatus] = useState('current');
  const q = useApi(`people/tenants?scope=${scope.id}`, () => data.tenants.filter((t) => t.buildingIds.some((b) => inScope.has(b))), [data.tenants, inScope]);
  return (
    <ApiView q={q} what="tenants">
      {(all) => {
        const rows = all.filter((t) => (status === 'current' ? !t.prior : status === 'prior' ? t.prior : true));
        return (
          <DataTable<Tenant>
            label="Tenants"
            rows={rows}
            rowKey={(t) => t.id}
            rowHref={(t) => to(`/people/tenants/${t.id}`)}
            search={(t) => `${t.name} ${t.industry}`}
            searchPlaceholder="Search tenants"
            caption={`${rows.length} ${status === 'prior' ? 'prior ' : status === 'current' ? 'current ' : ''}${rows.length === 1 ? 'tenant' : 'tenants'} in ${rollUp ? (scope.kind === 'portfolio' ? 'the portfolio' : scope.name) : scope.name}`}
            toolbar={
              <SelectFilter
                label="Current or prior"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'current', label: 'Current tenants' },
                  { value: 'prior', label: 'Prior tenants' },
                  { value: 'all', label: 'Current and prior' },
                ]}
              />
            }
            empty={{ title: status === 'prior' ? 'No prior tenants' : 'No tenants here', body: 'Tenants appear when a lease is recorded on a space in Building Info.', icon: 'storefront' }}
            initialSort={{ key: 'name', dir: 'asc' }}
            columns={[
              { key: 'name', header: 'Tenant', value: (t) => t.name, render: (t) => (
                <>
                  {t.name}
                  <span className="cell-sub">{t.industry}</span>
                </>
              ) },
              ...(rollUp ? [{ key: 'b', header: 'Property', value: (t: Tenant) => data.buildings.find((b) => b.id === t.buildingIds[0])?.name ?? '', render: (t: Tenant) => <BuildingLinks ids={t.buildingIds} /> }] : []),
              { key: 'spaces', header: 'Spaces', align: 'right', hideOnPhone: true, value: (t) => t.spaceIds.length },
              { key: 'area', header: 'Leased area', align: 'right', hideOnPhone: true, value: (t) => t.leasedSqft, render: (t) => fmtArea(t.leasedSqft, prefs.units) },
              { key: 'in', header: 'Moved in', hideOnPhone: true, value: (t) => t.moveIn, render: (t) => fmtDate(t.moveIn) },
              { key: 'out', header: 'Moved out', hideOnPhone: true, value: (t) => t.moveOut ?? '', render: (t) => (t.moveOut ? fmtDate(t.moveOut) : <span className="muted">—</span>) },
              { key: 'status', header: 'Status', value: (t) => (t.prior ? 'Prior' : t.contacts.length ? 'Current' : 'Contact unknown'), render: (t) => (t.prior ? <Pill icon="logout">Prior</Pill> : t.contacts.length ? <Pill tone="success" icon="check_circle">Current</Pill> : <Pill tone="warning" icon="person_off">Contact unknown</Pill>) },
            ]}
          />
        );
      }}
    </ApiView>
  );
}

export function TenantPage({ id }: { id: string }) {
  const { data, patch, add, getApp, setApp } = useData();
  const { to } = useNav();
  const { prefs } = usePrefs();
  const toast = useToast();
  const { canEditContacts, canManageChase } = usePermissions();
  const [adding, setAdding] = useState(false);
  const q = useApi(`people/tenants/${id}`, () => data.tenants.find((t) => t.id === id) ?? null, [data.tenants, id]);
  const back = { to: to('/people/tenants'), label: 'Tenants' };
  const rulesAll = getApp<Record<string, ContactRules>>('tenantChaseRules', {});

  if (q.status === 'ready' && !q.data) {
    return (
      <article className="page page-wide ppl-page">
        <PageHeader back={back} title="Tenant not found" />
        <EmptyState icon="storefront" title="We couldn’t find this tenant" body="The link may be from another account." />
      </article>
    );
  }
  return (
    <article className="page page-wide ppl-page">
      <ApiView q={q} what="this tenant">
        {(t: Tenant | null) => {
          if (!t) return null;
          const spaces = data.spaces.filter((s) => t.spaceIds.includes(s.id));
          const accounts = data.accounts.filter((a) => a.holder === t.id);
          const loaFiles = data.files.filter((f) => f.category === 'LOA' && f.attachedTo.id === t.id);
          const openReqs = data.requests.filter((r) => r.to.id === t.id && isOpenRequest(r));
          const covered = t.loa.accounts.length ? t.loa.accounts : t.loa.status === 'Signed' ? accounts.map((a) => a.id) : [];
          const rules = rulesAll[t.id] ?? { maxPerWeek: 1, channels: t.contacts.some((c) => c.email) ? ['Email'] : [] };
          return (
            <>
              <PageHeader
                back={back}
                eyebrow="Tenant"
                title={
                  <span className="ppl-title">
                    <Initials name={t.name} kind="org" />
                    {t.name}
                    {t.prior && <Pill icon="logout">Prior tenant</Pill>}
                  </span>
                }
                subtitle={`${t.industry} · ${fmtArea(t.leasedSqft, prefs.units)} leased`}
              />
              {t.prior && (
                <div className="banner banner--neutral">
                  <Icon name="logout" />
                  <div>Moved out {fmtDate(t.moveOut)}. The chase agent doesn’t send them requests, and nothing is asked for after they left.</div>
                </div>
              )}

              <div className="grid grid--2 ppl-cards">
                <section className="card" aria-labelledby="tl-h">
                  <h3 id="tl-h">Lease</h3>
                  <KeyValue
                    items={[
                      ['Buildings', <BuildingLinks key="b" ids={t.buildingIds} max={4} />],
                      ['Leased area', fmtArea(t.leasedSqft, prefs.units)],
                      ['Moved in', fmtDate(t.moveIn)],
                      ['Moved out', t.moveOut ? fmtDate(t.moveOut) : 'Current tenant'],
                      ['Industry', t.industry],
                    ]}
                  />
                </section>
                <section className="card" aria-labelledby="tc-h" id="contacts">
                  <div className="ppl-card-head">
                    <h3 id="tc-h">Contacts</h3>
                    {canEditContacts && !t.prior && (
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAdding(true)}>
                        <Icon name="person_add" /> Add a contact
                      </button>
                    )}
                  </div>
                  {t.contacts.length ? (
                    <ul className="ppl-plain-list">
                      {t.contacts.map((c, k) => (
                        <li key={k} className="ppl-contact">
                          <strong>{c.name}</strong> <span className="muted">· {c.role}</span>
                          <span className="ppl-contact-links">
                            {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="muted">No email</span>}
                            {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ppl-unknown">
                      <Pill tone="warning" icon="person_off">
                        Contact unknown
                      </Pill>
                      <p className="muted">There’s no one on file, so the chase agent can’t ask this tenant for anything. {canEditContacts ? 'Add a contact to start.' : 'An Admin or Property Manager can add one.'}</p>
                    </div>
                  )}
                </section>
              </div>

              <Section title="Spaces" description="Where they are on the stacking plan." id="spaces">
                {spaces.length ? (
                  <DataTable
                    label="Spaces"
                    rows={spaces}
                    rowKey={(s) => s.id}
                    rowHref={(s) => to(`/building-info/buildings/${s.buildingId}?tab=spaces`)}
                    columns={[
                      { key: 'name', header: 'Space', value: (s) => s.name },
                      { key: 'b', header: 'Building', value: (s) => data.buildings.find((b) => b.id === s.buildingId)?.name ?? '' },
                      { key: 'floor', header: 'Floor', align: 'right', hideOnPhone: true, value: (s) => s.floor },
                      { key: 'area', header: 'Area', align: 'right', value: (s) => s.sqft, render: (s) => fmtArea(s.sqft, prefs.units) },
                      { key: 'lease', header: 'Lease', hideOnPhone: true, render: (s) => (s.leaseStart ? `${fmtDate(s.leaseStart)} to ${fmtDate(s.leaseEnd)}` : '—') },
                    ]}
                  />
                ) : (
                  <p className="muted">{t.prior ? 'No current spaces; they’ve moved out.' : 'No spaces recorded.'}</p>
                )}
              </Section>

              <Section title="Letter of authorisation" description="Lets Enertiv pull the utility data for the accounts this tenant holds." id="loa">
                <div className="card">
                  <KeyValue
                    items={[
                      ['Status', <Pill key="s" tone={t.loa.status === 'Signed' ? 'success' : t.loa.status === 'Requested' ? 'info' : t.loa.status === 'Expired' ? 'warning' : 'neutral'}>{t.loa.status === 'None' ? 'Not on file' : t.loa.status}</Pill>],
                      ['Signed', t.loa.signed ? fmtDate(t.loa.signed) : null],
                      ['Expires', t.loa.expires ? fmtDate(t.loa.expires) : null],
                      ['Accounts covered', covered.length ? covered.map((a) => data.accounts.find((x) => x.id === a)?.accountNumber ?? a).join(', ') : 'None'],
                      ['Document', loaFiles.length ? loaFiles.map((f) => <Link key={f.id} to={to(`/building-info/files/${f.id}`)}>{f.name}</Link>) : null],
                    ]}
                  />
                  {canEditContacts && !t.prior && t.loa.status !== 'Signed' && (
                    <div className="btn-row ppl-card-actions">
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        disabled={!t.contacts.length || t.loa.status === 'Requested'}
                        onClick={() => {
                          add('requests', {
                            id: newId('rq'),
                            to: { kind: 'tenant', id: t.id, name: t.name },
                            what: 'Signed letter of authorisation for utility data',
                            buildingId: t.buildingIds[0],
                            spaceId: t.spaceIds[0] ?? null,
                            period: 'Ongoing',
                            stage: 'sent',
                            lastChased: TODAY,
                            channel: 'Email',
                            needsApproval: null,
                          } as ChaseRequest);
                          patch('tenants', t.id, { loa: { ...t.loa, status: 'Requested' } });
                          toast(`The chase agent asked ${t.name} for a signed LOA (test outbox)`);
                        }}
                      >
                        <Icon name="draw" /> {t.loa.status === 'Requested' ? 'LOA requested' : 'Ask for a signed LOA'}
                      </button>
                      {!t.contacts.length && <span className="muted">Add a contact first.</span>}
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Utility accounts they hold" description="Read-only here; each account lives in Building Info." id="accounts">
                {accounts.length ? (
                  <DataTable
                    label="Utility accounts"
                    rows={accounts}
                    rowKey={(a) => a.id}
                    rowHref={(a) => to(`/building-info/bills/${a.id}`)}
                    columns={[
                      { key: 'num', header: 'Account', value: (a) => a.accountNumber, render: (a) => (
                        <>
                          {a.accountNumber}
                          <span className="cell-sub">{a.provider}</span>
                        </>
                      ) },
                      { key: 'u', header: 'Utility', value: (a) => cap(a.utility) },
                      { key: 'b', header: 'Building', hideOnPhone: true, value: (a) => data.buildings.find((b) => b.id === a.buildingId)?.name ?? '' },
                      { key: 'x', header: 'Bills', value: (a) => a.extraction, render: (a) => <Pill tone={a.extraction === 'Successful' ? 'success' : a.extraction === 'Failed' ? 'danger' : 'neutral'}>{a.extraction === 'Successful' ? 'Coming in' : a.extraction}</Pill> },
                    ]}
                  />
                ) : (
                  <p className="muted">This tenant holds no utility accounts; the landlord holds them.</p>
                )}
              </Section>

              <Section title={`Requests${openReqs.length ? ` (${openReqs.length} open)` : ''}`} id="requests">
                <RequestsList tenantId={t.id} compact />
              </Section>

              {!t.prior && (
                <Section title="Chase agent contact rules" description="How often the chase agent may contact this tenant, and how." id="rules">
                  <ContactRulesEditor
                    canEdit={canManageChase}
                    value={rules}
                    channels={['Email', 'SMS']}
                    smsAvailable={t.contacts.some((c) => c.phone)}
                    smsNote="no phone number on file"
                    onSave={(v) => {
                      setApp('tenantChaseRules', { ...rulesAll, [t.id]: v });
                      toast(`Contact rules saved for ${t.name}`);
                    }}
                  />
                </Section>
              )}

              {adding && (
                <AddContactModal
                  tenant={t}
                  onClose={() => setAdding(false)}
                  onAdd={(c) => {
                    patch('tenants', t.id, { contacts: [...t.contacts, c] });
                    data.requests.filter((r) => r.to.id === t.id && r.stage === 'contact-unknown').forEach((r) => patch('requests', r.id, { stage: 'not-sent', channel: c.email ? 'Email' : 'SMS', needsApproval: 'first-of-kind' }));
                    toast(`${c.name} added. Waiting requests are ready to send.`);
                    setAdding(false);
                  }}
                />
              )}
            </>
          );
        }}
      </ApiView>
    </article>
  );
}

function AddContactModal({ tenant, onClose, onAdd }: { tenant: Tenant; onClose: () => void; onAdd: (c: Contact) => void }) {
  const [c, setC] = useState<Contact>({ name: '', role: 'Facilities manager', email: '', phone: '' });
  const [tried, setTried] = useState(false);
  const errs = {
    name: !c.name.trim() ? 'Enter their name' : null,
    reach: !c.email?.trim() && !c.phone?.trim() ? 'Enter an email or a phone number' : c.email?.trim() && !isEmail(c.email) ? 'Enter a valid email address' : null,
  };
  const submit = () => {
    setTried(true);
    if (errs.name || errs.reach) return;
    onAdd({ name: c.name.trim(), role: c.role.trim() || 'Contact', email: c.email?.trim() || null, phone: c.phone?.trim() || null });
  };
  return (
    <Modal
      title={`Add a contact for ${tenant.name}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submit}>
            Add contact
          </button>
        </>
      }
    >
      <form
        className="ppl-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} aria-invalid={Boolean(tried && errs.name)} />
          {tried && errs.name && <span className="ppl-error">{errs.name}</span>}
        </label>
        <label className="field">
          <span>Their role</span>
          <input value={c.role} onChange={(e) => setC({ ...c, role: e.target.value })} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={c.email ?? ''} onChange={(e) => setC({ ...c, email: e.target.value })} aria-invalid={Boolean(tried && errs.reach)} />
        </label>
        <label className="field">
          <span>Phone (for texts, only with their consent)</span>
          <input type="tel" value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </label>
        {tried && errs.reach && <span className="ppl-error">{errs.reach}</span>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
