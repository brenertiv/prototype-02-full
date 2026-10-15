/** The scope a page works at (panel template "Pages per group"). */
export type PageScope = 'portfolio' | 'property' | 'both' | 'any' | 'none';

/** A filter over the records on one page, kept in the URL as `?filter=<id>` (People). */
export interface FilterDef {
  id: string;
  label: string;
}

export type BadgeKind = 'dataHealth' | 'openRequests' | 'unread';

export interface PageDef {
  id: string;
  label: string;
  icon?: string;
  filters?: FilterDef[];
  /** Section-relative route. Absent for rows that are not pages in the MVP. */
  path?: string;
  scope: PageScope;
  requirements?: string;
  disabledNote?: string;
  adminOnly?: boolean;
  badge?: BadgeKind;
}

export interface GroupDef {
  id: string;
  label?: string;
  pages: PageDef[];
  adminOnly?: boolean;
}

export interface HeaderAction {
  id: string;
  label: string;
  icon: string;
  badge?: BadgeKind;
  /** Route the action opens; '@account/x' is an account route. */
  to?: string;
  action?: 'markAllRead';
}

export interface SectionDef {
  id: string;
  label: string;
  icon: string;
  path: string;
  defaultPath: string;
  headerActions: HeaderAction[];
  primaryAction?: { id: string; label: string; icon: string; adminOnly?: boolean };
  groups: GroupDef[];
  dynamicList?: 'workspaces';
  footer?: { id: string; label: string; icon: string }[];
  /** SYS-NAVPAT-04: an upgradable section; opens an upgrade page, no panel. */
  missing?: boolean;
  /** SYS-NAVPAT-06: fixed to the bottom of the rail. */
  fixed?: boolean;
  /** Routes carry no scope (account and upgrade pages, SYS-NAVPAT-15). */
  noScope?: boolean;
  source: string;
  pitch?: string;
  benefits?: string[];
}
