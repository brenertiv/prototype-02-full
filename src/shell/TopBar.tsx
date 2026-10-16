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

/**
 * Where am I (SYS-SCOPE-30 to 33, CMP-TOPBAR-10 to 16), drawn as the Figma shell's scope chips:
 * the portfolio or group chip, with a stepper that opens the scope navigator, and at property
 * scope a property chip whose close button goes up to the group (CMP-TOPBAR-16).
 */
function ScopeIndicator({ phone }: { phone: boolean }) {
  const scope = useScopeInfo();
  const { data, accessible } = useData();
  const { setScope, navigate, to } = useNav();
  const [open, setOpen] = useState(false);
  // ST-S01 single-property account; ST-S07 a user whose access is one building.
  const single = data.buildings.length === 1 || accessible.size === 1;

  // The group a property sits in (its leaf group), and that group's parent, for the path.
  let groupChip: { type: string; name: string; scopeId: string; path: string; count: number };
  if (scope.kind === 'property') {
    const b = data.buildings.find((x) => `property-${x.id}` === scope.id);
    const leaf = data.groups.find((g) => b && g.buildingIds.includes(b.id) && !data.groups.some((c) => c.parentId === g.id));
    const parent = leaf?.parentId ? data.groups.find((g) => g.id === leaf.parentId) : undefined;
    groupChip = leaf
      ? { type: leaf.kind, name: leaf.name, scopeId: `group-${leaf.id}`, path: ['Portfolio', parent?.name, leaf.name].filter(Boolean).join(' › '), count: leaf.buildingIds.filter((x) => accessible.has(x)).length }
      : { type: 'Portfolio', name: 'All properties', scopeId: 'portfolio', path: 'Portfolio', count: accessible.size };
  } else if (scope.kind === 'group') {
    groupChip = { type: scope.type, name: scope.name, scopeId: scope.id, path: scope.path.join(' › '), count: scope.buildingIds.length };
  } else {
    groupChip = { type: 'Portfolio', name: `All ${scope.buildingIds.length} properties`, scopeId: 'portfolio', path: 'Portfolio', count: scope.buildingIds.length };
  }

  const buildingId = scope.kind === 'property' ? scope.id.slice('property-'.length) : null;

  // Property chip, a split button: the label opens the building's page; the X goes back to the portfolio.
  const propertyChip = scope.kind === 'property' && (
    <div className="scope-chip scope-chip--property" title={`${groupChip.path} › ${scope.name}`}>
      <button type="button" className="scope-chip-main" aria-label={`Open ${scope.name}`} onClick={() => navigate(to(`/building-info/buildings/${buildingId}`))}>
        <span className="scope-chip-thumb" aria-hidden="true">
          <Icon name={LEVEL_ICON.property} />
        </span>
        <span className="scope-chip-text">
          <span className="scope-chip-label">Property</span>
          <span className="scope-chip-name">{scope.name}</span>
        </span>
      </button>
      {!single && (
        <button type="button" className="scope-chip-btn" aria-label="Back to the portfolio" title="Back to the portfolio" onClick={() => setScope('portfolio')}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );

  // CMP-SCOPE-55: a single-property account names the property and doesn't open the navigator.
  if (single) return <nav className="scope" aria-label="Scope">{propertyChip}</nav>;

  const groupIsCurrent = scope.kind !== 'property';
  return (
    <nav className="scope" aria-label="Scope">
      {/* Group chip, a split button: the label sets that group (or the portfolio) as the scope; the stepper opens the navigator */}
      {(!phone || groupIsCurrent) && (
        <div className={`scope-chip ${groupIsCurrent ? 'is-current' : ''}`} title={groupChip.path}>
          <button
            type="button"
            className="scope-chip-main"
            aria-label={groupIsCurrent ? `${groupChip.type} ${groupChip.name}, ${groupChip.count} properties` : `Go up to ${groupChip.type} ${groupChip.name}`}
            aria-current={groupIsCurrent ? 'true' : undefined}
            onClick={() => setScope(groupChip.scopeId)}
          >
            <span className="scope-chip-icon" aria-hidden="true">
              <Icon name={scope.kind === 'portfolio' ? LEVEL_ICON.portfolio : 'folder_open'} />
            </span>
            <span className="scope-chip-text">
              <span className="scope-chip-label">{groupChip.type}</span>
              <span className="scope-chip-name">{groupChip.name}</span>
            </span>
          </button>
          <button
            type="button"
            className="scope-chip-btn scope-chip-btn--step scope-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Change scope"
            title="Change scope"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="unfold_more" />
          </button>
        </div>
      )}
      {propertyChip}
      {open && <ScopeNavigator phone={phone} onClose={() => setOpen(false)} />}
    </nav>
  );
}
