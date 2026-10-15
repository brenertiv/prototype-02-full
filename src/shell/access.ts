import { useMemo } from 'react';
import { useData } from '../data/store';
import { useScopeInfo } from '../nav/route';

/**
 * Section access by permission role (`02-building/system/access-and-roles.md`, ST-E06, ST-N03).
 * A Vendor sees only the buildings they are scoped to in Building Info, and Notifications.
 */
export function useSectionAccess() {
  const { user } = useData();
  return (sectionId: string): boolean => {
    if (user.role === 'vendor') return sectionId === 'building-info' || sectionId === 'notifications' || sectionId === 'account';
    return true;
  };
}

/** Counts behind the section badges, in the current scope. */
export function useBadgeCounts() {
  const { data } = useData();
  const scope = useScopeInfo();
  return useMemo(() => {
    const inScope = new Set(scope.buildingIds);
    return {
      dataHealth: data.health.filter((h) => h.status === 'open' && inScope.has(h.buildingId)).length,
      openRequests: data.requests.filter((r) => !['completed', 'declined'].includes(r.stage) && inScope.has(r.buildingId)).length,
      unread: data.notices.filter((n) => !n.read && (!n.buildingId || inScope.has(n.buildingId))).length,
    };
  }, [data, scope.buildingIds]);
}
