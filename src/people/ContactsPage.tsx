/**
 * People › Building contacts: who's who per building (MOD-PPL-04; Gold Standard lines 8 and 9,
 * SYS-GOLD-08; ST-O09, ST-O10). Built so "who is the on-site contact for this building?" is one look.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { Building, ChaseRequest, User } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { ApiView, PageHeader, Pill } from '../ui/bits';
import { fmtAgo } from '../ui/format';
import { useToast } from '../ui/Toast';
import { accountOwner, effectiveBuildings, isOpenRequest, liveTeams, newId, STAGE_META, TODAY, usePermissions, useScopeBuildings } from './common';

type Line = 'contact' | 'sponsor';
const LINE_ASK: Record<Line, string> = { contact: 'Name the on-site building contact', sponsor: 'Invite the sponsor and project lead' };
const LINE_LABEL: Record<Line, string> = { contact: 'On-site contact', sponsor: 'Sponsor and project lead' };

export function ContactsPage() {
  const { data, add } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { isAdmin } = usePermissions();
  const { scope, inScope } = useScopeBuildings();
  const [naming, setNaming] = useState<{ b: Building; line: Line } | null>(null);
  const q = useApi(`people/contacts?scope=${scope.id}`, () => data.buildings.filter((b) => inScope.has(b.id)), [data.buildings, inScope]);
  const owner = accountOwner(data);

  const followUp = (b: Building, line: Line) => data.requests.find((r) => r.buildingId === b.id && r.what === LINE_ASK[line] && isOpenRequest(r));

  const renderGap = (b: Building, line: Line) => {
    const f = followUp(b, line);
    return (
      <span className="ppl-gap">
        <Pill tone="warning" icon="person_search">
          Not named yet
        </Pill>
        <span className="cell-sub">
          {f ? `Chase agent following up with ${f.to.name} · ${STAGE_META[f.stage].label.toLowerCase()} ${f.lastChased ? fmtAgo(f.lastChased) : ''}` : `To be named by ${owner?.name ?? 'your Admin'} (Admin)`}
        </span>
        <span className="ppl-gap-actions">
          {isAdmin && (
            <button type="button" className="text-btn" onClick={() => setNaming({ b, line })}>
              Name someone
            </button>
          )}
          {!f && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                add('requests', { id: newId('rq'), to: { kind: 'contact', id: owner?.id ?? 'u-admin', name: owner?.name ?? 'Account owner' }, what: LINE_ASK[line], buildingId: b.id, spaceId: null, period: '—', stage: 'sent', lastChased: TODAY, channel: 'Email', needsApproval: null } as ChaseRequest);
                toast(`The chase agent will follow up with ${owner?.name ?? 'your Admin'} (test outbox)`);
              }}
            >
              Ask the chase agent to follow up
            </button>
          )}
        </span>
      </span>
    );
  };

  const renderPerson = (id: string) => {
    const u = data.users.find((x) => x.id === id);
    if (!u) return <span className="muted">Unknown person</span>;
    return (
      <span className="ppl-person-cell">
        <Link to={to(`/people/${u.firm ? 'partners' : 'team'}/${u.id}`)} onClick={(e) => e.stopPropagation()}>
          <strong>{u.name}</strong>
        </Link>
        <span className="cell-sub">
          {u.title}
          {u.firm ? `, ${u.firm}` : ''} · <a href={`mailto:${u.email}`} onClick={(e) => e.stopPropagation()}>{u.email}</a>
        </span>
      </span>
    );
  };

  return (
    <article className="page page-wide ppl-page">
      <PageHeader title="Building contacts" subtitle="Who to call at each building, and who owns it on your side." />
      <ApiView q={q} what="building contacts">
        {(buildings) => {
          const named = buildings.filter((b) => b.contactUserId).length;
          const sponsors = buildings.filter((b) => b.sponsorUserId).length;
          const mgmtFor = (b: Building) => data.managementCompanies.find((m) => m.assignments.some((a) => a.buildingId === b.id && !a.end));
          const teamsFor = (b: Building) =>
            liveTeams(data.teams).filter((t) => t.scope.buildingIds.includes(b.id) || t.scope.groupIds.some((g) => data.groups.find((x) => x.id === g)?.buildingIds.includes(b.id)));
          return (
            <>
              {buildings.length > 1 && (
                <div className="ppl-setup-progress" role="status">
                  <div>
                    <span className="ppl-small-label">On-site contact named</span>
                    <strong>
                      {named} of {buildings.length}
                    </strong>
                    <span className="ppl-progress" aria-hidden="true">
                      <span style={{ width: `${(named / buildings.length) * 100}%` }} />
                    </span>
                  </div>
                  <div>
                    <span className="ppl-small-label">Sponsor and project lead</span>
                    <strong>
                      {sponsors} of {buildings.length}
                    </strong>
                    <span className="ppl-progress" aria-hidden="true">
                      <span style={{ width: `${(sponsors / buildings.length) * 100}%` }} />
                    </span>
                  </div>
                  <p className="muted">These are two of the setup steps for each building. Your Admin names people; the chase agent reminds them.</p>
                </div>
              )}
              <DataTable<Building>
                label="Building contacts"
                rows={buildings}
                rowKey={(b) => b.id}
                search={(b) => `${b.name} ${b.address} ${b.city} ${data.users.find((u) => u.id === b.contactUserId)?.name ?? ''}`}
                searchPlaceholder="Find a building or a person"
                caption={buildings.length === 1 ? undefined : `${buildings.length} buildings`}
                initialSort={{ key: 'b', dir: 'asc' }}
                empty={{ title: 'No buildings in scope', icon: 'apartment' }}
                columns={[
                  { key: 'b', header: 'Building', value: (b) => b.name, render: (b) => (
                    <>
                      <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                      <span className="cell-sub">{b.address}, {b.city}</span>
                    </>
                  ) },
                  { key: 'c', header: 'On-site contact', value: (b) => data.users.find((u) => u.id === b.contactUserId)?.name ?? '', render: (b) => (b.contactUserId ? renderPerson(b.contactUserId) : renderGap(b, 'contact')) },
                  { key: 's', header: 'Sponsor and project lead', hideOnPhone: true, value: (b) => data.users.find((u) => u.id === b.sponsorUserId)?.name ?? '', render: (b) => (b.sponsorUserId ? renderPerson(b.sponsorUserId) : renderGap(b, 'sponsor')) },
                  { key: 'm', header: 'Management company', hideOnPhone: true, value: (b) => mgmtFor(b)?.name ?? '', render: (b) => {
                    const m = mgmtFor(b);
                    return m ? <Link to={to(`/people/partners/${m.id}`)}>{m.name}</Link> : <span className="muted">Not recorded</span>;
                  } },
                  { key: 't', header: 'Team', hideOnPhone: true, render: (b) => {
                    const ts = teamsFor(b);
                    return ts.length ? (
                      <span>
                        {ts.map((t, k) => (
                          <span key={t.id}>
                            <Link to={to(`/people/team/${t.id}`)}>{t.name}</Link>
                            {t.proposed ? ' (suggested)' : ''}
                            {k < ts.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="muted">No team</span>
                    );
                  } },
                ]}
              />
              {naming && <NameModal b={naming.b} line={naming.line} onClose={() => setNaming(null)} />}
            </>
          );
        }}
      </ApiView>
    </article>
  );
}

function NameModal({ b, line, onClose }: { b: Building; line: Line; onClose: () => void }) {
  const { data, patch } = useData();
  const toast = useToast();
  const candidates = data.users.filter((u) => u.status !== 'deactivated' && u.role !== 'vendor' && u.role !== 'tenant' && effectiveBuildings(u, data).has(b.id));
  const [pick, setPick] = useState<string>(candidates[0]?.id ?? '');
  const save = () => {
    const u = candidates.find((x) => x.id === pick) as User | undefined;
    if (!u) return;
    const lineNo = line === 'contact' ? 9 : 8;
    patch('buildings', b.id, {
      [line === 'contact' ? 'contactUserId' : 'sponsorUserId']: u.id,
      goldStandard: b.goldStandard.map((g) => (g.line === lineNo ? { ...g, state: 'met' } : g)),
    });
    data.requests.filter((r) => r.buildingId === b.id && r.what === LINE_ASK[line] && isOpenRequest(r)).forEach((r) => patch('requests', r.id, { stage: 'completed', lastChased: TODAY, broughtIn: `${u.name} named as ${LINE_LABEL[line].toLowerCase()}` }));
    toast(`${u.name} is now the ${LINE_LABEL[line].toLowerCase()} for ${b.name}`);
    onClose();
  };
  return (
    <Modal
      title={`${LINE_LABEL[line]} for ${b.name}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={!pick}>
            Save
          </button>
        </>
      }
    >
      {candidates.length ? (
        <fieldset className="ppl-fieldset">
          <legend>People with access to this building</legend>
          <div className="ppl-checks ppl-checks--scroll">
            {candidates.map((u) => (
              <label key={u.id} className="check">
                <input type="radio" name="name-pick" checked={pick === u.id} onChange={() => setPick(u.id)} />
                <span>
                  {u.name} <span className="muted">· {u.title}{u.firm ? `, ${u.firm}` : ''}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p>
          <Icon name="info" /> No one has access to this building yet. Invite someone to it from Team first.
        </p>
      )}
    </Modal>
  );
}
