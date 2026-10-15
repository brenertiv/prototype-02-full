/**
 * Account › Notification settings: per event type and channel (SYS-NOTIF-08), defaults by persona
 * (SYS-NOTIF-01). By default only High severity alerts go by email, straight away; everything else
 * stays in the app until the user turns it on. A daily or weekly digest is an option, not the default.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useData } from '../data/store';
import type { PersonaId } from '../data/types';
import { useNav } from '../nav/route';
import { PERSONA_LABEL } from '../people/common';
import { Icon } from '../shell/Icon';
import { ApiView, PageHeader, Section } from '../ui/bits';
import { useToast } from '../ui/Toast';

type Channel = 'inApp' | 'email' | 'sms';
type EventId = 'insights' | 'alerts-high' | 'alerts-other' | 'data-alerts' | 'chase' | 'mentions' | 'people' | 'app-updates';
interface Settings {
  events: Record<EventId, Record<Channel, boolean>>;
  digest: 'off' | 'daily' | 'weekly';
}

const EVENTS: { id: EventId; label: string; detail: string; personas: PersonaId[] }[] = [
  { id: 'insights', label: 'New insights', detail: 'Savings and fixes found on your buildings', personas: ['am', 'sl', 'pm'] },
  { id: 'alerts-high', label: 'High severity alerts', detail: 'Such as a possible water leak', personas: ['am', 'sl', 'pm', 'none'] },
  { id: 'alerts-other', label: 'Other building alerts', detail: 'Medium and low severity equipment alerts', personas: ['pm'] },
  { id: 'data-alerts', label: 'Data alerts', detail: 'New problems with bills, meters or logins', personas: ['pm', 'sl'] },
  { id: 'chase', label: 'Chase requests', detail: 'Requests sent, completed or escalated', personas: ['pm', 'sl'] },
  { id: 'mentions', label: 'Comments, mentions and copies', detail: 'When someone involves you', personas: ['am', 'sl', 'pm', 'none'] },
  { id: 'people', label: 'People and access', detail: 'Invites accepted, access changed', personas: ['am', 'sl', 'pm', 'none'] },
  { id: 'app-updates', label: 'App updates', detail: 'New features, and reports that are ready', personas: ['am', 'sl', 'pm', 'none'] },
];

function defaultsFor(persona: PersonaId): Settings {
  const events = {} as Settings['events'];
  for (const e of EVENTS) events[e.id] = { inApp: e.personas.includes(persona), email: e.id === 'alerts-high', sms: false };
  return { events, digest: 'off' };
}

export function NotificationSettingsPage() {
  const { user, getApp, setApp } = useData();
  const { to } = useNav();
  const toast = useToast();
  const defaults = defaultsFor(user.persona);
  const saved = getApp<Settings | null>('notificationSettings', null);
  const current = saved ?? defaults;
  const phone = getApp<string>('phone', '');
  const q = useApi('account/notification-settings', () => current, [JSON.stringify(current)]);
  const [s, setS] = useState<Settings>(current);
  useEffect(() => setS(current), [JSON.stringify(current)]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(s) !== JSON.stringify(current);
  const flip = (e: EventId, c: Channel) => setS((x) => ({ ...x, events: { ...x.events, [e]: { ...x.events[e], [c]: !x.events[e][c] } } }));

  return (
    <article className="page page-wide acc-page">
      <PageHeader title="Notification settings" subtitle="What reaches you, and where. Everything always shows in Notifications in the app." />
      <ApiView q={q} what="your notification settings">
        {() => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setApp('notificationSettings', s);
              toast('Notification settings saved');
            }}
          >
            <p className="acc-note">
              <Icon name="info" />
              {saved ? 'Your own settings.' : `Showing the defaults for a ${PERSONA_LABEL[user.persona] === 'No persona' ? 'new user' : PERSONA_LABEL[user.persona]}.`} By default only high severity alerts are emailed, straight away.
            </p>
            <div className="table-scroll" role="region" aria-label="Notification settings by event and channel" tabIndex={0}>
              <table className="table acc-matrix">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">In the app</th>
                    <th scope="col">Email</th>
                    <th scope="col">Text message</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((e) => (
                    <tr key={e.id}>
                      <th scope="row">
                        {e.label}
                        <span className="cell-sub">{e.detail}</span>
                      </th>
                      {(['inApp', 'email', 'sms'] as Channel[]).map((c) => {
                        const disabled = c === 'sms' && !phone;
                        const label = `${e.label} by ${c === 'inApp' ? 'in-app notification' : c === 'email' ? 'email' : 'text message'}`;
                        return (
                          <td key={c}>
                            <label className="switch" title={disabled ? 'Add a mobile number in Profile first' : undefined}>
                              <input type="checkbox" aria-label={label} checked={s.events[e.id][c] && !disabled} disabled={disabled} onChange={() => flip(e.id, c)} />
                              <span />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!phone && (
              <p className="muted acc-help">
                To get text messages, <Link to={to('@account/profile')}>add a mobile number to your profile</Link>.
              </p>
            )}
            <Section title="Digest" description="One email that rounds up everything you didn’t get straight away." id="digest">
              <div className="acc-choices acc-choices--row" role="radiogroup" aria-label="Digest">
                {(
                  [
                    ['off', 'No digest', 'Only what’s switched on above'],
                    ['daily', 'Daily', 'Each morning'],
                    ['weekly', 'Weekly', 'Monday mornings'],
                  ] as const
                ).map(([id, label, detail]) => (
                  <label key={id} className={`acc-choice ${s.digest === id ? 'is-on' : ''}`}>
                    <input type="radio" name="digest" checked={s.digest === id} onChange={() => setS({ ...s, digest: id })} />
                    <span>
                      <strong>{label}</strong>
                      <span className="muted">{detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
            <div className="btn-row acc-actions">
              <button type="submit" className="btn" disabled={!dirty}>
                Save settings
              </button>
              {dirty && (
                <button type="button" className="btn btn--ghost" onClick={() => setS(current)}>
                  Undo changes
                </button>
              )}
              {saved && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setApp('notificationSettings', null);
                    toast('Back to the defaults');
                  }}
                >
                  Reset to defaults
                </button>
              )}
            </div>
          </form>
        )}
      </ApiView>
    </article>
  );
}
