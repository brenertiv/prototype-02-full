/**
 * The jobs offered at first login and on Profile (SYS-ONB-01, SYS-PERS-03). Written as outcomes the
 * user recognises; each carries a persona weight, and the persona is derived from the chosen jobs
 * and the title, never asked for as a label.
 */
import type { PersonaId } from '../data/types';
import { titleGroupFor } from '../people/common';

export interface Job {
  id: string;
  label: string;
  detail: string;
  icon: string;
  weights: Partial<Record<Exclude<PersonaId, 'none'>, number>>;
}

export const JOBS: Job[] = [
  { id: 'reporting-readiness', label: 'See which buildings are ready to report', detail: 'And what’s missing for GRESB, ENERGY STAR or a local law', icon: 'fact_check', weights: { sl: 2 } },
  { id: 'coverage-gaps', label: 'Find gaps in our utility data', detail: 'Missing bills, meters and tenant consumption', icon: 'data_alert', weights: { sl: 2, pm: 1 } },
  { id: 'energy-star-sync', label: 'Keep ENERGY STAR in sync', detail: 'Scores, meters and what was sent to Portfolio Manager', icon: 'sync', weights: { sl: 2 } },
  { id: 'exposure-by-asset', label: 'Know our exposure, cost and carbon by asset', detail: 'One number per building I can defend', icon: 'monitoring', weights: { am: 2 } },
  { id: 'compliance-deadlines', label: 'Stay ahead of compliance deadlines and fines', detail: 'Benchmarking and building performance laws', icon: 'gavel', weights: { am: 1, pm: 1, sl: 1 } },
  { id: 'emissions-pathway', label: 'Track our emissions against our target', detail: 'The pathway to net zero, building by building', icon: 'trending_down', weights: { sl: 1, am: 1 } },
  { id: 'capital-plan', label: 'Build a capital plan', detail: 'Which projects, when, and what they save', icon: 'account_balance', weights: { am: 2 } },
  { id: 'data-problems', label: 'Fix the data problems on my buildings', detail: 'Failing logins, missing bills, meters that went quiet', icon: 'build', weights: { pm: 2 } },
  { id: 'tenant-requests', label: 'Get tenants to send what they owe', detail: 'Bills, logins and letters of authorisation', icon: 'outgoing_mail', weights: { pm: 2 } },
];

const PREDICT: Record<Exclude<PersonaId, 'none'>, string[]> = {
  sl: ['reporting-readiness', 'coverage-gaps', 'energy-star-sync', 'emissions-pathway'],
  am: ['exposure-by-asset', 'capital-plan', 'emissions-pathway', 'compliance-deadlines'],
  pm: ['data-problems', 'tenant-requests', 'coverage-gaps', 'compliance-deadlines'],
};

/** The persona a title starts from (SYS-PERS-03 table); engineering with web access starts as a PM. */
export function personaFromTitle(title: string | null | undefined): PersonaId {
  const g = titleGroupFor(title);
  if (!g) return 'none';
  return g.persona === 'none' ? 'pm' : g.persona;
}

export function predictedJobs(title: string | null | undefined): string[] {
  const p = personaFromTitle(title);
  return p === 'none' ? [] : PREDICT[p];
}

/** Derive the persona from the chosen jobs, with the title breaking ties. */
export function derivePersona(jobs: string[], title: string | null | undefined): PersonaId {
  const score: Record<'am' | 'sl' | 'pm', number> = { am: 0, sl: 0, pm: 0 };
  jobs.forEach((id) => {
    const j = JOBS.find((x) => x.id === id);
    if (j) (Object.entries(j.weights) as ['am' | 'sl' | 'pm', number][]).forEach(([p, w]) => (score[p] += w));
  });
  const fromTitle = personaFromTitle(title);
  if (fromTitle !== 'none') score[fromTitle] += 0.5;
  const best = (Object.entries(score) as ['am' | 'sl' | 'pm', number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'none';
}
