/**
 * Time series derived from a building's synthetic record: monthly energy, cost and emissions,
 * the ENERGY STAR writer per period (MOD-BI-63), and interval load profiles at tier 2b and 3
 * (MOD-WS-17). Never-measured months are null, never zero (SYS-TRUST-10).
 */
import { AS_OF, addMonths, hashString, makeRng } from './rand';
import type { Building, Dataset, MonthPoint, Utility } from './types';

export function monthsBack(n: number, from = AS_OF): string[] {
  const start = `${from.slice(0, 7)}-01`;
  return Array.from({ length: n }, (_, k) => addMonths(start, -(n - k)).slice(0, 7));
}

export function buildingMonthly(data: Dataset, b: Building, n = 24): MonthPoint[] {
  const rng = makeRng(hashString(b.id + data.scenario));
  const months = monthsBack(n);
  const integration = b.integrationDate.slice(0, 7);
  const firstData = addMonths(`${AS_OF.slice(0, 7)}-01`, -b.historyMonths).slice(0, 7);
  const overlap = data.health.some((h) => h.buildingId === b.id && h.problem === 'ENERGY STAR meter overlap');
  const gap = data.health.some((h) => h.buildingId === b.id && h.problem === 'ENERGY STAR meter data gap');
  const missing = new Set(
    data.health
      .filter((h) => h.buildingId === b.id && (h.problem === 'Missing bill' || h.problem === 'Bill is late') && h.status === 'open')
      .map((h) => h.evidence.match(/\d{4}-\d{2}/)?.[0])
      .filter(Boolean) as string[],
  );
  const base = b.energyKwh / 12;
  const costRate = b.energyKwh ? b.energyCost / b.energyKwh : 0.15;
  const totalT = b.emissions.scope1 + b.emissions.scope2 + b.emissions.scope3;
  const tPerKwh = b.energyKwh ? totalT / b.energyKwh : 0.0003;

  return months.map((month, k) => {
    const m = Number(month.slice(5, 7)) - 1;
    const season = 1 + 0.22 * Math.cos(((m - 6.5) / 12) * 2 * Math.PI) + 0.12 * Math.cos(((m - 0.5) / 12) * 2 * Math.PI);
    const trend = 1 - (n - k) * 0.002;
    const measured = month >= firstData && b.tierByUtility.electricity !== 0;
    const isMissing = missing.has(month);
    const kwh = measured && !isMissing ? Math.round(base * season * trend * rng.float(0.94, 1.06)) : null;
    let writer: MonthPoint['writer'] = month < integration ? 'client' : 'enertiv';
    if (!measured) writer = 'missing';
    if (overlap && (month === integration || month === addMonths(`${integration}-01`, 1).slice(0, 7))) writer = 'both';
    if (gap && k === n - 7) writer = 'missing';
    if (isMissing) writer = 'missing';
    return {
      month,
      kwh,
      cost: kwh === null ? null : Math.round(kwh * costRate),
      tco2e: kwh === null ? null : Math.round(kwh * tPerKwh * 10) / 10,
      estimated: kwh !== null && rng.chance(0.07),
      writer,
    };
  });
}

/** Portfolio roll-up that states what it covers (SYS-TRUST-23). */
export function portfolioMonthly(data: Dataset, buildings: Building[], n = 24) {
  const per = buildings.map((b) => buildingMonthly(data, b, n));
  const months = monthsBack(n);
  return months.map((month, k) => {
    let kwh = 0;
    let cost = 0;
    let tco2e = 0;
    let covered = 0;
    let estimated = false;
    per.forEach((series) => {
      const p = series[k];
      if (p.kwh !== null) {
        kwh += p.kwh;
        cost += p.cost ?? 0;
        tco2e += p.tco2e ?? 0;
        covered++;
      }
      if (p.estimated) estimated = true;
    });
    return { month, kwh, cost, tco2e: Math.round(tco2e), covered, of: buildings.length, estimated };
  });
}

/** A day of 15-minute interval demand, kW, for tier 2b and 3 buildings (MOD-WS-17, MOD-BI-51). */
export function loadProfile(b: Building, seedKey = 'day') {
  const rng = makeRng(hashString(b.id + seedKey));
  const peak = ((b.energyKwh / 8760) * 2.1) || 100;
  return Array.from({ length: 96 }, (_, k) => {
    const h = k / 4;
    const occ = h >= 7 && h < 19 ? 1 : h >= 5 && h < 7 ? (h - 5) / 2 : h >= 19 && h < 22 ? 1 - (h - 19) / 3 : 0;
    const kw = peak * (0.28 + 0.66 * occ) * rng.float(0.95, 1.05);
    const hh = String(Math.floor(h)).padStart(2, '0');
    const mm = String((k % 4) * 15).padStart(2, '0');
    return { t: `${hh}:${mm}`, kw: Math.round(kw) };
  });
}

/** Monthly readings for one meter, derived from its bills when it has an account. */
export function meterReadings(data: Dataset, meterId: string) {
  const m = data.meters.find((x) => x.id === meterId);
  if (!m) return [];
  const acct = m.accountId;
  if (acct) {
    return data.bills
      .filter((b) => b.accountId === acct)
      .sort((a, b) => b.start.localeCompare(a.start))
      .map((b) => ({ period: `${b.start} – ${b.end}`, value: b.consumption, unit: b.unit, source: b.source === 'Uploaded' ? 'Uploaded bill' : 'Utility bill', estimated: b.estimated }));
  }
  const rng = makeRng(hashString(meterId));
  return monthsBack(12)
    .reverse()
    .map((month) => ({ period: month, value: Math.round(rng.float(8000, 60000)), unit: m.unit, source: 'Portfolio Manager', estimated: rng.chance(0.05) }));
}

export const UTILITY_LABEL: Record<Utility, string> = { electricity: 'Electricity', gas: 'Gas', water: 'Water', steam: 'Steam' };
