import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTestConfig } from '../config/testConfig';
import { useData } from '../data/store';
import { navForInner } from '../nav/sections';
import type { BadgeKind, GroupDef, PageDef, SectionDef } from '../nav/types';
import { useNav } from '../nav/route';
import { usePrefs } from '../state/preferences';
import { useToast } from '../ui/Toast';
import { WorkspacePanelList, type WorkspaceFilter } from '../workspace/registry';
import { useBadgeCounts, useSectionAccess } from './access';
import { Icon } from './Icon';
import { SearchDialog } from './SearchDialog';

interface Props {
  section: SectionDef;
  mode: 'docked' | 'peek' | 'phone';
  onClose?: () => void;
  /** Called when a page row is chosen (the phone drawer closes on it). */
  onNavigate?: () => void;
}

const PERSONA_LABEL: Record<string, string> = { sl: 'Sustainability Lead', am: 'Asset Manager', pm: 'Property Manager', none: 'Persona not set' };
export const personaLabel = (p: string) => PERSONA_LABEL[p] ?? p;

/** The context panel, one template for every section (SYS-NAVPAT-10 to 13). Upgradable (Missing) sections have none. */
export function Panel({ section, mode, onClose, onNavigate }: Props) {
  const { data, user, patch } = useData();
  const { config } = useTestConfig();
  const { to, inner, navigate } = useNav();
  const counts = useBadgeCounts();
  const canAccess = useSectionAccess();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wsQuery, setWsQuery] = useState('');
  const [wsFilter, setWsFilter] = useState<WorkspaceFilter>('all');
  const [wsSearchShown, setWsSearchShown] = useState(false);
  const [wsFilterShown, setWsFilterShown] = useState(false);
  const isAdmin = user.role === 'admin';

  // ST-N07: the simulated API delay applies to the panel too.
  useEffect(() => {
    if (config.latencyMs <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), config.latencyMs);
    return () => window.clearTimeout(t);
  }, [section.id, config.latencyMs]);

  const noAccess = !canAccess(section.id);
  const isAccount = section.id === 'account';
  const activePage = navForInner(inner)?.page;
  const toggleGroup = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const badgeFor = (badge?: BadgeKind) => (badge ? counts[badge] : 0);

  const renderRow = (page: PageDef) => {
    const disabled = !page.path;
    const n = badgeFor(page.badge);
    const current = activePage?.id === page.id && activePage.path === page.path;
    return (
      <li key={page.id} className="row-wrap">
        {disabled ? (
          <div className="row row--disabled" aria-disabled="true">
            {page.icon && <Icon name={page.icon} className="row-icon" />}
            <span className="row-label">{page.label}</span>
            {page.disabledNote && <span className="row-note">{page.disabledNote}</span>}
          </div>
        ) : (
          <Link to={to(page.path!)} className="row" aria-current={current ? 'page' : undefined} onClick={onNavigate}>
            {page.icon && <Icon name={page.icon} className="row-icon" filled={current} />}
            <span className="row-label">{page.label}</span>
            {n > 0 && (
              <span className="row-count" aria-label={`${n}`}>
                {n}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  };

  const renderGroup = (group: GroupDef) => {
    if (group.adminOnly && !isAdmin) return null;
    const open = !collapsed[group.id];
    const pages = group.pages.filter((p) => !p.adminOnly || isAdmin);
    if (pages.length === 0) return null;
    const listId = `group-${section.id}-${group.id}`;
    return (
      <li key={group.id} className="group">
        {group.label && (
          <button type="button" className="group-header" aria-expanded={open} aria-controls={listId} onClick={() => toggleGroup(group.id)}>
            <span>{group.label}</span>
            <Icon name={open ? 'expand_more' : 'chevron_right'} className="group-chevron" />
          </button>
        )}
        {open && (
          <ul id={listId} className="rows">
            {pages.map(renderRow)}
          </ul>
        )}
      </li>
    );
  };

  const runHeaderAction = (id: string, toPath?: string, action?: string) => {
    if (id === 'search') {
      if (section.dynamicList === 'workspaces') setWsSearchShown((s) => !s);
      else setSearchOpen(true);
      return;
    }
    if (id === 'filter') {
      setWsFilterShown((s) => !s);
      return;
    }
    if (action === 'markAllRead') {
      data.notices.filter((n) => !n.read).forEach((n) => patch('notices', n.id, { read: true }));
      toast('All notifications marked as read');
      return;
    }
    if (toPath) {
      navigate(to(toPath));
      onNavigate?.();
    }
  };

  const dockToggle =
    mode === 'phone' ? (
      <button type="button" className="icon-btn" aria-label="Close navigation" onClick={onClose}>
        <Icon name="close" />
      </button>
    ) : mode === 'docked' ? (
      <DockToggle docked />
    ) : (
      <DockToggle docked={false} />
    );

  return (
    <nav className={`panel panel--${mode}`} aria-label={`${section.label} pages`} aria-busy={loading || undefined}>
      <header className="panel-header">
        <div className="panel-title">
          {isAccount ? (
            <>
              <span className="panel-eyebrow">Account</span>
              <h2>{user.name}</h2>
              <span className="panel-subtitle">
                {user.title} · {personaLabel(user.persona)}
              </span>
            </>
          ) : (
            <h2>{section.label}</h2>
          )}
        </div>
        <div className="panel-actions">
          {!noAccess &&
            section.headerActions.map((a) => {
              const n = badgeFor(a.badge);
              const pressed = (a.id === 'search' && wsSearchShown) || (a.id === 'filter' && (wsFilterShown || wsFilter !== 'all'));
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`icon-btn ${pressed ? 'is-on' : ''}`}
                  aria-label={n ? `${a.label}, ${n}` : a.label}
                  title={a.label}
                  onClick={() => runHeaderAction(a.id, a.to, a.action)}
                >
                  <Icon name={a.icon} />
                  {n > 0 && (
                    <span className="count-badge" aria-hidden="true">
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </button>
              );
            })}
          {dockToggle}
        </div>
      </header>

      {section.dynamicList === 'workspaces' && !noAccess && (wsSearchShown || wsFilterShown) && (
        <div className="panel-tools">
          {wsSearchShown && (
            <label className="search-field search-field--panel">
              <Icon name="search" />
              <span className="sr-only">Search workspaces</span>
              <input autoFocus type="search" placeholder="Search workspaces" value={wsQuery} onChange={(e) => setWsQuery(e.target.value)} />
            </label>
          )}
          {wsFilterShown && (
            <div className="panel-filter" role="group" aria-label="Filter workspaces">
              {(['all', 'dashboard', 'report', 'plan', 'scheduled', 'received'] as WorkspaceFilter[]).map((f) => (
                <button key={f} type="button" className="filter-chip filter-chip--sm" aria-pressed={wsFilter === f} onClick={() => setWsFilter(f)}>
                  {f === 'all' ? 'All' : f === 'scheduled' ? 'Scheduled reports' : f === 'received' ? 'Received' : f[0].toUpperCase() + f.slice(1) + 's'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <ul className="rows skeleton" aria-label="Loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="row row--skeleton" />
          ))}
        </ul>
      ) : noAccess ? (
        <div className="panel-message">
          <Icon name="lock" />
          <p>You don't have access to {section.label}.</p>
          <p className="muted">Your role ({user.role}) doesn't include it. Ask an Admin of {data.company.name} if you need it.</p>
        </div>
      ) : (
        <>
          {section.primaryAction && (!section.primaryAction.adminOnly || isAdmin) && (
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                if (section.primaryAction!.id === 'invite') navigate(to('/people/team?invite=1'));
                onNavigate?.();
              }}
            >
              <Icon name={section.primaryAction.icon} />
              <span>{section.primaryAction.label}</span>
            </button>
          )}
          <ul className="groups">
            {section.dynamicList === 'workspaces' && <WorkspacePanelList onNavigate={onNavigate} query={wsQuery} filter={wsFilter} />}
            {section.groups.map(renderGroup)}
          </ul>
        </>
      )}

      {section.footer && !noAccess && (
        <footer className="panel-footer">
          {section.footer.map((f) => (
            <button
              key={f.id}
              type="button"
              className="row row--footer"
              onClick={() => toast(f.id === 'sign-out' ? 'Sign out is disabled in the prototype. Use /reset to start over.' : 'Help opens the support centre in the real app.', { tone: 'info' })}
            >
              <Icon name={f.icon} />
              <span className="row-label">{f.label}</span>
            </button>
          ))}
        </footer>
      )}
      {searchOpen && <SearchDialog section={section.id} onClose={() => setSearchOpen(false)} onNavigate={onNavigate} />}
    </nav>
  );
}

function DockToggle({ docked }: { docked: boolean }) {
  const { set } = usePrefs();
  return docked ? (
    <button type="button" className="icon-btn" aria-label="Collapse panel" aria-pressed="true" title="Collapse panel" onClick={() => set('panelDocked', false)}>
      <Icon name="left_panel_close" />
    </button>
  ) : (
    <button type="button" className="icon-btn" aria-label="Dock panel" aria-pressed="false" title="Dock panel" onClick={() => set('panelDocked', true)}>
      <Icon name="left_panel_open" />
    </button>
  );
}
