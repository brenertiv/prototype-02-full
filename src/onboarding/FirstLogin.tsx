/**
 * OWNED BY THE PEOPLE BUILD. First App Onboarding (SYS-ONB-01 to 09; ST-P07), shown over the app on
 * first login: a welcome that opens with what we already know, a jobs step, then the first workspace
 * being built and the landing on it. Not a tour: the app is learned from hints and the assistant.
 */
import { useMemo, useRef, useState } from 'react';
import { useTestConfig } from '../config/testConfig';
import { useData } from '../data/store';
import type { PersonaId, Utility } from '../data/types';
import { useNav } from '../nav/route';
import { scopeParts } from '../people/common';
import { Icon } from '../shell/Icon';
import { usePrefs } from '../state/preferences';
import { Modal } from '../ui/Modal';
import { fmtArea, fmtMoney } from '../ui/format';
import { useCreateFirstWorkspace } from '../workspace/registry';
import { derivePersona, JOBS, personaFromTitle, predictedJobs } from './jobs';
import './onboarding.css';

type Step = 'intro' | 'jobs' | 'building';

export function FirstLogin() {
  const { config } = useTestConfig();
  const { getApp } = useData();
  if (!config.firstLogin || getApp('onboarded', false)) return null;
  return <FirstLoginFlow />;
}

const UTIL_LABEL: Record<Utility, string> = { electricity: 'electricity', gas: 'gas', water: 'water', steam: 'steam' };

function FirstLoginFlow() {
  const { data, user, accessible, setApp } = useData();
  const { prefs } = usePrefs();
  const { to, navigate } = useNav();
  const createFirstWorkspace = useCreateFirstWorkspace();
  const [step, setStep] = useState<Step>('intro');
  const predicted = useMemo(() => predictedJobs(user.title), [user.title]);
  const [jobs, setJobs] = useState<string[]>(predicted);
  const [progress, setProgress] = useState(0);
  const started = useRef(false);

  const first = user.name.split(' ')[0];
  const inviter = data.users.find((u) => u.id === user.invitedBy);
  const buildings = data.buildings.filter((b) => accessible.has(b.id));

  // "Priya invited you to 12 buildings in the West region" (SYS-ONB-02): from the invite, never elsewhere.
  const where = useMemo(() => {
    const record = data.users.find((u) => u.id === user.id) ?? user;
    const parts = scopeParts(record, data).filter((p) => p.buildingIds.length);
    const n = buildings.length;
    const noun = n === 1 ? 'building' : 'buildings';
    if (n === data.buildings.length && n > 1) return `all ${n} ${noun} in the portfolio`;
    if (n === 1) return buildings[0].name;
    const grp = record.scope.groupIds.map((g) => data.groups.find((x) => x.id === g)).filter(Boolean);
    if (grp.length === 1 && parts.length === 1) return `${n} ${noun} in ${grp[0]!.name}`;
    const team = parts.find((p) => p.kind === 'team');
    if (team && parts.length === 1) return `${n} ${noun} with the ${team.source.replace('Team: ', '')} team`;
    return `${n} ${noun}`;
  }, [data, user, buildings]);

  const facts = useMemo(() => {
    const gfa = buildings.reduce((a, b) => a + (b.gfa ?? 0), 0);
    const missingGfa = buildings.filter((b) => b.gfa === null).length;
    const cities = [...new Set(buildings.map((b) => `${b.city}, ${b.state}`))];
    const utilities = (['electricity', 'gas', 'water', 'steam'] as Utility[])
      .map((u) => ({ u, n: buildings.filter((b) => b.tierByUtility[u] !== undefined && b.tierByUtility[u] !== 0).length, setup: buildings.filter((b) => b.sold[u]?.sold && b.sold[u]?.stage !== 'live').length }))
      .filter((x) => x.n > 0 || x.setup > 0);
    const scored = buildings.filter((b) => b.energyStarScore !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + (b.energyStarScore ?? 0), 0) / scored.length) : null;
    const atRisk = buildings.filter((b) => b.exposure.status === 'At risk' || b.exposure.status === 'Non-compliant');
    const fines = buildings.reduce((a, b) => a + b.exposure.potentialFine, 0);
    return { gfa, missingGfa, cities, utilities, scored: scored.length, avgScore, atRisk: atRisk.length, fines };
  }, [buildings]);

  const finish = (chosen: string[]) => {
    if (started.current) return;
    started.current = true;
    const usable = chosen.length ? chosen : predicted;
    // SYS-ONB-07: nothing to predict from means the persona-neutral workspace.
    const persona: PersonaId = usable.length ? derivePersona(usable, user.title) : personaFromTitle(user.title);
    setStep('building');
    let id = 'role-default';
    try {
      id = createFirstWorkspace(usable, persona) || 'role-default';
    } catch {
      id = 'role-default'; // a failed build lands on the persona-neutral workspace, not an error
    }
    if (persona !== 'none') setApp('personaOverride', persona);
    setApp('jobs', usable);
    const ticks = [500, 1100, 1700];
    ticks.forEach((t, k) => window.setTimeout(() => setProgress(k + 1), t));
    window.setTimeout(() => {
      setApp('onboarded', true);
      navigate(to(`/workspace/${id}`));
    }, 2300);
  };

  if (step === 'intro') {
    const little = facts.utilities.every((x) => x.n === 0) || facts.scored === 0;
    return (
      <Modal
        title={`Welcome, ${first}`}
        onClose={() => undefined}
        noClose
        size="md"
        footer={
          <button type="button" className="btn" onClick={() => setStep('jobs')} autoFocus>
            Next <Icon name="arrow_forward" />
          </button>
        }
      >
        <div className="onb-intro">
          <p className="onb-lede">
            {inviter ? (
              <>
                {inviter.name.split(' ')[0]} invited you to <strong>{where}</strong> at {data.company.name}.
              </>
            ) : (
              <>
                You’re set up with <strong>{where}</strong> at {data.company.name}.
              </>
            )}
          </p>
          <p className="muted">Here’s what we already know about {buildings.length === 1 ? 'it' : 'them'}.</p>
          <ul className="onb-facts">
            <li>
              <Icon name="square_foot" />
              <span>
                <strong>{facts.gfa ? fmtArea(facts.gfa, prefs.units) : 'Size not recorded yet'}</strong>
                {facts.missingGfa > 0 && facts.gfa > 0 && <span className="muted"> · {facts.missingGfa} still to confirm</span>}
              </span>
            </li>
            <li>
              <Icon name="location_on" />
              <span>
                <strong>{facts.cities.slice(0, 3).join(' · ')}</strong>
                {facts.cities.length > 3 && <span className="muted"> and {facts.cities.length - 3} more</span>}
              </span>
            </li>
            <li>
              <Icon name="bolt" />
              <span>
                {facts.utilities.length ? (
                  facts.utilities.map((x, k) => (
                    <span key={x.u}>
                      <strong>{UTIL_LABEL[x.u]}</strong> {x.n ? `at ${x.n}` : ''}
                      {x.setup ? <span className="muted">{x.n ? ', ' : ''}being connected at {x.setup}</span> : null}
                      {k < facts.utilities.length - 1 ? ' · ' : ''}
                    </span>
                  ))
                ) : (
                  <span>Utilities are being connected now</span>
                )}
              </span>
            </li>
            <li>
              <Icon name="star" />
              <span>
                {facts.avgScore !== null ? (
                  <>
                    <strong>ENERGY STAR {facts.avgScore}</strong> average across {facts.scored} {facts.scored === 1 ? 'building' : 'buildings'}
                  </>
                ) : (
                  'No ENERGY STAR scores yet; they come once a year of data is in'
                )}
              </span>
            </li>
            <li>
              <Icon name="gavel" />
              <span>
                {facts.atRisk ? (
                  <>
                    <strong>{facts.atRisk} {facts.atRisk === 1 ? 'building' : 'buildings'}</strong> at risk under local energy laws
                    {facts.fines > 0 && <>, up to {fmtMoney(facts.fines, true)} in possible fines</>}
                  </>
                ) : (
                  'No compliance exposure found so far'
                )}
              </span>
            </li>
          </ul>
          {little && <p className="onb-note">Some of this is still being set up. You’ll see what’s ready, and what’s on its way.</p>}
        </div>
      </Modal>
    );
  }

  if (step === 'jobs') {
    const need = Math.max(0, 3 - jobs.length);
    return (
      <Modal
        title="What do you want to do in Enertiv?"
        onClose={() => undefined}
        noClose
        size="md"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => finish([])}>
              Skip
            </button>
            <span className="onb-count" aria-live="polite">
              {need ? `Choose ${need} more` : `${jobs.length} chosen`}
            </span>
            <button type="button" className="btn" disabled={need > 0} onClick={() => finish(jobs)}>
              Build my workspace
            </button>
          </>
        }
      >
        <p className="muted onb-sub">Pick at least three. We’ll build your first workspace around them{predicted.length ? '; we’ve ticked the usual ones for your title' : ''}.</p>
        <fieldset className="onb-jobs">
          <legend className="sr-only">Jobs</legend>
          {JOBS.map((j) => {
            const on = jobs.includes(j.id);
            return (
              <label key={j.id} className={`onb-job ${on ? 'is-on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => setJobs((x) => (x.includes(j.id) ? x.filter((y) => y !== j.id) : [...x, j.id]))} />
                <Icon name={j.icon} />
                <span>
                  <span className="onb-job-label">{j.label}</span>
                  <span className="onb-job-detail">{j.detail}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </Modal>
    );
  }

  const steps = ['Reading your buildings', 'Choosing views for your jobs', 'Laying out your workspace'];
  return (
    <Modal title="Building your workspace" onClose={() => undefined} noClose size="sm">
      <div className="onb-building" role="status" aria-live="polite">
        <div className="onb-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (progress / steps.length) * 100)}%` }} />
        </div>
        <ul className="onb-steps">
          {steps.map((s, k) => (
            <li key={s} className={k < progress ? 'is-done' : k === progress ? 'is-now' : ''}>
              <Icon name={k < progress ? 'check_circle' : k === progress ? 'progress_activity' : 'radio_button_unchecked'} />
              {s}
            </li>
          ))}
        </ul>
        <p className="muted">It’s yours to change once you’re in.</p>
      </div>
    </Modal>
  );
}
