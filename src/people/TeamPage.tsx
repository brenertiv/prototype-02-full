/** People › Team: Team members and Teams (MOD-PPL-01, 02, 14, 16, 40; SYS-GOLD-08; ST-U01 to U04, U12). */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { Team, User } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable } from '../ui/DataTable';
import { ApiView, FilterChips, PageHeader, Pill, SelectFilter } from '../ui/bits';
import { fmtAgo } from '../ui/format';
import { useToast } from '../ui/Toast';
import { BuildingLinks, describeScope, effectiveBuildings, liveTeams, PERSONA_LABEL, ReadOnlyNote, ROLE_LABEL, TODAY, usePermissions, UserStatus, useScopeBuildings } from './common';
import { InviteModal, TeamModal } from './modals';

const daysSince = (iso: string | null) => (iso ? Math.round((Date.parse(TODAY) - Date.parse(iso)) / 86400000) : 0);

export function TeamPage() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') === 'teams' ? 'teams' : 'members';
  const { isAdmin } = usePermissions();
  const inviteOpen = params.get('invite') === '1' && isAdmin;
  const [creating, setCreating] = useState(false);
  const closeInvite = () => {
    const next = new URLSearchParams(params);
    next.delete('invite');
    setParams(next, { replace: true });
  };
  const openInvite = () => {
    const next = new URLSearchParams(params);
    next.set('invite', '1');
    setParams(next);
  };

  return (
    <article className="page page-wide ppl-page">
      <PageHeader
        title="Team"
        subtitle={filter === 'teams' ? 'Teams are how access is given: a team covers a set of buildings and gives its members a role.' : 'Everyone with access to this account’s buildings.'}
        actions={
          isAdmin ? (
            filter === 'teams' ? (
              <button type="button" className="btn" onClick={() => setCreating(true)}>
                <Icon name="group_add" /> Create team
              </button>
            ) : (
              <button type="button" className="btn" onClick={openInvite}>
                <Icon name="person_add" /> Invite
              </button>
            )
          ) : undefined
        }
      />
      <FilterChips
        label="Show"
        options={[
          { id: 'members', label: 'Team members' },
          { id: 'teams', label: 'Teams' },
        ]}
      />
      {!isAdmin && <ReadOnlyNote>You can see who has access. Only an Admin can invite people or change access.</ReadOnlyNote>}
      {filter === 'teams' ? <TeamsList onCreate={() => setCreating(true)} /> : <MembersList />}
      {inviteOpen && <InviteModal onClose={closeInvite} />}
      {creating && <TeamModal onClose={() => setCreating(false)} />}
    </article>
  );
}

function MembersList() {
  const { data, patch } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { isAdmin } = usePermissions();
  const { scope, inScope, rollUp } = useScopeBuildings();
  const [status, setStatus] = useState('current');
  const q = useApi(
    `people/team?scope=${scope.id}`,
    () =>
      data.users
        .filter((u) => !u.firm && u.role !== 'vendor' && u.role !== 'tenant')
        .map((u) => ({ u, bIds: [...effectiveBuildings(u, data)].filter((b) => inScope.has(b)) }))
        .filter((r) => r.bIds.length > 0),
    [data, inScope],
  );

  return (
    <ApiView q={q} what="team members">
      {(rows) => {
        const shown = rows.filter((r) => (status === 'current' ? r.u.status !== 'deactivated' : status === 'all' ? true : r.u.status === status));
        const stale = rows.filter((r) => r.u.status === 'never' || (r.u.status === 'invited' && daysSince(r.u.invited) > 14));
        return (
          <>
            {isAdmin && stale.length > 0 && (
              <div className="banner banner--warning" role="status">
                <Icon name="schedule" />
                <div>
                  <strong>
                    {stale.length === 1 ? `${stale[0].u.name} hasn’t signed in` : `${stale.length} people haven’t signed in`} since they were invited.
                  </strong>{' '}
                  A reminder usually helps; it goes with a fresh link.
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    stale.forEach((r) => patch('users', r.u.id, { invited: TODAY, status: r.u.status === 'never' ? 'invited' : r.u.status }));
                    toast(`Reminder sent to ${stale.length === 1 ? stale[0].u.name : `${stale.length} people`} (test outbox)`);
                  }}
                >
                  Resend {stale.length === 1 ? 'invitation' : 'invitations'}
                </button>
              </div>
            )}
            <DataTable<{ u: User; bIds: string[] }>
              label="Team members"
              rows={shown}
              rowKey={(r) => r.u.id}
              rowHref={(r) => to(`/people/team/${r.u.id}`)}
              search={(r) => `${r.u.name} ${r.u.email} ${r.u.title}`}
              searchPlaceholder="Search by name, email or title"
              caption={`${shown.length} ${shown.length === 1 ? 'person' : 'people'} with access to ${rollUp ? `buildings in ${scope.name === 'Portfolio' ? 'the portfolio' : scope.name}` : scope.name}`}
              toolbar={
                <SelectFilter
                  label="Invite status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'current', label: 'Everyone current' },
                    { value: 'active', label: 'Active' },
                    { value: 'invited', label: 'Invited' },
                    { value: 'never', label: 'Never signed in' },
                    { value: 'deactivated', label: 'Deactivated' },
                    { value: 'all', label: 'All, including deactivated' },
                  ]}
                />
              }
              empty={{ title: 'No one matches', body: 'Try another invite status.', icon: 'group' }}
              initialSort={{ key: 'name', dir: 'asc' }}
              columns={[
                { key: 'name', header: 'Name', value: (r) => r.u.name, render: (r) => (
                  <>
                    {r.u.name}
                    <span className="cell-sub">{r.u.title}</span>
                  </>
                ) },
                { key: 'persona', header: 'Persona', value: (r) => PERSONA_LABEL[r.u.persona], hideOnPhone: true, render: (r) => (r.u.persona === 'none' ? <span className="muted">—</span> : PERSONA_LABEL[r.u.persona]) },
                { key: 'role', header: 'Role', value: (r) => ROLE_LABEL[r.u.role], hideOnPhone: true },
                { key: 'app', header: 'App access', value: (r) => r.u.appAccess, hideOnPhone: true, render: (r) => (r.u.appAccess === 'survey' ? <Pill icon="phone_iphone">Survey App only</Pill> : 'Web app') },
                ...(rollUp ? [{ key: 'scope', header: 'Buildings', value: (r: { u: User; bIds: string[] }) => r.bIds.length, hideOnPhone: true, render: (r: { u: User; bIds: string[] }) => (r.bIds.length === scope.buildingIds.length && scope.buildingIds.length > 2 ? 'All in scope' : <BuildingLinks ids={r.bIds} />) }] : []),
                { key: 'teams', header: 'Teams', hideOnPhone: true, value: (r) => liveTeams(data.teams).filter((t) => t.memberIds.includes(r.u.id)).map((t) => t.name).join(', ') },
                { key: 'status', header: 'Status', value: (r) => r.u.status, render: (r) => <UserStatus status={r.u.status} /> },
                { key: 'last', header: 'Last active', value: (r) => r.u.lastActive ?? '', hideOnPhone: true, render: (r) => (r.u.lastActive ? fmtAgo(r.u.lastActive) : <span className="muted">Never</span>) },
              ]}
            />
          </>
        );
      }}
    </ApiView>
  );
}

function TeamsList({ onCreate }: { onCreate: () => void }) {
  const { data, patch } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { isAdmin } = usePermissions();
  const { scope, inScope } = useScopeBuildings();
  const [editing, setEditing] = useState<Team | null>(null);
  const q = useApi(
    `people/teams?scope=${scope.id}`,
    () =>
      liveTeams(data.teams)
        .map((t) => {
          const ids = new Set(t.scope.buildingIds);
          t.scope.groupIds.forEach((g) => data.groups.find((x) => x.id === g)?.buildingIds.forEach((b) => ids.add(b)));
          return { t, bIds: [...ids].filter((b) => inScope.has(b)) };
        })
        .filter((r) => r.bIds.length > 0 || (r.t.scope.buildingIds.length === 0 && r.t.scope.groupIds.length === 0)),
    [data, inScope],
  );
  return (
    <ApiView q={q} what="teams">
      {(rows) => {
        const proposed = rows.filter((r) => r.t.proposed);
        return (
          <>
            {proposed.length > 0 && (
              <div className="banner banner--neutral ppl-proposed" role="status">
                <Icon name="auto_awesome" />
                <div>
                  <strong>Setup suggested {proposed.length === 1 ? 'a team' : `${proposed.length} teams`} from the management companies on your buildings.</strong>{' '}
                  Each covers the buildings that firm manages. {isAdmin ? 'Confirm them as they are, or change them first.' : 'An Admin confirms them.'}
                  <ul className="ppl-proposed-list">
                    {proposed.map((r) => (
                      <li key={r.t.id}>
                        <span>
                          <strong>{r.t.name}</strong> · {r.t.memberIds.length} {r.t.memberIds.length === 1 ? 'member' : 'members'} · {describeScope(r.t.scope, data)} · {ROLE_LABEL[r.t.defaultRole]}
                        </span>
                        {isAdmin && (
                          <span className="btn-row">
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(r.t)}>
                              Change
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => {
                                patch('teams', r.t.id, { proposed: false });
                                toast(`Team “${r.t.name}” confirmed`);
                              }}
                            >
                              <Icon name="check" /> Confirm
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <DataTable
              label="Teams"
              rows={rows}
              rowKey={(r) => r.t.id}
              rowHref={(r) => to(`/people/team/${r.t.id}`)}
              search={(r) => r.t.name}
              searchPlaceholder="Search teams"
              caption={`${rows.length} ${rows.length === 1 ? 'team' : 'teams'} covering buildings in ${scope.kind === 'portfolio' ? 'the portfolio' : scope.name}`}
              empty={{
                title: 'No teams yet',
                body: isAdmin ? (
                  <>
                    A team gives a set of people the same buildings and role.{' '}
                    <button type="button" className="text-btn" onClick={onCreate}>
                      Create the first team
                    </button>
                  </>
                ) : (
                  'An Admin can create teams.'
                ),
                icon: 'groups',
              }}
              initialSort={{ key: 'name', dir: 'asc' }}
              columns={[
                { key: 'name', header: 'Team', value: (r) => r.t.name, render: (r) => (
                  <>
                    {r.t.name}
                    {r.t.proposed && (
                      <>
                        {' '}
                        <Pill tone="info">Suggested</Pill>
                      </>
                    )}
                  </>
                ) },
                { key: 'members', header: 'Members', value: (r) => r.t.memberIds.length, align: 'right' },
                { key: 'scope', header: 'Covers', value: (r) => describeScope(r.t.scope, data), hideOnPhone: true },
                { key: 'role', header: 'Default role', value: (r) => ROLE_LABEL[r.t.defaultRole], hideOnPhone: true },
                { key: 'chase', header: 'Runs the chase agent', value: (r) => (r.t.canManageChase ? 'Yes' : 'No'), hideOnPhone: true },
              ]}
            />
            {editing && <TeamModal team={editing} onClose={() => setEditing(null)} />}
          </>
        );
      }}
    </ApiView>
  );
}
