/** Share (MOD-WS-48), schedule and run history (MOD-WS-53), and rename. Sends stay in the simulated outbox (SYS-SHARE-05). */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { Pill } from '../ui/bits';
import { fmtDate, fmtDateTime } from '../ui/format';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { AS_OF } from '../data/rand';
import { newId, nowIso } from './logic';
import { msg, useRuntime } from './runtime';
import type { Cadence, Run, RunPeriod, Schedule, Workspace } from './types';

export const CADENCE_LABEL: Record<Cadence, string> = { daily: 'Daily', weekly: 'Weekly, on Mondays', monthly: 'Monthly, on the 1st', quarterly: 'Quarterly, on the 1st' };
export const RUN_PERIOD_LABEL: Record<RunPeriod, string> = {
  'previous-day': 'The previous day',
  'previous-week': 'The previous week',
  'previous-month': 'The previous month',
  'previous-quarter': 'The previous quarter',
  'year-to-date': 'Year to date',
  'last-12-months': 'The last 12 months',
};
const DEFAULT_PERIOD: Record<Cadence, RunPeriod> = { daily: 'previous-day', weekly: 'previous-week', monthly: 'previous-month', quarterly: 'previous-quarter' };

export function nextRun(c: Cadence) {
  const d = new Date(`${AS_OF}T06:00:00Z`);
  if (c === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (c === 'weekly') d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  else if (c === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1, 1);
  else d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3 + 3, 1);
  return d.toISOString().slice(0, 10);
}

export function scheduleSummary(s: Schedule, nameOf: (r: string) => string) {
  return `${CADENCE_LABEL[s.cadence]}, covering ${RUN_PERIOD_LABEL[s.period].toLowerCase()}, to ${s.recipients.map(nameOf).join(', ') || 'nobody yet'}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useRecipients() {
  const { data, user } = useData();
  return useMemo(() => data.users.filter((u) => u.status === 'active' && u.appAccess === 'web' && u.role !== 'vendor' && u.role !== 'tenant').sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : a.name.localeCompare(b.name))), [data.users, user.id]);
}

export function useNameOf() {
  const { data, user } = useData();
  return (r: string) => (r === user.id ? 'you' : data.users.find((u) => u.id === r)?.name ?? r);
}

function RecipientPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const people = useRecipients();
  const { user } = useData();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const emails = value.filter((v) => v.includes('@'));
  const addTyped = () => {
    const list = typed.split(/[,\s]+/).filter(Boolean);
    const bad = list.filter((e) => !EMAIL.test(e));
    if (bad.length) return setError(`${bad.join(', ')} ${bad.length === 1 ? "isn't" : "aren't"} an email address`);
    setError('');
    onChange([...new Set([...value, ...list])]);
    setTyped('');
  };
  return (
    <fieldset className="ws-fieldset">
      <legend>Recipients</legend>
      <div className="ws-people">
        {people.slice(0, 12).map((u) => (
          <label key={u.id} className="check">
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => onChange(value.includes(u.id) ? value.filter((x) => x !== u.id) : [...value, u.id])} />
            <span>{u.id === user.id ? `${u.name} (you)` : u.name}<span className="muted"> · {u.title}</span></span>
          </label>
        ))}
      </div>
      <label className="field">
        <span>Email addresses outside the account</span>
        <div className="ws-inline-field">
          <input type="email" value={typed} placeholder="name@example.com" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }} aria-describedby="ws-email-help" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={addTyped} disabled={!typed.trim()}>Add</button>
        </div>
        <span id="ws-email-help" className="muted ws-help">They receive a file, never a link into the app.</span>
        {error && <span className="ws-error" role="alert">{error}</span>}
      </label>
      {emails.length > 0 && (
        <ul className="ws-chips" aria-label="Added email addresses">
          {emails.map((e) => (
            <li key={e} className="ws-chip">
              {e}
              <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${e}`} onClick={() => onChange(value.filter((x) => x !== e))}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/** Schedule a report. On a ready-made report, saving makes the user's own copy first (MOD-WS-52). */
export function ScheduleDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const rt = useRuntime();
  const { user } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const { to } = useNav();
  const nameOf = useNameOf();
  const s = ws.schedule;
  const [enabled, setEnabled] = useState(s?.enabled ?? true);
  const [cadence, setCadence] = useState<Cadence>(s?.cadence ?? 'monthly');
  const [period, setPeriod] = useState<RunPeriod>(s?.period ?? 'previous-month');
  const [recipients, setRecipients] = useState<string[]>(s?.recipients ?? [user.id]);
  const save = () => {
    const schedule: Schedule = { enabled, cadence, period, recipients, createdAt: s?.createdAt ?? nowIso() };
    let id = ws.id;
    if (ws.prebuilt) {
      id = rt.editCopy(ws.id)!;
    }
    rt.update(id, { schedule, updatedAt: nowIso() });
    rt.push(id, [msg('assistant', 'edit', enabled ? `Scheduled: ${scheduleSummary(schedule, nameOf)}. The first run goes out ${fmtDate(nextRun(cadence))}.` : 'The schedule is paused. Nothing goes out until you turn it back on.')]);
    toast(ws.prebuilt ? `Saved as your own copy with the schedule. First run ${fmtDate(nextRun(cadence))}.` : enabled ? `Schedule saved. Next run ${fmtDate(nextRun(cadence))}.` : 'Schedule paused.');
    onClose();
    if (id !== ws.id) navigate(to(`/workspace/${id}`));
  };
  return (
    <Modal title={s ? 'Edit the schedule' : 'Schedule this report'} onClose={onClose} footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={enabled && !recipients.length} onClick={save}>{ws.prebuilt ? 'Save as my copy and schedule' : 'Save schedule'}</button></>}>
      {ws.prebuilt && <p className="hint-inline"><Icon name="content_copy" /> This report is ready-made, so the schedule goes on your own copy of it.</p>}
      <label className="ws-switch-row">
        <span className="switch"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><span /></span>
        <span>{enabled ? 'Schedule on' : 'Schedule paused'}</span>
      </label>
      <div className="field-row">
        <label className="field">
          <span>How often</span>
          <select value={cadence} onChange={(e) => { const c = e.target.value as Cadence; setCadence(c); setPeriod(DEFAULT_PERIOD[c]); }}>
            {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Each run covers</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as RunPeriod)}>
            {(Object.keys(RUN_PERIOD_LABEL) as RunPeriod[]).map((p) => <option key={p} value={p}>{RUN_PERIOD_LABEL[p]}</option>)}
          </select>
        </label>
      </div>
      <RecipientPicker value={recipients} onChange={setRecipients} />
      {enabled && !recipients.length && <p className="ws-error" role="alert">Choose at least one recipient.</p>}
      <p className="muted">Each run is a new point-in-time copy with its scope, period and sources on the cover. A run with incomplete data says so on its cover.</p>
    </Modal>
  );
}

export function RunHistory({ ws }: { ws: Workspace }) {
  const rt = useRuntime();
  const toast = useToast();
  const runs = ws.runs ?? [];
  const runNow = (incomplete: boolean) => {
    const run: Run = { id: newId('run'), at: nowIso(), period: 'On demand', status: incomplete ? 'incomplete' : 'sent', recipients: ws.schedule?.recipients.length ?? 0, note: incomplete ? 'Some properties had months without data; the cover says which' : undefined };
    rt.update(ws.id, { runs: [run, ...runs] });
    toast(`Run sent to ${run.recipients} ${run.recipients === 1 ? 'recipient' : 'recipients'} (simulated outbox).`);
  };
  return (
    <div className="ws-runs">
      <div className="ws-runs-head">
        <h3>Run history</h3>
        {ws.schedule && !ws.prebuilt && <button type="button" className="btn btn--ghost btn--sm" onClick={() => runNow(false)}><Icon name="send" /> Run now</button>}
      </div>
      {runs.length ? (
        <ul className="ws-list">
          {runs.map((r) => (
            <li key={r.id}>
              <div className="ws-list-main">
                <span>{fmtDateTime(r.at)} · {r.period}</span>
                <span className="muted">{r.note ?? `Sent to ${r.recipients} ${r.recipients === 1 ? 'recipient' : 'recipients'}`}</span>
              </div>
              <Pill tone={r.status === 'sent' ? 'success' : r.status === 'incomplete' ? 'warning' : 'danger'} icon={r.status === 'sent' ? 'check_circle' : r.status === 'incomplete' ? 'warning' : 'error'}>{r.status === 'sent' ? 'Sent' : r.status === 'incomplete' ? 'Incomplete data' : 'Failed'}</Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No runs yet. {ws.schedule?.enabled ? `The first goes out ${fmtDate(nextRun(ws.schedule.cadence))}.` : 'Schedule the report to start sending it.'}</p>
      )}
    </div>
  );
}

export function ShareDialog({ ws, onClose, onSchedule }: { ws: Workspace; onClose: () => void; onSchedule: () => void }) {
  const rt = useRuntime();
  const { user } = useData();
  const toast = useToast();
  const people = useRecipients().filter((u) => u.id !== user.id);
  const [mode, setMode] = useState<'copy' | 'email'>('copy');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [emailTo, setEmailTo] = useState<string[]>([]);
  const shown = people.filter((u) => `${u.name} ${u.title} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const send = () => {
    if (mode === 'copy') {
      const p = people.find((u) => u.id === who);
      rt.sendCopy(ws.id, who);
      toast(`Sent ${p?.name} their own copy of ${ws.name}. It starts with a clean thread and shows only what they can access.`);
    } else {
      toast(`Emailed ${ws.name} to ${emailTo.length} ${emailTo.length === 1 ? 'recipient' : 'recipients'} as a file, with its scope, period and sources on the cover (simulated outbox).`);
    }
    onClose();
  };
  return (
    <Modal title={`Share ${ws.name}`} onClose={onClose} footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={mode === 'copy' ? !who : !emailTo.length} onClick={send}>{mode === 'copy' ? 'Send a copy' : 'Email now'}</button></>}>
      {ws.kind === 'report' && (
        <div className="filters" role="group" aria-label="How to share">
          <button type="button" className="filter-chip" aria-pressed={mode === 'copy'} onClick={() => setMode('copy')}>Send a colleague a copy</button>
          <button type="button" className="filter-chip" aria-pressed={mode === 'email'} onClick={() => setMode('email')}>Email or schedule</button>
        </div>
      )}
      {mode === 'copy' ? (
        <>
          <p>Your colleague gets their own copy, unlinked from yours, with a clean thread. It keeps this workspace’s scope and shows only what they can access.</p>
          <label className="search-field ws-search">
            <Icon name="search" />
            <span className="sr-only">Search team members</span>
            <input type="search" value={q} placeholder="Search team members" onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="ws-people ws-people--radio" role="radiogroup" aria-label="Team member">
            {shown.map((u) => (
              <label key={u.id} className="check">
                <input type="radio" name="ws-share-to" checked={who === u.id} onChange={() => setWho(u.id)} />
                <span>{u.name}<span className="muted"> · {u.title}{u.firm ? `, ${u.firm}` : ''}</span></span>
              </label>
            ))}
            {!shown.length && <p className="muted">No team member matches “{q}”.</p>}
          </div>
        </>
      ) : (
        <>
          <p>Send it once now as a file, or set it to go out on a schedule.</p>
          <RecipientPicker value={emailTo} onChange={setEmailTo} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { onClose(); onSchedule(); }}><Icon name="schedule" /> Set up a schedule instead</button>
        </>
      )}
    </Modal>
  );
}

export function RenameDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const rt = useRuntime();
  const [name, setName] = useState(ws.name);
  const ok = name.trim().length > 0 && name.trim().length <= 80;
  return (
    <Modal title="Rename workspace" onClose={onClose} size="sm" footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="btn" disabled={!ok} onClick={() => { rt.update(ws.id, { name: name.trim(), updatedAt: nowIso() }); onClose(); }}>Rename</button></>}>
      <label className="field">
        <span>Name</span>
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && ok) { rt.update(ws.id, { name: name.trim(), updatedAt: nowIso() }); onClose(); } }} />
      </label>
      {!ok && <p className="ws-error" role="alert">Give it a name of up to 80 characters.</p>}
    </Modal>
  );
}
