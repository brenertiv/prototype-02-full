/**
 * Admin forms in People: invite by email (MOD-PPL-02, 03, 16; SYS-ACCESS-28; SYS-PERS-03),
 * change a person's role and scope, and create or edit a team (MOD-PPL-14).
 * Every write stays in the per-session overlay; invites go to a simulated outbox.
 */
import { useMemo, useState } from 'react';
import { useData } from '../data/store';
import type { RoleId, Team, User } from '../data/types';
import { Icon } from '../shell/Icon';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { describeScope, isEmail, liveTeams, newId, PERSONA_LABEL, ROLE_HELP, ROLE_LABEL, TITLE_GROUPS, TODAY } from './common';

const INVITE_ROLES: RoleId[] = ['operator', 'billing', 'admin'];

/** Pick groups and buildings for a direct grant or a team's scope. */
function ScopePicker({ groupIds, buildingIds, onChange, idPrefix }: { groupIds: string[]; buildingIds: string[]; onChange: (s: { groupIds: string[]; buildingIds: string[] }) => void; idPrefix: string }) {
  const { data, accessible } = useData();
  const [q, setQ] = useState('');
  const groups = data.groups.filter((g) => g.buildingIds.length);
  const buildings = data.buildings.filter((b) => accessible.has(b.id) && (!q || b.name.toLowerCase().includes(q.toLowerCase()) || b.city.toLowerCase().includes(q.toLowerCase())));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <div className="ppl-scope-picker">
      {groups.length > 0 && (
        <fieldset className="ppl-fieldset">
          <legend>Groups of buildings</legend>
          <p className="muted ppl-help">A group grant follows the group: buildings added to it later are included.</p>
          <div className="ppl-checks">
            {groups.map((g) => (
              <label key={g.id} className="check">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => onChange({ groupIds: toggle(groupIds, g.id), buildingIds })} />
                <span>
                  {g.name} <span className="muted">· {g.kind}, {g.buildingIds.length} buildings</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="ppl-fieldset">
        <legend>Specific buildings</legend>
        {data.buildings.length > 6 && (
          <label className="search-field ppl-search-sm">
            <Icon name="search" />
            <span className="sr-only">Find a building</span>
            <input id={`${idPrefix}-bq`} type="search" placeholder="Find a building" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        )}
        <div className="ppl-checks ppl-checks--scroll">
          {buildings.map((b) => (
            <label key={b.id} className="check">
              <input type="checkbox" checked={buildingIds.includes(b.id)} onChange={() => onChange({ groupIds, buildingIds: toggle(buildingIds, b.id) })} />
              <span>
                {b.name} <span className="muted">· {b.city}</span>
              </span>
            </label>
          ))}
          {!buildings.length && <p className="muted">No buildings match “{q}”.</p>}
        </div>
      </fieldset>
    </div>
  );
}

export function InviteModal({ onClose, guest = false }: { onClose: () => void; guest?: boolean }) {
  const { data, user, add, patch } = useData();
  const toast = useToast();
  const teams = liveTeams(data.teams).filter((t) => !t.proposed || guest);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [titleGroup, setTitleGroup] = useState(guest ? 'property-management' : 'sustainability');
  const [title, setTitle] = useState('');
  const [firm, setFirm] = useState('');
  const [role, setRole] = useState<RoleId>('operator');
  const [mode, setMode] = useState<'teams' | 'direct'>(teams.length ? 'teams' : 'direct');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [grant, setGrant] = useState<{ groupIds: string[]; buildingIds: string[] }>({ groupIds: [], buildingIds: [] });
  const [webAccess, setWebAccess] = useState(false);
  const [tried, setTried] = useState(false);

  const group = TITLE_GROUPS.find((g) => g.id === titleGroup)!;
  const engineering = titleGroup === 'engineering';
  const persona = engineering ? (webAccess ? 'pm' : 'none') : group.persona;
  const duplicate = data.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const errors = {
    email: !email.trim() ? 'Enter an email address' : !isEmail(email) ? 'Enter a valid email address, like name@company.com' : duplicate ? 'Someone with this email is already in the account' : null,
    name: !name.trim() ? 'Enter their name' : null,
    firm: guest && !firm.trim() ? 'Enter the firm they work for' : null,
    scope: mode === 'teams' ? (!teamIds.length ? 'Choose at least one team' : null) : !grant.groupIds.length && !grant.buildingIds.length ? 'Choose at least one group or building' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  // A team brings its default role; the highest one wins.
  const teamRole = useMemo(() => {
    const rank: RoleId[] = ['operator', 'billing', 'admin'];
    const roles = teams.filter((t) => teamIds.includes(t.id)).map((t) => t.defaultRole);
    return roles.sort((a, b) => rank.indexOf(b) - rank.indexOf(a))[0];
  }, [teams, teamIds]);
  const effectiveRole = mode === 'teams' && teamRole ? teamRole : role;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    const id = newId('u');
    const rec: User = {
      id,
      name: name.trim(),
      email: email.trim(),
      title: title.trim() || group.example,
      persona,
      role: effectiveRole,
      appAccess: engineering && !webAccess ? 'survey' : 'web',
      scope: mode === 'direct' ? { all: false, ...grant } : { all: false, groupIds: [], buildingIds: [] },
      teamIds: mode === 'teams' ? teamIds : [],
      status: 'invited',
      lastActive: null,
      invitedBy: user.id,
      invited: TODAY,
      firm: guest ? firm.trim() : null,
    };
    add('users', rec);
    if (mode === 'teams') teamIds.forEach((t) => patch('teams', t, { memberIds: [...(data.teams.find((x) => x.id === t)?.memberIds ?? []), id] }));
    toast(`Invitation sent to ${rec.email}. In this prototype it goes to the test outbox.`);
    onClose();
  };

  const err = (k: keyof typeof errors) => (tried && errors[k] ? <span className="ppl-error" id={`inv-${k}-err`}>{errors[k]}</span> : null);

  return (
    <Modal
      title={guest ? 'Invite a contractor or guest' : 'Invite a team member'}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submit}>
            <Icon name="send" /> Send invitation
          </button>
        </>
      }
    >
      <form
        className="ppl-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="field-row">
          <label className="field">
            <span>Email</span>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(tried && errors.email)} aria-describedby="inv-email-err" placeholder="name@company.com" />
            {err('email')}
          </label>
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(tried && errors.name)} aria-describedby="inv-name-err" />
            {err('name')}
          </label>
        </div>
        {guest && (
          <label className="field">
            <span>Firm they work for</span>
            <input type="text" value={firm} list="inv-firms" onChange={(e) => setFirm(e.target.value)} aria-invalid={Boolean(tried && errors.firm)} aria-describedby="inv-firm-err" placeholder="Crestline Property Services" />
            <datalist id="inv-firms">
              {[...new Set(data.users.map((u) => u.firm).filter(Boolean) as string[])].map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            {err('firm')}
          </label>
        )}
        <div className="field-row">
          <label className="field">
            <span>Title group</span>
            <select value={titleGroup} onChange={(e) => setTitleGroup(e.target.value)}>
              {TITLE_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Job title (optional)</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={group.example} />
          </label>
        </div>
        <p className="ppl-help muted">
          {engineering && !webAccess
            ? 'Building engineers get the Survey App only. They can’t sign in to the web app.'
            : `They’ll start with ${PERSONA_LABEL[persona]} defaults, and choose their own jobs when they first sign in.`}
        </p>
        {engineering && (
          <label className="check">
            <input type="checkbox" checked={webAccess} onChange={(e) => setWebAccess(e.target.checked)} />
            <span>Also give web app access (they start as a Property Manager)</span>
          </label>
        )}

        <fieldset className="ppl-fieldset">
          <legend>Which buildings</legend>
          <div className="ppl-radios" role="radiogroup" aria-label="How to grant access">
            <label className="check">
              <input type="radio" name="inv-mode" checked={mode === 'teams'} onChange={() => setMode('teams')} disabled={!teams.length} />
              <span>
                Add to a team <span className="muted">· recommended; they get the team’s buildings and role</span>
              </span>
            </label>
            <label className="check">
              <input type="radio" name="inv-mode" checked={mode === 'direct'} onChange={() => setMode('direct')} />
              <span>Grant buildings or groups directly</span>
            </label>
          </div>
          {mode === 'teams' ? (
            <div className="ppl-checks">
              {teams.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={teamIds.includes(t.id)} onChange={() => setTeamIds((ids) => (ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id]))} />
                  <span>
                    {t.name} <span className="muted">· {describeScope(t.scope, data)} · {ROLE_LABEL[t.defaultRole]}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <ScopePicker idPrefix="inv" groupIds={grant.groupIds} buildingIds={grant.buildingIds} onChange={setGrant} />
          )}
          {err('scope')}
        </fieldset>

        {mode === 'direct' || !teamRole ? (
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}: {ROLE_HELP[r]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="ppl-help">
            <strong>Role:</strong> {ROLE_LABEL[teamRole]}, from the team. You can change it after they join.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Change one person's role, teams and direct grants. */
export function EditAccessModal({ person, onClose }: { person: User; onClose: () => void }) {
  const { data, patch } = useData();
  const toast = useToast();
  const teams = liveTeams(data.teams);
  const [role, setRole] = useState<RoleId>(person.role);
  const [teamIds, setTeamIds] = useState<string[]>(teams.filter((t) => t.memberIds.includes(person.id)).map((t) => t.id));
  const [all, setAll] = useState(person.scope.all);
  const [grant, setGrant] = useState({ groupIds: person.scope.groupIds, buildingIds: person.scope.buildingIds });

  const save = () => {
    patch('users', person.id, { role, scope: { all, ...(all ? { groupIds: [], buildingIds: [] } : grant) }, teamIds });
    for (const t of teams) {
      const has = t.memberIds.includes(person.id);
      const want = teamIds.includes(t.id);
      if (has !== want) patch('teams', t.id, { memberIds: want ? [...t.memberIds, person.id] : t.memberIds.filter((m) => m !== person.id) });
    }
    toast(`Access updated for ${person.name}`);
    onClose();
  };

  return (
    <Modal
      title={`Change access for ${person.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save}>
            Save changes
          </button>
        </>
      }
    >
      <div className="ppl-form">
        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as RoleId)} disabled={person.role === 'vendor'}>
            {(person.role === 'vendor' ? (['vendor'] as RoleId[]) : INVITE_ROLES).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}: {ROLE_HELP[r]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="ppl-fieldset">
          <legend>Teams</legend>
          {teams.length ? (
            <div className="ppl-checks">
              {teams.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={teamIds.includes(t.id)} onChange={() => setTeamIds((ids) => (ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id]))} />
                  <span>
                    {t.name} <span className="muted">· {describeScope(t.scope, data)}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="muted">No teams yet.</p>
          )}
        </fieldset>
        <fieldset className="ppl-fieldset">
          <legend>Direct grants</legend>
          <label className="check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            <span>Every building in the account, including ones added later</span>
          </label>
          {!all && <ScopePicker idPrefix="edit" groupIds={grant.groupIds} buildingIds={grant.buildingIds} onChange={setGrant} />}
        </fieldset>
      </div>
    </Modal>
  );
}

/** Create or edit a team: people, a scope and a default role, nothing else (MOD-PPL-14). */
export function TeamModal({ team, onClose, onSaved }: { team?: Team; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, add, patch } = useData();
  const toast = useToast();
  const people = data.users.filter((u) => u.status !== 'deactivated' && u.role !== 'vendor' && u.role !== 'tenant');
  const [name, setName] = useState(team?.name ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  const [scope, setScope] = useState(team?.scope ?? { groupIds: [], buildingIds: [] });
  const [defaultRole, setDefaultRole] = useState<RoleId>(team?.defaultRole ?? 'operator');
  const [canManageChase, setCanManageChase] = useState(team?.canManageChase ?? false);
  const [q, setQ] = useState('');
  const [tried, setTried] = useState(false);
  const nameErr = !name.trim() ? 'Give the team a name' : liveTeams(data.teams).some((t) => t.id !== team?.id && t.name.toLowerCase() === name.trim().toLowerCase()) ? 'A team with this name already exists' : null;
  const scopeErr = !scope.groupIds.length && !scope.buildingIds.length ? 'Choose at least one group or building' : null;

  const save = () => {
    setTried(true);
    if (nameErr || scopeErr) return;
    const body = { name: name.trim(), memberIds, scope, defaultRole, canManageChase, proposed: false };
    if (team) {
      patch('teams', team.id, body);
      toast(`Team “${body.name}” saved`);
      onSaved?.(team.id);
    } else {
      const id = newId('t');
      add('teams', { id, ...body });
      toast(`Team “${body.name}” created`);
      onSaved?.(id);
    }
    onClose();
  };

  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.firm ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      title={team ? `Edit ${team.name}` : 'Create a team'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save}>
            {team?.proposed ? 'Confirm team' : team ? 'Save team' : 'Create team'}
          </button>
        </>
      }
    >
      <div className="ppl-form">
        <label className="field">
          <span>Team name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(tried && nameErr)} aria-describedby="team-name-err" autoFocus />
          {tried && nameErr && (
            <span className="ppl-error" id="team-name-err">
              {nameErr}
            </span>
          )}
        </label>
        <div className="field-row">
          <label className="field">
            <span>Default role for members</span>
            <select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as RoleId)}>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="check ppl-check-inline">
            <input type="checkbox" checked={canManageChase} onChange={(e) => setCanManageChase(e.target.checked)} />
            <span>
              Members can run the chase agent <span className="muted">· its settings, contact rules and approvals</span>
            </span>
          </label>
        </div>
        <fieldset className="ppl-fieldset">
          <legend>Buildings the team covers</legend>
          <ScopePicker idPrefix="team" groupIds={scope.groupIds} buildingIds={scope.buildingIds} onChange={setScope} />
          {tried && scopeErr && <span className="ppl-error">{scopeErr}</span>}
        </fieldset>
        <fieldset className="ppl-fieldset">
          <legend>Members ({memberIds.length})</legend>
          <label className="search-field ppl-search-sm">
            <Icon name="search" />
            <span className="sr-only">Find people</span>
            <input type="search" placeholder="Find people" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="ppl-checks ppl-checks--scroll">
            {shown.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={memberIds.includes(p.id)} onChange={() => setMemberIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))} />
                <span>
                  {p.name} <span className="muted">· {p.title}{p.firm ? `, ${p.firm}` : ''}</span>
                </span>
              </label>
            ))}
            {!shown.length && <p className="muted">No one matches “{q}”.</p>}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
