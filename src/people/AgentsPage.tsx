/**
 * People › Agents: the chase agent as a member of the account's people (MOD-PPL-15; SYS-CHASE-02,
 * 06, 07, 09, 10; SYS-ACCESS-13; ST-O06, ST-O12). What it is chasing, its settings in one place,
 * and its approval queue. Users without the permission see it read-only; Vendors and Tenants not at all.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { ChaseRequest, Dataset } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { Modal } from '../ui/Modal';
import { ApiView, EmptyState, Kpi, PageHeader, Pill, Section } from '../ui/bits';
import { fmtAgo } from '../ui/format';
import { useToast } from '../ui/Toast';
import { accountOwner, Initials, isOpenRequest, ReadOnlyNote, StagePill, TODAY, usePermissions, useScopeBuildings } from './common';

interface ChaseSettings {
  channels: { tenants: string[]; contacts: string[]; members: string[] };
  reminder1: number;
  reminder2: number;
  escalateOwner: number;
  escalateCs: number;
  maxPerWeek: number;
  escalationTarget: string;
  mayContact: { tenants: boolean; contacts: boolean; firms: boolean };
  templates: Record<TemplateId, string>;
}
type TemplateId = 'bill' | 'login' | 'contact' | 'escalation';

const TEMPLATE_LABEL: Record<TemplateId, string> = {
  bill: 'Asking a tenant for a bill',
  login: 'Asking for a utility login or a letter of authorisation',
  contact: 'Asking an Admin to name a building contact',
  escalation: 'Escalating to the account owner',
};

const DEFAULTS = (ownerId: string): ChaseSettings => ({
  channels: { tenants: ['Email'], contacts: ['Email'], members: ['In-app'] },
  reminder1: 7,
  reminder2: 14,
  escalateOwner: 30,
  escalateCs: 45,
  maxPerWeek: 2,
  escalationTarget: ownerId,
  mayContact: { tenants: true, contacts: true, firms: true },
  templates: {
    bill: 'Hi {name}, we’re missing the {what} for {space} at {building} for {period}. It keeps the building’s energy reporting complete. You can upload it from this secure link; no login needed. Thank you!',
    login: 'Hi {name}, the utility login we use for {building} has stopped working. Could you update it, or sign a letter of authorisation, from this secure link? It takes about two minutes.',
    contact: 'Hi {name}, {building} doesn’t have an on-site contact yet. Could you name someone in People › Building contacts? It’s one of the setup steps for the building.',
    escalation: 'Hi {name}, we asked {to} for the {what} at {building} {days} days ago and haven’t heard back. Could you help us reach the right person?',
  },
});

const templateFor = (r: ChaseRequest): TemplateId => (r.needsApproval === 'escalation' ? 'escalation' : /login|authoris/i.test(r.what) ? 'login' : r.to.kind === 'contact' ? 'contact' : 'bill');

function draft(r: ChaseRequest, s: ChaseSettings, data: Dataset) {
  const tenant = data.tenants.find((t) => t.id === r.to.id);
  const owner = data.users.find((u) => u.id === s.escalationTarget) ?? accountOwner(data);
  const esc = r.needsApproval === 'escalation';
  const values: Record<string, string> = {
    name: (esc ? owner?.name : tenant?.contacts[0]?.name ?? r.to.name)?.split(' ')[0] ?? 'there',
    to: r.to.name,
    what: r.what.toLowerCase(),
    space: data.spaces.find((x) => x.id === r.spaceId)?.name ?? 'your space',
    building: data.buildings.find((b) => b.id === r.buildingId)?.name ?? 'the building',
    period: r.period,
    days: String(s.escalateOwner),
  };
  return s.templates[templateFor(r)].replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);
}

export function AgentsPage() {
  const { data, getApp, setApp, patch } = useData();
  const { to } = useNav();
  const toast = useToast();
  const { canSeeAgent, canManageChase, chaseVia } = usePermissions();
  const { scope, inScope } = useScopeBuildings();
  const owner = accountOwner(data);
  const settings = getApp<ChaseSettings>('chaseSettings', DEFAULTS(owner?.id ?? 'u-admin'));
  const [editing, setEditing] = useState<ChaseRequest | null>(null);
  const q = useApi(`people/agents/chase?scope=${scope.id}`, () => data.requests.filter((r) => inScope.has(r.buildingId)), [data.requests, inScope]);

  if (!canSeeAgent) {
    return (
      <article className="page ppl-page">
        <PageHeader title="Agents" />
        <EmptyState icon="lock" title="You don’t have access to the chase agent" body="It’s for the account’s own team. Ask an Admin if you need it." />
      </article>
    );
  }

  const approve = (r: ChaseRequest, message?: string) => {
    patch('requests', r.id, { stage: r.needsApproval === 'escalation' ? 'escalated' : 'sent', needsApproval: null, lastChased: TODAY, ...(message ? { message } : {}) });
    toast(r.needsApproval === 'escalation' ? `Escalation sent to ${owner?.name ?? 'the account owner'} (test outbox)` : `Request sent to ${r.to.name} (test outbox)`);
  };

  return (
    <article className="page page-wide ppl-page">
      <PageHeader
        eyebrow="Agent"
        title={
          <span className="ppl-title">
            <Initials name="Chase agent" kind="agent" />
            Chase agent
          </span>
        }
        subtitle="Asks tenants and contacts for the bills, logins and building details your data needs, and follows up until they arrive."
      />
      {!canManageChase ? (
        <ReadOnlyNote>You can see what the chase agent is doing on your buildings. Changing its settings or approving messages needs permission to run it; an Admin can give it to you or your team.</ReadOnlyNote>
      ) : chaseVia === 'team' ? (
        <p className="muted ppl-help">You can run the chase agent through your team.</p>
      ) : null}
      <ApiView q={q} what="the chase agent">
        {(reqs) => {
          const queue = reqs.filter((r) => r.stage === 'not-sent' && r.needsApproval && !(r as ChaseRequest & { rejected?: boolean }).rejected);
          const open = reqs.filter(isOpenRequest);
          return (
            <>
              <div className="grid grid--kpis ppl-kpis">
                <Kpi label="Chasing now" value={open.length} sub="Open requests" icon="outgoing_mail" />
                <Kpi label="Waiting for approval" value={queue.length} tone={queue.length ? 'warning' : undefined} icon="approval" />
                <Kpi label="Escalated" value={reqs.filter((r) => r.stage === 'escalated').length} tone={reqs.some((r) => r.stage === 'escalated') ? 'danger' : undefined} icon="priority_high" />
                <Kpi label="Completed" value={reqs.filter((r) => r.stage === 'completed').length} tone="success" icon="check_circle" />
              </div>

              <Section title="Approval queue" description="The first message of a new kind, and every escalation, waits here before it goes out." id="approvals">
                {queue.length === 0 ? (
                  <EmptyState icon="task_alt" title="Nothing waiting for approval" body="Routine reminders go out on their own." />
                ) : (
                  <ul className="ppl-queue" id="approvals-list">
                    {queue.map((r) => {
                      const noChannel = r.channel === 'None';
                      const b = data.buildings.find((x) => x.id === r.buildingId);
                      const health = data.health.find((h) => h.id === r.healthItemId);
                      return (
                        <li key={r.id} className="card ppl-queue-item">
                          <div className="ppl-queue-head">
                            <Pill tone={r.needsApproval === 'escalation' ? 'danger' : 'info'} icon={r.needsApproval === 'escalation' ? 'north_east' : 'fiber_new'}>
                              {r.needsApproval === 'escalation' ? 'Escalation' : 'First of its kind'}
                            </Pill>
                            <strong>
                              {r.needsApproval === 'escalation' ? `To ${owner?.name ?? 'the account owner'}, about ${r.to.name}` : `To ${r.to.name}`}
                            </strong>
                            <span className="muted">
                              {b?.name} · {r.period}
                            </span>
                          </div>
                          <blockquote className="ppl-draft">{(r as ChaseRequest & { message?: string }).message ?? draft(r, settings, data)}</blockquote>
                          <p className="muted ppl-help">
                            <Icon name="rule" /> Why: {health ? `${health.problem} (${health.evidence})` : r.what}. Rule: {r.needsApproval === 'escalation' ? `open past ${settings.escalateOwner} days` : 'a new kind of message for this account is checked once'}.
                          </p>
                          {noChannel && (
                            <p className="ppl-error">
                              <Icon name="error" /> No usable channel: there’s no email or phone on file.{' '}
                              {r.to.kind === 'tenant' && <Link to={to(`/people/tenants/${r.to.id}#contacts`)}>Add a contact</Link>}
                            </p>
                          )}
                          {canManageChase && (
                            <div className="btn-row">
                              <button type="button" className="btn btn--sm" disabled={noChannel} onClick={() => approve(r)}>
                                <Icon name="check" /> Approve and send
                              </button>
                              <button type="button" className="btn btn--sm btn--ghost" disabled={noChannel} onClick={() => setEditing(r)}>
                                <Icon name="edit" /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => {
                                  patch('requests', r.id, { rejected: true, needsApproval: null });
                                  toast('Not sent. It stays on Requests as not sent.');
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              <Section
                title="What it’s chasing now"
                actions={
                  <Link className="btn btn--sm btn--ghost" to={to('/people/tenants?filter=requests')}>
                    All requests
                  </Link>
                }
                id="chasing"
              >
                {open.length ? (
                  <ul className="list">
                    {open.slice(0, 8).map((r) => (
                      <li key={r.id}>
                        <div className="list-item-main">
                          <div className="list-item-title">
                            {r.to.name}: {r.what}
                          </div>
                          <div className="muted">
                            {data.buildings.find((b) => b.id === r.buildingId)?.name} · {r.lastChased ? `last chased ${fmtAgo(r.lastChased)}` : 'not chased yet'}
                          </div>
                        </div>
                        <StagePill stage={r.stage} />
                      </li>
                    ))}
                    {open.length > 8 && (
                      <li>
                        <Link to={to('/people/tenants?filter=requests')}>and {open.length - 8} more</Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <EmptyState icon="mark_email_read" title="Not chasing anyone right now" body="When a data problem needs someone outside Enertiv, the agent asks them." />
                )}
              </Section>

              <SettingsForm
                key={JSON.stringify(settings)}
                settings={settings}
                canEdit={canManageChase}
                onSave={(s) => {
                  setApp('chaseSettings', s);
                  toast('Chase agent settings saved');
                }}
                onReset={() => {
                  setApp('chaseSettings', DEFAULTS(owner?.id ?? 'u-admin'));
                  toast('Settings back to the defaults');
                }}
              />
              <p className="muted ppl-foot">
                <Icon name="science" /> In this prototype, the chase agent sends to a test outbox. No real person is contacted.
              </p>
              {editing && (
                <EditMessageModal
                  initial={(editing as ChaseRequest & { message?: string }).message ?? draft(editing, settings, data)}
                  onClose={() => setEditing(null)}
                  onSend={(m) => {
                    approve(editing, m);
                    setEditing(null);
                  }}
                />
              )}
            </>
          );
        }}
      </ApiView>
    </article>
  );
}

function EditMessageModal({ initial, onClose, onSend }: { initial: string; onClose: () => void; onSend: (m: string) => void }) {
  const [m, setM] = useState(initial);
  return (
    <Modal
      title="Edit the message"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!m.trim()} onClick={() => onSend(m.trim())}>
            Approve and send
          </button>
        </>
      }
    >
      <label className="field">
        <span>Message</span>
        <textarea rows={7} value={m} onChange={(e) => setM(e.target.value)} autoFocus />
      </label>
      <p className="muted ppl-help">The secure link is added when it’s sent.</p>
    </Modal>
  );
}

function SettingsForm({ settings, canEdit, onSave, onReset }: { settings: ChaseSettings; canEdit: boolean; onSave: (s: ChaseSettings) => void; onReset: () => void }) {
  const { data } = useData();
  const [s, setS] = useState(settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const admins = data.users.filter((u) => (u.role === 'admin' || u.role === 'billing') && u.status === 'active' && !u.firm);
  const order = s.reminder1 < s.reminder2 && s.reminder2 < s.escalateOwner && s.escalateOwner < s.escalateCs;
  const num = (k: 'reminder1' | 'reminder2' | 'escalateOwner' | 'escalateCs' | 'maxPerWeek', label: string, max = 120) => (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={1} max={max} value={s[k]} disabled={!canEdit} onChange={(e) => setS({ ...s, [k]: Math.max(1, Math.min(max, Number(e.target.value) || 1)) })} />
    </label>
  );
  const chan = (who: keyof ChaseSettings['channels'], label: string, options: string[]) => (
    <fieldset className="ppl-fieldset">
      <legend>{label}</legend>
      <div className="ppl-checks ppl-checks--row">
        {options.map((c) => (
          <label key={c} className="check">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={s.channels[who].includes(c)}
              onChange={() => setS({ ...s, channels: { ...s.channels, [who]: s.channels[who].includes(c) ? s.channels[who].filter((x) => x !== c) : [...s.channels[who], c] } })}
            />
            <span>
              {c}
              {c === 'Email' && <span className="muted"> with a secure link</span>}
              {c === 'SMS' && <span className="muted"> where they’ve agreed to texts</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <Section title="Settings" description={canEdit ? 'One place for how the agent behaves across the account. A person’s or tenant’s own page can tighten this for them.' : 'How the agent behaves across the account.'} id="settings">
      <form
        className="ppl-settings"
        onSubmit={(e) => {
          e.preventDefault();
          if (order) onSave(s);
        }}
      >
        <div className="grid grid--2">
          <div className="card">
            <h3>Channels</h3>
            {chan('tenants', 'Tenants', ['Email', 'SMS'])}
            {chan('contacts', 'Building contacts and firms', ['Email', 'SMS', 'In-app'])}
            {chan('members', 'Your own team', ['In-app', 'Email'])}
            <p className="muted ppl-help">People who sign in see requests in Notifications and aren’t emailed for the same thing.</p>
          </div>
          <div className="card">
            <h3>Follow-up and escalation</h3>
            <div className="field-row">
              {num('reminder1', 'First reminder after (days)')}
              {num('reminder2', 'Second reminder after (days)')}
            </div>
            <div className="field-row">
              {num('escalateOwner', 'Escalate to your team after (days)')}
              {num('escalateCs', 'Escalate to Enertiv after (days)')}
            </div>
            {!order && <p className="ppl-error">Each step needs to come after the one before it.</p>}
            <label className="field">
              <span>Escalate to</span>
              <select value={s.escalationTarget} disabled={!canEdit} onChange={(e) => setS({ ...s, escalationTarget: e.target.value })}>
                {admins.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}, {u.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="card">
            <h3>Who it may contact, and how often</h3>
            {(
              [
                ['tenants', 'Tenants'],
                ['contacts', 'Building contacts on your team'],
                ['firms', 'Management company and contractor staff'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="check">
                <input type="checkbox" disabled={!canEdit} checked={s.mayContact[k]} onChange={(e) => setS({ ...s, mayContact: { ...s.mayContact, [k]: e.target.checked } })} />
                <span>{label}</span>
              </label>
            ))}
            {num('maxPerWeek', 'Most messages to one person a week', 7)}
          </div>
          <div className="card">
            <h3>Message templates</h3>
            <p className="muted ppl-help">Placeholders in braces are filled in for each request: {'{name}'}, {'{what}'}, {'{space}'}, {'{building}'}, {'{period}'}.</p>
            {(Object.keys(TEMPLATE_LABEL) as TemplateId[]).map((t) => (
              <label key={t} className="field">
                <span>{TEMPLATE_LABEL[t]}</span>
                <textarea rows={3} value={s.templates[t]} disabled={!canEdit} onChange={(e) => setS({ ...s, templates: { ...s.templates, [t]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
        {canEdit && (
          <div className="btn-row ppl-settings-actions">
            <button type="submit" className="btn" disabled={!dirty || !order}>
              Save settings
            </button>
            {dirty && (
              <button type="button" className="btn btn--ghost" onClick={() => setS(settings)}>
                Undo changes
              </button>
            )}
            <button type="button" className="text-btn" onClick={onReset}>
              Reset to defaults
            </button>
          </div>
        )}
      </form>
    </Section>
  );
}
