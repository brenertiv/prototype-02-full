/**
 * A person's page: the team member template and the guest template (MOD-PPL-13), with access,
 * teams, the union of their scope and where each part comes from (MOD-PPL-14, ST-U12), the
 * buildings they are the contact for, and the chase agent's contact rules (MOD-PPL-08).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { User } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog } from '../ui/Modal';
import { ApiView, EmptyState, PageHeader, Pill, Section } from '../ui/bits';
import { fmtAgo, fmtDate } from '../ui/format';
import { useToast } from '../ui/Toast';
import { ContactRulesEditor } from './ContactRules';
import { effectiveBuildings, Initials, KeyValue, liveTeams, PERSONA_LABEL, ROLE_HELP, ROLE_LABEL, scopeParts, TODAY, usePermissions, UserStatus } from './common';
import { EditAccessModal } from './modals';

export function MemberPage({ id, guest }: { id: string; guest?: boolean }) {
  const { data, patch } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { isAdmin, canManageChase } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const q = useApi(`people/users/${id}`, () => data.users.find((u) => u.id === id) ?? null, [data.users, id]);
  const isGuest = guest || Boolean(q.data?.firm);
  const back = isGuest ? { to: to('/people/partners'), label: 'Contractors and guests' } : { to: to('/people/team'), label: 'Team' };

  if (q.status === 'ready' && !q.data) {
    return (
      <article className="page page-wide ppl-page">
        <PageHeader back={back} title="Person not found" />
        <EmptyState icon="person_off" title="We couldn’t find this person" body="They may have been removed, or the link is from another account." action={<Link to={back.to}>Back to {back.label}</Link>} />
      </article>
    );
  }

  return (
    <article className="page page-wide ppl-page">
      <ApiView q={q} what="this person">
        {(u: User | null) => {
          if (!u) return null;
          const parts = scopeParts(u, data);
          const all = [...effectiveBuildings(u, data)];
          const teams = liveTeams(data.teams).filter((t) => t.memberIds.includes(u.id));
          const contactFor = data.buildings.filter((b) => b.contactUserId === u.id || b.sponsorUserId === u.id);
          const inviter = data.users.find((x) => x.id === u.invitedBy);
          const deactivated = u.status === 'deactivated';
          const pending = u.status === 'invited' || u.status === 'never';
          return (
            <>
              <PageHeader
                back={back}
                eyebrow={isGuest ? `Guest from ${u.firm}` : 'Team member'}
                title={
                  <span className="ppl-title">
                    <Initials name={u.name} />
                    {u.name}
                  </span>
                }
                subtitle={
                  <>
                    {u.title} · <a href={`mailto:${u.email}`}>{u.email}</a>
                  </>
                }
                actions={
                  isAdmin && (
                    <div className="btn-row">
                      {pending && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            patch('users', u.id, { invited: TODAY, status: 'invited' });
                            toast(`Invitation resent to ${u.email} (test outbox)`);
                          }}
                        >
                          <Icon name="forward_to_inbox" /> Resend invitation
                        </button>
                      )}
                      {!deactivated && (
                        <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                          <Icon name="admin_panel_settings" /> Change access
                        </button>
                      )}
                      {deactivated ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            patch('users', u.id, { status: 'active' });
                            toast(`${u.name} can sign in again`);
                          }}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button type="button" className="btn btn--ghost ppl-danger-text" onClick={() => setConfirm(true)}>
                          {isGuest ? 'Revoke access' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  )
                }
              />

              {u.status === 'never' && (
                <div className="banner banner--warning">
                  <Icon name="schedule" />
                  <div>
                    <strong>{u.name.split(' ')[0]} hasn’t signed in since being invited {fmtAgo(u.invited)}.</strong>{' '}
                    {isAdmin ? 'Resend the invitation, or ask them directly; the link in the first one may have expired.' : 'An Admin can resend the invitation.'}
                  </div>
                </div>
              )}
              {u.status === 'invited' && (
                <div className="banner banner--neutral">
                  <Icon name="mail" />
                  <div>Invited {fmtAgo(u.invited)} by {inviter?.name ?? 'an Admin'}. They haven’t accepted yet.</div>
                </div>
              )}
              {deactivated && (
                <div className="banner banner--neutral">
                  <Icon name="block" />
                  <div>Deactivated. {u.name.split(' ')[0]} can’t sign in, and the chase agent won’t contact them. Their history stays on the record.</div>
                </div>
              )}
              {u.appAccess === 'survey' && (
                <div className="banner banner--neutral">
                  <Icon name="phone_iphone" />
                  <div>
                    <strong>Survey App only.</strong> Building engineers survey buildings in the Survey App and can’t sign in to the web app. They’re listed here so your team can reach them.
                  </div>
                </div>
              )}

              <div className="grid grid--2 ppl-cards">
                <section className="card" aria-labelledby="acc-h">
                  <h3 id="acc-h">Access</h3>
                  <KeyValue
                    items={[
                      ['Role', <span key="r" title={ROLE_HELP[u.role]}>{ROLE_LABEL[u.role]}</span>],
                      ['Persona', u.persona === 'none' ? <span className="muted">None in the web app</span> : PERSONA_LABEL[u.persona]],
                      ['App access', u.appAccess === 'survey' ? 'Survey App only' : 'Web app'],
                      ['Status', <UserStatus key="s" status={u.status} />],
                      ['Last active', u.lastActive ? fmtAgo(u.lastActive) : 'Never'],
                      ...(isGuest ? ([['Firm', u.firm]] as [string, string | null][]) : []),
                      ['Invited', u.invited ? `${fmtDate(u.invited)}${inviter ? ` by ${inviter.name}` : ''}` : 'Account owner'],
                    ]}
                  />
                </section>
                <section className="card" aria-labelledby="teams-h">
                  <h3 id="teams-h">Teams</h3>
                  {teams.length ? (
                    <ul className="ppl-plain-list">
                      {teams.map((t) => (
                        <li key={t.id}>
                          <Link to={to(`/people/team/${t.id}`)}>{t.name}</Link>
                          <span className="muted"> · {ROLE_LABEL[t.defaultRole]}{t.canManageChase ? ', runs the chase agent' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Not on a team. Their access comes from direct grants.</p>
                  )}
                </section>
              </div>

              <Section title="Buildings they can reach" description={`${all.length} ${all.length === 1 ? 'building' : 'buildings'} in total: everything below, combined.`} id="scope">
                {parts.length ? (
                  <DataTable
                    label="Where their access comes from"
                    rows={parts}
                    rowKey={(p) => p.key}
                    columns={[
                      { key: 'source', header: 'From', render: (p) => (p.teamId ? <Link to={to(`/people/team/${p.teamId}`)}>{p.source}</Link> : p.source) },
                      { key: 'grants', header: 'What it gives', render: (p) => p.grants },
                      { key: 'count', header: 'Buildings', align: 'right', render: (p) => p.buildingIds.length },
                    ]}
                  />
                ) : (
                  <EmptyState icon="domain_disabled" title="No buildings yet" body={isAdmin ? 'Add them to a team or grant buildings directly.' : 'An Admin can give them access.'} />
                )}
              </Section>

              <Section title="Building contact for" id="contact-for">
                {contactFor.length ? (
                  <ul className="list">
                    {contactFor.map((b) => (
                      <li key={b.id}>
                        <Icon name="apartment" />
                        <div className="list-item-main">
                          <Link className="list-item-title" to={to(`/building-info/buildings/${b.id}`)}>
                            {b.name}
                          </Link>
                          <div className="muted">
                            {[b.contactUserId === u.id ? 'On-site contact' : null, b.sponsorUserId === u.id ? 'Sponsor and project lead' : null].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not named as a contact on any building.</p>
                )}
              </Section>

              <Section title="Chase agent contact rules" description="How often the chase agent may contact this person, and how." id="rules">
                <ContactRulesEditor
                  canEdit={canManageChase}
                  value={u.chaseRules ?? { maxPerWeek: 2, channels: ['In-app'] }}
                  channels={['In-app', 'Email', 'SMS']}
                  smsAvailable={false}
                  onSave={(rules) => {
                    patch('users', u.id, { chaseRules: rules });
                    toast(`Contact rules saved for ${u.name}`);
                  }}
                />
              </Section>

              {editing && <EditAccessModal person={u} onClose={() => setEditing(false)} />}
              {confirm && (
                <ConfirmDialog
                  title={isGuest ? `Revoke ${u.name}’s access?` : `Deactivate ${u.name}?`}
                  body={
                    <p>
                      {u.name.split(' ')[0]} won’t be able to sign in to {data.company.name}
                      {isGuest ? ` or see its ${all.length} buildings` : ''}. Their history stays on the record, and an Admin can reactivate them later.
                    </p>
                  }
                  confirmLabel={isGuest ? 'Revoke access' : 'Deactivate'}
                  destructive
                  onCancel={() => setConfirm(false)}
                  onConfirm={() => {
                    patch('users', u.id, { status: 'deactivated' });
                    setConfirm(false);
                    toast(isGuest ? `${u.name}’s access revoked` : `${u.name} deactivated`);
                  }}
                />
              )}
              {isGuest && <GuestNote firm={u.firm} />}
            </>
          );
        }}
      </ApiView>
    </article>
  );
}

function GuestNote({ firm }: { firm: string | null }) {
  const { data } = useData();
  const team = liveTeams(data.teams).find((t) => t.name === firm);
  const { to } = useNav();
  if (!team) return null;
  return (
    <p className="muted ppl-foot">
      <Pill icon="handshake">{firm}</Pill> has a team in this account. When the firm takes on or hands back a building, change it once on the <Link to={to(`/people/team/${team.id}`)}>{team.name} team</Link>.
    </p>
  );
}
