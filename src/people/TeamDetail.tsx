/** A team's page: members, the buildings it covers, its default role (MOD-PPL-14; SYS-GOLD-08 for a suggested team). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { Team } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog } from '../ui/Modal';
import { ApiView, EmptyState, PageHeader, Pill, Section } from '../ui/bits';
import { useToast } from '../ui/Toast';
import { describeScope, Initials, KeyValue, PERSONA_LABEL, ROLE_LABEL, usePermissions, UserStatus } from './common';
import { TeamModal } from './modals';

export function TeamDetail({ id }: { id: string }) {
  const { data, patch } = useData();
  const { to, navigate } = useNav();
  const toast = useToast();
  const { isAdmin } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const q = useApi(`people/teams/${id}`, () => data.teams.find((t) => t.id === id && !(t as Team & { deleted?: boolean }).deleted) ?? null, [data.teams, id]);
  const back = { to: to('/people/team?filter=teams'), label: 'Teams' };

  if (q.status === 'ready' && !q.data) {
    return (
      <article className="page page-wide ppl-page">
        <PageHeader back={back} title="Team not found" />
        <EmptyState icon="group_off" title="This team no longer exists" body="It may have been deleted." />
      </article>
    );
  }
  return (
    <article className="page page-wide ppl-page">
      <ApiView q={q} what="this team">
        {(t: Team | null) => {
          if (!t) return null;
          const members = t.memberIds.map((m) => data.users.find((u) => u.id === m)).filter(Boolean) as typeof data.users;
          const bIds = new Set(t.scope.buildingIds);
          t.scope.groupIds.forEach((g) => data.groups.find((x) => x.id === g)?.buildingIds.forEach((b) => bIds.add(b)));
          const buildings = data.buildings.filter((b) => bIds.has(b.id));
          return (
            <>
              <PageHeader
                back={back}
                eyebrow="Team"
                title={
                  <span className="ppl-title">
                    <Initials name={t.name} kind="org" />
                    {t.name}
                    {t.proposed && <Pill tone="info">Suggested at setup</Pill>}
                  </span>
                }
                subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'} · ${describeScope(t.scope, data)}`}
                actions={
                  isAdmin && (
                    <div className="btn-row">
                      {t.proposed && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            patch('teams', t.id, { proposed: false });
                            toast(`Team “${t.name}” confirmed`);
                          }}
                        >
                          <Icon name="check" /> Confirm
                        </button>
                      )}
                      <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                        <Icon name="edit" /> Edit team
                      </button>
                      <button type="button" className="btn btn--ghost ppl-danger-text" onClick={() => setDeleting(true)}>
                        Delete
                      </button>
                    </div>
                  )
                }
              />
              {t.proposed && (
                <div className="banner banner--neutral">
                  <Icon name="auto_awesome" />
                  <div>Setup suggested this team because {t.name} manages these buildings. Nobody gets access from it until it’s confirmed.</div>
                </div>
              )}
              <div className="grid grid--2 ppl-cards">
                <section className="card" aria-labelledby="tm-h">
                  <h3 id="tm-h">What the team gives its members</h3>
                  <KeyValue
                    items={[
                      ['Buildings', describeScope(t.scope, data)],
                      ['Default role', ROLE_LABEL[t.defaultRole]],
                      ['Chase agent', t.canManageChase ? 'Members can run it' : 'Members see what it’s doing'],
                    ]}
                  />
                  {t.scope.groupIds.length > 0 && <p className="muted ppl-help">Group access follows the group: a building added to it later is included automatically.</p>}
                </section>
                <section className="card" aria-labelledby="tb-h">
                  <h3 id="tb-h">Buildings ({buildings.length})</h3>
                  {buildings.length ? (
                    <ul className="ppl-plain-list">
                      {buildings.slice(0, 12).map((b) => (
                        <li key={b.id}>
                          <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link> <span className="muted">· {b.city}</span>
                        </li>
                      ))}
                      {buildings.length > 12 && <li className="muted">and {buildings.length - 12} more</li>}
                    </ul>
                  ) : (
                    <p className="muted">No buildings yet.</p>
                  )}
                </section>
              </div>
              <Section title="Members" id="members">
                <DataTable
                  label="Team members"
                  rows={members}
                  rowKey={(u) => u.id}
                  rowHref={(u) => to(`/people/${u.firm ? 'partners' : 'team'}/${u.id}`)}
                  empty={{ title: 'No members yet', body: isAdmin ? 'Edit the team to add people, or invite someone to it.' : undefined, icon: 'group' }}
                  columns={[
                    { key: 'name', header: 'Name', value: (u) => u.name, render: (u) => (
                      <>
                        {u.name}
                        <span className="cell-sub">{u.title}</span>
                      </>
                    ) },
                    { key: 'persona', header: 'Persona', hideOnPhone: true, value: (u) => (u.persona === 'none' ? '—' : PERSONA_LABEL[u.persona]) },
                    { key: 'role', header: 'Role', hideOnPhone: true, value: (u) => ROLE_LABEL[u.role] },
                    { key: 'status', header: 'Status', render: (u) => <UserStatus status={u.status} /> },
                  ]}
                />
              </Section>
              {editing && <TeamModal team={t} onClose={() => setEditing(false)} />}
              {deleting && (
                <ConfirmDialog
                  title={`Delete ${t.name}?`}
                  body={<p>Its {members.length} members lose the buildings this team gives them, unless they have access another way. Their accounts stay.</p>}
                  confirmLabel="Delete team"
                  destructive
                  onCancel={() => setDeleting(false)}
                  onConfirm={() => {
                    patch('teams', t.id, { deleted: true, memberIds: [], scope: { groupIds: [], buildingIds: [] } });
                    toast(`Team “${t.name}” deleted`);
                    navigate(back.to);
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
