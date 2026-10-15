/**
 * Account › Profile: name, title, email, phone, the persona (editable, SYS-PERS-02, 03; ST-P05, P06)
 * and the jobs chosen at first login (SYS-ONB-09). The persona shapes defaults, never access (SYS-PERS-01).
 */
import { useEffect, useState } from 'react';
import { useData } from '../data/store';
import type { PersonaId } from '../data/types';
import { derivePersona, JOBS } from '../onboarding/jobs';
import { PERSONA_LABEL, ROLE_LABEL } from '../people/common';
import { Icon } from '../shell/Icon';
import { PageHeader, Section } from '../ui/bits';
import { useToast } from '../ui/Toast';

const PERSONAS: { id: Exclude<PersonaId, 'none'>; blurb: string }[] = [
  { id: 'am', blurb: 'Exposure, cost and carbon by asset; capital plans' },
  { id: 'sl', blurb: 'Reporting readiness, coverage gaps and ENERGY STAR' },
  { id: 'pm', blurb: 'Data problems on your buildings, and what tenants owe' },
];

export function ProfilePage() {
  const { data, user, patch, getApp, setApp } = useData();
  const toast = useToast();
  const record = data.users.find((u) => u.id === user.id) ?? user;
  const [name, setName] = useState(record.name);
  const [title, setTitle] = useState(record.title);
  const [phone, setPhone] = useState(getApp<string>('phone', ''));
  const savedJobs = getApp<string[]>('jobs', []);
  const [jobs, setJobs] = useState<string[]>(savedJobs);
  useEffect(() => setJobs(savedJobs), [savedJobs.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = name.trim() !== record.name || title.trim() !== record.title || phone.trim() !== getApp<string>('phone', '');
  const suggested = jobs.length ? derivePersona(jobs, title) : null;
  const choosePersona = (p: PersonaId) => {
    setApp('personaOverride', p);
    toast(`Your persona is now ${PERSONA_LABEL[p]}. Defaults follow it from your next visit to each page.`);
  };

  return (
    <article className="page acc-page">
      <PageHeader title="Profile" subtitle={`You at ${data.company.name}.`} />

      <Section title="About you" id="about">
        <form
          className="card acc-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            patch('users', record.id, { name: name.trim(), title: title.trim() });
            setApp('phone', phone.trim());
            toast('Profile saved');
          }}
        >
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!name.trim()} required />
              {!name.trim() && <span className="acc-error">Enter your name</span>}
            </label>
            <label className="field">
              <span>Job title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Email</span>
              <input value={record.email} readOnly aria-describedby="email-help" />
              <span className="muted acc-help" id="email-help">
                You sign in with this. An Admin can change it.
              </span>
            </label>
            <label className="field">
              <span>Mobile number (optional)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 010-0000" aria-describedby="phone-help" />
              <span className="muted acc-help" id="phone-help">
                Only used for texts you turn on in Notification settings.
              </span>
            </label>
          </div>
          <dl className="dl acc-dl">
            <dt>Role</dt>
            <dd>{ROLE_LABEL[user.role]}, set by your Admin in People</dd>
            <dt>Company</dt>
            <dd>{data.company.name}</dd>
          </dl>
          <div className="btn-row">
            <button type="submit" className="btn" disabled={!dirty || !name.trim()}>
              Save
            </button>
          </div>
        </form>
      </Section>

      <Section title="Persona" description="Your persona shapes your defaults: the workspace you start on, what comes first, and which notifications you get. It never changes what you can see or do." id="persona">
        <div className="acc-choices" role="radiogroup" aria-label="Persona">
          {PERSONAS.map((p) => (
            <label key={p.id} className={`acc-choice ${user.persona === p.id ? 'is-on' : ''}`}>
              <input type="radio" name="persona" checked={user.persona === p.id} onChange={() => choosePersona(p.id)} />
              <span>
                <strong>{PERSONA_LABEL[p.id]}</strong>
                <span className="muted">{p.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        {user.persona === 'none' && (
          <p className="acc-note">
            <Icon name="info" /> No persona yet, so you get a general workspace. Pick one above, or choose your jobs below.
          </p>
        )}
      </Section>

      <Section title="Your jobs" description="What you told us you want to do in Enertiv. They decide what your first workspace is built from." id="jobs">
        <fieldset className="acc-jobs">
          <legend className="sr-only">Jobs</legend>
          {JOBS.map((j) => (
            <label key={j.id} className="check">
              <input type="checkbox" checked={jobs.includes(j.id)} onChange={() => setJobs((x) => (x.includes(j.id) ? x.filter((y) => y !== j.id) : [...x, j.id]))} />
              <span>
                {j.label} <span className="muted">· {j.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={jobs.join(',') === savedJobs.join(',')}
            onClick={() => {
              setApp('jobs', jobs);
              toast('Jobs saved');
            }}
          >
            Save jobs
          </button>
          {suggested && suggested !== 'none' && suggested !== user.persona && (
            <span className="acc-suggest">
              These jobs fit a {PERSONA_LABEL[suggested]}.{' '}
              <button type="button" className="text-btn" onClick={() => choosePersona(suggested)}>
                Use that persona
              </button>
            </span>
          )}
        </div>
      </Section>
    </article>
  );
}
