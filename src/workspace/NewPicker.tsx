/** New (MOD-WS-40, 41, 23, 44): a template for the user's role, a blank workspace to describe, or a carbon plan; each asks for the scope. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../data/store';
import { useNav } from '../nav/route';
import { ScopeField } from './ScopeField';
import { Icon } from '../shell/Icon';
import { PageHeader } from '../ui/bits';
import { useToast } from '../ui/Toast';
import { composeFromBrief, compTitle, KIND_ICON, KIND_LABEL, PREBUILT_DEFS, templatesFor } from './catalog';
import { NotBought } from './components/operations';
import { CADENCE_LABEL } from './dialogs';
import { DEFAULT_PERIOD, nowIso, PERIODS, periodById } from './logic';
import { PlanWizard } from './PlanWizard';
import { msg, useRuntime } from './runtime';
import type { Cadence, RunPeriod } from './types';

type Choice = { kind: 'template'; id: string } | { kind: 'blank' } | { kind: 'plan' };

export function NewPicker() {
  const { data, user } = useData();
  const rt = useRuntime();
  const { to, scopeId } = useNav();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const initial: Choice | null = params.get('start') === 'plan' ? { kind: 'plan' } : params.get('template') && PREBUILT_DEFS.some((d) => d.id === params.get('template')) ? { kind: 'template', id: params.get('template')! } : params.get('start') === 'blank' ? { kind: 'blank' } : null;
  const [choice, setChoice] = useState<Choice | null>(initial);
  const [scope, setScope] = useState(scopeId);
  const [brief, setBrief] = useState(params.get('brief') ?? '');
  const [periodId, setPeriodId] = useState(DEFAULT_PERIOD.id);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [showAll, setShowAll] = useState(false);
  const { mine, rest } = templatesFor(user.persona);
  const template = choice?.kind === 'template' ? PREBUILT_DEFS.find((d) => d.id === choice.id) : undefined;
  const preview = useMemo(() => (brief.trim().length > 8 ? composeFromBrief(brief) : null), [brief]);

  const create = () => {
    if (!choice || choice.kind === 'plan') return;
    if (choice.kind === 'template' && template) {
      const period = template.kind === 'report' ? periodById(periodId) : undefined;
      const schedule = template.kind === 'report' && scheduleOn ? { enabled: true, cadence, period: (cadence === 'monthly' ? 'previous-month' : cadence === 'quarterly' ? 'previous-quarter' : cadence === 'weekly' ? 'previous-week' : 'previous-day') as RunPeriod, recipients: [user.id], createdAt: nowIso() } : undefined;
      const b = `Start from ${template.name}${period ? ` for ${period.label.toLowerCase()}` : ''}${schedule ? `, emailed to me ${CADENCE_LABEL[cadence].toLowerCase()}` : ''}`;
      const ws = rt.create({ name: template.name, kind: template.kind, scopeId: scope, components: template.components, period, framework: template.framework, templateId: template.id, schedule, brief: b }, { messages: [msg('user', 'text', b)] });
      toast(`Building ${template.name}. It carries on if you leave.`);
      navigate(to(`/workspace/${ws.id}`));
      return;
    }
    const c = composeFromBrief(brief);
    const ws = rt.create({ name: c.name, kind: c.kind, scopeId: scope, components: c.components, period: c.period ?? undefined, framework: c.framework, brief: brief.trim() }, { messages: [msg('user', 'text', brief.trim())], ask: c.ask });
    navigate(to(`/workspace/${ws.id}`));
  };

  const card = (d: (typeof PREBUILT_DEFS)[number]) => (
    <li key={d.id}>
      <button type="button" className={`ws-pick ${choice?.kind === 'template' && choice.id === d.id ? 'is-on' : ''}`} aria-pressed={choice?.kind === 'template' && choice.id === d.id} onClick={() => setChoice({ kind: 'template', id: d.id })}>
        <Icon name={KIND_ICON[d.kind]} />
        <span>
          <strong>{d.name}</strong>
          <span className="muted">{KIND_LABEL[d.kind]} · {d.question}</span>
        </span>
      </button>
    </li>
  );

  return (
    <article className="page page-wide ws-page">
      <PageHeader eyebrow="Custom Workspaces" title="New workspace" subtitle="Start from a template and change it, describe what you need, or build a carbon plan. Every choice asks for the scope it keeps." back={{ to: to('/workspace'), label: 'Back to Workspace' }} />
      <div className="ws-new">
        <section className="ws-new-col" aria-labelledby="ws-new-start">
          <h2 id="ws-new-start" className="ws-new-h">1. Start from</h2>
          <p className="ws-mini-title">Templates for your role</p>
          <ul className="ws-pick-list">{mine.map(card)}</ul>
          {showAll ? <><p className="ws-mini-title">More templates</p><ul className="ws-pick-list">{rest.map(card)}</ul></> : rest.length > 0 && <button type="button" className="text-btn" onClick={() => setShowAll(true)}>Show {rest.length} more templates</button>}
          <p className="ws-mini-title">Or</p>
          <ul className="ws-pick-list">
            <li>
              <button type="button" className={`ws-pick ${choice?.kind === 'blank' ? 'is-on' : ''}`} aria-pressed={choice?.kind === 'blank'} onClick={() => setChoice({ kind: 'blank' })}>
                <Icon name="edit_note" />
                <span><strong>A blank workspace to describe</strong><span className="muted">Say what you need; the assistant builds it from the component library.</span></span>
              </button>
            </li>
            <li>
              <button type="button" className={`ws-pick ${choice?.kind === 'plan' ? 'is-on' : ''}`} aria-pressed={choice?.kind === 'plan'} onClick={() => setChoice({ kind: 'plan' })}>
                <Icon name="eco" />
                <span><strong>A carbon plan</strong><span className="muted">Strategy, conditions and properties, then a plan with projects and a pathway.</span></span>
              </button>
            </li>
          </ul>
        </section>

        <section className="ws-new-col card" aria-labelledby="ws-new-set">
          <h2 id="ws-new-set" className="ws-new-h">2. Set it up</h2>
          {!choice && <p className="muted">Choose a starting point to set its scope{' '}and details.</p>}
          {choice?.kind === 'plan' && (data.entitlements.carbonPlanning ? <PlanWizard scope={scope} setScope={setScope} /> : <NotBought product="Carbon Planning" ctx={{ data, buildings: data.buildings }} />)}
          {choice?.kind === 'template' && template && (
            <>
              <p><strong>{template.name}</strong>: {template.question}</p>
              <ScopeField value={scope} onChange={setScope} />
              {template.kind === 'report' && (
                <>
                  <label className="field">
                    <span>Period</span>
                    <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                      {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={scheduleOn} onChange={(e) => setScheduleOn(e.target.checked)} />
                    <span>Email it to me on a schedule</span>
                  </label>
                  {scheduleOn && (
                    <label className="field">
                      <span>How often</span>
                      <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                        {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
                      </select>
                      <span className="muted ws-help">You can add colleagues and outside addresses from the report’s Schedule control.</span>
                    </label>
                  )}
                </>
              )}
              <button type="button" className="btn" onClick={create}><Icon name="auto_awesome" /> Build it</button>
            </>
          )}
          {choice?.kind === 'blank' && (
            <>
              <label className="field">
                <span>What do you need?</span>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="For example: exposure and emissions for my three worst buildings, with gas use by month" />
              </label>
              <ScopeField value={scope} onChange={setScope} />
              {preview && (
                <div className="ws-preview" aria-live="polite">
                  <p className="ws-mini-title">The assistant will arrange</p>
                  <ul>
                    {preview.components.map((x) => <li key={x.id}>{compTitle(x)}</li>)}
                  </ul>
                  {preview.ask && <p className="muted"><Icon name="help" /> It will ask first: {preview.ask.text.toLowerCase()}</p>}
                </div>
              )}
              <button type="button" className="btn" disabled={brief.trim().length < 4} onClick={create}><Icon name="auto_awesome" /> Build it</button>
            </>
          )}
          <p className="muted ws-help">Ready-made workspaces are in the panel under Workspaces. <Link to={to('/workspace')}>Back to your last workspace</Link></p>
        </section>
      </div>
    </article>
  );
}
