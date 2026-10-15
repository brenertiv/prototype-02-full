/**
 * People › Partners: Contractors and guests (MOD-PPL-03), Vendors (MOD-PPL-11) and Management
 * companies (MOD-PPL-12), with the vendor and management company page templates (MOD-PPL-13).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { ManagementCompany, User, Vendor } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { ApiView, EmptyState, FilterChips, PageHeader, Pill, Section, SelectFilter } from '../ui/bits';
import { fmtAgo, fmtDate } from '../ui/format';
import { useToast } from '../ui/Toast';
import { BuildingLinks, effectiveBuildings, Initials, isEmail, KeyValue, liveTeams, newId, ReadOnlyNote, ROLE_LABEL, usePermissions, UserStatus, useScopeBuildings } from './common';
import { InviteModal } from './modals';

export function PartnersPage() {
  const [params] = useSearchParams();
  const f = params.get('filter');
  const filter = f === 'vendors' || f === 'management-companies' ? f : 'contractors';
  const { isAdmin } = usePermissions();
  const [inviting, setInviting] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  return (
    <article className="page page-wide ppl-page">
      <PageHeader
        title="Partners"
        subtitle={
          filter === 'vendors'
            ? 'The service companies that work on your buildings.'
            : filter === 'management-companies'
              ? 'Who manages each property, and since when.'
              : 'People from other firms with access to some of your buildings.'
        }
        actions={
          isAdmin && filter === 'contractors' ? (
            <button type="button" className="btn" onClick={() => setInviting(true)}>
              <Icon name="person_add" /> Invite a guest
            </button>
          ) : isAdmin && filter === 'vendors' ? (
            <button type="button" className="btn" onClick={() => setAddingVendor(true)}>
              <Icon name="add_business" /> Add vendor
            </button>
          ) : undefined
        }
      />
      <FilterChips
        label="Show"
        options={[
          { id: 'contractors', label: 'Contractors and guests' },
          { id: 'vendors', label: 'Vendors' },
          { id: 'management-companies', label: 'Management companies' },
        ]}
      />
      {!isAdmin && filter !== 'management-companies' && <ReadOnlyNote>Only an Admin can {filter === 'vendors' ? 'add or edit vendors' : 'invite or remove guests'}.</ReadOnlyNote>}
      {filter === 'contractors' && <Guests />}
      {filter === 'vendors' && <Vendors />}
      {filter === 'management-companies' && <ManagementCompanies />}
      {inviting && <InviteModal guest onClose={() => setInviting(false)} />}
      {addingVendor && <VendorModal onClose={() => setAddingVendor(false)} />}
    </article>
  );
}

function Guests() {
  const { data } = useData();
  const { to } = useNav();
  const { scope, inScope, rollUp } = useScopeBuildings();
  const q = useApi(
    `people/guests?scope=${scope.id}`,
    () =>
      data.users
        .filter((u) => u.firm && u.role !== 'tenant')
        .map((u) => ({ u, bIds: [...effectiveBuildings(u, data)].filter((b) => inScope.has(b)) }))
        .filter((r) => r.bIds.length),
    [data, inScope],
  );
  return (
    <ApiView q={q} what="contractors and guests">
      {(rows) => (
        <DataTable<{ u: User; bIds: string[] }>
          label="Contractors and guests"
          rows={rows}
          rowKey={(r) => r.u.id}
          rowHref={(r) => to(`/people/partners/${r.u.id}`)}
          search={(r) => `${r.u.name} ${r.u.firm} ${r.u.email}`}
          searchPlaceholder="Search by name or firm"
          caption={`${rows.length} ${rows.length === 1 ? 'guest' : 'guests'} from other firms`}
          empty={{ title: 'No guests on these buildings', body: 'Invite a property manager or contractor from another firm to the buildings they work on.', icon: 'handshake' }}
          initialSort={{ key: 'firm', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Name', value: (r) => r.u.name, render: (r) => (
              <>
                {r.u.name}
                <span className="cell-sub">{r.u.title}</span>
              </>
            ) },
            { key: 'firm', header: 'Firm', value: (r) => r.u.firm ?? '' },
            { key: 'role', header: 'Role', hideOnPhone: true, value: (r) => (r.u.role === 'vendor' ? 'Vendor' : ROLE_LABEL[r.u.role]) },
            ...(rollUp ? [{ key: 'b', header: 'Buildings', hideOnPhone: true, value: (r: { u: User; bIds: string[] }) => r.bIds.length, render: (r: { u: User; bIds: string[] }) => <BuildingLinks ids={r.bIds} /> }] : []),
            { key: 'status', header: 'Status', value: (r) => r.u.status, render: (r) => <UserStatus status={r.u.status} /> },
            { key: 'last', header: 'Last active', hideOnPhone: true, value: (r) => r.u.lastActive ?? '', render: (r) => (r.u.lastActive ? fmtAgo(r.u.lastActive) : 'Never') },
          ]}
        />
      )}
    </ApiView>
  );
}

function Vendors() {
  const { data } = useData();
  const { to } = useNav();
  const { scope, inScope, rollUp } = useScopeBuildings();
  const [cat, setCat] = useState('all');
  const q = useApi(`people/vendors?scope=${scope.id}`, () => data.vendors.filter((v) => !v.buildingIds.length || v.buildingIds.some((b) => inScope.has(b))), [data.vendors, inScope]);
  return (
    <ApiView q={q} what="vendors">
      {(all) => {
        const cats = [...new Set(all.flatMap((v) => v.categories))].sort();
        const rows = all.filter((v) => (cat === 'all' ? true : cat === 'preferred' ? v.preferred : v.categories.includes(cat)));
        return (
          <DataTable<Vendor>
            label="Vendors"
            rows={rows}
            rowKey={(v) => v.id}
            rowHref={(v) => to(`/people/partners/${v.id}`)}
            search={(v) => `${v.name} ${v.categories.join(' ')} ${v.offerings} ${v.locality}`}
            searchPlaceholder="Search vendors, categories or services"
            caption={`${rows.length} ${rows.length === 1 ? 'vendor' : 'vendors'}`}
            toolbar={<SelectFilter label="Category" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, { value: 'preferred', label: 'Preferred only' }, ...cats.map((c) => ({ value: c, label: c }))]} />}
            empty={{ title: 'No vendors yet', body: 'Admins can add the companies that service your buildings.', icon: 'storefront' }}
            initialSort={{ key: 'name', dir: 'asc' }}
            columns={[
              { key: 'name', header: 'Vendor', value: (v) => v.name, render: (v) => (
                <>
                  {v.name} {v.preferred && <Pill tone="success" icon="star">Preferred</Pill>}
                  <span className="cell-sub">{v.offerings}</span>
                </>
              ) },
              { key: 'cat', header: 'Categories', hideOnPhone: true, value: (v) => v.categories.join(', ') },
              { key: 'class', header: 'Classification', hideOnPhone: true, value: (v) => v.classification },
              { key: 'loc', header: 'Locality', hideOnPhone: true, value: (v) => v.locality },
              { key: 'contact', header: 'Contact', hideOnPhone: true, value: (v) => v.contact.name, render: (v) => (
                <>
                  {v.contact.name}
                  <span className="cell-sub">{v.contact.phone}</span>
                </>
              ) },
              ...(rollUp ? [{ key: 'b', header: 'Buildings', hideOnPhone: true, value: (v: Vendor) => v.buildingIds.length, render: (v: Vendor) => <BuildingLinks ids={v.buildingIds.filter((b) => inScope.has(b))} /> }] : []),
            ]}
          />
        );
      }}
    </ApiView>
  );
}

function ManagementCompanies() {
  const { data } = useData();
  const { to } = useNav();
  const { scope, inScope } = useScopeBuildings();
  const q = useApi(`people/management-companies?scope=${scope.id}`, () => data.managementCompanies.filter((m) => m.assignments.some((a) => inScope.has(a.buildingId))), [data.managementCompanies, inScope]);
  return (
    <ApiView q={q} what="management companies">
      {(rows) => {
        // A change of manager: one assignment ends and another starts on the same building (ST-U09).
        const changes = data.managementCompanies.flatMap((m) =>
          m.assignments
            .filter((a) => a.end && inScope.has(a.buildingId))
            .map((a) => ({ from: m, a, next: data.managementCompanies.find((n) => n.assignments.some((x) => x.buildingId === a.buildingId && !x.end)) })),
        );
        return (
          <>
            <DataTable<ManagementCompany>
              label="Management companies"
              rows={rows}
              rowKey={(m) => m.id}
              rowHref={(m) => to(`/people/partners/${m.id}`)}
              search={(m) => m.name}
              searchPlaceholder="Search management companies"
              caption={`${rows.length} ${rows.length === 1 ? 'company manages' : 'companies manage'} buildings in scope`}
              empty={{ title: 'No manager recorded', body: 'Setup asks who manages each building when it’s brought in.', icon: 'business' }}
              columns={[
                { key: 'name', header: 'Company', value: (m) => m.name },
                { key: 'tp', header: 'Third party', value: (m) => (m.thirdParty ? 'Yes' : 'No, self-managed') },
                { key: 'now', header: 'Manages now', align: 'right', value: (m) => m.assignments.filter((a) => !a.end && inScope.has(a.buildingId)).length },
                { key: 'b', header: 'Properties', hideOnPhone: true, render: (m) => <BuildingLinks ids={m.assignments.filter((a) => !a.end && inScope.has(a.buildingId)).map((a) => a.buildingId)} /> },
              ]}
            />
            {changes.length > 0 && (
              <Section title="Changes of manager" id="mgmt-changes">
                <ul className="list">
                  {changes.map(({ from, a, next }) => {
                    const b = data.buildings.find((x) => x.id === a.buildingId);
                    return (
                      <li key={from.id + a.buildingId}>
                        <Icon name="swap_horiz" />
                        <div className="list-item-main">
                          <Link className="list-item-title" to={to(`/building-info/buildings/${a.buildingId}`)}>
                            {b?.name}
                          </Link>
                          <div className="muted">
                            {from.name} until {fmtDate(a.end)}
                            {next ? `, then ${next.name} from ${fmtDate(next.assignments.find((x) => x.buildingId === a.buildingId && !x.end)?.start)}` : ''}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </>
        );
      }}
    </ApiView>
  );
}

export function VendorPage({ id }: { id: string }) {
  const { data } = useData();
  const { to } = useNav();
  const { isAdmin } = usePermissions();
  const [editing, setEditing] = useState(false);
  const q = useApi(`people/vendors/${id}`, () => data.vendors.find((v) => v.id === id) ?? null, [data.vendors, id]);
  const back = { to: to('/people/partners?filter=vendors'), label: 'Vendors' };
  if (q.status === 'ready' && !q.data) {
    return (
      <article className="page page-wide ppl-page">
        <PageHeader back={back} title="Vendor not found" />
        <EmptyState icon="storefront" title="We couldn’t find this vendor" />
      </article>
    );
  }
  return (
    <article className="page page-wide ppl-page">
      <ApiView q={q} what="this vendor">
        {(v: Vendor | null) =>
          v && (
            <>
              <PageHeader
                back={back}
                eyebrow="Vendor"
                title={
                  <span className="ppl-title">
                    <Initials name={v.name} kind="org" />
                    {v.name}
                    {v.preferred && <Pill tone="success" icon="star">Preferred</Pill>}
                  </span>
                }
                subtitle={v.offerings}
                actions={
                  isAdmin && (
                    <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                      <Icon name="edit" /> Edit vendor
                    </button>
                  )
                }
              />
              <div className="grid grid--2 ppl-cards">
                <section className="card" aria-labelledby="vc-h">
                  <h3 id="vc-h">The company</h3>
                  <KeyValue
                    items={[
                      ['Categories', v.categories.join(', ')],
                      ['Offerings', v.offerings],
                      ['Classification', v.classification],
                      ['Locality', v.locality],
                      ['Preferred', v.preferred ? 'Yes' : 'No'],
                    ]}
                  />
                </section>
                <section className="card" aria-labelledby="vk-h">
                  <h3 id="vk-h">Contact</h3>
                  <KeyValue
                    items={[
                      ['Name', v.contact.name],
                      ['Role', v.contact.role],
                      ['Email', v.contact.email ? <a href={`mailto:${v.contact.email}`}>{v.contact.email}</a> : null],
                      ['Phone', v.contact.phone ? <a href={`tel:${v.contact.phone.replace(/[^\d+]/g, '')}`}>{v.contact.phone}</a> : null],
                    ]}
                  />
                </section>
              </div>
              <Section title={`Buildings they serve (${v.buildingIds.length})`} id="vb">
                <BuildingLinks ids={v.buildingIds} max={20} />
              </Section>
              <p className="muted ppl-foot">Assigning work to vendors comes with Maintenance.</p>
              {editing && <VendorModal vendor={v} onClose={() => setEditing(false)} />}
            </>
          )
        }
      </ApiView>
    </article>
  );
}

function VendorModal({ vendor, onClose }: { vendor?: Vendor; onClose: () => void }) {
  const { data, accessible, add, patch } = useData();
  const toast = useToast();
  const [v, setV] = useState<Vendor>(
    vendor ?? { id: newId('v'), name: '', categories: [], offerings: '', classification: 'Service provider', locality: '', contact: { name: '', email: '', phone: '', role: 'Account manager' }, preferred: false, buildingIds: [] },
  );
  const [cats, setCats] = useState(v.categories.join(', '));
  const [tried, setTried] = useState(false);
  const errs = {
    name: !v.name.trim() ? 'Enter the vendor’s name' : null,
    email: v.contact.email && !isEmail(v.contact.email) ? 'Enter a valid email address' : null,
  };
  const save = () => {
    setTried(true);
    if (errs.name || errs.email) return;
    const rec = { ...v, name: v.name.trim(), categories: cats.split(',').map((c) => c.trim()).filter(Boolean) };
    if (vendor) patch('vendors', vendor.id, rec as unknown as Record<string, unknown>);
    else add('vendors', rec);
    toast(vendor ? `${rec.name} saved` : `${rec.name} added to the vendor directory`);
    onClose();
  };
  const set = (k: keyof Vendor, val: unknown) => setV((x) => ({ ...x, [k]: val }));
  const setC = (k: 'name' | 'email' | 'phone' | 'role', val: string) => setV((x) => ({ ...x, contact: { ...x.contact, [k]: val } }));
  return (
    <Modal
      title={vendor ? `Edit ${vendor.name}` : 'Add a vendor'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save}>
            {vendor ? 'Save vendor' : 'Add vendor'}
          </button>
        </>
      }
    >
      <form
        className="ppl-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field-row">
          <label className="field">
            <span>Name</span>
            <input autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(tried && errs.name)} />
            {tried && errs.name && <span className="ppl-error">{errs.name}</span>}
          </label>
          <label className="field">
            <span>Categories, separated by commas</span>
            <input value={cats} onChange={(e) => setCats(e.target.value)} placeholder="HVAC, Plumbing" />
          </label>
        </div>
        <label className="field">
          <span>Offerings</span>
          <input value={v.offerings} onChange={(e) => set('offerings', e.target.value)} placeholder="Preventive maintenance, chiller service" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Classification</span>
            <input value={v.classification} onChange={(e) => set('classification', e.target.value)} />
          </label>
          <label className="field">
            <span>Locality</span>
            <input value={v.locality} onChange={(e) => set('locality', e.target.value)} placeholder="City" />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Contact name</span>
            <input value={v.contact.name} onChange={(e) => setC('name', e.target.value)} />
          </label>
          <label className="field">
            <span>Contact email</span>
            <input type="email" value={v.contact.email ?? ''} onChange={(e) => setC('email', e.target.value)} aria-invalid={Boolean(tried && errs.email)} />
            {tried && errs.email && <span className="ppl-error">{errs.email}</span>}
          </label>
          <label className="field">
            <span>Contact phone</span>
            <input type="tel" value={v.contact.phone ?? ''} onChange={(e) => setC('phone', e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={v.preferred} onChange={(e) => set('preferred', e.target.checked)} />
          <span>Preferred vendor</span>
        </label>
        <fieldset className="ppl-fieldset">
          <legend>Buildings they serve</legend>
          <div className="ppl-checks ppl-checks--scroll">
            {data.buildings
              .filter((b) => accessible.has(b.id))
              .map((b) => (
                <label key={b.id} className="check">
                  <input type="checkbox" checked={v.buildingIds.includes(b.id)} onChange={() => set('buildingIds', v.buildingIds.includes(b.id) ? v.buildingIds.filter((x) => x !== b.id) : [...v.buildingIds, b.id])} />
                  <span>{b.name}</span>
                </label>
              ))}
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function MgmtPage({ id }: { id: string }) {
  const { data } = useData();
  const { to } = useNav();
  const q = useApi(`people/management-companies/${id}`, () => data.managementCompanies.find((m) => m.id === id) ?? null, [data.managementCompanies, id]);
  const back = { to: to('/people/partners?filter=management-companies'), label: 'Management companies' };
  if (q.status === 'ready' && !q.data) {
    return (
      <article className="page page-wide ppl-page">
        <PageHeader back={back} title="Management company not found" />
        <EmptyState icon="business" title="We couldn’t find this company" />
      </article>
    );
  }
  return (
    <article className="page page-wide ppl-page">
      <ApiView q={q} what="this management company">
        {(m: ManagementCompany | null) => {
          if (!m) return null;
          const team = liveTeams(data.teams).find((t) => t.name === m.name);
          const staff = data.users.filter((u) => u.firm === m.name);
          const current = m.assignments.filter((a) => !a.end);
          return (
            <>
              <PageHeader
                back={back}
                eyebrow="Management company"
                title={
                  <span className="ppl-title">
                    <Initials name={m.name} kind="org" />
                    {m.name}
                  </span>
                }
                subtitle={`${m.thirdParty ? 'Third-party manager' : 'Self-managed'} · manages ${current.length} ${current.length === 1 ? 'property' : 'properties'}`}
              />
              <Section title="Properties" id="props">
                <DataTable
                  label="Properties managed"
                  rows={[...m.assignments].sort((a, b) => Number(Boolean(a.end)) - Number(Boolean(b.end)))}
                  rowKey={(a) => a.buildingId + a.start}
                  rowHref={(a) => to(`/building-info/buildings/${a.buildingId}`)}
                  empty={{ title: 'No properties recorded', icon: 'apartment' }}
                  columns={[
                    { key: 'b', header: 'Property', value: (a) => data.buildings.find((b) => b.id === a.buildingId)?.name ?? a.buildingId },
                    { key: 's', header: 'From', value: (a) => a.start, render: (a) => fmtDate(a.start) },
                    { key: 'e', header: 'Until', value: (a) => a.end ?? '', render: (a) => (a.end ? fmtDate(a.end) : <Pill tone="success">Current</Pill>) },
                  ]}
                />
              </Section>
              <Section title="Their people in this account" id="staff">
                {staff.length ? (
                  <ul className="ppl-plain-list">
                    {staff.map((u) => (
                      <li key={u.id}>
                        <Link to={to(`/people/partners/${u.id}`)}>{u.name}</Link> <span className="muted">· {u.title}</span> <UserStatus status={u.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No one from {m.name} has been invited.</p>
                )}
                {team && (
                  <p className="ppl-help">
                    Access for this firm is given through the <Link to={to(`/people/team/${team.id}`)}>{team.name} team</Link>
                    {team.proposed ? ', suggested at setup and waiting to be confirmed.' : '.'}
                  </p>
                )}
              </Section>
            </>
          );
        }}
      </ApiView>
    </article>
  );
}
