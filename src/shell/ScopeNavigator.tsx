import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/store';
import type { Building, Group } from '../data/types';
import { useNav, useScopeInfo } from '../nav/route';
import { Icon } from './Icon';

/**
 * The scope navigator (`02-building/design-system/scope-navigator.md`): search, the Portfolio
 * row, recent and pinned scopes, and Miller columns; one column at a time on phones.
 */
export const LEVEL_ICON = { portfolio: 'account_tree', group: 'folder_open', property: 'apartment' } as const;

const RECENT_KEY = (company: string) => `kw.scopes.${company}`;

function loadShelf(company: string): { recent: string[]; pinned: string[] } {
  try {
    const raw = localStorage.getItem(RECENT_KEY(company));
    return raw ? JSON.parse(raw) : { recent: [], pinned: [] };
  } catch {
    return { recent: [], pinned: [] };
  }
}
function saveShelf(company: string, shelf: { recent: string[]; pinned: string[] }) {
  try {
    localStorage.setItem(RECENT_KEY(company), JSON.stringify(shelf));
  } catch {
    /* fine */
  }
}

export function ScopeNavigator({ onClose, phone }: { onClose: () => void; phone: boolean }) {
  const { data, accessible } = useData();
  const { setScope, company } = useNav();
  const current = useScopeInfo();
  const [q, setQ] = useState('');
  const [shelf, setShelf] = useState(() => loadShelf(company));
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const groups = data.groups;
  const visibleGroups = groups.filter((g) => g.buildingIds.length === 0 || g.buildingIds.some((b) => accessible.has(b)));
  const buildings = data.buildings.filter((b) => accessible.has(b.id));
  const childGroups = (parentId: string | undefined) => visibleGroups.filter((g) => g.parentId === parentId);
  const looseBuildings = buildings.filter((b) => !b.groupIds.length);

  // Columns open along the path to the current scope (CMP-SCOPE-41).
  const initialPath = useMemo(() => {
    const path: string[] = [];
    let gid: string | undefined;
    if (current.id.startsWith('group-')) gid = current.id.slice(6);
    if (current.id.startsWith('property-')) {
      const b = data.buildings.find((x) => `property-${x.id}` === current.id);
      gid = groups.find((g) => b && g.buildingIds.includes(b.id) && !groups.some((c) => c.parentId === g.id))?.id;
    }
    while (gid) {
      path.unshift(gid);
      gid = groups.find((g) => g.id === gid)?.parentId;
    }
    return path;
  }, [current.id, data.buildings, groups]);
  const [openPath, setOpenPath] = useState<string[]>(initialPath);
  const columnsRef = useRef<HTMLDivElement>(null);

  // Stay inside the viewport, and keep the newest column in view (CMP-SCOPE-02).
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || phone) return;
    const left = el.getBoundingClientRect().left;
    el.style.maxWidth = `${Math.max(300, window.innerWidth - left - 16)}px`;
    const cols = columnsRef.current;
    if (cols) cols.scrollLeft = cols.scrollWidth;
  }, [openPath, phone]);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.scope-trigger')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const choose = (scopeId: string) => {
    const next = { ...shelf, recent: [scopeId, ...shelf.recent.filter((s) => s !== scopeId)].slice(0, 5) };
    saveShelf(company, next);
    setScope(scopeId);
    onClose();
  };
  const togglePin = (scopeId: string) => {
    const next = { ...shelf, pinned: shelf.pinned.includes(scopeId) ? shelf.pinned.filter((s) => s !== scopeId) : [...shelf.pinned, scopeId] };
    setShelf(next);
    saveShelf(company, next);
  };

  const countFor = (g: Group) => g.buildingIds.filter((b) => accessible.has(b)).length;
  const pathFor = (g: Group | undefined): string[] => {
    const out: string[] = [];
    let cur = g;
    while (cur) {
      out.unshift(cur.name);
      cur = cur.parentId ? groups.find((x) => x.id === cur!.parentId) : undefined;
    }
    return out;
  };
  const labelFor = (scopeId: string) => {
    if (scopeId === 'portfolio') return { icon: LEVEL_ICON.portfolio, name: 'Portfolio', sub: `${buildings.length} properties` };
    if (scopeId.startsWith('group-')) {
      const g = groups.find((x) => x.id === scopeId.slice(6));
      return g ? { icon: LEVEL_ICON.group, name: g.name, sub: `${g.kind} · ${countFor(g)} properties` } : null;
    }
    const b = data.buildings.find((x) => x.id === scopeId.slice(9));
    return b ? { icon: LEVEL_ICON.property, name: b.name, sub: `${b.city}, ${b.state}` } : null;
  };

  // ---------- Search (CMP-SCOPE-20 to 22) ----------
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return null;
    const gRes = visibleGroups.filter((g) => g.name.toLowerCase().includes(needle)).map((g) => ({ id: `group-${g.id}`, icon: LEVEL_ICON.group, type: g.kind, name: g.name, path: pathFor(groups.find((x) => x.id === g.parentId)).join(' › ') || 'Portfolio', count: countFor(g) }));
    const bRes: { id: string; icon: string; type: string; name: string; path: string; count?: number }[] = [];
    buildings
      .filter((b) => [b.name, b.address, b.city, b.id].some((s) => s.toLowerCase().includes(needle)))
      .forEach((b) => {
        const leafGroups = groups.filter((g) => g.buildingIds.includes(b.id) && !groups.some((c) => c.parentId === g.id));
        if (!leafGroups.length) bRes.push({ id: `property-${b.id}`, icon: LEVEL_ICON.property, type: 'Property', name: b.name, path: `${b.address}, ${b.city}` });
        // One row per path (CMP-SCOPE-45).
        leafGroups.forEach((g) => bRes.push({ id: `property-${b.id}`, icon: LEVEL_ICON.property, type: 'Property', name: b.name, path: `${pathFor(g).join(' › ')} · ${b.address}, ${b.city}` }));
      });
    return [...gRes, ...bRes];
  }, [needle, visibleGroups, buildings, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlight = (text: string) => {
    if (!needle) return text;
    const i = text.toLowerCase().indexOf(needle);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + needle.length)}</mark>
        {text.slice(i + needle.length)}
      </>
    );
  };

  // ---------- Columns (CMP-SCOPE-40 to 45) ----------
  const columns: { parent: Group | null; groups: Group[]; buildings: Building[] }[] = [];
  columns.push({ parent: null, groups: childGroups(undefined), buildings: looseBuildings });
  openPath.forEach((gid) => {
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    const kids = childGroups(g.id);
    columns.push({ parent: g, groups: kids, buildings: kids.length ? [] : buildings.filter((b) => g.buildingIds.includes(b.id)) });
  });
  const shownColumns = phone ? columns.slice(-1) : columns.slice(-4);

  const openGroup = (g: Group, depth: number) => {
    // A group with a single property shows as that property (CMP-SCOPE-42).
    const kids = childGroups(g.id);
    if (!kids.length && countFor(g) === 1) {
      choose(`property-${g.buildingIds.find((b) => accessible.has(b))}`);
      return;
    }
    setOpenPath([...openPath.slice(0, depth), g.id]);
  };

  const shelfItems = [...shelf.pinned, ...shelf.recent.filter((r) => !shelf.pinned.includes(r))].slice(0, 6).map((id) => ({ id, label: labelFor(id) })).filter((x) => x.label);
  const showShelf = !needle && shelfItems.length > 0 && buildings.length > 1;

  return (
    <div ref={panelRef} className={`scope-nav ${phone ? 'scope-nav--sheet' : ''}`} role="dialog" aria-label="Change scope">
      {phone && (
        <div className="scope-nav-sheet-head">
          <span>
            <span className="muted">Scope: </span>
            <strong>{current.name}</strong>
          </span>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      )}
      <label className="search-field scope-nav-search">
        <Icon name="search" />
        <span className="sr-only">Search groups and properties by name, address or city</span>
        <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, address or city" />
      </label>
      <button type="button" className={`scope-row scope-row--portfolio ${current.id === 'portfolio' ? 'is-current' : ''}`} onClick={() => choose('portfolio')}>
        <Icon name={LEVEL_ICON.portfolio} />
        <span className="scope-row-text">
          <span className="scope-row-name">Portfolio</span>
          <span className="muted">{buildings.length} properties</span>
        </span>
        {current.id === 'portfolio' && <Icon name="check" />}
      </button>

      {results ? (
        <ul className="scope-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <li className="scope-empty">
              No group or property matches “{q}”.{' '}
              <button type="button" className="text-btn" onClick={() => setQ('')}>
                Clear search
              </button>
            </li>
          ) : (
            results.map((r, k) => (
              <li key={r.id + k} role="option" aria-selected={r.id === current.id}>
                <button type="button" className={`scope-row ${r.id === current.id ? 'is-current' : ''}`} onClick={() => choose(r.id)}>
                  <Icon name={r.icon} />
                  <span className="scope-row-text">
                    <span className="scope-row-name">
                      <span className="scope-row-type">{r.type}</span> {highlight(r.name)}
                    </span>
                    <span className="muted">
                      {highlight(r.path)}
                      {r.count !== undefined ? ` · ${r.count} properties` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <>
          {showShelf && (
            <div className="scope-shelf" aria-label="Recent and pinned scopes">
              {shelfItems.map(({ id, label }) => (
                <span key={id} className={`scope-shelf-item ${shelf.pinned.includes(id) ? 'is-pinned' : ''}`}>
                  <button type="button" onClick={() => choose(id)}>
                    <Icon name={label!.icon} /> {label!.name}
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={shelf.pinned.includes(id) ? `Unpin ${label!.name}` : `Pin ${label!.name}`} onClick={() => togglePin(id)}>
                    <Icon name="push_pin" filled={shelf.pinned.includes(id)} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="scope-columns" ref={columnsRef}>
            {shownColumns.map((col) => {
              const depth = columns.indexOf(col);
              return (
                <div key={col.parent?.id ?? 'root'} className="scope-col" role="listbox" aria-label={col.parent ? col.parent.name : 'Portfolio'}>
                  {col.parent && (
                    <div className="scope-col-head">
                      {phone && (
                        <button type="button" className="text-btn scope-back" onClick={() => setOpenPath(openPath.slice(0, depth - 1))}>
                          <Icon name="arrow_back" /> Back
                        </button>
                      )}
                      <button type="button" className="btn btn--sm" onClick={() => choose(`group-${col.parent!.id}`)}>
                        Choose {col.parent.name} · {countFor(col.parent)}
                      </button>
                    </div>
                  )}
                  {col.groups.map((g) => {
                    const open = openPath[depth] === g.id;
                    const isCurrent = current.id === `group-${g.id}`;
                    return (
                      <button key={g.id} type="button" role="option" aria-selected={isCurrent} className={`scope-row ${open ? 'is-open' : ''} ${isCurrent ? 'is-current' : ''}`} onClick={() => openGroup(g, depth)}>
                        <Icon name={LEVEL_ICON.group} />
                        <span className="scope-row-text">
                          <span className="scope-row-name">
                            <span className="scope-row-type">{g.kind}</span> {g.name}
                          </span>
                          <span className="muted">{countFor(g)} properties</span>
                        </span>
                        {isCurrent && <Icon name="check" />}
                        <Icon name="chevron_right" className="scope-row-chev" />
                      </button>
                    );
                  })}
                  {col.buildings.map((b) => {
                    const isCurrent = current.id === `property-${b.id}`;
                    return (
                      <button key={b.id} type="button" role="option" aria-selected={isCurrent} className={`scope-row ${isCurrent ? 'is-current' : ''}`} onClick={() => choose(`property-${b.id}`)}>
                        <Icon name={LEVEL_ICON.property} />
                        <span className="scope-row-text">
                          <span className="scope-row-name">{b.name}</span>
                          <span className="muted">
                            {b.city}, {b.state}
                          </span>
                        </span>
                        {isCurrent && <Icon name="check" />}
                      </button>
                    );
                  })}
                  {col.parent && !col.groups.length && !col.buildings.length && <p className="scope-empty">{col.parent.name} has 0 properties.</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
