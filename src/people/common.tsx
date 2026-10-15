/**
 * Shared helpers for the People section (`02-building/modules/people.md`): labels, effective
 * scope (MOD-PPL-14, SYS-ACCESS-28), permissions (SYS-ACCESS-10, 13) and small cells.
 */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData, type CurrentUser } from '../data/store';
import type { ChaseRequest, ChaseStage, Dataset, PersonaId, RoleId, Team, User } from '../data/types';
import { useNav, useScopeInfo } from '../nav/route';
import { Pill, type Tone } from '../ui/bits';

export const TODAY = '2026-10-15';

export const PERSONA_LABEL: Record<PersonaId, string> = {
  am: 'Asset Manager',
  sl: 'Sustainability Lead',
  pm: 'Property Manager',
  none: 'No persona',
};

export const ROLE_LABEL: Record<RoleId, string> = {
  admin: 'Admin',
  billing: 'Billing',
  operator: 'Operator',
  vendor: 'Vendor',
  tenant: 'Tenant',
};

export const ROLE_HELP: Record<RoleId, string> = {
  admin: 'Everything, including inviting people and changing access',
  billing: 'Utilities, tenants, budgets and projects; can run the chase agent',
  operator: 'Equipment, meters and alerts on their buildings',
  vendor: 'Only the buildings and work they are given',
  tenant: 'Their own spaces only',
};

/** Title groups from Modules & Roles 2.0, and the persona each starts with (SYS-PERS-03 table). */
export const TITLE_GROUPS: { id: string; label: string; persona: PersonaId; example: string }[] = [
  { id: 'executive', label: 'Executive', persona: 'am', example: 'VP, Operations' },
  { id: 'asset-management', label: 'Asset Management', persona: 'am', example: 'Asset Manager' },
  { id: 'sustainability', label: 'Sustainability', persona: 'sl', example: 'Sustainability Analyst' },
  { id: 'property-management', label: 'Property Management', persona: 'pm', example: 'Property Manager' },
  { id: 'accounting', label: 'Accounting', persona: 'pm', example: 'Controller' },
  { id: 'operations', label: 'Operations', persona: 'pm', example: 'Operations Manager' },
  { id: 'engineering', label: 'Engineering', persona: 'none', example: 'Chief Engineer' },
];

/** Best guess at a title's group, for pre-selecting jobs and showing the starting persona. */
export function titleGroupFor(title: string | null | undefined): (typeof TITLE_GROUPS)[number] | null {
  const t = (title ?? '').toLowerCase();
  if (!t.trim()) return null;
  const find = (id: string) => TITLE_GROUPS.find((g) => g.id === id)!;
  if (/engineer|technician|mechanic/.test(t)) return find('engineering');
  if (/sustainab|esg|energy|environment|carbon/.test(t)) return find('sustainability');
  if (/asset|portfolio|investment|acquisition/.test(t)) return find('asset-management');
  if (/property|building manager|facilit|leasing/.test(t)) return find('property-management');
  if (/controller|account|finance|billing/.test(t)) return find('accounting');
  if (/operation/.test(t) && !/vp|vice|chief|head|director/.test(t)) return find('operations');
  if (/vp|vice|chief|head|director|president|ceo|coo|cfo|principal|partner/.test(t)) return find('executive');
  return null;
}

export const STATUS_META: Record<User['status'], { label: string; tone: Tone; icon: string }> = {
  invited: { label: 'Invited', tone: 'info', icon: 'mail' },
  active: { label: 'Active', tone: 'success', icon: 'check_circle' },
  never: { label: 'Never signed in', tone: 'warning', icon: 'schedule' },
  deactivated: { label: 'Deactivated', tone: 'neutral', icon: 'block' },
};

export function UserStatus({ status }: { status: User['status'] }) {
  const m = STATUS_META[status];
  return (
    <Pill tone={m.tone} icon={m.icon}>
      {m.label}
    </Pill>
  );
}

export const STAGE_META: Record<ChaseStage, { label: string; tone: Tone; icon: string; open: boolean }> = {
  'not-sent': { label: 'Not sent', tone: 'neutral', icon: 'schedule_send', open: true },
  sent: { label: 'Sent', tone: 'info', icon: 'send', open: true },
  reminded: { label: 'Reminded', tone: 'info', icon: 'notifications_active', open: true },
  escalated: { label: 'Escalated', tone: 'danger', icon: 'priority_high', open: true },
  completed: { label: 'Completed', tone: 'success', icon: 'check_circle', open: false },
  declined: { label: 'Declined', tone: 'warning', icon: 'do_not_disturb_on', open: false },
  'contact-unknown': { label: 'Contact unknown', tone: 'warning', icon: 'person_off', open: true },
  'moved-out': { label: 'Tenant moved out', tone: 'neutral', icon: 'logout', open: false },
};

export function StagePill({ stage }: { stage: ChaseStage }) {
  const m = STAGE_META[stage];
  return (
    <Pill tone={m.tone} icon={m.icon}>
      {m.label}
    </Pill>
  );
}

export const isOpenRequest = (r: ChaseRequest) => STAGE_META[r.stage].open;

/** Teams that still exist (a deleted team is kept in the overlay with no members and no scope). */
export function liveTeams(teams: Team[]) {
  return teams.filter((t) => !(t as Team & { deleted?: boolean }).deleted);
}

export function groupBuildings(data: Dataset, groupId: string): string[] {
  return data.groups.find((g) => g.id === groupId)?.buildingIds ?? [];
}

export interface ScopePart {
  key: string;
  kind: 'all' | 'team' | 'direct';
  /** "Team: Sustainability", "Direct grant", "Role" */
  source: string;
  teamId?: string;
  /** What it grants, in words: "Fund I (Fund)", "3 buildings" */
  grants: string;
  buildingIds: string[];
}

/** Where each part of a person's scope comes from (MOD-PPL-14, ST-U12). */
export function scopeParts(u: User, data: Dataset): ScopePart[] {
  const parts: ScopePart[] = [];
  const all = data.buildings.map((b) => b.id);
  if (u.scope.all || u.role === 'admin' || u.role === 'billing') {
    parts.push({ key: 'all', kind: 'all', source: u.scope.all ? 'Direct grant' : `${ROLE_LABEL[u.role]} role`, grants: 'Every building in the account', buildingIds: all });
  }
  for (const t of liveTeams(data.teams)) {
    if (!t.memberIds.includes(u.id)) continue;
    const ids = new Set<string>(t.scope.buildingIds);
    t.scope.groupIds.forEach((g) => groupBuildings(data, g).forEach((b) => ids.add(b)));
    parts.push({ key: `t-${t.id}`, kind: 'team', source: `Team: ${t.name}`, teamId: t.id, grants: describeScope(t.scope, data), buildingIds: [...ids] });
  }
  if (!u.scope.all) {
    u.scope.groupIds.forEach((g) => {
      const grp = data.groups.find((x) => x.id === g);
      if (grp) parts.push({ key: `g-${g}`, kind: 'direct', source: 'Direct grant', grants: `${grp.name} (${grp.kind}); follows the group as it changes`, buildingIds: grp.buildingIds });
    });
    if (u.scope.buildingIds.length) {
      parts.push({ key: 'b', kind: 'direct', source: 'Direct grant', grants: buildingNames(u.scope.buildingIds, data), buildingIds: u.scope.buildingIds });
    }
  }
  return parts;
}

export function effectiveBuildings(u: User, data: Dataset): Set<string> {
  const set = new Set<string>();
  scopeParts(u, data).forEach((p) => p.buildingIds.forEach((b) => set.add(b)));
  return set;
}

export function buildingNames(ids: string[], data: Dataset, max = 3) {
  const names = ids.map((id) => data.buildings.find((b) => b.id === id)?.name).filter(Boolean) as string[];
  if (names.length <= max) return names.join(', ') || 'No buildings';
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

export function describeScope(scope: { groupIds: string[]; buildingIds: string[] }, data: Dataset) {
  const parts: string[] = [];
  scope.groupIds.forEach((g) => {
    const grp = data.groups.find((x) => x.id === g);
    if (grp) parts.push(`${grp.name} (${grp.kind})`);
  });
  if (scope.buildingIds.length) parts.push(scope.buildingIds.length === 1 ? buildingNames(scope.buildingIds, data) : `${scope.buildingIds.length} buildings`);
  return parts.join(' · ') || 'No buildings yet';
}

/** Permission checks for the signed-in user (SYS-ACCESS-10, 13). */
export function usePermissions() {
  const { user, data, getApp } = useData();
  return useMemo(() => {
    const isAdmin = user.role === 'admin';
    const operatorGrants = getApp<string[]>('chaseGrants', []);
    const viaTeam = liveTeams(data.teams).some((t) => t.canManageChase && t.memberIds.includes(user.id));
    const blocked = user.role === 'vendor' || user.role === 'tenant';
    const canManageChase = !blocked && (isAdmin || user.role === 'billing' || viaTeam || operatorGrants.includes(user.id));
    return {
      isAdmin,
      canManageChase,
      chaseVia: isAdmin || user.role === 'billing' ? 'role' : viaTeam ? 'team' : operatorGrants.includes(user.id) ? 'grant' : null,
      canSeeAgent: !blocked,
      canEditContacts: isAdmin || canManageChase,
    };
  }, [user, data.teams, getApp]);
}

/** The account owner the chase agent escalates to first (SYS-CHASE-07). */
export function accountOwner(data: Dataset): User | undefined {
  return data.users.find((u) => u.id === 'u-admin') ?? data.users.find((u) => u.role === 'admin' && u.status === 'active');
}

/** Buildings in the current scope, the user can access (MOD-PPL-40). */
export function useScopeBuildings() {
  const scope = useScopeInfo();
  return useMemo(() => ({ scope, inScope: new Set(scope.buildingIds), rollUp: scope.kind !== 'property' }), [scope]);
}

export function BuildingLinks({ ids, max = 2 }: { ids: string[]; max?: number }) {
  const { data } = useData();
  const { to } = useNav();
  if (!ids.length) return <span className="muted">None</span>;
  const shown = ids.slice(0, max);
  return (
    <span className="ppl-blinks">
      {shown.map((id, k) => {
        const b = data.buildings.find((x) => x.id === id);
        return (
          <span key={id}>
            <Link to={to(`/building-info/buildings/${id}`)} onClick={(e) => e.stopPropagation()}>
              {b?.name ?? id}
            </Link>
            {k < shown.length - 1 ? ', ' : ''}
          </span>
        );
      })}
      {ids.length > max && <span className="muted"> +{ids.length - max} more</span>}
    </span>
  );
}

export function Initials({ name, kind = 'person' }: { name: string; kind?: 'person' | 'org' | 'agent' }) {
  const text = kind === 'agent' ? '' : name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className={`ppl-avatar ppl-avatar--${kind}`} aria-hidden="true">
      {kind === 'agent' ? <span className="msym">smart_toy</span> : text}
    </span>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="dl ppl-dl">
      {items.map(([k, v]) => (
        <div key={k} className="ppl-dl-row">
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Read-only notice for users without the controls (People › States). */
export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return (
    <p className="ppl-readonly">
      <span className="msym" aria-hidden="true">
        visibility
      </span>
      {children}
    </p>
  );
}

export type { CurrentUser };
