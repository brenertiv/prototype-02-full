/**
 * The platform's calculations the workspace components and the assistant read. The assistant
 * chooses and arranges these; it never computes a number of its own (MOD-WS-41, SYS-AI-04).
 */
import { AS_OF } from '../data/rand';
import { buildingMonthly } from '../data/series';
import type { Building, Dataset, HealthItem } from '../data/types';
import { fmtDate, fmtMonth, fmtPct } from '../ui/format';
import type { Binding, ReportPeriod, RuleId } from './types';

export const nowIso = () => `${AS_OF}T${new Date().toTimeString().slice(0, 8)}`;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- Periods ---------- */

export const PERIODS: ReportPeriod[] = [
  { id: 'cy-2025', label: 'Calendar year 2025', from: '2025-01', to: '2025-12' },
  { id: 'last-12', label: 'Last 12 months (Oct 2025 – Sep 2026)', from: '2025-10', to: '2026-09' },
  { id: 'ytd-2026', label: '2026 year to date (Jan – Sep)', from: '2026-01', to: '2026-09' },
  { id: 'q3-2026', label: 'Q3 2026 (Jul – Sep)', from: '2026-07', to: '2026-09' },
  { id: 'cy-2024', label: 'Calendar year 2024', from: '2024-01', to: '2024-12' },
];
export const periodById = (id: string) => PERIODS.find((p) => p.id === id) ?? PERIODS[1];
export const periodText = (p: ReportPeriod) => `${fmtMonth(p.from)} – ${fmtMonth(p.to)}`;
export const DEFAULT_PERIOD = PERIODS[1];

/** Read a period from free text ("for 2025", "last 12 months", "Q3"). Null when the brief doesn't say. */
export function periodFromText(t: string): ReportPeriod | null {
  const s = t.toLowerCase();
  if (/\b2025\b/.test(s)) return PERIODS[0];
  if (/\b2024\b/.test(s)) return PERIODS[4];
  if (/last 12|past 12|last year|trailing|past year/.test(s)) return PERIODS[1];
  if (/year to date|ytd|this year|2026/.test(s)) return PERIODS[2];
  if (/\bq3\b|quarter/.test(s)) return PERIODS[3];
  if (/month/.test(s)) return PERIODS[1];
  return null;
}

/* ---------- Bindings (MOD-WS-51) ---------- */

export const RULE_LABEL: Record<RuleId, string> = {
  'worst-exposure': 'highest fine exposure',
  'worst-eui': 'highest energy use per square foot',
  'worst-coverage': 'lowest data coverage',
  'most-emissions': 'highest emissions',
};

export function applyBinding(binding: Binding | undefined, buildings: Building[]): Building[] {
  if (!binding || binding.kind === 'scope') return buildings;
  if (binding.kind === 'pinned') return buildings.filter((b) => binding.buildingIds.includes(b.id));
  const score = (b: Building) => {
    switch (binding.rule) {
      case 'worst-exposure':
        return b.exposure.potentialFine;
      case 'worst-eui':
        return b.siteEui === null ? -1 : b.siteEui / b.euiBenchmark;
      case 'worst-coverage':
        return b.tierByUtility.electricity === 0 ? -1 : 1 - b.coverage;
      case 'most-emissions':
        return b.emissions.scope1 + b.emissions.scope2 + b.emissions.scope3;
    }
  };
  return [...buildings].sort((a, b) => score(b) - score(a)).slice(0, binding.n);
}

export function bindingLabel(binding: Binding | undefined, lookup: (id: string) => string) {
  if (!binding || binding.kind === 'scope') return null;
  if (binding.kind === 'rule') return `Rule: ${binding.n} with the ${RULE_LABEL[binding.rule]}`;
  return `Pinned: ${binding.buildingIds.map(lookup).join(', ')}`;
}

/* ---------- Coverage statements (SYS-TRUST-23) ---------- */

export const hasData = (b: Building) => b.tierByUtility.electricity !== 0 && b.tierByUtility.electricity !== undefined;

export function coverText(included: number, of: number, noun = 'properties', excluded = 0) {
  const base = included === of ? `Totals include all ${of} ${noun}` : `Totals include ${included} of ${of} ${noun}; ${of - included} ${of - included === 1 ? 'is' : 'are'} missing data`;
  return excluded > 0 ? `${base}. ${excluded} more in this scope ${excluded === 1 ? "isn't" : "aren't"} available to you.` : `${base}.`;
}

export function tierMix(buildings: Building[]) {
  const counts = { none: 0, bills: 0, sub: 0, interval: 0, inst: 0 };
  buildings.forEach((b) => {
    const t = b.tierByUtility.electricity;
    if (t === 3) counts.inst++;
    else if (t === '2b') counts.interval++;
    else if (t === '2a') counts.sub++;
    else if (t === 1) counts.bills++;
    else counts.none++;
  });
  const n = buildings.length || 1;
  const parts: string[] = [];
  if (counts.bills) parts.push(`${Math.round((counts.bills / n) * 100)}% bills only`);
  if (counts.sub) parts.push(`${Math.round((counts.sub / n) * 100)}% submetered`);
  if (counts.interval) parts.push(`${Math.round((counts.interval / n) * 100)}% interval data`);
  if (counts.inst) parts.push(`${Math.round((counts.inst / n) * 100)}% instrumented`);
  if (counts.none) parts.push(`${Math.round((counts.none / n) * 100)}% not connected yet`);
  return parts.join(', ');
}

/* ---------- Reporting readiness (MOD-WS-10) ---------- */

export interface Readiness {
  ready: boolean;
  reasons: string[];
  items: HealthItem[];
  notApplicable?: boolean;
}

const openFor = (data: Dataset, b: Building, framework: string) =>
  data.health.filter((h) => h.buildingId === b.id && h.status === 'open' && h.frameworks.includes(framework) && h.severity !== 'low');

export function gresbReadiness(data: Dataset, b: Building): Readiness {
  const reasons: string[] = [];
  if (!hasData(b)) reasons.push('No energy data connected yet');
  else {
    if (b.coverage < 0.75) reasons.push(`Coverage is ${fmtPct(b.coverage)}, below GRESB's 75%`);
    if (b.historyMonths < 24) reasons.push(`${b.historyMonths} months of data; like-for-like needs 24`);
  }
  const items = openFor(data, b, 'GRESB');
  items.slice(0, 2).forEach((h) => reasons.push(`${h.problem}${h.utility ? ` (${h.utility})` : ''}`));
  return { ready: reasons.length === 0, reasons, items };
}

export function energyStarReadiness(data: Dataset, b: Building): Readiness {
  const reasons: string[] = [];
  if (!b.pmPropertyId) reasons.push('Not linked to Portfolio Manager');
  if (b.historyMonths < 12) reasons.push(`${b.historyMonths} of the 12 consecutive months needed`);
  const items = openFor(data, b, 'ENERGY STAR');
  items.slice(0, 2).forEach((h) => reasons.push(`${h.problem}${h.utility ? ` (${h.utility})` : ''}`));
  return { ready: reasons.length === 0, reasons, items };
}

export function localReadiness(data: Dataset, b: Building): Readiness & { policies: string[] } {
  const ps = data.policies.filter((p) => p.buildingId === b.id && p.applicable);
  if (!ps.length) return { ready: true, reasons: [], items: [], notApplicable: true, policies: [] };
  const reasons: string[] = [];
  ps.filter((p) => p.submission === 'Overdue').forEach((p) => reasons.push(`${p.name}: submission overdue since ${fmtDate(p.deadline)}`));
  if (b.historyMonths < 12 && ps.some((p) => p.submission === 'Due')) reasons.push(`${b.historyMonths} months of data for a submission due ${fmtDate(ps.find((p) => p.submission === 'Due')!.deadline)}`);
  return { ready: reasons.length === 0, reasons, items: [], policies: ps.map((p) => p.name) };
}

export type SyncState = 'in-sync' | 'out-of-sync' | 'not-linked';
export function esSync(data: Dataset, b: Building): { state: SyncState; reason: string } {
  if (!b.pmPropertyId) return { state: 'not-linked', reason: 'Not linked to Portfolio Manager' };
  const issue = data.health.find((h) => h.buildingId === b.id && h.status === 'open' && h.family === 'ENERGY STAR');
  const days = b.esLastSynced ? Math.round((Date.parse(AS_OF) - Date.parse(b.esLastSynced)) / 86400000) : null;
  if (days === null) return { state: 'out-of-sync', reason: 'Never synced' };
  if (issue) return { state: 'out-of-sync', reason: issue.problem };
  if (days > 35) return { state: 'out-of-sync', reason: `Last synced ${days} days ago` };
  return { state: 'in-sync', reason: `Synced ${fmtDate(b.esLastSynced)}` };
}

/* ---------- Energy over a period ---------- */

export function periodEnergy(data: Dataset, b: Building, p: ReportPeriod) {
  const series = buildingMonthly(data, b, 36).filter((m) => m.month >= p.from && m.month <= p.to);
  const measured = series.filter((m) => m.kwh !== null);
  const total = measured.reduce((a, m) => a + (m.kwh ?? 0), 0);
  const t = measured.reduce((a, m) => a + (m.tco2e ?? 0), 0);
  const cost = measured.reduce((a, m) => a + (m.cost ?? 0), 0);
  const all = b.emissions.scope1 + b.emissions.scope2 + b.emissions.scope3 || 1;
  return {
    months: series.length,
    monthsWithData: measured.length,
    kwh: measured.length ? total : null,
    cost: measured.length ? cost : null,
    tco2e: measured.length ? Math.round(t) : null,
    scope1: measured.length ? Math.round((t * b.emissions.scope1) / all) : null,
    scope2: measured.length ? Math.round((t * b.emissions.scope2) / all) : null,
    estimated: series.some((m) => m.estimated),
  };
}

/* ---------- GRESB export (MOD-WS-11): one value per column, units in their own columns ---------- */

export const GRESB_COLUMNS = [
  'Asset name', 'Asset ID', 'Country', 'City', 'Property type', 'Floor area', 'Floor area unit', 'Reporting scope', 'Period start', 'Period end',
  'Energy consumption', 'Energy unit', 'Months with data', 'Data coverage', 'Coverage unit', 'Like-for-like eligible', 'Scope 1 emissions', 'Scope 2 emissions', 'Emissions unit', 'Contains estimated values', 'Source', 'Ready to submit', 'Blocking reason',
];

export function gresbRows(data: Dataset, buildings: Building[], p: ReportPeriod, scopeName: string) {
  return buildings.map((b) => {
    const e = periodEnergy(data, b, p);
    const r = gresbReadiness(data, b);
    return {
      b,
      e,
      r,
      cells: [
        b.name, b.id, b.country, b.city, b.type, b.gfa, b.gfa === null ? '' : 'sq ft', scopeName, `${p.from}-01`, `${p.to}-${p.to.endsWith('02') ? '28' : ['04', '06', '09', '11'].some((m) => p.to.endsWith(m)) ? '30' : '31'}`,
        e.kwh, e.kwh === null ? '' : 'kWh', e.monthsWithData, hasData(b) ? Math.round(b.coverage * 100) : null, hasData(b) ? '%' : '', b.historyMonths >= 24 ? 'Yes' : 'No',
        e.scope1, e.scope2, e.scope1 === null ? '' : 'tCO2e', e.estimated ? 'Yes' : 'No', 'Utility bills, meters and ENERGY STAR Portfolio Manager', r.ready ? 'Yes' : 'No', r.reasons.join('; '),
      ] as (string | number | null)[],
    };
  });
}

/** Download rows as a CSV through a Blob. Unmeasured values are empty cells, never 0 (SYS-TRUST-10). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Plans ---------- */

export function planFigures(data: Dataset, planId: string) {
  const projects = data.projects.filter((p) => p.planId === planId);
  const capex = projects.reduce((a, p) => a + p.capex, 0);
  const savings = projects.reduce((a, p) => a + p.savingsUsd, 0);
  const tco2e = projects.reduce((a, p) => a + p.tco2e, 0);
  return { projects, capex, savings, tco2e, payback: savings ? Math.round((capex / savings) * 10) / 10 : null, estimated: projects.some((p) => p.estimated) };
}

/** Months a stale report has missed: bills issued after it was generated (ST-W05). */
export function newBillsSince(data: Dataset, buildingIds: string[], since: string | undefined) {
  if (!since) return 0;
  const set = new Set(buildingIds);
  return data.bills.filter((b) => set.has(b.buildingId) && b.issued > since.slice(0, 10)).length;
}
