/** The Create Plan wizard, kept as it is and restyled (MOD-WS-23): strategy, conditions, properties. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import type { Building, Dataset, Equipment, Plan, Project } from '../data/types';
import { resolveScope, useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { fmtMoney } from '../ui/format';
import { COMP_META } from './catalog';
import { newId, nowIso } from './logic';
import { ScopeField } from './ScopeField';
import { msg, useRuntime } from './runtime';
import type { CompSpec } from './types';

export const STRATEGIES = [
  { id: 'custom', label: 'Custom', help: 'Your own mix of projects, balanced across cost and carbon' },
  { id: 'intensity', label: 'Lower intensity', help: 'Start with the buildings that use the most energy per square foot' },
  { id: 'impact', label: 'Maximum impact for budget', help: 'The most tCO₂e for each dollar, within your budget' },
  { id: 'net-zero', label: 'Net zero', help: 'Electrify and decarbonise every building in the time you set' },
  { id: 'energy-star', label: 'Pass ENERGY STAR', help: 'Lift the lowest-scoring buildings to certification' },
  { id: 'retrofit', label: 'Upgrades and retrofit', help: 'Replace equipment in poor condition or at end of life' },
] as const;
type StrategyId = (typeof STRATEGIES)[number]['id'];

const CAPEX: Record<Project['type'], number> = { HVAC: 180000, Lighting: 60000, Electrification: 260000, Envelope: 150000, Controls: 45000, Solar: 210000 };

function typeFor(e: Equipment, strategy: StrategyId): Project['type'] {
  if (/light/i.test(e.type ?? '')) return 'Lighting';
  if (/boiler|furnace|heat/i.test(e.type ?? '') || strategy === 'net-zero') return 'Electrification';
  if (/bms|control/i.test(e.type ?? '')) return 'Controls';
  return 'HVAC';
}

function pickBuildings(bs: Building[], strategy: StrategyId) {
  const total = (b: Building) => b.emissions.scope1 + b.emissions.scope2;
  const sorted = [...bs].sort((a, b) => {
    if (strategy === 'intensity') return (b.siteEui ?? 0) / b.euiBenchmark - (a.siteEui ?? 0) / a.euiBenchmark;
    if (strategy === 'energy-star') return (a.energyStarScore ?? 101) - (b.energyStarScore ?? 101);
    if (strategy === 'impact') return b.exposure.potentialFine + total(b) * 100 - (a.exposure.potentialFine + total(a) * 100);
    return total(b) - total(a);
  });
  return sorted.slice(0, 6);
}

/** The planner: projects from the equipment record, building-level estimates where there's no survey (MOD-WS-22). */
export function buildProjects(data: Dataset, planId: string, buildings: Building[], strategy: StrategyId, budget: number, years: number): Project[] {
  const out: Project[] = [];
  buildings.forEach((b, bk) => {
    const eq = data.equipment.filter((e) => e.buildingId === b.id && e.kind === 'equipment' && !e.retired && (e.condition === 'Poor' || e.condition === 'Critical' || (strategy === 'retrofit' && e.condition === 'Fair')));
    const emissions = b.emissions.scope1 + b.emissions.scope2;
    if (eq.length) {
      eq.slice(0, 3).forEach((e, k) => {
        const type = typeFor(e, strategy);
        const capex = CAPEX[type];
        const savings = Math.round(capex * (type === 'Controls' ? 0.25 : type === 'Lighting' ? 0.2 : 0.1));
        out.push({ id: newId('pr'), planId, buildingId: b.id, equipmentId: e.id, name: `Replace ${e.name}${e.description ? ` (${e.description})` : ''}`, type, status: 'Proposed', priority: e.condition === 'Critical' ? 'High' : k === 0 ? 'Medium' : 'Low', capex, savingsUsd: savings, tco2e: Math.max(5, Math.round(emissions * (type === 'Electrification' ? 0.18 : 0.07))), paybackYears: Math.round((capex / savings) * 10) / 10, year: 2027 + ((bk + k) % Math.max(1, years)), estimated: false });
      });
    } else {
      const capex = CAPEX.Controls + CAPEX.Lighting;
      const savings = Math.round(capex * 0.22);
      out.push({ id: newId('pr'), planId, buildingId: b.id, equipmentId: null, name: 'Controls and lighting upgrade', type: 'Controls', status: 'Proposed', priority: 'Medium', capex, savingsUsd: savings, tco2e: Math.max(5, Math.round(emissions * 0.09)), paybackYears: Math.round((capex / savings) * 10) / 10, year: 2027 + (bk % Math.max(1, years)), estimated: true });
    }
  });
  const ranked = strategy === 'impact' ? [...out].sort((a, b) => b.tco2e / b.capex - a.tco2e / a.capex) : out;
  const kept: Project[] = [];
  let spent = 0;
  for (const p of ranked) {
    if (spent + p.capex > budget && kept.length) continue;
    kept.push(p);
    spent += p.capex;
  }
  return kept;
}

export function PlanWizard({ scope, setScope }: { scope: string; setScope: (s: string) => void }) {
  const { data, accessible, add } = useData();
  const rt = useRuntime();
  const { to } = useNav();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [strategy, setStrategy] = useState<StrategyId>('impact');
  const [budget, setBudget] = useState(4000000);
  const [years, setYears] = useState(5);
  const [conds, setConds] = useState<string[]>(['Replace at end of life']);
  const [auto, setAuto] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const inScope = data.buildings.filter((b) => resolveScope(scope, data.buildings, data.groups, accessible).buildingIds.includes(b.id));
  const chosen = auto ? pickBuildings(inScope, strategy) : inScope.filter((b) => picked.includes(b.id));
  const label = STRATEGIES.find((s) => s.id === strategy)!.label;

  const create = () => {
    const planId = newId('plan');
    const projects = buildProjects(data, planId, chosen, strategy, budget, years);
    const capex = projects.reduce((a, p) => a + p.capex, 0);
    const t = projects.reduce((a, p) => a + p.tco2e, 0);
    const current = chosen.reduce((a, b) => a + b.emissions.scope1 + b.emissions.scope2, 0);
    const est = projects.filter((p) => p.estimated).length;
    const pct = current ? Math.round((t / current) * 100) : 0;
    const name = `${label} ${new Date(nowIso()).getUTCFullYear() + years}`;
    const narrative = `Strategy: ${label.toLowerCase()}. The planner chose ${chosen.length} buildings and ${projects.length} projects within a ${fmtMoney(budget, true)} budget over ${years} years; together they cut ${t.toLocaleString('en-US')} tCO₂e a year, ${pct}% of these buildings’ Scope 1 and 2 today, for ${fmtMoney(capex, true)}. Projects are built on equipment in poor or critical condition from the survey.${est ? ` ${est} buildings have no equipment survey, so their projects are building-level estimates, marked as estimated.` : ''}`;
    const plan: Plan = { id: planId, name, status: 'under-review', strategy: STRATEGIES.find((s) => s.id === strategy)!.help, conditions: [`Budget ${fmtMoney(budget, true)}`, `${years} years`, ...conds], buildingIds: chosen.map((b) => b.id), targetYear: 2026 + years, reductionPct: pct, narrative, created: nowIso().slice(0, 10) };
    add('plans', plan);
    projects.forEach((p) => add('projects', p));
    const components: CompSpec[] = (['plan-overview', 'plan-narrative', 'plan-pathway', 'plan-projects'] as const).map((type, k) => ({ id: `${type}-${k}`, type, title: COMP_META[type].title }));
    const brief = `Create a carbon plan: ${label.toLowerCase()}, ${fmtMoney(budget, true)} over ${years} years, ${auto ? 'properties chosen automatically' : `${chosen.length} properties chosen by hand`}${conds.length ? `; ${conds.join(', ').toLowerCase()}` : ''}.`;
    const ws = rt.create({ name, kind: 'plan', scopeId: chosen.length === 1 ? `property-${chosen[0].id}` : scope, components, planId, brief }, { messages: [msg('user', 'text', brief)] });
    navigate(to(`/workspace/${ws.id}`));
  };

  return (
    <div className="ws-wizard">
      <ol className="ws-steps" aria-label="Create plan steps">
        {['Strategy', 'Conditions', 'Properties'].map((s, k) => (
          <li key={s} className={step === k + 1 ? 'is-current' : step > k + 1 ? 'is-done' : ''} aria-current={step === k + 1 ? 'step' : undefined}>
            <span>{step > k + 1 ? <Icon name="check" /> : k + 1}</span> {s}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <fieldset className="ws-fieldset">
          <legend>Choose a strategy</legend>
          {STRATEGIES.map((s) => (
            <label key={s.id} className="check">
              <input type="radio" name="ws-strategy" checked={strategy === s.id} onChange={() => setStrategy(s.id)} />
              <span><strong>{s.label}</strong><span className="muted"> · {s.help}</span></span>
            </label>
          ))}
        </fieldset>
      )}
      {step === 2 && (
        <fieldset className="ws-fieldset">
          <legend>Define conditions</legend>
          <div className="field-row">
            <label className="field"><span>Total investment ($)</span><input type="number" min={100000} step={100000} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} /></label>
            <label className="field"><span>Duration</span><select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[3, 5, 10].map((n) => <option key={n} value={n}>{n} years</option>)}</select></label>
          </div>
          {['Replace at end of life', 'Keep tenants in place', 'No work in Q4'].map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={conds.includes(c)} onChange={() => setConds((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))} />
              <span>{c}</span>
            </label>
          ))}
          {budget < 100000 && <p className="ws-error" role="alert">Set a budget of at least $100,000.</p>}
        </fieldset>
      )}
      {step === 3 && (
        <fieldset className="ws-fieldset">
          <legend>Choose properties</legend>
          <ScopeField value={scope} onChange={(v) => { setScope(v); setPicked([]); }} />
          <label className="check"><input type="radio" name="ws-auto" checked={auto} onChange={() => setAuto(true)} /><span><strong>Choose properties automatically</strong><span className="muted"> · the planner picks up to six for the most impact</span></span></label>
          <label className="check"><input type="radio" name="ws-auto" checked={!auto} onChange={() => setAuto(false)} /><span><strong>Choose properties by hand</strong></span></label>
          {auto ? (
            <p className="muted">Chosen: {chosen.map((b) => b.name).join(', ') || 'none in this scope'}.</p>
          ) : (
            <div className="ws-people">
              {inScope.map((b) => (
                <label key={b.id} className="check">
                  <input type="checkbox" checked={picked.includes(b.id)} onChange={() => setPicked((p) => (p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id]))} />
                  <span>{b.name}<span className="muted"> · {b.hasEquipmentSurvey ? 'surveyed' : 'no equipment survey, building-level estimates'}</span></span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <div className="btn-row">
        {step > 1 && <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 ? (
          <button type="button" className="btn" disabled={step === 2 && budget < 100000} onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button type="button" className="btn" disabled={!chosen.length} onClick={create}><Icon name="auto_awesome" /> Create plan</button>
        )}
      </div>
    </div>
  );
}
