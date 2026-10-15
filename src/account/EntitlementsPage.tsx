/**
 * Account › Modules and entitlements (Admins only; SYS-NAVPAT-06, SYS-ACCESS-25, 29; ST-U10, ST-N05).
 * The products the company has and doesn't, what each turns on, and the data sources per building
 * with their onboarding stage. Anything free or covered by the contract changes at once; a change
 * that would affect price goes to the account team as a request, with the quote outside the app.
 */
import { useState } from 'react';
import { useApi, useData } from '../data/store';
import type { Building, Entitlements, OnboardingStage, Utility } from '../data/types';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { ApiView, EmptyState, PageHeader, Pill, Section } from '../ui/bits';
import { fmtDate } from '../ui/format';
import { useToast } from '../ui/Toast';
import { accountOwner, TODAY } from '../people/common';

type ProductId = keyof Entitlements | 'tenantPortal';
const PRODUCTS: { id: ProductId; name: string; icon: string; turnsOn: string[]; later?: boolean }[] = [
  { id: 'energyEsg', name: 'Energy & ESG', icon: 'eco', turnsOn: ['Reporting workspaces and framework exports', 'Data Health for bills, meters and logins', 'ENERGY STAR sync', 'The chase agent'] },
  { id: 'carbonPlanning', name: 'Carbon Planning', icon: 'trending_down', turnsOn: ['Emissions pathways against your target', 'Capital plans with project savings', 'Plans in Workspace'] },
  { id: 'equipmentOptimization', name: 'Equipment Optimization', icon: 'hvac', turnsOn: ['Sensor and BMS data on equipment', 'Building alerts', 'Equipment insights and savings'] },
  { id: 'submeter', name: 'Submeter', icon: 'electric_meter', turnsOn: ['Tenant submeter data', 'Tenant consumption in reports'] },
  { id: 'tenantBilling', name: 'Tenant Billing', icon: 'request_quote', turnsOn: ['Utility invoices for tenants', 'Cost recovery from submetered use'] },
  { id: 'maintenance', name: 'Maintenance', icon: 'build', turnsOn: ['Work orders from alerts and insights', 'Assigning work to engineers and vendors', 'Preventive maintenance schedules'] },
  { id: 'tenantPortal', name: 'Tenant Experience Portal', icon: 'storefront', turnsOn: ['Tickets, bookings and bills for tenants', 'Your branding on the tenant view'], later: true },
];

const STAGE: Record<OnboardingStage, string> = { scoping: 'Scoping', install: 'Installing', schedule: 'Scheduling', ops: 'Checking', training: 'Training', live: 'Live' };
const UTILS: Utility[] = ['electricity', 'gas', 'water', 'steam'];

export function EntitlementsPage() {
  const { data, user, getApp, setApp } = useData();
  const toast = useToast();
  const owner = accountOwner(data);
  const requests = getApp<Record<string, string>>('entitlementRequests', {});
  const cpOff = getApp<Record<string, boolean>>('carbonPlanningOff', {});
  const [asking, setAsking] = useState<{ key: string; title: string; body: string } | null>(null);
  const q = useApi('account/entitlements', () => ({ ent: data.entitlements, buildings: data.buildings }), [data.entitlements, data.buildings]);

  if (user.role !== 'admin') {
    return (
      <article className="page acc-page">
        <PageHeader title="Modules and entitlements" />
        <EmptyState icon="lock" title="Only Admins can see this" body={`What ${data.company.name} has bought is visible to Admins. ${owner ? `${owner.name} can tell you more.` : ''}`} />
      </article>
    );
  }

  const has = (id: ProductId) => (id === 'tenantPortal' ? false : data.entitlements[id]);
  const request = (key: string, title: string, body: string) => setAsking({ key, title, body });

  return (
    <article className="page page-wide acc-page">
      <PageHeader title="Modules and entitlements" subtitle={`What ${data.company.name} has, and what each product turns on.`} />
      <ApiView q={q} what="your products">
        {({ buildings }) => {
          const owned = PRODUCTS.filter((p) => has(p.id));
          const missing = PRODUCTS.filter((p) => !has(p.id));
          return (
            <>
              <p className="acc-summary">
                <strong>You have {owned.length}</strong> of {PRODUCTS.length}: {owned.map((p) => p.name).join(', ')}. <strong>Not included:</strong> {missing.map((p) => p.name).join(', ')}.
              </p>
              <Section title="Products" id="products">
                <ul className="acc-products">
                  {[...owned, ...missing].map((p) => {
                    const on = has(p.id);
                    const asked = requests[`product:${p.id}`];
                    return (
                      <li key={p.id} className={`card acc-product ${on ? 'is-on' : ''}`}>
                        <div className="acc-product-head">
                          <Icon name={p.icon} />
                          <h3>{p.name}</h3>
                          {on ? (
                            <Pill tone="success" icon="check_circle">
                              Included
                            </Pill>
                          ) : (
                            <Pill icon="remove_circle_outline">Not included</Pill>
                          )}
                        </div>
                        <p className="muted acc-small">{on ? 'Turns on:' : 'Would turn on:'}</p>
                        <ul className="acc-turns">
                          {p.turnsOn.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                        <div className="acc-product-foot">
                          {asked ? (
                            <span className="muted">
                              <Icon name="schedule" /> Requested {fmtDate(asked)}; your account team will be in touch
                            </span>
                          ) : p.later ? (
                            <span className="muted">Available again after this release</span>
                          ) : on ? (
                            <button type="button" className="text-btn" onClick={() => request(`product:${p.id}`, `Change ${p.name}`, `Removing or reducing ${p.name} changes your contract.`)}>
                              Ask about changing this
                            </button>
                          ) : (
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => request(`product:${p.id}`, `Add ${p.name}`, `Adding ${p.name} would change your price.`)}>
                              Request {p.name}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>

              <Section title="Data sources by building" description="What was bought for each building, and where its setup has got to." id="sources">
                <DataTable<Building>
                  label="Data sources by building"
                  rows={buildings}
                  rowKey={(b) => b.id}
                  search={(b) => `${b.name} ${b.city}`}
                  searchPlaceholder="Find a building"
                  initialSort={{ key: 'name', dir: 'asc' }}
                  columns={[
                    { key: 'name', header: 'Building', value: (b) => b.name, render: (b) => (
                      <>
                        {b.name}
                        <span className="cell-sub">{b.city}</span>
                      </>
                    ) },
                    ...UTILS.map((u) => ({
                      key: u,
                      header: u[0].toUpperCase() + u.slice(1),
                      hideOnPhone: u !== 'electricity',
                      value: (b: Building) => (b.sold[u]?.sold ? STAGE[b.sold[u]!.stage ?? 'live'] : 'Not bought'),
                      render: (b: Building) => {
                        const s = b.sold[u];
                        const key = `source:${b.id}:${u}`;
                        if (s?.sold) return <Pill tone={s.stage === 'live' || !s.stage ? 'success' : 'info'}>{STAGE[s.stage ?? 'live']}</Pill>;
                        if (requests[key]) return <span className="muted acc-small">Requested</span>;
                        return (
                          <button type="button" className="text-btn acc-small" onClick={() => request(key, `Add ${u} at ${b.name}`, `Adding ${u} data at ${b.name} would change your price.`)} aria-label={`Request ${u} at ${b.name}`}>
                            Not bought · Request
                          </button>
                        );
                      },
                    })),
                    { key: 'equip', header: 'Equipment data', hideOnPhone: true, value: (b) => (b.tierByUtility.electricity === 3 ? 'Sensors or BMS' : '—') },
                    ...(data.entitlements.carbonPlanning
                      ? [
                          {
                            key: 'cp',
                            header: 'In Carbon Planning',
                            hideOnPhone: true,
                            render: (b: Building) => (
                              <label className="switch" title="Covered by your contract">
                                <input
                                  type="checkbox"
                                  aria-label={`Include ${b.name} in Carbon Planning`}
                                  checked={!cpOff[b.id]}
                                  onChange={(e) => {
                                    setApp('carbonPlanningOff', { ...cpOff, [b.id]: !e.target.checked });
                                    toast(`${b.name} ${e.target.checked ? 'added to' : 'taken out of'} Carbon Planning. It’s covered by your contract, so your price doesn’t change.`);
                                  }}
                                />
                                <span />
                              </label>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </Section>
              {asking && (
                <Modal
                  title={asking.title}
                  onClose={() => setAsking(null)}
                  size="sm"
                  footer={
                    <>
                      <button type="button" className="btn btn--ghost" onClick={() => setAsking(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setApp('entitlementRequests', { ...requests, [asking.key]: TODAY });
                          toast('Request sent to your Enertiv account team');
                          setAsking(null);
                        }}
                      >
                        Send request
                      </button>
                    </>
                  }
                >
                  <p>{asking.body}</p>
                  <p className="muted">We’ll send a request to your Enertiv account team, who’ll follow up with a quote. Nothing changes until you agree to it.</p>
                </Modal>
              )}
            </>
          );
        }}
      </ApiView>
    </article>
  );
}
