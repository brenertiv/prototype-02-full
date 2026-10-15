import { useState, type FocusEvent, type MouseEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../data/store';
import { RAIL_FIXED, RAIL_SECTIONS } from '../nav/sections';
import type { SectionDef } from '../nav/types';
import { useNav } from '../nav/route';
import { useWorkspaceIndicator } from '../workspace/registry';
import { useBadgeCounts, useSectionAccess } from './access';
import { Icon } from './Icon';

interface Props {
  activeId?: string;
  /** Phone variant inside the drawer: labels shown, no tooltips (SYS-NAVPAT-30). */
  phone?: boolean;
  /** Panel docked: every item gets a tooltip. Collapsed: only items with no panel, since the peek names the rest. */
  docked?: boolean;
  onHoverSection?: (id: string) => void;
  onClickSection?: (id: string) => void;
  onOpenCompany: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** The icon rail (SYS-NAVPAT-01 to 09). */
export function Rail({ activeId, phone, docked, onHoverSection, onClickSection, onOpenCompany }: Props) {
  const { data, user } = useData();
  const { to } = useNav();
  const counts = useBadgeCounts();
  const canAccess = useSectionAccess();
  const indicator = useWorkspaceIndicator();
  const company = data.company;

  // Fixed-position tooltip so the scrolling list can't clip it; aria-hidden because the
  // aria-label is the accessible name (SYS-NAVPAT-31: a tooltip is not the label).
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const showTip = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, label: string, enabled: boolean) => {
    if (!enabled || phone) return setTip(null);
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);

  const renderItem = (section: SectionDef) => {
    const active = section.id === activeId;
    const noAccess = !canAccess(section.id);
    const unread = section.id === 'notifications' ? counts.unread : 0;
    const wsIndicator = section.id === 'workspace' ? indicator : null;
    const labelParts = [section.label];
    if (section.missing) labelParts.push('not in your account');
    if (noAccess) labelParts.push('no access');
    if (unread > 0) labelParts.push(`${unread} unread`);
    if (wsIndicator === 'running') labelParts.push('a workspace is generating');
    if (wsIndicator === 'ready') labelParts.push('a workspace is ready');
    const label = labelParts.join(', ');
    const isAccount = section.id === 'account';
    const tipOn = Boolean(docked) || Boolean(section.missing);

    return (
      <li key={section.id}>
        <NavLink
          to={to(section.defaultPath)}
          className={['rail-item', active ? 'is-active' : '', section.missing ? 'is-missing' : '', noAccess ? 'is-locked' : '', isAccount ? 'rail-item--account' : ''].join(' ')}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          onMouseEnter={(e) => {
            showTip(e, section.label, tipOn);
            onHoverSection?.(section.id);
          }}
          onFocus={(e) => {
            showTip(e, section.label, tipOn);
            onHoverSection?.(section.id);
          }}
          onMouseLeave={hideTip}
          onBlur={hideTip}
          onClick={() => onClickSection?.(section.id)}
        >
          {isAccount ? (
            <span className="avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
          ) : (
            <Icon name={section.icon} filled={active} />
          )}
          {section.missing && <Icon name="add" className="rail-sub" />}
          {noAccess && <Icon name="lock" className="rail-sub" />}
          {unread > 0 && (
            <span className="rail-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          {wsIndicator && <span className={`rail-dot rail-dot--${wsIndicator}`} aria-hidden="true" />}
          {phone && <span className="rail-label">{section.label}</span>}
        </NavLink>
      </li>
    );
  };

  return (
    <nav className={`rail ${phone ? 'rail--phone' : ''}`} aria-label="Sections">
      <button
        type="button"
        className="rail-item rail-item--company"
        aria-label={`Company: ${company.name}. Switch company`}
        aria-haspopup="dialog"
        onMouseEnter={(e) => showTip(e, company.name, true)}
        onFocus={(e) => showTip(e, company.name, true)}
        onMouseLeave={hideTip}
        onBlur={hideTip}
        onClick={() => {
          hideTip();
          onOpenCompany();
        }}
      >
        <span className="company-mark" aria-hidden="true">
          {company.initials}
        </span>
        {phone && <span className="rail-label">{company.name}</span>}
      </button>
      <ul className="rail-scroll" onScroll={hideTip}>
        {RAIL_SECTIONS.map(renderItem)}
      </ul>
      <ul className="rail-fixed">{RAIL_FIXED.map(renderItem)}</ul>
      {tip && (
        <div className="rail-tooltip" aria-hidden="true" style={{ top: tip.top, left: tip.left }}>
          {tip.label}
        </div>
      )}
    </nav>
  );
}
