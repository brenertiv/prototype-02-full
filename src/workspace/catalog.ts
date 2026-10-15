/**
 * The component library, the pre-built workspaces Enertiv maintains (MOD-WS-01, 40, 52), the
 * seed a returning user starts with, and the brief composer the assistant uses to choose and
 * arrange components by keyword (MOD-WS-41).
 */
import type { CurrentUser } from '../data/store';
import type { Dataset, PersonaId } from '../data/types';
import { DEFAULT_PERIOD, PERIODS, periodFromText } from './logic';
import type { CompSpec, CompType, Msg, Workspace, WsKind } from './types';

export const COMP_META: Record<CompType, { title: string; icon: string; views?: boolean }> = {
  'readiness-kpis': { title: 'Readiness at a glance', icon: 'fact_check' },
  'framework-readiness': { title: 'Readiness by framework and building', icon: 'checklist' },
  'coverage-gaps': { title: 'Coverage gaps', icon: 'data_alert' },
  'es-sync': { title: 'ENERGY STAR sync', icon: 'sync' },
  'exposure-kpis': { title: 'Fine exposure', icon: 'gavel' },
  'exposure-ranked': { title: 'Exposure by asset', icon: 'leaderboard', views: true },
  'asset-figures': { title: 'Cost, carbon and coverage by asset', icon: 'table_chart' },
  'data-problems': { title: 'Open data problems by building', icon: 'health_and_safety' },
  'capital-projects': { title: 'Capital projects across plans', icon: 'construction' },
  'equipment-eol': { title: 'Equipment due for replacement', icon: 'hvac' },
  'insights-ranked': { title: 'Insights ranked by value', icon: 'lightbulb', views: true },
  'emissions-split': { title: 'Emissions by scope and control', icon: 'co2' },
  'energy-monthly': { title: 'Energy use by month', icon: 'bar_chart', views: true },
  'goal-progress': { title: 'Progress against your carbon target', icon: 'flag' },
  'eui-ranked': { title: 'Energy use per square foot', icon: 'square_foot', views: true },
  'load-profiles': { title: 'Load profile', icon: 'show_chart', views: true },
  'buildings-overview': { title: 'Your buildings', icon: 'apartment' },
  'setup-progress': { title: 'Setup progress', icon: 'pending_actions' },
  templates: { title: 'Start a workspace from a template', icon: 'auto_awesome_mosaic' },
  'report-cover': { title: 'Cover', icon: 'description' },
  'gresb-table': { title: 'GRESB asset table', icon: 'table_view' },
  'summary-table': { title: 'Energy and ESG summary', icon: 'summarize' },
  'business-case': { title: 'Business case', icon: 'request_quote' },
  'plan-overview': { title: 'Plan overview', icon: 'insights' },
  'plan-narrative': { title: 'How this plan was built', icon: 'notes' },
  'plan-pathway': { title: 'Emissions pathway and fine exposure', icon: 'trending_down' },
  'plan-projects': { title: 'Projects by type', icon: 'construction' },
};

export const compTitle = (c: CompSpec) => c.title ?? COMP_META[c.type].title;
export const KIND_ICON: Record<WsKind, string> = { dashboard: 'dashboard', report: 'description', plan: 'eco' };
export const KIND_LABEL: Record<WsKind, string> = { dashboard: 'Dashboard', report: 'Report', plan: 'Carbon plan' };

const c = (type: CompType, extra: Partial<CompSpec> = {}): CompSpec => ({ id: `${type}`, type, ...extra });
const withIds = (list: CompSpec[]) => list.map((x, k) => ({ ...x, id: `${x.type}-${k}` }));

export const ROLE_DEFAULT: Record<PersonaId, string> = {
  sl: 'reporting-readiness',
  am: 'exposure-by-asset',
  pm: 'data-problems',
  none: 'getting-started',
};

interface PrebuiltDef {
  id: string;
  name: string;
  kind: WsKind;
  question: string;
  components: CompSpec[];
  framework?: string;
  /** Personas whose New picker offers it first. */
  personas: PersonaId[];
}

export const PREBUILT_DEFS: PrebuiltDef[] = [
  { id: 'reporting-readiness', name: 'Reporting readiness', kind: 'dashboard', question: 'Which buildings are ready for GRESB, ENERGY STAR and local laws, and what blocks the rest?', personas: ['sl'], components: withIds([c('readiness-kpis'), c('framework-readiness'), c('coverage-gaps'), c('es-sync')]) },
  { id: 'exposure-by-asset', name: 'Exposure by asset', kind: 'dashboard', question: 'Which assets carry the most fine exposure, and can I defend each number?', personas: ['am'], components: withIds([c('exposure-kpis'), c('exposure-ranked'), c('asset-figures')]) },
  { id: 'data-problems', name: 'Data problems to fix', kind: 'dashboard', question: 'What on my buildings needs fixing, and where do I fix it?', personas: ['pm'], components: withIds([c('data-problems')]) },
  { id: 'getting-started', name: 'Your buildings and setup', kind: 'dashboard', question: 'What does the account hold so far, and where do I start?', personas: ['none'], components: withIds([c('buildings-overview'), c('setup-progress'), c('templates')]) },
  { id: 'capital-projects', name: 'Capital projects', kind: 'dashboard', question: 'Every capital project across your carbon plans, with cost, savings and the equipment behind it.', personas: ['am', 'sl'], components: withIds([c('capital-projects')]) },
  { id: 'equipment-end-of-life', name: 'Equipment end of life', kind: 'dashboard', question: 'Which equipment is in poor condition or due for replacement, building by building?', personas: ['am', 'pm'], components: withIds([c('equipment-eol', { window: 5 })]) },
  { id: 'insights', name: 'Insights', kind: 'dashboard', question: 'Savings opportunities on instrumented buildings, ranked by value.', personas: ['pm', 'am'], components: withIds([c('insights-ranked')]) },
  { id: 'emissions-and-energy', name: 'Emissions and energy', kind: 'dashboard', question: 'How much energy and carbon, who controls it, and are we on track for the target?', personas: ['sl', 'am'], components: withIds([c('emissions-split'), c('energy-monthly'), c('goal-progress'), c('eui-ranked')]) },
  { id: 'load-profiles', name: 'Load profiles', kind: 'dashboard', question: 'When do buildings with interval data use power, and how high do they peak?', personas: ['pm'], components: withIds([c('load-profiles')]) },
  { id: 'gresb-export', name: 'GRESB export', kind: 'report', framework: 'GRESB', question: 'The GRESB asset table, ready to upload, with what blocks each building.', personas: ['sl'], components: withIds([c('report-cover'), c('gresb-table')]) },
  { id: 'energy-esg-summary', name: 'Portfolio energy and ESG summary', kind: 'report', question: 'Energy, cost and emissions for the period, by building, with what each figure covers.', personas: ['sl', 'am', 'pm'], components: withIds([c('report-cover'), c('summary-table')]) },
  { id: 'business-case', name: 'Business case', kind: 'report', question: 'Fine exposure avoided, project paybacks and coverage gained: the case for the investment committee.', personas: ['sl', 'am'], components: withIds([c('report-cover'), c('business-case')]) },
];

export const isPrebuiltId = (id: string) => PREBUILT_DEFS.some((d) => d.id === id);

/** Pre-built workspaces show the global scope (an open question in the spec; the global scope is the prototype's answer). */
export function prebuiltList(scopeId: string, persona: PersonaId): Workspace[] {
  const own = ROLE_DEFAULT[persona];
  const roleIds = new Set(Object.values(ROLE_DEFAULT));
  const ordered = [
    ...PREBUILT_DEFS.filter((d) => d.id === own),
    ...PREBUILT_DEFS.filter((d) => d.id !== own && roleIds.has(d.id) && d.id !== 'getting-started'),
    ...PREBUILT_DEFS.filter((d) => !roleIds.has(d.id) && d.kind === 'dashboard'),
    ...PREBUILT_DEFS.filter((d) => d.kind === 'report'),
    ...PREBUILT_DEFS.filter((d) => d.id === 'getting-started' && d.id !== own),
  ];
  return ordered.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    ownerId: 'enertiv',
    scopeId,
    createdAt: '2026-10-01T00:00:00',
    updatedAt: '2026-10-15T06:00:00',
    components: d.components,
    prebuilt: true,
    question: d.question,
    framework: d.framework,
    period: d.kind === 'report' ? (d.id === 'gresb-export' ? PERIODS[0] : DEFAULT_PERIOD) : undefined,
    status: 'ready',
    generatedAt: '2026-10-15T06:00:00',
  }));
}

/** Templates the New picker offers for the user's role first, then the rest (MOD-WS-40). */
export function templatesFor(persona: PersonaId) {
  const mine = PREBUILT_DEFS.filter((d) => d.personas.includes(persona) && d.id !== 'getting-started');
  const rest = PREBUILT_DEFS.filter((d) => !d.personas.includes(persona) && d.id !== 'getting-started');
  return { mine, rest };
}

/* ---------- Generation steps (SYS-AI-13) ---------- */

export interface GenStep {
  label: string;
  compId?: string;
}

export function genSteps(ws: Workspace): GenStep[] {
  return [
    { label: ws.kind === 'plan' ? 'Reading the strategy, conditions and properties' : 'Reading the brief and the scope' },
    ...ws.components.map((x) => ({ label: `Adding ${(x.title ?? COMP_META[x.type].title).toLowerCase()}`, compId: x.id })),
    { label: 'Checking provenance and coverage on every number' },
  ];
}

/** The step a simulated failure stops at (ST-W04). */
export const failStepFor = (ws: Workspace) => Math.min(2, genSteps(ws).length - 2);

/* ---------- Composing from a brief (MOD-WS-41) ---------- */

const KEYWORDS: [RegExp, CompType[]][] = [
  [/expos|fine|penalt|\bbps\b|ll97|violation/, ['exposure-kpis', 'exposure-ranked']],
  [/emission|carbon|scope [123]|ghg|co2/, ['emissions-split', 'goal-progress']],
  [/energy|consumption|electric|\bgas\b|kwh|usage/, ['energy-monthly', 'eui-ranked']],
  [/per square|eui|intensity|sq ?ft/, ['eui-ranked']],
  [/coverage|gap|complete/, ['coverage-gaps']],
  [/energy star|portfolio manager/, ['es-sync']],
  [/gresb|readiness|benchmark|compliance|ready/, ['framework-readiness']],
  [/insight|saving|opportunit/, ['insights-ranked']],
  [/equipment|end of life|condition|replace/, ['equipment-eol']],
  [/project|capital|capex/, ['capital-projects']],
  [/data problem|data health|fix|issue|problem/, ['data-problems']],
  [/load|peak|demand|interval/, ['load-profiles']],
  [/cost|spend|asset/, ['asset-figures']],
];

export function kindFromBrief(t: string): WsKind {
  return /\b(report|export|pack|submission|send|email)\b|summary for|board pack/.test(t.toLowerCase()) && !/\bdashboard\b/.test(t.toLowerCase()) ? 'report' : 'dashboard';
}

export interface Composed {
  kind: WsKind;
  components: CompSpec[];
  framework?: string;
  period?: ReturnType<typeof periodFromText>;
  /** What the brief left open (MOD-WS-49). */
  ask?: { text: string; options: string[]; field: 'period' | 'framework' };
  name: string;
}

export function composeFromBrief(brief: string): Composed {
  const t = brief.toLowerCase();
  const kind = kindFromBrief(t);
  const types: CompType[] = [];
  for (const [re, list] of KEYWORDS) if (re.test(t)) list.forEach((x) => !types.includes(x) && types.push(x));
  let framework: string | undefined;
  if (/gresb/.test(t)) framework = 'GRESB';
  else if (/energy star/.test(t) && kind === 'report') framework = 'ENERGY STAR';
  else if (/tcfd/.test(t)) framework = 'TCFD';
  else if (/csrd/.test(t)) framework = 'CSRD';

  let components: CompSpec[];
  if (kind === 'report') {
    const body: CompType[] = framework === 'GRESB' ? ['gresb-table'] : /business case|investment committee|payback/.test(t) ? ['business-case'] : ['summary-table'];
    const extra = types.filter((x) => ['exposure-ranked', 'emissions-split', 'framework-readiness', 'capital-projects'].includes(x) && !body.includes(x));
    components = withIds([c('report-cover'), ...body.map((x) => c(x)), ...extra.slice(0, 2).map((x) => c(x))]);
  } else {
    const chosen = types.length ? types.slice(0, 5) : (['buildings-overview', 'energy-monthly', 'coverage-gaps'] as CompType[]);
    components = withIds(chosen.map((x) => c(x, x === 'energy-monthly' && /\bgas\b/.test(t) ? { utility: 'gas' } : x === 'energy-monthly' && /electric/.test(t) ? { utility: 'electricity' } : x === 'equipment-eol' ? { window: 5 } : {})));
  }
  const worst = t.match(/(three|3|five|5|two|2|ten|10) worst/);
  if (worst) {
    const n = { three: 3, five: 5, two: 2, ten: 10 }[worst[1] as 'three'] ?? Number(worst[1]);
    const target = components.find((x) => ['exposure-ranked', 'eui-ranked', 'asset-figures'].includes(x.type));
    if (target) target.binding = { kind: 'rule', rule: target.type === 'eui-ranked' ? 'worst-eui' : 'worst-exposure', n };
  }

  const period = periodFromText(t);
  let ask: Composed['ask'];
  if (kind === 'report' && !period) ask = { field: 'period', text: 'Which period should the report cover?', options: [PERIODS[0].label, PERIODS[1].label, PERIODS[2].label] };
  else if (kind === 'report' && !framework && /framework|submission|disclosure/.test(t)) ask = { field: 'framework', text: 'Which framework is this for?', options: ['GRESB', 'TCFD', 'CSRD', 'No framework: a plain summary'] };

  const nameBits = [framework ? `${framework} ` : '', kind === 'report' ? 'report' : 'dashboard'];
  const topic = types[0] ? COMP_META[types[0]].title.split(' ').slice(0, 3).join(' ') : 'Overview';
  return { kind, components, framework, period, ask, name: framework ? nameBits.join('').replace(/^./, (m) => m.toUpperCase()) : `${topic.replace(/^./, (m) => m.toUpperCase())} ${kind}` };
}

/* ---------- Onboarding jobs (SYS-ONB-01, 07, 09) ---------- */

const JOB_COMPONENTS: Record<string, CompType[]> = {
  'reporting-readiness': ['readiness-kpis', 'framework-readiness'],
  'exposure-by-asset': ['exposure-kpis', 'exposure-ranked'],
  'coverage-gaps': ['coverage-gaps'],
  'emissions-pathway': ['emissions-split', 'goal-progress'],
  'capital-plan': ['capital-projects', 'equipment-eol'],
  'data-problems': ['data-problems'],
  'energy-star-sync': ['es-sync'],
  'compliance-deadlines': ['framework-readiness', 'exposure-kpis'],
};
const JOB_NAME: Record<string, string> = {
  'reporting-readiness': 'Reporting readiness',
  'exposure-by-asset': 'Exposure by asset',
  'coverage-gaps': 'Coverage gaps',
  'emissions-pathway': 'Emissions pathway',
  'capital-plan': 'Capital plan',
  'data-problems': 'Data problems to fix',
  'energy-star-sync': 'ENERGY STAR sync',
  'compliance-deadlines': 'Compliance deadlines',
};

export function composeFromJobs(jobs: string[], persona: PersonaId, carbonPlanning: boolean): { name: string; components: CompSpec[] } {
  const types: CompType[] = [];
  const add = (x: CompType) => !types.includes(x) && types.push(x);
  jobs.forEach((j) => {
    // An unknown job maps by keyword ("gas-use-by-month" → energy by month); one that matches nothing is skipped.
    const words = j.replace(/[-_]/g, ' ').toLowerCase();
    const list = JOB_COMPONENTS[j] ?? KEYWORDS.filter(([re]) => re.test(words)).flatMap(([, l]) => l);
    list.forEach(add);
  });
  if (!types.length) {
    const def = PREBUILT_DEFS.find((d) => d.id === ROLE_DEFAULT[persona])!;
    def.components.forEach((x) => add(x.type));
  }
  if (!carbonPlanning) {
    // The not-bought state still shows, once, rather than a second card (ST-E03).
    const k = types.indexOf('equipment-eol');
    if (k >= 0 && types.includes('capital-projects')) types.splice(k, 1);
  }
  const named = jobs.map((j) => JOB_NAME[j]).filter(Boolean);
  const name = named.length ? (named.length > 2 ? `${named.slice(0, 2).join(', ')} and more` : named.join(' and ')) : 'My workspace';
  return { name, components: withIds(types.slice(0, 6).map((x) => c(x, x === 'equipment-eol' ? { window: 5 } : {}))) };
}

/* ---------- The returning user's seed (SC-1 to SC-4, SC-6) ---------- */

const m = (id: string, role: Msg['role'], kind: Msg['kind'], text: string, at: string, extra: Partial<Msg> = {}): Msg => ({ id, role, kind, text, at, ...extra });

export function seedCustom(data: Dataset, user: Pick<CurrentUser, 'id' | 'name'>): Workspace[] {
  if (data.scenario === 'SC-5' || data.buildings.length === 0) return [];
  const out: Workspace[] = [];
  const base = { ownerId: user.id, status: 'ready' as const, prebuilt: false };
  out.push({
    ...base, id: 'c-gresb-2026', name: 'GRESB 2026 submission', kind: 'report', scopeId: 'portfolio', framework: 'GRESB', period: PERIODS[0],
    createdAt: '2026-07-20T10:12:00', updatedAt: '2026-10-01T06:00:00', generatedAt: '2026-10-01T06:00:00', templateId: 'gresb-export',
    components: withIds([c('report-cover'), c('gresb-table'), c('framework-readiness')]),
    schedule: { enabled: true, cadence: 'monthly', period: 'year-to-date', recipients: [user.id, 'esg@greenledger-advisory.example'], createdAt: '2026-07-20T10:20:00' },
    runs: [
      { id: 'run-3', at: '2026-10-01T06:00:00', period: 'Jan – Sep 2026', status: 'sent', recipients: 2 },
      { id: 'run-2', at: '2026-09-01T06:00:00', period: 'Jan – Aug 2026', status: 'incomplete', recipients: 2, note: 'August bills were missing for 3 buildings when it ran; the cover said so' },
      { id: 'run-1', at: '2026-08-01T06:00:00', period: 'Jan – Jul 2026', status: 'sent', recipients: 2 },
    ],
  });
  out.push({
    ...base, id: 'c-q3-board-pack', name: 'Q3 board pack', kind: 'report', scopeId: 'portfolio', period: PERIODS[3],
    createdAt: '2026-09-02T15:40:00', updatedAt: '2026-10-08T09:10:00', generatedAt: '2026-10-15T06:00:00',
    components: withIds([c('report-cover'), c('summary-table'), c('exposure-ranked')]),
    schedule: { enabled: true, cadence: 'quarterly', period: 'previous-quarter', recipients: ['u-am', 'u-admin'], createdAt: '2026-09-02T15:45:00' },
    runs: [{ id: 'run-q3', at: '2026-10-01T07:00:00', period: 'Jul – Sep 2026', status: 'sent', recipients: 2 }],
  });
  data.plans.forEach((p, k) => {
    out.push({
      ...base, id: `c-${p.id}`, name: p.name, kind: 'plan', planId: p.id, scopeId: p.buildingIds.length === 1 ? `property-${p.buildingIds[0]}` : 'portfolio',
      createdAt: `${p.created}T11:00:00`, updatedAt: `${p.created}T11:05:00`, generatedAt: `${p.created}T11:05:00`, period: undefined,
      components: withIds([c('plan-overview'), c('plan-narrative'), c('plan-pathway'), c('plan-projects')]).map((x) => ({ ...x, id: `${x.id}-${k}` })),
    });
  });
  const west = data.groups.find((g) => /west/i.test(g.name) && g.buildingIds.length);
  if (west) {
    out.push({
      ...base, id: 'c-west-exposure', name: `${west.name} exposure`, kind: 'dashboard', scopeId: `group-${west.id}`,
      createdAt: '2026-10-06T14:02:00', updatedAt: '2026-10-09T16:30:00', generatedAt: '2026-10-09T16:30:00',
      brief: `Make me a dashboard of exposure for the ${west.name} region`,
      components: withIds([c('exposure-kpis'), c('exposure-ranked', { binding: { kind: 'rule', rule: 'worst-exposure', n: 3 } }), c('energy-monthly', { binding: { kind: 'pinned', buildingIds: west.buildingIds.slice(0, 1) } })]),
    });
  }
  const sender = data.users.find((u) => u.id === 'u-admin' && u.id !== user.id) ?? data.users.find((u) => u.id !== user.id && u.status === 'active');
  if (sender) {
    out.push({
      ...base, id: 'c-received-review', name: 'Portfolio exposure review', kind: 'dashboard', scopeId: 'portfolio',
      createdAt: '2026-10-13T08:30:00', updatedAt: '2026-10-13T08:30:00', generatedAt: '2026-10-13T08:30:00',
      receivedFrom: { userId: sender.id, name: sender.name, at: '2026-10-13T08:30:00' },
      components: withIds([c('exposure-kpis'), c('asset-figures'), c('emissions-split')]),
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function seedThreads(data: Dataset, list: Workspace[]): Record<string, Msg[]> {
  const t: Record<string, Msg[]> = {};
  for (const w of list) {
    if (w.id === 'c-gresb-2026') {
      t[w.id] = [
        m('s1', 'user', 'text', 'Build our GRESB 2026 submission for the whole portfolio', '2026-07-20T10:12:00'),
        m('s2', 'assistant', 'question', 'GRESB 2026 reports on a calendar year. Which one should it cover?', '2026-07-20T10:12:05', { options: ['Calendar year 2025', 'Last 12 months'], answered: 'Calendar year 2025' }),
        m('s3', 'user', 'text', 'Calendar year 2025', '2026-07-20T10:12:30'),
        m('s4', 'assistant', 'steps', 'Built from the GRESB export template: the cover, the asset table and readiness by building.', '2026-07-20T10:13:10', { wsId: w.id }),
        m('s5', 'user', 'text', 'Send it to me and our consultant on the first of every month', '2026-07-20T10:19:40'),
        m('s6', 'assistant', 'edit', 'Scheduled monthly on the 1st, covering the year to date, to you and esg@greenledger-advisory.example. Each run says on its cover if data was incomplete.', '2026-07-20T10:20:00'),
      ];
    } else if (w.id === 'c-q3-board-pack') {
      t[w.id] = [
        m('q1', 'user', 'text', 'A board pack for Q3: the energy and ESG summary plus exposure by asset, quarterly to David and Priya', '2026-09-02T15:40:00'),
        m('q2', 'assistant', 'steps', 'Built from the portfolio energy and ESG summary, with exposure by asset added.', '2026-09-02T15:41:00', { wsId: w.id }),
      ];
    } else if (w.planId) {
      const p = data.plans.find((x) => x.id === w.planId)!;
      t[w.id] = [
        m('p1', 'user', 'text', `Create a carbon plan: ${p.strategy.toLowerCase()}. Conditions: ${p.conditions.join('; ').toLowerCase()}.`, w.createdAt),
        m('p2', 'assistant', 'steps', p.narrative, w.updatedAt, { wsId: w.id }),
      ];
    } else if (w.id === 'c-west-exposure') {
      const ranked = w.components.find((x) => x.type === 'exposure-ranked')!;
      t[w.id] = [
        m('w1', 'user', 'text', w.brief!, w.createdAt),
        m('w2', 'assistant', 'steps', 'Built for the group you named, which stays this workspace’s scope.', '2026-10-06T14:03:00', { wsId: w.id }),
        m('w3', 'user', 'text', 'Only my three worst buildings', '2026-10-09T16:29:00', { chips: [{ compId: ranked.id, label: 'Exposure by asset' }] }),
        m('w4', 'assistant', 'edit', 'Exposure by asset now follows a rule: the 3 buildings with the highest fine exposure in this scope. It re-picks them as the data changes.', '2026-10-09T16:30:00', { compId: ranked.id }),
      ];
    } else if (w.receivedFrom) {
      t[w.id] = [m('r1', 'assistant', 'note', `${w.receivedFrom.name} sent you this copy. It's yours to change; the conversation that built it stays with ${w.receivedFrom.name.split(' ')[0]}, so this thread starts clean.`, w.receivedFrom.at)];
    }
  }
  return t;
}
