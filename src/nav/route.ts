/**
 * Routes start with the Company and the scope (SYS-NAVPAT-15):
 *   /{company}/{scope}/workspace/{workspaceId}
 *   /{company}/{scope}/building-info/{page}/{objectId?}
 *   /{company}/{scope}/people/{item}/{objectId?}?filter={filter}
 *   /{company}/{scope}/notifications/{group?}
 *   /{company}/account/{page}
 *   /{company}/tenant-billing, /{company}/maintenance
 * scope = portfolio | group-{groupId} | property-{propertyId}
 */
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import type { Building } from '../data/types';
import { findSection } from './sections';

const NO_SCOPE = new Set(['account', 'tenant-billing', 'maintenance']);
const LAST_SCOPE_KEY = 'kw.lastScope';

export function parsePath(pathname: string) {
  const segs = pathname.split('/').filter(Boolean);
  const company = segs[0] ?? '';
  if (segs[1] && NO_SCOPE.has(segs[1])) {
    return { company, scopeId: null as string | null, inner: `/${segs.slice(1).join('/')}` };
  }
  return { company, scopeId: segs[1] ?? 'portfolio', inner: `/${segs.slice(2).join('/')}` };
}

export function rememberScope(scopeId: string) {
  try {
    sessionStorage.setItem(LAST_SCOPE_KEY, scopeId);
  } catch {
    /* fine */
  }
}

export function lastScope() {
  try {
    return sessionStorage.getItem(LAST_SCOPE_KEY) ?? 'portfolio';
  } catch {
    return 'portfolio';
  }
}

export interface ScopeInfo {
  id: string;
  kind: 'portfolio' | 'group' | 'property';
  /** Level type shown first in the indicator (SYS-SCOPE-31). */
  type: string;
  name: string;
  /** Names from the Company down (SYS-SCOPE-32). */
  path: string[];
  /** Buildings in scope that this user can access. */
  buildingIds: string[];
  /** Buildings in the nominal scope the user can't access (SYS-TRUST-23, ST-D07). */
  excluded: number;
  valid: boolean;
}

/** Resolve a scope id against the dataset and the user's access. */
export function useScopeInfo(scopeIdArg?: string | null): ScopeInfo {
  const { data, accessible } = useData();
  const { pathname } = useLocation();
  const scopeId = scopeIdArg ?? parsePath(pathname).scopeId ?? lastScope();
  return useMemo(() => resolveScope(scopeId, data.buildings, data.groups, accessible), [scopeId, data.buildings, data.groups, accessible]);
}

export function resolveScope(scopeId: string, buildings: Building[], groups: { id: string; name: string; kind: string; parentId?: string; buildingIds: string[] }[], accessible: Set<string>): ScopeInfo {
  const single = buildings.length === 1;
  if (scopeId.startsWith('property-')) {
    const id = scopeId.slice('property-'.length);
    const b = buildings.find((x) => x.id === id);
    if (b) {
      const g = groups.find((x) => x.buildingIds.includes(b.id) && !groups.some((c) => c.parentId === x.id));
      const parent = g?.parentId ? groups.find((x) => x.id === g.parentId) : undefined;
      return {
        id: scopeId, kind: 'property', type: 'Property', name: b.name,
        path: [single ? b.name : 'Portfolio', ...(parent ? [parent.name] : []), ...(g ? [g.name] : []), ...(single ? [] : [b.name])],
        buildingIds: accessible.has(b.id) ? [b.id] : [], excluded: accessible.has(b.id) ? 0 : 1, valid: true,
      };
    }
  }
  if (scopeId.startsWith('group-')) {
    const id = scopeId.slice('group-'.length);
    const g = groups.find((x) => x.id === id);
    if (g) {
      const parent = g.parentId ? groups.find((x) => x.id === g.parentId) : undefined;
      const inScope = g.buildingIds.filter((b) => accessible.has(b));
      return { id: scopeId, kind: 'group', type: g.kind, name: g.name, path: ['Portfolio', ...(parent ? [parent.name] : []), g.name], buildingIds: inScope, excluded: g.buildingIds.length - inScope.length, valid: true };
    }
  }
  const all = buildings.filter((b) => accessible.has(b.id)).map((b) => b.id);
  if (single) {
    // ST-S01: a single-property account has no portfolio wording.
    return { id: 'portfolio', kind: 'property', type: 'Property', name: buildings[0].name, path: [buildings[0].name], buildingIds: all, excluded: 0, valid: scopeId === 'portfolio' };
  }
  return { id: 'portfolio', kind: 'portfolio', type: 'Portfolio', name: 'Portfolio', path: ['Portfolio'], buildingIds: all, excluded: buildings.length - all.length, valid: scopeId === 'portfolio' };
}

/** Link helpers that keep the Company and scope (SYS-SCOPE-13, 15). */
export function useNav() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { data } = useData();
  const parsed = parsePath(pathname);
  const company = parsed.company || data.company.id;
  const scopeId = parsed.scopeId ?? lastScope();

  /** A section-relative path ('/building-info/buildings') to a full route in the current scope. */
  const to = useCallback(
    (inner: string, opts?: { scope?: string }) => {
      if (inner.startsWith('@account/')) return `/${company}/account/${inner.slice('@account/'.length)}`;
      const first = inner.split('/').filter(Boolean)[0];
      if (first && findSection(first)?.noScope) return `/${company}${inner}`;
      return `/${company}/${opts?.scope ?? scopeId}${inner}`;
    },
    [company, scopeId],
  );

  /** Switch scope and stay on the same page (SYS-SCOPE-10). Detail pages keep their object. */
  const setScope = useCallback(
    (nextScope: string) => {
      rememberScope(nextScope);
      if (parsed.scopeId === null) return;
      navigate(`/${company}/${nextScope}${parsed.inner === '/' ? '/workspace' : parsed.inner}${search}`);
    },
    [company, navigate, parsed.inner, parsed.scopeId, search],
  );

  return { company, scopeId, inner: parsed.inner, to, setScope, navigate };
}
