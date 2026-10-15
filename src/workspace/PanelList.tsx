/** The Workspace panel's two groups, Workspaces then Custom Workspaces with New first (MOD-WS-46, 50). */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { KIND_ICON, KIND_LABEL } from './catalog';
import type { WorkspaceFilter } from './registry';
import { useRuntime } from './runtime';
import type { Workspace } from './types';
import './workspace.css';

function matches(w: Workspace, query: string, filter: WorkspaceFilter) {
  if (query.trim() && !w.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
  if (filter === 'all') return true;
  if (filter === 'scheduled') return w.kind === 'report' && Boolean(w.schedule?.enabled);
  if (filter === 'received') return Boolean(w.receivedFrom);
  return w.kind === filter;
}

export function WorkspacePanelList({ onNavigate, query, filter }: { onNavigate?: () => void; query: string; filter: WorkspaceFilter }) {
  const rt = useRuntime();
  const { to, inner } = useNav();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const current = inner.match(/^\/workspace\/([^/?]+)/)?.[1];
  const filtering = Boolean(query.trim()) || filter !== 'all';

  const pre = rt.prebuilt.filter((w) => matches(w, query, filter));
  const mine = [...rt.custom].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((w) => matches(w, query, filter));

  const row = (w: Workspace) => {
    const busy = w.status === 'generating';
    const waiting = w.status === 'waiting';
    const failed = w.status === 'failed';
    const ready = rt.unseen.includes(w.id) && w.id !== current;
    const state = busy ? 'generating' : waiting ? 'waiting on your answer' : failed ? 'generation failed' : ready ? 'ready, not opened yet' : '';
    return (
      <li key={w.id} className="row-wrap">
        <Link
          to={to(`/workspace/${w.id}`)}
          className="row"
          aria-current={current === w.id ? 'page' : undefined}
          aria-label={`${w.name}, ${KIND_LABEL[w.kind].toLowerCase()}${w.schedule?.enabled ? ', scheduled' : ''}${w.receivedFrom ? `, from ${w.receivedFrom.name}` : ''}${state ? `, ${state}` : ''}`}
          onClick={onNavigate}
        >
          <Icon name={KIND_ICON[w.kind]} className="row-icon" filled={current === w.id} />
          <span className="row-label">{w.name}</span>
          {w.schedule?.enabled && !busy && <Icon name="schedule" className="ws-row-mark" />}
          {w.receivedFrom && !busy && <Icon name="move_to_inbox" className="ws-row-mark" />}
          {busy && <span className="ws-spinner" aria-hidden="true" />}
          {waiting && <Icon name="help" className="ws-row-mark ws-row-mark--wait" />}
          {failed && <Icon name="error" className="ws-row-mark ws-row-mark--fail" />}
          {ready && <span className="ws-ready-dot" aria-hidden="true" />}
        </Link>
      </li>
    );
  };

  const group = (id: string, label: string, body: ReactNode) => {
    const open = !collapsed[id];
    return (
      <li className="group" key={id}>
        <button type="button" className="group-header" aria-expanded={open} aria-controls={`ws-group-${id}`} onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}>
          <span>{label}</span>
          <Icon name={open ? 'expand_more' : 'chevron_right'} className="group-chevron" />
        </button>
        {open && (
          <ul id={`ws-group-${id}`} className="rows">
            {body}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {group(
        'prebuilt',
        'Workspaces',
        pre.length ? pre.map(row) : (
          <li className="row row--empty">
            <Icon name="search_off" />
            <span className="row-label">No ready-made workspaces match</span>
          </li>
        ),
      )}
      {group(
        'custom',
        'Custom Workspaces',
        <>
          <li className="row-wrap">
            <Link to={to('/workspace/new')} className="row ws-new-row" aria-current={current === 'new' ? 'page' : undefined} onClick={onNavigate}>
              <Icon name="add" className="row-icon" />
              <span className="row-label">New</span>
            </Link>
          </li>
          {mine.map(row)}
          {!mine.length && (
            <li className="row row--empty">
              <Icon name={filtering ? 'search_off' : 'auto_awesome'} />
              <span className="row-label">{filtering ? 'None of yours match' : 'Nothing yet. New starts one from a template.'}</span>
            </li>
          )}
        </>,
      )}
    </>
  );
}
