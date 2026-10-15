import { useState } from 'react';
import { useData } from '../data/store';
import { sectionForInner } from '../nav/sections';
import { useNav, useScopeInfo } from '../nav/route';
import { usePrefs } from '../state/preferences';
import { useBadgeCounts } from './access';
import { Icon } from './Icon';
import { usePageControlsNode } from './pageControls';
import { LEVEL_ICON, ScopeNavigator } from './ScopeNavigator';

interface Props {
  phone: boolean;
  onOpenMenu: () => void;
}

/** The canvas top bar: scope indicator, page controls, assistant toggle; no title (SYS-NAVPAT-20 to 22). */
export function TopBar({ phone, onOpenMenu }: Props) {
  const { prefs, set } = usePrefs();
  const { inner, scopeId } = useNav();
  const counts = useBadgeCounts();
  const section = sectionForInner(inner);
  const scopeApplies = scopeId !== null && !section?.noScope;
  const controls = usePageControlsNode();

  return (
    <div className="topbar" role="toolbar" aria-label="Page">
      <div className="topbar-left">
        {phone && (
          <button type="button" className="icon-btn topbar-btn" aria-label={`Open navigation${counts.unread ? `, ${counts.unread} unread notifications` : ''}`} onClick={onOpenMenu}>
            <Icon name="menu" />
            {counts.unread > 0 && (
              <span className="count-badge" aria-hidden="true">
                {counts.unread}
              </span>
            )}
          </button>
        )}
        {scopeApplies && <ScopeIndicator phone={phone} />}
      </div>
      <div className="topbar-right">
        {controls}
        <button
          type="button"
          className={`icon-btn topbar-btn ${prefs.drawerOpen ? 'is-on' : ''}`}
          aria-label="Assistant"
          title="Assistant"
          aria-pressed={prefs.drawerOpen}
          onClick={() => set('drawerOpen', !prefs.drawerOpen)}
        >
          <Icon name="auto_awesome" filled={prefs.drawerOpen} />
        </button>
      </div>
    </div>
  );
}

/** Where am I (SYS-SCOPE-30 to 33, CMP-TOPBAR-10 to 16): level icon, path, count; parent crumbs go up a level. */
function ScopeIndicator({ phone }: { phone: boolean }) {
  const scope = useScopeInfo();
  const { data, accessible } = useData();
  const { setScope } = useNav();
  const [open, setOpen] = useState(false);
  // ST-S01 single-property account; ST-S07 a user whose access is one building.
  const single = data.buildings.length === 1 || accessible.size === 1;

  // Parent crumbs as scope ids.
  const crumbs: { label: string; scopeId: string }[] = [];
  if (scope.kind !== 'portfolio' && !single) {
    crumbs.push({ label: 'Portfolio', scopeId: 'portfolio' });
    if (scope.kind === 'property') {
      const b = data.buildings.find((x) => `property-${x.id}` === scope.id);
      const leaf = data.groups.find((g) => b && g.buildingIds.includes(b.id) && !data.groups.some((c) => c.parentId === g.id));
      const parent = leaf?.parentId ? data.groups.find((g) => g.id === leaf.parentId) : undefined;
      if (parent) crumbs.push({ label: parent.name, scopeId: `group-${parent.id}` });
      if (leaf) crumbs.push({ label: leaf.name, scopeId: `group-${leaf.id}` });
    } else {
      const g = data.groups.find((x) => `group-${x.id}` === scope.id);
      const parent = g?.parentId ? data.groups.find((x) => x.id === g.parentId) : undefined;
      if (parent) crumbs.push({ label: parent.name, scopeId: `group-${parent.id}` });
    }
  }
  const level = scope.kind;
  const count = scope.buildingIds.length;

  // CMP-SCOPE-55: a single-property account names the property and doesn't open the navigator.
  if (single) {
    return (
      <div className={`scope-indicator scope-indicator--property`} aria-label={`Property: ${scope.name}`}>
        <Icon name={LEVEL_ICON.property} filled />
        <span className="scope-type">Property</span>
        <span className="scope-name">{scope.name}</span>
      </div>
    );
  }

  return (
    <nav className="scope" aria-label="Scope">
      <ol className={`scope-indicator scope-indicator--${level === 'portfolio' ? 'portfolio' : level === 'group' ? 'group' : 'property'}`}>
        <li className="scope-level">
          <Icon name={LEVEL_ICON[level]} filled />
          {level !== 'portfolio' && <span className="scope-type">{scope.type}</span>}
        </li>
        {!phone &&
          crumbs.map((c) => (
            <li key={c.scopeId} className="scope-crumb">
              <button type="button" className="scope-crumb-link" aria-label={`Go up to ${c.label}`} onClick={() => setScope(c.scopeId)}>
                {c.label}
              </button>
              <Icon name="chevron_right" className="scope-sep" />
            </li>
          ))}
        <li>
          <button type="button" className="scope-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`Scope: ${scope.type} ${scope.name}${level !== 'property' ? `, ${count} properties` : ''}. Change scope`} onClick={() => setOpen((o) => !o)}>
            <span className="scope-name">{scope.name}</span>
            {level !== 'property' && <span className="scope-count">{count} properties</span>}
            <Icon name="expand_more" />
          </button>
        </li>
      </ol>
      {open && <ScopeNavigator phone={phone} onClose={() => setOpen(false)} />}
    </nav>
  );
}
