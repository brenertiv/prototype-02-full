/**
 * OWNED BY THE PEOPLE BUILD. Routes under /{company}/{scope}/notifications/*.
 * One feed for everything relevant to the user (SYS-NOTIF-02, 07): the landing lists every unread
 * item across the five groups, newest first; each group is one filtered list. Opening an item marks
 * it read and opens the object it's about (ST-N11 for the empty state).
 */
import { useCallback, useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { Notice } from '../data/types';
import { useNav, useScopeInfo } from '../nav/route';
import { Icon } from '../shell/Icon';
import { ApiView, EmptyState, PageHeader, SelectFilter } from '../ui/bits';
import { fmtAgo, fmtDateTime } from '../ui/format';
import { useToast } from '../ui/Toast';
import { InsightDrawer } from '../workspace/InsightDrawer';
import './notifications.css';

type GroupId = Notice['group'];
const GROUPS: { id: GroupId; label: string; icon: string; blurb: string }[] = [
  { id: 'insights', label: 'Insights', icon: 'lightbulb', blurb: 'New and changed insights on your buildings.' },
  { id: 'activity', label: 'Activity', icon: 'history', blurb: 'Changes, comments, people events and chase requests.' },
  { id: 'building-alerts', label: 'Building Alerts', icon: 'warning', blurb: 'Equipment alerts from your monitored buildings.' },
  { id: 'data-alerts', label: 'Data Alerts', icon: 'database', blurb: 'New problems with the data behind your numbers.' },
  { id: 'app-updates', label: 'App updates', icon: 'new_releases', blurb: 'What’s new in Enertiv, and reports that are ready.' },
];

export function NotificationsSection() {
  return (
    <Routes>
      <Route index element={<NoticeList />} />
      <Route path=":group" element={<NoticeList />} />
      <Route path="*" element={<Navigate to=".." replace />} />
    </Routes>
  );
}

function NoticeList() {
  const { group: groupParam } = useParams();
  const group = GROUPS.find((g) => g.id === groupParam);
  const { data, user, patch, accessible } = useData();
  const { to, navigate } = useNav();
  const scope = useScopeInfo();
  const toast = useToast();
  const [building, setBuilding] = useState('all');
  const [everything, setEverything] = useState(false);
  const [insightId, setInsightId] = useState<string | null>(null);

  const inScope = new Set(everything ? [...accessible] : scope.buildingIds);
  // Vendors don't see insights (SYS-ACCESS-10); nothing outside the user's access is delivered (SYS-NOTIF-02).
  const visible = (n: Notice) => (!n.buildingId || accessible.has(n.buildingId)) && !(user.role === 'vendor' && n.group === 'insights');

  const q = useApi(`notifications/${group?.id ?? 'unread'}?scope=${scope.id}`, () => data.notices.filter(visible), [data.notices, accessible, user.role]);
  const closeInsight = useCallback(() => setInsightId(null), []);
  if (groupParam && !group) return <Navigate to={to('/notifications')} replace />;

  const open = (n: Notice) => {
    if (!n.read) patch('notices', n.id, { read: true });
    if (n.insightId) {
      setInsightId(n.insightId);
      return;
    }
    if (n.link) navigate(to(n.link));
    else if (n.buildingId) navigate(to(`/building-info/buildings/${n.buildingId}`));
  };

  const buildingsInScope = data.buildings.filter((b) => inScope.has(b.id));
  const title = group ? group.label : 'Unread';

  return (
    <article className="page page-wide ntf-page">
      <PageHeader
        title={title}
        subtitle={group ? group.blurb : 'Everything you haven’t opened yet, newest first.'}
        actions={
          <Link className="btn btn--ghost btn--sm" to={to('@account/notification-settings')}>
            <Icon name="tune" /> Notification settings
          </Link>
        }
      />
      <ApiView q={q} what="notifications">
        {(all) => {
          const rows = all
            .filter((n) => (group ? n.group === group.id : !n.read))
            .filter((n) => !n.buildingId || inScope.has(n.buildingId))
            .filter((n) => building === 'all' || n.buildingId === building)
            .sort((a, b) => b.at.localeCompare(a.at));
          const unread = rows.filter((n) => !n.read);
          return (
            <>
              <div className="table-toolbar ntf-toolbar">
                {buildingsInScope.length > 1 && (
                  <SelectFilter
                    label="Building"
                    value={building}
                    onChange={setBuilding}
                    options={[{ value: 'all', label: everything ? 'All buildings you can access' : `All buildings in ${scope.kind === 'portfolio' ? 'scope' : scope.name}` }, ...buildingsInScope.map((b) => ({ value: b.id, label: b.name }))]}
                  />
                )}
                {scope.kind !== 'portfolio' && (
                  <label className="check ntf-all">
                    <input
                      type="checkbox"
                      checked={everything}
                      onChange={(e) => {
                        setEverything(e.target.checked);
                        setBuilding('all');
                      }}
                    />
                    <span>Show everything I can access</span>
                  </label>
                )}
                {unread.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm ntf-markall"
                    onClick={() => {
                      unread.forEach((n) => patch('notices', n.id, { read: true }));
                      toast(`${unread.length} marked as read`);
                    }}
                  >
                    <Icon name="done_all" /> Mark {group ? 'these' : 'all'} read
                  </button>
                )}
              </div>
              {rows.length === 0 ? (
                group ? (
                  <EmptyState icon={group.icon} title={`No ${group.label === 'App updates' ? 'app updates' : group.label.toLowerCase()} here`} body={building !== 'all' ? 'Nothing for this building. Try all buildings.' : 'When something happens, it shows up here.'} />
                ) : (
                  <EmptyState
                    icon="notifications_off"
                    title="You’re all caught up"
                    body="Nothing unread in this scope."
                    action={
                      <Link className="btn btn--ghost btn--sm" to={to('/notifications/activity')}>
                        See recent activity
                      </Link>
                    }
                  />
                )
              ) : (
                <ul className="ntf-list" aria-label={`${title} notifications`}>
                  {rows.map((n) => {
                    const g = GROUPS.find((x) => x.id === n.group)!;
                    const b = data.buildings.find((x) => x.id === n.buildingId);
                    const opens = n.insightId || n.link || n.buildingId;
                    return (
                      <li key={n.id} className={`ntf-item ${n.read ? '' : 'is-unread'}`}>
                        <button type="button" className="ntf-btn" onClick={() => open(n)} aria-label={`${n.read ? '' : 'Unread. '}${g.label}: ${n.title}. ${n.body}`}>
                          <span className={`ntf-icon ntf-icon--${n.group}`} aria-hidden="true">
                            <Icon name={g.icon} />
                          </span>
                          <span className="ntf-main">
                            <span className="ntf-title">{n.title}</span>
                            <span className="ntf-body">{n.body}</span>
                            <span className="ntf-meta">
                              {!group && <span>{g.label}</span>}
                              {b && <span>{b.name}</span>}
                              <span title={fmtDateTime(n.at)}>{fmtAgo(n.at)}</span>
                            </span>
                          </span>
                          {!n.read && <span className="ntf-dot" aria-hidden="true" />}
                          {opens && <Icon name="chevron_right" className="ntf-chev" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          );
        }}
      </ApiView>
      {insightId && <InsightDrawer insightId={insightId} onClose={closeInsight} />}
    </article>
  );
}
