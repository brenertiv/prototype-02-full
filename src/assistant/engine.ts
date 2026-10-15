/**
 * The simulated assistant: rule-based answers grounded in the dataset, with sources and
 * provenance (SYS-AI-04, 15 to 18). It chooses and arranges what the platform computed; it never
 * calculates a number of its own. Actions that write come back as confirm cards (SYS-AI-16).
 */
import type { CurrentUser } from '../data/store';
import { loadProfile } from '../data/series';
import type { Building, Dataset } from '../data/types';
import type { ScopeInfo } from '../nav/route';
import { fmtDate, fmtEnergy, fmtInt, fmtMoney, fmtPct, fmtT } from '../ui/format';
import { COMP_META, composeFromBrief, compTitle, PREBUILT_DEFS } from '../workspace/catalog';
import { energyStarReadiness, esSync, gresbReadiness, hasData, periodFromText, RULE_LABEL } from '../workspace/logic';
import { msg } from '../workspace/runtime';
import type { Cadence, Chip, CompSpec, CompType, Msg, RuleId, Workspace } from '../workspace/types';

export interface EngineIn {
  text: string;
  data: Dataset;
  user: CurrentUser;
  accessible: Set<string>;
  scope: ScopeInfo;
  ws?: Workspace;
  chips: Chip[];
  pageLabel: string;
  inner: string;
}

export interface CreateIntent {
  name: string;
  kind: Workspace['kind'];
  scopeId: string;
  scopeName: string;
  components: CompSpec[];
  brief: string;
  period?: Workspace['period'];
  framework?: string;
  ask?: { field: 'period' | 'framework'; text: string; options: string[] };
}

export interface EngineOut {
  reply: Msg[];
  create?: CreateIntent;
  edits?: { compId: string; label: string; partial: Partial<CompSpec>; note: string }[];
}

const a = (kind: Msg['kind'], text: string, extra: Partial<Msg> = {}) => msg('assistant', kind, text, extra);
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };

/* ---------- Recognising things in the question ---------- */

export function findBuilding(t: string, list: Building[]) {
  const s = t.toLowerCase();
  const full = [...list].sort((x, y) => y.name.length - x.name.length).find((b) => s.includes(b.name.toLowerCase()));
  if (full) return full;
  return list.find((b) => {
    const first = b.name.split(' ')[0].toLowerCase();
    return first.length >= 5 && new RegExp(`\\b${first}\\b`).test(s) && !['logistics', 'distribution', 'commerce'].includes(first);
  });
}

function findGroup(t: string, data: Dataset) {
  const s = t.toLowerCase();
  const exact = [...data.groups].sort((x, y) => y.name.length - x.name.length).find((g) => new RegExp(`\\b${g.name.toLowerCase()}\\b`).test(s));
  if (exact) return exact;
  return data.groups.find((g) => {
    const first = g.name.split(' ')[0].toLowerCase();
    return first.length >= 4 && new RegExp(`\\b${first}\\b`).test(s) && /region|coast|fund|group|program/.test(s);
  });
}

const inScope = (data: Dataset, scope: ScopeInfo) => data.buildings.filter((b) => scope.buildingIds.includes(b.id));

function scopeNote(e: EngineIn, mentionedOutside?: Building): Msg | null {
  if (mentionedOutside) return a('text', `You don’t have access to ${mentionedOutside.name}, so I can’t answer for it. Here’s the answer for the ${e.scope.buildingIds.length} buildings you can see in ${e.scope.name}.`, { tone: 'scope' });
  const wantsAll = /\b(all|every|whole|entire)\b.*\b(building|portfolio|asset)s?\b|\bportfolio\b/.test(e.text.toLowerCase());
  const total = e.data.buildings.length;
  const mine = e.data.buildings.filter((b) => e.accessible.has(b.id)).length;
  if (wantsAll && mine < total) return a('text', `You have access to ${mine} of the account’s ${total} buildings, so this covers those ${mine}. An Admin of ${e.data.company.name} can widen your access.`, { tone: 'scope' });
  if (e.scope.excluded > 0) return a('text', `${e.scope.excluded} buildings in ${e.scope.name} aren’t available to you, so this answer leaves them out.`, { tone: 'scope' });
  return null;
}

function noData(e: EngineIn, what: string): Msg {
  const bs = inScope(e.data, e.scope);
  const failing = e.data.accounts.filter((x) => bs.some((b) => b.id === x.buildingId) && (x.credentials === 'Failed' || x.enrolment !== 'Enrolled')).length;
  return a('text', `There’s no ${what} for ${e.scope.name} yet, so I can’t answer that. To get it, Enertiv needs energy data flowing: ${failing ? `${failing} utility accounts still need a working login or enrolment, ` : ''}or bills uploaded, or the buildings linked to ENERGY STAR Portfolio Manager.`, { tone: 'no-data', sources: [{ label: 'What’s missing, in Data Health', to: '/building-info/data-health' }] });
}

/* ---------- Editing a selected component (SYS-AI-20) ---------- */

function ruleFor(type: CompType): RuleId {
  if (type === 'eui-ranked' || type === 'energy-monthly') return 'worst-eui';
  if (type === 'coverage-gaps' || type === 'framework-readiness' || type === 'readiness-kpis' || type === 'data-problems') return 'worst-coverage';
  if (type === 'emissions-split' || type === 'goal-progress') return 'most-emissions';
  return 'worst-exposure';
}

export function editFor(text: string, comp: CompSpec, e: EngineIn): { partial: Partial<CompSpec>; note: string } | { cannot: string } | null {
  const t = text.toLowerCase();
  const views = COMP_META[comp.type].views;
  const title = compTitle(comp);
  const partial: Partial<CompSpec> = {};
  const notes: string[] = [];

  if (/\btable\b/.test(t)) {
    if (!views) return { cannot: `${title} is already a list or table, so there’s no other view of it. I can change its buildings or its period instead.` };
    partial.view = 'table';
    notes.push('shows as a table');
  } else if (/\b(chart|graph|bars?)\b/.test(t)) {
    if (!views) return { cannot: `${title} has no chart form. I can change which buildings it covers.` };
    partial.view = 'chart';
    notes.push('shows as a chart');
  }
  const year = t.match(/\badd (20\d\d)\b|\b(20\d\d)\b.*\b(too|as well|compare)/);
  if (year) {
    if (comp.type !== 'energy-monthly') return { cannot: `${title} covers the last 12 months only. Monthly energy can compare years; select it and ask again.` };
    const y = Number(year[1] ?? year[2]);
    if (y < 2023 || y > 2026) return { cannot: `Enertiv holds data from 2023 to 2026 for these buildings, so I can’t add ${y}.` };
    const ys = [...new Set([...(comp.years ?? [2026]), y])].sort();
    partial.years = ys;
    partial.period = 'monthly';
    partial.view = 'chart';
    notes.push(`compares ${ys.join(' and ')} month by month`);
  } else if (/\bmonthly\b|\bby month\b|\beach month\b/.test(t)) {
    if (comp.type !== 'energy-monthly') return { cannot: `${title} isn’t a time series, so it has no monthly view. Monthly energy use can be added as its own card.` };
    partial.period = 'monthly';
    partial.years = undefined;
    notes.push('shows each month');
  } else if (/\b(annual|yearly|by year|per year)\b/.test(t)) {
    if (comp.type !== 'energy-monthly') return { cannot: `${title} isn’t a time series, so it has no yearly view.` };
    partial.period = 'annual';
    partial.years = undefined;
    notes.push('shows totals by calendar year');
  }
  const worst = t.match(/\b(one|two|three|four|five|six|ten|\d+) (worst|highest|biggest|top)\b|\b(worst|top|highest) (one|two|three|four|five|six|ten|\d+)\b/);
  if (worst) {
    const word = worst[1] ?? worst[4];
    const n = NUM[word] ?? Number(word);
    const rule = /eui|square|intensity/.test(t) ? 'worst-eui' : /coverage|data/.test(t) ? 'worst-coverage' : /emission|carbon/.test(t) ? 'most-emissions' : ruleFor(comp.type);
    partial.binding = { kind: 'rule', rule, n };
    notes.push(`follows a rule: the ${n} buildings with the ${RULE_LABEL[rule]} in this scope, re-picked as the data changes`);
  }
  const scopeBs = e.data.buildings.filter((b) => e.scope.buildingIds.includes(b.id));
  const named = scopeBs.filter((b) => t.includes(b.name.toLowerCase()));
  if (named.length && /\bonly\b|\bpin\b|\bjust\b|\bfor\b/.test(t) && !worst) {
    partial.binding = { kind: 'pinned', buildingIds: named.map((b) => b.id) };
    notes.push(`is pinned to ${named.map((b) => b.name).join(' and ')}`);
  }
  if (/\b(all|every) (the )?buildings\b|\bwhole scope\b|\bremove the (rule|pin)\b|\bunpin\b/.test(t)) {
    partial.binding = { kind: 'scope' };
    notes.push('covers every building in the workspace’s scope again');
  }
  if (comp.type === 'energy-monthly') {
    if (/\bgas\b/.test(t)) { partial.utility = 'gas'; notes.push('shows gas only, from bills'); }
    else if (/\belectric/.test(t)) { partial.utility = 'electricity'; notes.push('shows electricity only, from bills'); }
    else if (/\ball (fuels|utilities|energy)\b/.test(t)) { partial.utility = undefined; notes.push('shows all energy'); }
    if (/\bcost|dollar|spend\b/.test(t)) { partial.metric = 'cost'; partial.utility = undefined; notes.push('shows cost'); }
    else if (/\bemission|carbon|co2\b/.test(t)) { partial.metric = 'tco2e'; partial.utility = undefined; notes.push('shows emissions'); }
  }
  if (comp.type === 'equipment-eol') {
    const w = t.match(/(\d+) years?/);
    if (w) { partial.window = Math.min(20, Math.max(1, Number(w[1]))); notes.push(`looks ${partial.window} years ahead`); }
  }
  const rename = text.match(/(?:rename (?:it |this )?to|call (?:it|this)) [“"']?([^”"']+)[”"']?/i);
  if (rename) { partial.title = rename[1].trim().slice(0, 60); notes.push(`is now called “${partial.title}”`); }

  if (!notes.length) return null;
  return { partial, note: `${title} now ${notes.join(', and ')}.` };
}

function explainComp(comp: CompSpec): Msg {
  const t = comp.type;
  const sources: Record<string, string> = {
    'exposure-kpis': 'Portfolio Diagnostics: the potential violation cost per building, with each benchmarking and BPS law that applies behind it',
    'exposure-ranked': 'Portfolio Diagnostics per building, ranked; open any figure for the policies behind it',
    'framework-readiness': 'coverage, months of history and open data problems per building, checked against each framework’s thresholds',
    'readiness-kpis': 'the same readiness checks, counted',
    'coverage-gaps': 'bills, meters and ENERGY STAR data per building and utility over the last 12 months',
    'es-sync': 'the ENERGY STAR link, last push and open ENERGY STAR problems per building',
    'energy-monthly': 'bills, interval meters and ENERGY STAR, summed per month across buildings with data that month',
    'emissions-split': 'billed and metered energy times grid and fuel factors, split by who controls each space',
    'data-problems': 'the Data Health checks on each building',
  };
  return a('text', `${compTitle(comp)} is built from ${sources[t] ?? 'the platform’s records for the buildings in this workspace’s scope'}. Every number on it opens its own provenance: select the figure to see the period and the calculation.`, { chips: [{ compId: comp.id, label: compTitle(comp) }] });
}

/* ---------- How do I (SYS-AI-18) ---------- */

const HOWTO: [RegExp, string, { label: string; to: string }?][] = [
  [/schedul|by email|every (day|week|month|quarter)|monthly email|email me/, 'Open a report workspace, such as Portfolio energy and ESG summary, and choose Schedule by email beside its title. Set how often, the period each run covers and who gets it. On a ready-made report the schedule goes on your own copy. You can also ask me: “email me an energy summary every month”.', { label: 'Portfolio energy and ESG summary', to: '/workspace/energy-esg-summary' }],
  [/share|send (it|this) to|colleague/, 'Share is in the top bar of any workspace. Your colleague gets their own copy, unlinked from yours, with a clean thread. Reports can also be emailed as a file.'],
  [/export|download|csv|spreadsheet/, 'Use More actions (the ⋮ button in the top bar) and choose Export as CSV. The GRESB export also has Download CSV above its table, one value per column with units in their own columns.', { label: 'GRESB export', to: '/workspace/gresb-export' }],
  [/scope|switch building|another building|change (the )?portfolio/, 'The scope picker at the top left of the canvas sets the portfolio, a group or one property. Pages follow it; a custom workspace keeps the scope it was made with.'],
  [/goal|target/, 'Carbon targets are set in Workspace: open Emissions and energy and use “Change the target” under Progress against your carbon target. Carbon plans read the same target.', { label: 'Emissions and energy', to: '/workspace/emissions-and-energy' }],
  [/new (workspace|dashboard|report)|make a (dashboard|report)|create a (dashboard|report)/, 'New is the first row under Custom Workspaces in the panel. Start from a template, describe what you need, or build a carbon plan; each asks for the scope it keeps.', { label: 'New workspace', to: '/workspace/new' }],
  [/data health|fix (a|the|my) (data|problem)|data problem/, 'Data problems are in Building Info › Data Health, each with its fix and who owns it. The badge on the panel header counts the open ones.', { label: 'Data Health', to: '/building-info/data-health' }],
  [/energy star|push|portfolio manager|sync/, 'ENERGY STAR sync and the manual push are on each building’s Utilities tab in Building Info, beside the meter mapping.', { label: 'Buildings in Building Info', to: '/building-info/buildings' }],
  [/acknowledge|alert/, 'Alerts are on the equipment record in Building Info, on its Alerts tab. You can also ask me to acknowledge one; I’ll ask you to confirm first.', { label: 'Equipment', to: '/building-info/equipment' }],
  [/approve|decline|plan/, 'Open the plan from Custom Workspaces; Approve plan and Decline plan sit beside its title while it’s under review.'],
  [/invite|add (a )?(user|person|teammate)/, 'Admins invite people from People › Team with Invite at the top of the panel.', { label: 'Team', to: '/people/team' }],
  [/edit|change (a|this) (card|chart|component)|customi[sz]e/, 'Select a card with its + button so it shows as a chip on the composer, then tell me what to change. Only that card changes. Ready-made workspaces need “Edit a copy” first.'],
];

/* ---------- The answer router ---------- */

export function respond(e: EngineIn): EngineOut {
  const t = e.text.toLowerCase().trim();
  const { data } = e;
  const bs = inScope(data, e.scope);
  const allBuildings = data.buildings;
  const mentioned = findBuilding(t, allBuildings);
  const outside = mentioned && !e.accessible.has(mentioned.id) ? mentioned : undefined;
  const b = mentioned && !outside ? mentioned : e.scope.kind === 'property' ? bs[0] : undefined;
  const withNote = (reply: Msg[]) => {
    const n = scopeNote(e, outside);
    return n ? [...reply, n] : reply;
  };

  // 1. Selected components: edit that item alone (SYS-AI-20).
  if (e.chips.length && e.ws) {
    const comps = e.chips.map((c) => e.ws!.components.find((x) => x.id === c.compId)).filter(Boolean) as CompSpec[];
    if (/where|come from|built from|source|how is|explain|what is this/.test(t)) return { reply: comps.map((c) => explainComp(c)) };
    const results = comps.map((c) => ({ c, r: editFor(e.text, c, e) }));
    const edits = results.filter((x) => x.r && 'partial' in x.r) as { c: CompSpec; r: { partial: Partial<CompSpec>; note: string } }[];
    if (edits.length && e.ws.prebuilt) {
      return { reply: [a('text', `${e.ws.name} is ready-made, so I can’t change it here. Edit a copy and I’ll make the change on yours; the original stays as it is for everyone.`, { action: { label: 'Edit a copy', kind: 'edit-copy', wsId: e.ws.id } })] };
    }
    if (edits.length) {
      return {
        reply: edits.map((x) => a('edit', x.r.note, { compId: x.c.id, chips: [{ compId: x.c.id, label: compTitle(x.c) }] })),
        edits: edits.map((x) => ({ compId: x.c.id, label: compTitle(x.c), partial: x.r.partial, note: x.r.note })),
      };
    }
    const cannot = results.find((x) => x.r && 'cannot' in x.r);
    if (cannot) return { reply: [a('text', (cannot.r as { cannot: string }).cannot)] };
    if (!/\?$/.test(t) && !/^(what|which|how|why|who|when)/.test(t)) {
      return { reply: [a('text', `I can change ${comps.map(compTitle).join(' and ')} in these ways: show it as a table or a chart, make it monthly or yearly, add a year to compare, follow a rule such as “only my three worst buildings”, or pin it to buildings you name. Which would you like?`)] };
    }
  }

  // 2. How do I…
  if (/^(how (do|can|would) i|how to|where (do|can|is|are)|can i|is there a way)/.test(t)) {
    const hit = HOWTO.find(([re]) => re.test(t));
    if (hit) return { reply: [a('text', hit[1], { sources: hit[2] ? [hit[2]] : undefined })] };
    return { reply: [a('text', 'I’m not sure which control that is. The panel on the left lists every page in the section you’re in, and the top bar holds the page’s own actions: Share, and More actions for the rest. Tell me what you’re trying to get done and I’ll point you to it.')] };
  }

  // 3. Writes: acknowledge an alert (confirm first, SYS-AI-16).
  if (/\back(nowledge)?\b/.test(t) && /alert/.test(t)) {
    const pool = data.alerts.filter((x) => bs.some((y) => y.id === x.buildingId) && !x.acknowledged && !x.resolved);
    const eq = data.equipment.find((x) => pool.some((p) => p.equipmentId === x.id) && t.includes(x.name.toLowerCase()));
    const target = pool.find((x) => (eq ? x.equipmentId === eq.id : b ? x.buildingId === b.id : true)) ?? (b ? undefined : pool.sort((x, y) => (x.severity === 'High' ? -1 : 1) - (y.severity === 'High' ? -1 : 1))[0]);
    if (!target) return { reply: withNote([a('text', b ? `There’s no unacknowledged alert at ${b.name}.` : `There’s no unacknowledged alert in ${e.scope.name}.`, { sources: [{ label: 'Equipment', to: '/building-info/equipment' }] })]) };
    const where = allBuildings.find((x) => x.id === target.buildingId)?.name;
    return { reply: withNote([a('confirm', `This acknowledges the alert for everyone who follows it. It stays open until it resolves.`, { confirm: { action: 'ack-alert', targetId: target.id, label: `Acknowledge “${target.title}” at ${where}`, state: 'pending' } })]) };
  }

  // 4. Schedule a summary by email (N11), confirm first because it sends.
  const cadenceMatch = t.match(/\b(daily|weekly|monthly|quarterly)\b|every (day|week|month|quarter)/);
  if (cadenceMatch && /email|send|schedule|inbox/.test(t)) {
    const word = cadenceMatch[1] ?? cadenceMatch[2];
    const cadence = ({ day: 'daily', week: 'weekly', month: 'monthly', quarter: 'quarterly' } as Record<string, Cadence>)[word] ?? (word as Cadence);
    const g = findGroup(t, data);
    const scopeId = g ? `group-${g.id}` : b && mentioned ? `property-${b.id}` : e.scope.id;
    const scopeName = g ? g.name : b && mentioned ? b.name : e.scope.name;
    return { reply: [a('confirm', `I’ll make your own copy of Portfolio energy and ESG summary for ${scopeName}, and email it to you ${cadence === 'daily' ? 'every day' : cadence === 'weekly' ? 'every Monday' : cadence === 'monthly' ? 'on the 1st of every month' : 'at the start of every quarter'}, each run covering the previous ${cadence === 'daily' ? 'day' : cadence.replace('ly', '')}. You can add colleagues from its Schedule control.`, { confirm: { action: 'schedule-report', targetId: `${cadence}|${scopeId}|${scopeName}`, label: `Schedule an energy summary ${cadence}`, state: 'pending' } })] };
  }

  // 5. Make me a dashboard / report (SYS-AI-17).
  if (/\b(make|build|create|generate|set up|give me|put together)\b.*\b(dashboard|report|workspace|view|export|board pack|pack)\b/.test(t)) {
    if (/carbon plan|capital plan/.test(t) && !data.entitlements.carbonPlanning) return { reply: [a('not-bought', 'Carbon Planning isn’t part of your account yet.')] };
    if (/carbon plan|capital plan/.test(t)) return { reply: [a('text', 'Carbon plans run the Create Plan wizard: choose a strategy, set the budget and duration, then the properties. The plan becomes its own workspace with its projects, pathway and fine exposure.', { sources: [{ label: 'Create a carbon plan', to: '/workspace/new?start=plan' }] })] };
    const g = findGroup(t, data);
    const scopeId = g ? `group-${g.id}` : b && mentioned ? `property-${b.id}` : e.scope.id;
    const scopeName = g ? g.name : b && mentioned ? b.name : e.scope.name;
    let components: CompSpec[];
    let kind: Workspace['kind'];
    const composed = composeFromBrief(e.text);
    if (/\b(this|these|it)\b/.test(t) && e.ws) {
      components = e.ws.components.map((c) => ({ ...c, binding: undefined }));
      kind = e.ws.kind === 'plan' ? 'dashboard' : e.ws.kind;
    } else if (/\b(this|these)\b/.test(t) && e.inner.startsWith('/building-info/data-health')) {
      components = [{ id: 'data-problems-0', type: 'data-problems' }, { id: 'coverage-gaps-1', type: 'coverage-gaps' }];
      kind = 'dashboard';
    } else if (/\b(this|these)\b/.test(t) && e.inner.startsWith('/building-info/equipment')) {
      components = [{ id: 'equipment-eol-0', type: 'equipment-eol', window: 5 }];
      kind = 'dashboard';
    } else {
      components = composed.components;
      kind = composed.kind;
    }
    const base = e.ws && /\b(this|these|it)\b/.test(t) ? e.ws.name.replace(/ \(my copy\)$/, '') : composed.name;
    return {
      reply: [],
      create: { name: `${base} · ${scopeName}`, kind, scopeId, scopeName, components, brief: e.text.trim(), period: composed.period ?? undefined, framework: composed.framework, ask: kind === 'report' ? composed.ask : undefined },
    };
  }

  // 6. Outside the entitlement (ST-A06).
  if (/carbon plan|capital plan|retrofit|pathway|decarboni|payback|capex|net zero/.test(t) && !data.entitlements.carbonPlanning) {
    return { reply: [a('not-bought', 'Carbon Planning isn’t part of your account yet, so I can’t build or read a plan. Your data is ready for it.')] };
  }
  if (/payback|capital project|capex|retrofit/.test(t)) {
    const ps = data.projects.filter((p) => bs.some((x) => x.id === p.buildingId) && p.status !== 'Complete').sort((x, y) => x.paybackYears - y.paybackYears);
    if (!ps.length) return { reply: withNote([a('text', `No carbon plan has projects in ${e.scope.name} yet. A plan adds them, with cost, savings and payback.`, { sources: [{ label: 'Create a carbon plan', to: '/workspace/new?start=plan' }] })]) };
    return { reply: withNote([a('text', `${ps.length} planned projects in ${e.scope.name}. The quickest paybacks:`, { items: ps.slice(0, 4).map((p) => ({ label: p.name, detail: `${allBuildings.find((x) => x.id === p.buildingId)?.name} · ${fmtMoney(p.capex, true)}${p.estimated ? ' (estimated)' : ''}, pays back in ${p.paybackYears} years`, to: p.equipmentId ? `/building-info/equipment/${p.equipmentId}` : undefined })), sources: [{ label: 'Capital projects', to: '/workspace/capital-projects' }] })]) };
  }
  if (/insight|saving opportunit/.test(t) && !data.entitlements.equipmentOptimization) {
    return { reply: [a('text', 'Insights come with Equipment Optimization, which isn’t part of your account. Ask your account team if you’d like it; your instrumented buildings would show insights straight away.', { tone: 'scope' })] };
  }

  // 7. Questions about the data.
  if (!bs.length) return { reply: [a('text', `You don’t have access to any building in ${e.scope.name}, so there’s nothing I can answer from here.`, { tone: 'scope' })] };

  // Exposure (J1)
  if (/expos|fine|penalt|\bbps\b|ll97|local law|violation|compliance risk/.test(t)) {
    const ranked = bs.filter((x) => x.exposure.status !== 'Not covered').sort((x, y) => y.exposure.potentialFine - x.exposure.potentialFine);
    if (!ranked.length) return { reply: withNote([a('text', `No benchmarking or BPS law that Enertiv tracks applies to the buildings in ${e.scope.name}, so there’s no fine exposure to report.`)]) };
    const top = b && mentioned ? b : ranked[0];
    const ps = data.policies.filter((p) => p.buildingId === top.id && p.applicable);
    if (!top.exposure.potentialFine) return { reply: withNote([a('text', `${top.name} has no fine at risk under ${ps.map((p) => p.name).join(' or ') || 'the laws that apply'}. ${ranked[0].exposure.potentialFine ? `The highest exposure in scope is ${ranked[0].name}.` : ''}`, { sources: [{ label: top.name, to: `/building-info/buildings/${top.id}` }] })]) };
    const lowCov = hasData(top) && top.coverage < 0.75;
    return {
      reply: withNote([
        a('text', `${mentioned ? top.name : `${top.name} has the highest exposure in ${e.scope.name}`}: a potential fine of ${fmtMoney(top.exposure.potentialFine)}, status ${top.exposure.status.toLowerCase()}. The number comes from Portfolio Diagnostics, built on ${ps.map((p) => p.name).join(' and ')}.${lowCov ? ` Its data coverage is ${fmtPct(top.coverage)}, so treat it as a floor: missing data could raise it.` : ''}`, {
          tone: lowCov ? 'low-confidence' : undefined,
          facts: [{ label: 'Potential fine', value: fmtMoney(top.exposure.potentialFine), info: { builtFrom: ['Portfolio Diagnostics: potential violation cost', ...ps.map((p) => `${p.name} (${p.type}, ${p.compliancePeriod})`)], period: ps.find((p) => p.type === 'BPS')?.compliancePeriod ?? 'Current compliance period', calculation: 'Fine for the compliance period at the current site EUI against each law’s limit, summed.', estimated: lowCov } }],
          items: mentioned ? undefined : ranked.slice(1, 4).map((x) => ({ label: x.name, detail: fmtMoney(x.exposure.potentialFine, true), to: `/building-info/buildings/${x.id}` })),
          sources: [{ label: `${top.name} in Building Info`, to: `/building-info/buildings/${top.id}` }, { label: 'Exposure by asset', to: '/workspace/exposure-by-asset' }],
        }),
      ]),
    };
  }

  // GRESB blockers (J2)
  if (/gresb/.test(t)) {
    const blocked = bs.map((x) => ({ x, r: gresbReadiness(data, x) })).filter((y) => !y.r.ready);
    if (!blocked.length) return { reply: withNote([a('text', `Nothing in ${e.scope.name} blocks GRESB: every building has at least 75% coverage, 24 months for like-for-like and no open problem that affects it.`, { sources: [{ label: 'Reporting readiness', to: '/workspace/reporting-readiness' }] })]) };
    return {
      reply: withNote([
        a('text', `${blocked.length} of ${bs.length} buildings would block a GRESB submission. GRESB needs 75% coverage and 24 months for like-for-like; these fall short:`, {
          items: blocked.slice(0, 6).map(({ x, r }) => ({ label: x.name, detail: r.reasons.slice(0, 2).join('; '), to: `/building-info/data-health?framework=GRESB&building=${x.id}` })),
          sources: [{ label: 'GRESB problems in Data Health', to: '/building-info/data-health?framework=GRESB' }, { label: 'Reporting readiness', to: '/workspace/reporting-readiness' }],
        }),
        ...(blocked.length > 6 ? [a('text', `And ${blocked.length - 6} more; Reporting readiness lists them all.`)] : []),
      ]),
    };
  }

  // ENERGY STAR score and sync
  if (/energy star|portfolio manager|\bes score\b|star score/.test(t)) {
    if (b) {
      const s = esSync(data, b);
      const r = energyStarReadiness(data, b);
      const score = b.energyStarScore;
      return {
        reply: withNote([
          a('text', `${b.name}: ${score === null ? `no ENERGY STAR score yet${b.historyMonths < 12 ? `, because it has ${b.historyMonths} of the 12 months of data a score needs` : r.reasons.length ? `: ${r.reasons[0].toLowerCase()}` : '; Portfolio Manager hasn’t returned one, and some property types can’t be scored'}` : `ENERGY STAR score ${score}`}. ${s.state === 'not-linked' ? 'It isn’t linked to Portfolio Manager.' : `Last synced ${b.esLastSynced ? fmtDate(b.esLastSynced) : 'never'}${b.esDirection ? `, ${b.esDirection}` : ''}; ${s.state === 'in-sync' ? 'in sync' : `out of sync: ${s.reason.toLowerCase()}`}.`}`, {
            facts: score === null ? undefined : [{ label: 'ENERGY STAR score', value: String(score), info: { builtFrom: ['ENERGY STAR Portfolio Manager', '12 months of whole-building energy'], period: 'The latest 12 months Portfolio Manager scored', calculation: 'Portfolio Manager’s 1 to 100 score for the property type; Enertiv reads it, it doesn’t compute it.' } }],
            sources: [{ label: `${b.name} Utilities tab`, to: `/building-info/buildings/${b.id}?tab=utilities` }],
          }),
        ]),
      };
    }
    const states = bs.map((x) => ({ x, s: esSync(data, x) }));
    const out = states.filter((y) => y.s.state !== 'in-sync');
    return {
      reply: withNote([
        a('text', `${states.length - out.length} of ${states.length} buildings in ${e.scope.name} are in sync with ENERGY STAR.${out.length ? ' These need a look:' : ''} Name a building to get its score.`, {
          items: out.slice(0, 6).map(({ x, s }) => ({ label: x.name, detail: s.reason, to: `/building-info/buildings/${x.id}?tab=utilities` })),
          sources: [{ label: 'Reporting readiness', to: '/workspace/reporting-readiness' }],
        }),
      ]),
    };
  }

  // Accounts we can't get data from
  if (/can'?t get|cannot get|unable to get|not getting|login|credential|failing|failed|extraction|which accounts|utility account/.test(t)) {
    const failing = data.accounts.filter((x) => bs.some((y) => y.id === x.buildingId) && !x.closed && (x.credentials === 'Failed' || x.extraction === 'Failed' || x.enrolment === 'Not enrolled'));
    if (!failing.length) return { reply: withNote([a('text', `Every open utility account in ${e.scope.name} is extracting. Nothing is blocked on a login.`, { sources: [{ label: 'Data Health', to: '/building-info/data-health' }] })]) };
    return {
      reply: withNote([
        a('text', `Enertiv can’t get data from ${failing.length} ${failing.length === 1 ? 'account' : 'accounts'} in ${e.scope.name}:`, {
          items: failing.slice(0, 8).map((x) => ({ label: `${x.provider} ${x.utility} ···${x.accountNumber.slice(-4)}`, detail: `${allBuildings.find((y) => y.id === x.buildingId)?.name} · ${x.credentials === 'Failed' ? 'login rejected' : x.enrolment === 'Not enrolled' ? 'not enrolled' : 'extraction failed'}${x.lastSuccessful ? `, last successful ${fmtDate(x.lastSuccessful)}` : ''}${x.holder !== 'landlord' ? ', tenant-held' : ''}`, to: `/building-info/buildings/${x.buildingId}?tab=utilities` })),
          sources: [{ label: 'Utility logins in Data Health', to: '/building-info/data-health' }],
        }),
        ...(failing.length > 8 ? [a('text', `And ${failing.length - 8} more in Data Health.`)] : []),
      ]),
    };
  }

  // How complete is a building's data
  if (/complete|coverage|how much data|data quality|gaps?\b/.test(t)) {
    if (b) {
      if (!hasData(b)) return { reply: withNote([noData({ ...e, scope: { ...e.scope, name: b.name, buildingIds: [b.id] } }, 'energy data')]) };
      const open = data.health.filter((h) => h.buildingId === b.id && h.status === 'open');
      return {
        reply: withNote([
          a('text', `${b.name}: coverage ${fmtPct(b.coverage)} and completeness ${fmtPct(b.completeness)} over the last 12 months, with ${b.historyMonths} months of history. Coverage is how much of the building and its sold utilities has data; completeness is how much of the expected data arrived. ${open.length ? `${open.length} open data ${open.length === 1 ? 'problem affects' : 'problems affect'} it, starting with “${open[0].problem}”.` : 'No open data problems.'}`, {
            facts: [
              { label: 'Coverage', value: fmtPct(b.coverage), info: { builtFrom: ['Bills, meters and ENERGY STAR per utility'], period: 'Last 12 months', calculation: 'Share of floor area and sold utilities, landlord and tenant, with data.' } },
              { label: 'Completeness', value: fmtPct(b.completeness), info: { builtFrom: ['Expected against received bills and readings'], period: 'Last 12 months', calculation: 'Share of expected data points that arrived, judged against occupancy.' } },
            ],
            sources: [{ label: `${b.name} in Data Health`, to: `/building-info/data-health?building=${b.id}` }],
          }),
        ]),
      };
    }
    const connected = bs.filter(hasData);
    if (!connected.length) return { reply: withNote([noData(e, 'energy data')]) };
    const low = [...connected].sort((x, y) => x.coverage - y.coverage).slice(0, 3);
    return { reply: withNote([a('text', `Across ${connected.length} connected buildings in ${e.scope.name}, the lowest coverage is at:`, { items: low.map((x) => ({ label: x.name, detail: `coverage ${fmtPct(x.coverage)}, completeness ${fmtPct(x.completeness)}`, to: `/building-info/data-health?building=${x.id}` })), sources: [{ label: 'Coverage gaps', to: '/workspace/reporting-readiness' }] })]) };
  }

  // Peak demand: interval data only, low confidence otherwise (ST-A07)
  if (/peak|demand|load profile|kw\b/.test(t)) {
    const target = b ?? bs.find((x) => x.tierByUtility.electricity === '2b' || x.tierByUtility.electricity === 3) ?? bs[0];
    if (target.tierByUtility.electricity !== '2b' && target.tierByUtility.electricity !== 3) {
      return { reply: withNote([a('text', `I can’t give ${target.name}’s peak demand with confidence: it has monthly utility bills only, no interval data, so the peak inside each month isn’t measured. The bills’ demand charges are the closest source.`, { tone: 'low-confidence', sources: [{ label: `${target.name} bills`, to: '/building-info/bills' }] })]) };
    }
    const p = loadProfile(target);
    const peak = Math.max(...p.map((x) => x.kw));
    const at = p.find((x) => x.kw === peak)?.t;
    return { reply: withNote([a('text', `${target.name} peaks at about ${fmtInt(peak)} kW on a typical weekday, around ${at}.`, { facts: [{ label: 'Peak demand', value: `${fmtInt(peak)} kW`, info: { builtFrom: [`15-minute interval data, ${target.name}`], period: 'A typical weekday, last 30 days', calculation: 'Highest 15-minute demand.' } }], sources: [{ label: 'Load profiles', to: '/workspace/load-profiles' }] })]) };
  }

  // Forecasts: low confidence (ST-A07)
  if (/forecast|predict|next year|will (we|i|it)|going to|projection/.test(t)) {
    return { reply: [a('text', 'I can’t forecast that with confidence: Enertiv reports measured and billed data, and a projection would be my guess rather than the platform’s number. The trend over the last 24 months is the most reliable thing I can show you.', { tone: 'low-confidence', sources: [{ label: 'Emissions and energy', to: '/workspace/emissions-and-energy' }] })] };
  }

  // Energy per square foot (N8)
  if (/per square|eui|intensity|most energy|least efficient|worst performing/.test(t)) {
    const ranked = bs.filter((x) => x.siteEui !== null && x.gfa).sort((x, y) => (y.siteEui ?? 0) - (x.siteEui ?? 0));
    if (!ranked.length) return { reply: withNote([noData(e, 'energy use per square foot (it needs 12 months of energy and the floor area)')]) };
    const top = ranked[0];
    return { reply: withNote([a('text', `${top.name} used the most energy per square foot over the last 12 months: ${fmtInt(top.siteEui)} kBtu/ft², against a benchmark of ${top.euiBenchmark} for its property type.${ranked.length < bs.length ? ` ${bs.length - ranked.length} buildings aren’t ranked: no floor area or not enough data.` : ''}`, { facts: [{ label: 'Site EUI', value: `${fmtInt(top.siteEui)} kBtu/ft²`, info: { builtFrom: ['Whole-building energy, all fuels', `Gross floor area ${fmtInt(top.gfa)} ft²`], period: 'Last 12 months', calculation: 'Site energy in kBtu divided by floor area.' } }], items: ranked.slice(1, 4).map((x) => ({ label: x.name, detail: `${fmtInt(x.siteEui)} kBtu/ft²`, to: `/building-info/buildings/${x.id}` })), sources: [{ label: 'Emissions and energy', to: '/workspace/emissions-and-energy' }] })]) };
  }

  // Emissions
  if (/emission|carbon|co2|scope [123]|ghg/.test(t)) {
    const connected = (b ? [b] : bs).filter(hasData);
    if (!connected.length) return { reply: withNote([noData(e, 'emissions data')]) };
    const total = connected.reduce((s, x) => s + x.emissions.scope1 + x.emissions.scope2 + x.emissions.scope3, 0);
    const landlord = connected.reduce((s, x) => s + (x.emissions.scope1 + x.emissions.scope2 + x.emissions.scope3) * x.emissions.landlordShare, 0);
    return { reply: withNote([a('text', `${b ? b.name : e.scope.name} emitted ${fmtT(total)} over the last 12 months, ${Math.round((landlord / total) * 100)}% of it in landlord-controlled space.${!b && connected.length < bs.length ? ` That covers ${connected.length} of ${bs.length} buildings; the rest have no data yet.` : ''}`, { facts: [{ label: 'Emissions', value: fmtT(total), info: { builtFrom: ['Billed and metered energy', 'Grid and fuel emission factors'], period: 'Last 12 months', calculation: 'Scope 1, 2 and 3 summed.', coverage: `${connected.length} of ${(b ? [b] : bs).length} buildings` } }], sources: [{ label: 'Emissions and energy', to: '/workspace/emissions-and-energy' }] })]) };
  }

  // Energy use
  if (/energy|consumption|kwh|usage|utility cost|spend/.test(t)) {
    const target = b ? [b] : bs;
    const connected = target.filter(hasData);
    if (!connected.length) return { reply: withNote([noData(e, 'energy data')]) };
    const kwh = connected.reduce((s, x) => s + x.energyKwh, 0);
    const cost = connected.reduce((s, x) => s + x.energyCost, 0);
    const low = b && b.coverage < 0.75;
    return { reply: withNote([a('text', `${b ? b.name : e.scope.name} used ${fmtEnergy(kwh)} and spent ${fmtMoney(cost, true)} on energy over the last 12 months.${low ? ` Coverage there is ${fmtPct(b!.coverage)}, so this is likely low; I’d check the bills before quoting it.` : ''}${!b && connected.length < target.length ? ` That covers ${connected.length} of ${target.length} buildings.` : ''}`, { tone: low ? 'low-confidence' : undefined, facts: [{ label: 'Energy', value: fmtEnergy(kwh), info: { builtFrom: ['Utility bills', 'Interval meters', 'ENERGY STAR'], period: 'Last 12 months', calculation: 'Sum across sold utilities, converted to kWh.', estimated: low || undefined } }], sources: [{ label: b ? `${b.name} bills` : 'Bills', to: '/building-info/bills' }] })]) };
  }

  // What to fix first (PM)
  if (/fix|problem|issue|wrong|broken|to do|todo/.test(t)) {
    const open = data.health.filter((h) => bs.some((x) => x.id === h.buildingId) && h.status === 'open').sort((x, y) => ({ high: 0, medium: 1, low: 2 })[x.severity] - ({ high: 0, medium: 1, low: 2 })[y.severity]);
    if (!open.length) return { reply: withNote([a('text', `Nothing is open in ${e.scope.name}. New problems show up in Data Health as the checks find them.`)]) };
    return { reply: withNote([a('text', `${open.length} data problems are open in ${e.scope.name}. Start with these:`, { items: open.slice(0, 5).map((h) => ({ label: `${h.problem} · ${allBuildings.find((x) => x.id === h.buildingId)?.name}`, detail: `${h.fix} (${h.owner === 'You' ? 'yours' : h.owner})`, to: `/building-info/data-health?item=${h.id}` })), sources: [{ label: 'Data problems to fix', to: '/workspace/data-problems' }] })]) };
  }

  // Insights
  if (/insight|saving/.test(t)) {
    const list = data.insights.filter((i) => bs.some((x) => x.id === i.buildingId)).sort((x, y) => y.valueUsd - x.valueUsd);
    if (!list.length) return { reply: withNote([a('text', `There are no insights in ${e.scope.name}. Insights need instrumented buildings, with sensors or a BMS connected.`, { tone: 'no-data' })]) };
    return { reply: withNote([a('text', `The most valuable open insight is “${list[0].title}” at ${allBuildings.find((x) => x.id === list[0].buildingId)?.name}, worth about ${fmtMoney(list[0].valueUsd)} a year (estimated).`, { items: list.slice(1, 4).map((i) => ({ label: i.title, detail: fmtMoney(i.valueUsd, true), to: '/workspace/insights' })), sources: [{ label: 'Insights', to: '/workspace/insights' }] })]) };
  }

  // A template by name
  const template = PREBUILT_DEFS.find((d) => t.includes(d.name.toLowerCase()));
  if (template) return { reply: [a('text', `${template.name}: ${template.question}`, { sources: [{ label: `Open ${template.name}`, to: `/workspace/${template.id}` }] })] };

  if (periodFromText(t) && e.ws?.status === 'waiting') return { reply: [] };

  return {
    reply: [
      a('text', `I can answer questions about ${e.scope.name} from the platform’s data, with the source for every number: fine exposure, what blocks GRESB, ENERGY STAR scores and sync, coverage and completeness, accounts we can’t get data from, emissions and energy. I can also build a dashboard or report (“make me a dashboard of exposure for the West region”), or point you to a control (“how do I schedule a report?”).`),
    ],
  };
}
