import type { SectionDef } from './types';

/**
 * The Rail contents table (`02-building/system/navigation-pattern.md` § Rail contents) and each
 * section's "Panel and pages" table, as data. Order here is rail order. Paths are relative to
 * `/{company}/{scope}` (SYS-NAVPAT-15); account and upgrade pages carry no scope.
 */
export const SECTIONS: SectionDef[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    icon: 'space_dashboard',
    path: '/workspace',
    defaultPath: '/workspace',
    source: '02-building/modules/workspace.md § Panel and pages',
    headerActions: [
      { id: 'search', label: 'Search workspaces', icon: 'search' },
      { id: 'filter', label: 'Filter workspaces', icon: 'filter_list' },
    ],
    dynamicList: 'workspaces',
    groups: [],
  },
  {
    id: 'building-info',
    label: 'Building Info',
    icon: 'domain',
    path: '/building-info',
    defaultPath: '/building-info/stacking-plan',
    source: '02-building/modules/building-info.md § Panel and pages',
    headerActions: [
      { id: 'search', label: 'Search buildings, equipment, meters, accounts, bills and files', icon: 'search' },
      { id: 'data-health', label: 'Open data health items', icon: 'health_and_safety', badge: 'dataHealth', to: '/building-info/data-health' },
    ],
    // MOD-BI-41: seven pages in a fixed order, no groups.
    groups: [
      {
        id: 'pages',
        pages: [
          { id: 'stacking-plan', label: 'Stacking plan', icon: 'stacks', path: '/building-info/stacking-plan', scope: 'any', requirements: 'MOD-BI-45, 02' },
          { id: 'data-health', label: 'Data Health', icon: 'health_and_safety', path: '/building-info/data-health', scope: 'any', requirements: 'MOD-BI-60, 17, 64 to 66, 07, 15', badge: 'dataHealth' },
          { id: 'buildings', label: 'Buildings', icon: 'apartment', path: '/building-info/buildings', scope: 'any', requirements: 'MOD-BI-01 to 04, 08, 43' },
          { id: 'equipment', label: 'Equipment', icon: 'hvac', path: '/building-info/equipment', scope: 'any', requirements: 'MOD-BI-09, 20, 21, 44, 50, 52, 53' },
          { id: 'meters', label: 'Meters', icon: 'speed', path: '/building-info/meters', scope: 'any', requirements: 'MOD-BI-14, 15, 51, 68' },
          { id: 'bills', label: 'Bills', icon: 'receipt_long', path: '/building-info/bills', scope: 'any', requirements: 'MOD-BI-12, 69' },
          { id: 'files', label: 'Files', icon: 'folder', path: '/building-info/files', scope: 'any', requirements: 'MOD-BI-09, 50' },
        ],
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: 'group',
    path: '/people',
    defaultPath: '/people/team',
    source: '02-building/modules/people.md § Panel and pages',
    headerActions: [
      { id: 'search', label: 'Search people, tenants and vendors', icon: 'search' },
      { id: 'requests', label: 'Open requests', icon: 'outgoing_mail', badge: 'openRequests', to: '/people/tenants?filter=requests' },
    ],
    primaryAction: { id: 'invite', label: 'Invite', icon: 'person_add', adminOnly: true },
    groups: [
      {
        id: 'items',
        pages: [
          { id: 'team', label: 'Team', icon: 'badge', path: '/people/team', scope: 'any', filters: [{ id: 'members', label: 'Team members' }, { id: 'teams', label: 'Teams' }] },
          { id: 'tenants', label: 'Tenants', icon: 'storefront', path: '/people/tenants', scope: 'any', filters: [{ id: 'tenants', label: 'Tenants' }, { id: 'requests', label: 'Requests' }] },
          { id: 'partners', label: 'Partners', icon: 'handshake', path: '/people/partners', scope: 'any', filters: [{ id: 'contractors', label: 'Contractors and guests' }, { id: 'vendors', label: 'Vendors' }, { id: 'management-companies', label: 'Management companies' }] },
          { id: 'contacts', label: 'Building contacts', icon: 'contact_phone', path: '/people/contacts', scope: 'any' },
          { id: 'agents', label: 'Agents', icon: 'smart_toy', path: '/people/agents', scope: 'any' },
        ],
      },
    ],
  },
  {
    id: 'tenant-billing',
    label: 'Tenant Billing',
    icon: 'request_quote',
    path: '/tenant-billing',
    defaultPath: '/tenant-billing',
    source: '02-building/modules/tenant-billing.md',
    headerActions: [],
    groups: [],
    missing: true,
    noScope: true,
    pitch: 'Bill tenants for the utilities they use, from the same meters and bills Enertiv already holds.',
    benefits: ['Recover utility costs from submetered and allocated consumption', 'Invoices built from the same meters and bills as your ESG reporting', 'Tenants see and pay their bills in the Tenant Portal'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: 'build',
    path: '/maintenance',
    defaultPath: '/maintenance',
    source: '02-building/modules/maintenance.md',
    headerActions: [],
    groups: [],
    missing: true,
    noScope: true,
    pitch: 'Turn alerts and insights into work orders, assign them to your team or vendors, and track them to done.',
    benefits: ['Create a ticket from any alert, with the details attached', 'Assign work to building engineers and vendors already in People', 'Preventive maintenance schedules on the equipment record'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'notifications',
    path: '/notifications',
    defaultPath: '/notifications',
    fixed: true,
    source: '02-building/system/notifications.md § Panel and pages',
    headerActions: [
      { id: 'search', label: 'Search notifications', icon: 'search' },
      { id: 'mark-read', label: 'Mark all read', icon: 'done_all', action: 'markAllRead' },
      { id: 'prefs', label: 'Notification preferences', icon: 'tune', to: '@account/notification-settings' },
    ],
    groups: [
      {
        id: 'groups',
        pages: [
          { id: 'unread', label: 'Unread', icon: 'mark_email_unread', path: '/notifications', scope: 'any', badge: 'unread' },
          { id: 'insights', label: 'Insights', icon: 'lightbulb', path: '/notifications/insights', scope: 'any' },
          { id: 'activity', label: 'Activity', icon: 'history', path: '/notifications/activity', scope: 'any' },
          { id: 'building-alerts', label: 'Building Alerts', icon: 'warning', path: '/notifications/building-alerts', scope: 'any' },
          { id: 'data-alerts', label: 'Data Alerts', icon: 'database', path: '/notifications/data-alerts', scope: 'any' },
          { id: 'app-updates', label: 'App updates', icon: 'new_releases', path: '/notifications/app-updates', scope: 'any' },
        ],
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: 'account_circle',
    path: '/account',
    defaultPath: '/account/profile',
    fixed: true,
    noScope: true,
    source: '02-building/system/navigation-pattern.md (SYS-NAVPAT-06)',
    headerActions: [],
    groups: [
      {
        id: 'personal',
        label: 'Personal',
        pages: [
          { id: 'profile', label: 'Profile', icon: 'person', path: '/account/profile', scope: 'none' },
          { id: 'preferences', label: 'Preferences', icon: 'tune', path: '/account/preferences', scope: 'none' },
          { id: 'notification-settings', label: 'Notification settings', icon: 'notifications_active', path: '/account/notification-settings', scope: 'none' },
          { id: 'tenant-view', label: 'Tenant view', icon: 'storefront', scope: 'none', disabledNote: 'after the MVP' },
        ],
      },
      {
        id: 'account-settings',
        label: 'Account settings',
        adminOnly: true,
        pages: [
          { id: 'entitlements', label: 'Modules and entitlements', icon: 'widgets', path: '/account/entitlements', scope: 'none', adminOnly: true },
          { id: 'white-labelling', label: 'White labelling', icon: 'palette', scope: 'none', disabledNote: 'after the MVP' },
        ],
      },
    ],
    footer: [
      { id: 'help', label: 'Help and support', icon: 'help' },
      { id: 'sign-out', label: 'Sign out', icon: 'logout' },
    ],
  },
];

export const RAIL_SECTIONS = SECTIONS.filter((s) => !s.fixed);
export const RAIL_FIXED = SECTIONS.filter((s) => s.fixed);

export function findSection(id: string) {
  return SECTIONS.find((s) => s.id === id);
}

/** The section an inner path (after /{company}/{scope}) belongs to. */
export function sectionForInner(inner: string) {
  return SECTIONS.find((s) => inner === s.path || inner.startsWith(s.path + '/'));
}

/** Section and page for an inner path; detail pages resolve to their list page. */
export function navForInner(inner: string) {
  const section = sectionForInner(inner);
  if (!section) return undefined;
  let best: { page: (typeof section.groups)[number]['pages'][number]; len: number } | undefined;
  for (const group of section.groups) {
    for (const page of group.pages) {
      if (!page.path) continue;
      if (inner === page.path || inner.startsWith(page.path + '/')) {
        if (!best || page.path.length > best.len) best = { page, len: page.path.length };
      }
    }
  }
  return { section, page: best?.page };
}
