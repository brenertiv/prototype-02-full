/** Number, unit and date formats (`02-building/design-system/content-and-terminology.md`). */

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'));

export function fmtNum(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtMoney(n: number | null | undefined, compact = false) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}k`;
  }
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function fmtPct(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/** kWh to a readable energy figure. */
export function fmtEnergy(kwh: number | null | undefined) {
  if (kwh === null || kwh === undefined) return '—';
  if (kwh >= 1e6) return `${fmtNum(kwh / 1e6, 1)} GWh`;
  if (kwh >= 1e3) return `${fmtNum(kwh / 1e3, 0)} MWh`;
  return `${fmtInt(kwh)} kWh`;
}

export const fmtT = (t: number | null | undefined) => (t === null || t === undefined ? '—' : `${fmtInt(t)} tCO₂e`);

export function fmtArea(sqft: number | null | undefined, units: 'imperial' | 'metric' = 'imperial') {
  if (sqft === null || sqft === undefined) return '—';
  return units === 'metric' ? `${fmtInt(sqft * 0.0929)} m²` : `${fmtInt(sqft)} ft²`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function fmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const time = iso.length > 10 ? iso.slice(11, 16) : '';
  return `${fmtDate(iso)}${time ? `, ${time}` : ''}`;
}

/** "3 days ago" against the snapshot date. */
export function fmtAgo(iso: string | null | undefined, asOf = '2026-10-15') {
  if (!iso) return '—';
  const days = Math.round((Date.parse(asOf) - Date.parse(iso.slice(0, 10))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const tierLabel = (t: number | string | null | undefined) => (t === null || t === undefined ? '—' : `Tier ${t}`);
