import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../shell/Icon';
import { EmptyState } from './bits';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Sort and default text value. */
  value?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
  width?: string;
  sortable?: boolean;
  /** Hidden below 768 px to keep the table readable on phones. */
  hideOnPhone?: boolean;
}

interface Props<T> {
  label: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** The first column links to the object's page (MOD-BI-40: every object links to its detail page). */
  rowHref?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  /** Text a row is searched by. Turns on the search box. */
  search?: (row: T) => string;
  searchPlaceholder?: string;
  /** What the table covers (SYS-TRUST-23). */
  caption?: ReactNode;
  toolbar?: ReactNode;
  empty?: { title: string; body?: ReactNode; icon?: string };
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowClass?: (row: T) => string | undefined;
  selectedKey?: string | null;
  dense?: boolean;
}

/**
 * The shared table (stands in for the DataTable wrapper over material-react-table in the
 * production stack): sort, search, paging, a caption that says what it covers, and an empty
 * state for no results (ST-X03).
 */
export function DataTable<T>({ label, rows, columns, rowKey, rowHref, onRowClick, search, searchPlaceholder, caption, toolbar, empty, pageSize = 50, initialSort, rowClass, selectedKey, dense }: Props<T>) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle && search ? rows.filter((r) => search(r).toLowerCase().includes(needle)) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.value) {
        const v = col.value;
        out = [...out].sort((a, b) => {
          const av = v(a);
          const bv = v(b);
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, search, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  return (
    <div className="table-block">
      {(search || toolbar) && (
        <div className="table-toolbar">
          {search && (
            <label className="search-field">
              <Icon name="search" />
              <span className="sr-only">Search {label}</span>
              <input
                type="search"
                value={q}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          )}
          {toolbar}
        </div>
      )}
      {caption && <p className="table-caption">{caption}</p>}
      {filtered.length === 0 ? (
        <EmptyState icon={empty?.icon ?? (q ? 'search_off' : 'inbox')} title={q ? `No results for “${q}”` : (empty?.title ?? 'Nothing here yet')} body={q ? 'Try a different search, or clear the filters.' : empty?.body} />
      ) : (
        <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
          <table className={`table ${dense ? 'table--dense' : ''}`}>
            <thead>
              <tr>
                {columns.map((c) => {
                  const sortable = c.sortable ?? Boolean(c.value);
                  const dir = sort?.key === c.key ? sort.dir : null;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      style={{ width: c.width, textAlign: c.align }}
                      className={c.hideOnPhone ? 'hide-phone' : undefined}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    >
                      {sortable ? (
                        <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                          {c.header}
                          <Icon name={dir === 'asc' ? 'arrow_upward' : dir === 'desc' ? 'arrow_downward' : 'unfold_more'} className={dir ? '' : 'th-sort-idle'} />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = rowKey(row);
                const href = rowHref?.(row);
                return (
                  <tr
                    key={key}
                    className={[href || onRowClick ? 'is-clickable' : '', selectedKey === key ? 'is-selected' : '', rowClass?.(row) ?? ''].join(' ')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((c, ci) => {
                      const content = c.render ? c.render(row) : (c.value?.(row) ?? '—');
                      return (
                        <td key={c.key} style={{ textAlign: c.align }} className={c.hideOnPhone ? 'hide-phone' : undefined}>
                          {ci === 0 && href ? (
                            <Link to={href} className="cell-link">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="table-pager">
          <span className="muted">
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length}
          </span>
          <button type="button" className="icon-btn" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <Icon name="chevron_left" />
          </button>
          <button type="button" className="icon-btn" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            <Icon name="chevron_right" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Field and value rows: the record table of a detail page or tab. */
export function RecordTable({ label, rows }: { label: string; rows: [string, ReactNode][] }) {
  return (
    <div className="table-scroll" role="region" aria-label={label}>
      <table className="table table--record">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v === null || v === undefined || v === '' ? <span className="muted">—</span> : v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
