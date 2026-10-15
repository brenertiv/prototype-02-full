/**
 * Every chase request by person (MOD-PPL-10; SYS-CHASE-02, 04, 05, 07). Phone-first: cards that
 * read on a walkthrough, grouped by who owes it. One record with Building Info's Data Health page.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays as addDaysIso } from '../data/rand';
import { useApi, useData } from '../data/store';
import type { ChaseRequest } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DetailDrawer } from '../ui/DetailDrawer';
import { ApiView, EmptyState, Pill, SelectFilter } from '../ui/bits';
import { fmtAgo, fmtDate } from '../ui/format';
import { useToast } from '../ui/Toast';
import { accountOwner, isOpenRequest, STAGE_META, StagePill, TODAY, usePermissions, useScopeBuildings } from './common';

const STAGE_ORDER: ChaseRequest['stage'][] = ['escalated', 'contact-unknown', 'not-sent', 'reminded', 'sent', 'declined', 'completed', 'moved-out'];

export function RequestsList({ tenantId, compact }: { tenantId?: string; compact?: boolean }) {
  const { data } = useData();
  const { scope, inScope } = useScopeBuildings();
  const { to } = useNav();
  const [stage, setStage] = useState(tenantId ? 'all' : 'open');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setOpenId(null), []);
  const q = useApi(`people/requests?scope=${scope.id}${tenantId ? `&tenant=${tenantId}` : ''}`, () => data.requests.filter((r) => (tenantId ? r.to.id === tenantId : inScope.has(r.buildingId))), [data.requests, inScope, tenantId]);

  return (
    <ApiView q={q} what="requests">
      {(all) => {
        const needle = query.trim().toLowerCase();
        const rows = all
          .filter((r) => (stage === 'open' ? isOpenRequest(r) : stage === 'all' ? true : r.stage === stage))
          .filter((r) => !needle || `${r.to.name} ${r.what} ${data.buildings.find((b) => b.id === r.buildingId)?.name ?? ''}`.toLowerCase().includes(needle))
          .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || (b.lastChased ?? '').localeCompare(a.lastChased ?? ''));
        const byPerson = new Map<string, ChaseRequest[]>();
        rows.forEach((r) => byPerson.set(r.to.id + r.to.name, [...(byPerson.get(r.to.id + r.to.name) ?? []), r]));
        const open = all.filter(isOpenRequest).length;
        const escalated = all.filter((r) => r.stage === 'escalated').length;
        const selected = all.find((r) => r.id === openId);
        return (
          <div className="ppl-requests">
            {!compact && (
              <div className="ppl-req-summary" role="status">
                <span>
                  <strong>{open}</strong> open
                </span>
                <span>
                  <strong>{escalated}</strong> escalated
                </span>
                <span>
                  <strong>{all.filter((r) => r.stage === 'completed').length}</strong> completed
                </span>
              </div>
            )}
            {!compact && (
              <div className="table-toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <span className="sr-only">Search requests</span>
                  <input type="search" placeholder="Search by person, building or what’s owed" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <SelectFilter
                  label="Stage"
                  value={stage}
                  onChange={setStage}
                  options={[
                    { value: 'open', label: 'Open requests' },
                    { value: 'all', label: 'All requests' },
                    ...STAGE_ORDER.map((s) => ({ value: s, label: STAGE_META[s].label })),
                  ]}
                />
              </div>
            )}
            {rows.length === 0 ? (
              <EmptyState
                icon={needle ? 'search_off' : 'mark_email_read'}
                title={needle ? `No requests match “${query}”` : stage === 'open' ? 'Nothing outstanding' : 'No requests here'}
                body={needle ? 'Try another search, or show all requests.' : stage === 'open' ? 'No one owes anything for the buildings in scope right now.' : tenantId ? 'The chase agent hasn’t asked this tenant for anything.' : undefined}
              />
            ) : (
              [...byPerson.values()].map((reqs) => (
                <section key={reqs[0].to.id + reqs[0].to.name} className="ppl-req-group" aria-label={`Requests to ${reqs[0].to.name}`}>
                  {!tenantId && (
                    <h3 className="ppl-req-person">
                      {reqs[0].to.kind === 'tenant' ? <Link to={to(`/people/tenants/${reqs[0].to.id}`)}>{reqs[0].to.name}</Link> : reqs[0].to.name}
                      <span className="muted"> · {reqs[0].to.kind === 'tenant' ? 'Tenant' : 'Contact'} · {reqs.length}</span>
                    </h3>
                  )}
                  <ul className="ppl-req-list">
                    {reqs.map((r) => (
                      <li key={r.id}>
                        <RequestCard r={r} onOpen={() => setOpenId(r.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            {selected && <RequestDrawer r={selected} onClose={closeDrawer} />}
          </div>
        );
      }}
    </ApiView>
  );
}

function RequestCard({ r, onOpen }: { r: ChaseRequest; onOpen: () => void }) {
  const { data } = useData();
  const b = data.buildings.find((x) => x.id === r.buildingId);
  const space = data.spaces.find((s) => s.id === r.spaceId);
  const owner = accountOwner(data);
  return (
    <button type="button" className={`ppl-req-card ppl-req-card--${r.stage}`} onClick={onOpen} aria-label={`${r.what} from ${r.to.name}, ${STAGE_META[r.stage].label}. Open details`}>
      <span className="ppl-req-top">
        <span className="ppl-req-what">{r.what}</span>
        <StagePill stage={r.stage} />
      </span>
      <span className="ppl-req-meta">
        {[b?.name, space?.name, r.period !== '—' ? r.period : null].filter(Boolean).join(' · ')}
      </span>
      <span className="ppl-req-foot">
        {r.stage === 'escalated' && (
          <span className="ppl-req-esc">
            <Icon name="north_east" /> Escalated to {owner?.name ?? 'the account owner'}
          </span>
        )}
        {r.stage === 'completed' && r.broughtIn && (
          <span>
            <Icon name="download_done" /> {r.broughtIn}
          </span>
        )}
        {r.stage === 'declined' && r.declineReason && <span>“{r.declineReason}”</span>}
        {r.stage === 'contact-unknown' && <span>No contact on file, so nothing can be sent yet</span>}
        {r.stage === 'not-sent' && <span>{r.needsApproval ? 'Waiting for approval before it goes out' : 'Drafted, not sent'}</span>}
        <span className="muted">{r.lastChased ? `Last chased ${fmtAgo(r.lastChased)}` : 'Not chased yet'}</span>
      </span>
    </button>
  );
}

/** The timeline the agent keeps on a request (SYS-CHASE-10: the thread stays on the request). */
function timeline(r: ChaseRequest, ownerName: string): { at: string | null; text: string }[] {
  const last = r.lastChased;
  const back = (n: number) => (last ? addDaysIso(last, -n) : null);
  const via = r.channel === 'None' ? 'no channel' : r.channel.toLowerCase();
  switch (r.stage) {
    case 'not-sent':
      return [{ at: null, text: r.needsApproval === 'escalation' ? 'Escalation drafted; waiting for approval' : r.needsApproval ? 'First request of its kind drafted; waiting for approval' : 'Drafted; waiting for the contact rules to allow it' }];
    case 'sent':
      return [{ at: last, text: `Sent by ${via} with a secure upload link` }];
    case 'reminded':
      return [
        { at: back(7), text: `Sent by ${via} with a secure upload link` },
        { at: last, text: 'Reminder sent after 7 days with no reply' },
      ];
    case 'escalated':
      return [
        { at: back(30), text: `Sent by ${via} with a secure upload link` },
        { at: back(23), text: 'Reminder sent after 7 days' },
        { at: back(16), text: 'Second reminder sent after 14 days' },
        { at: last, text: `Escalated to ${ownerName} after 30 days open` },
      ];
    case 'completed':
      return [
        { at: back(5), text: `Sent by ${via} with a secure upload link` },
        { at: last, text: `Completed without signing in: ${r.broughtIn ?? 'data received'}` },
      ];
    case 'declined':
      return [
        { at: back(4), text: `Sent by ${via}` },
        { at: last, text: `Declined: ${r.declineReason ?? 'no reason given'}` },
      ];
    case 'contact-unknown':
      return [{ at: null, text: 'Not sent: there’s no email or phone on file for this tenant' }];
    case 'moved-out':
      return [{ at: last, text: 'Stopped: the tenant moved out, so no more requests go to them' }];
  }
}

export function RequestDrawer({ r, onClose }: { r: ChaseRequest; onClose: () => void }) {
  const { data, patch, user } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { canManageChase } = usePermissions();
  const b = data.buildings.find((x) => x.id === r.buildingId);
  const space = data.spaces.find((s) => s.id === r.spaceId);
  const owner = accountOwner(data);
  const health = data.health.find((h) => h.id === r.healthItemId);
  const events = useMemo(() => timeline(r, owner?.name ?? 'the account owner'), [r, owner]);
  const chasing = r.stage === 'sent' || r.stage === 'reminded' || r.stage === 'escalated';

  return (
    <DetailDrawer
      title={r.what}
      eyebrow={`Request to ${r.to.name}`}
      onClose={onClose}
      actions={
        <div className="btn-row">
          {chasing && canManageChase && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                patch('requests', r.id, { stage: r.stage === 'escalated' ? 'escalated' : 'reminded', lastChased: TODAY });
                toast(`Reminder sent to ${r.to.name} (test outbox)`);
              }}
            >
              <Icon name="send" /> Send a reminder now
            </button>
          )}
          {chasing && canManageChase && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                patch('requests', r.id, { stage: 'completed', lastChased: TODAY, broughtIn: `Marked as received by ${user.name}` });
                toast('Marked as received. The next data check confirms it.');
              }}
            >
              <Icon name="check" /> Mark as received
            </button>
          )}
          {r.stage === 'contact-unknown' && r.to.kind === 'tenant' && (
            <Link className="btn" to={to(`/people/tenants/${r.to.id}#contacts`)}>
              <Icon name="person_add" /> Add a contact
            </Link>
          )}
          {r.stage === 'not-sent' && r.needsApproval && (
            <Link className="btn" to={to('/people/agents#approvals')}>
              Review in the approval queue
            </Link>
          )}
        </div>
      }
    >
      <div className="stack">
        <div>
          <StagePill stage={r.stage} />
        </div>
        <dl className="dl">
          <dt>Owed by</dt>
          <dd>{r.to.kind === 'tenant' ? <Link to={to(`/people/tenants/${r.to.id}`)}>{r.to.name}</Link> : r.to.name}</dd>
          <dt>Building</dt>
          <dd>{b ? <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link> : '—'}</dd>
          <dt>Space</dt>
          <dd>{space?.name ?? 'Whole building'}</dd>
          <dt>Period</dt>
          <dd>{r.period}</dd>
          <dt>Channel</dt>
          <dd>{r.channel === 'None' ? <Pill tone="warning">No usable channel</Pill> : `${r.channel} with a secure link`}</dd>
          <dt>Last chased</dt>
          <dd>{r.lastChased ? `${fmtDate(r.lastChased)} (${fmtAgo(r.lastChased)})` : 'Not yet'}</dd>
        </dl>
        {health && (
          <div className="card card--sunken">
            <p className="ppl-small-label">Why we’re asking</p>
            <p>
              {health.problem}: {health.impact.toLowerCase()}.
            </p>
            <Link to={to(`/building-info/data-health?item=${health.id}`)}>See it on Data Health</Link>
          </div>
        )}
        {r.stage === 'escalated' && (
          <p className="ppl-req-esc">
            <Icon name="north_east" /> Escalated to {owner?.name ?? 'the account owner'}. If it’s still open at 45 days, it goes to Enertiv customer success.
          </p>
        )}
        <div>
          <p className="ppl-small-label">History</p>
          <ol className="ppl-timeline">
            {events.map((e, k) => (
              <li key={k}>
                <span className="muted">{e.at ? fmtDate(e.at) : 'Now'}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="muted ppl-help">In this prototype, messages go to a test outbox. No real person is contacted.</p>
      </div>
    </DetailDrawer>
  );
}
