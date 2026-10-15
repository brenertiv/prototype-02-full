/**
 * Synthetic scenario data for SC-1 to SC-6 (`02-building/journeys-and-prototypes/prototype-data.md`).
 * Type-correct, deterministic and fake: every name, address and account number is invented
 * (JNY-DATA-04). A masked snapshot would replace this through the build-time pull (JNY-DATA-13).
 */
import { AS_OF, addDays, addMonths, daysAgo, makeRng, type Rng } from './rand';
import type {
  Accolade,
  ActivityItem,
  Alert,
  AlertRule,
  Bill,
  Building,
  ChaseRequest,
  Company,
  Dataset,
  Entitlements,
  Equipment,
  FileRec,
  GoldLine,
  Goal,
  Group,
  HealthItem,
  Insight,
  ManagementCompany,
  Meter,
  Notice,
  Plan,
  Policy,
  Project,
  ScenarioId,
  Space,
  Team,
  Tenant,
  Tier,
  User,
  Utility,
  UtilityAccount,
  Vendor,
} from './types';

interface City {
  city: string;
  state: string;
  zip: string;
  tz: string;
  lat: number;
  lng: number;
  policies: { name: string; type: 'Benchmarking' | 'BPS'; year: number }[];
  region: 'East' | 'Central' | 'West' | 'South';
}

const OFFICE_CITIES: City[] = [
  { city: 'New York', state: 'NY', zip: '10017', tz: 'America/New_York', lat: 40.75, lng: -73.98, region: 'East', policies: [{ name: 'Local Law 84 benchmarking', type: 'Benchmarking', year: 2009 }, { name: 'Local Law 97 emissions limits', type: 'BPS', year: 2019 }] },
  { city: 'Boston', state: 'MA', zip: '02110', tz: 'America/New_York', lat: 42.36, lng: -71.05, region: 'East', policies: [{ name: 'BERDO 2.0', type: 'BPS', year: 2021 }] },
  { city: 'Washington', state: 'DC', zip: '20005', tz: 'America/New_York', lat: 38.9, lng: -77.03, region: 'East', policies: [{ name: 'DC benchmarking', type: 'Benchmarking', year: 2008 }, { name: 'DC BEPS', type: 'BPS', year: 2018 }] },
  { city: 'Philadelphia', state: 'PA', zip: '19103', tz: 'America/New_York', lat: 39.95, lng: -75.17, region: 'East', policies: [{ name: 'Philadelphia benchmarking', type: 'Benchmarking', year: 2012 }] },
  { city: 'Atlanta', state: 'GA', zip: '30308', tz: 'America/New_York', lat: 33.77, lng: -84.38, region: 'South', policies: [{ name: 'Atlanta commercial buildings ordinance', type: 'Benchmarking', year: 2015 }] },
  { city: 'Chicago', state: 'IL', zip: '60606', tz: 'America/Chicago', lat: 41.88, lng: -87.64, region: 'Central', policies: [{ name: 'Chicago energy benchmarking', type: 'Benchmarking', year: 2013 }] },
  { city: 'Denver', state: 'CO', zip: '80202', tz: 'America/Denver', lat: 39.75, lng: -104.99, region: 'Central', policies: [{ name: 'Energize Denver', type: 'BPS', year: 2021 }] },
  { city: 'Seattle', state: 'WA', zip: '98101', tz: 'America/Los_Angeles', lat: 47.61, lng: -122.33, region: 'West', policies: [{ name: 'Seattle benchmarking', type: 'Benchmarking', year: 2010 }, { name: 'Washington Clean Buildings Performance Standard', type: 'BPS', year: 2019 }] },
  { city: 'San Francisco', state: 'CA', zip: '94105', tz: 'America/Los_Angeles', lat: 37.79, lng: -122.4, region: 'West', policies: [{ name: 'SF existing commercial buildings', type: 'Benchmarking', year: 2011 }] },
  { city: 'Los Angeles', state: 'CA', zip: '90071', tz: 'America/Los_Angeles', lat: 34.05, lng: -118.25, region: 'West', policies: [{ name: 'LA EBEWE', type: 'Benchmarking', year: 2016 }] },
];

const INDUSTRIAL_CITIES: City[] = [
  { city: 'Edison', state: 'NJ', zip: '08837', tz: 'America/New_York', lat: 40.52, lng: -74.41, region: 'East', policies: [] },
  { city: 'Allentown', state: 'PA', zip: '18106', tz: 'America/New_York', lat: 40.6, lng: -75.49, region: 'East', policies: [] },
  { city: 'Charlotte', state: 'NC', zip: '28273', tz: 'America/New_York', lat: 35.13, lng: -80.93, region: 'South', policies: [] },
  { city: 'McDonough', state: 'GA', zip: '30253', tz: 'America/New_York', lat: 33.45, lng: -84.15, region: 'South', policies: [] },
  { city: 'Joliet', state: 'IL', zip: '60431', tz: 'America/Chicago', lat: 41.53, lng: -88.08, region: 'Central', policies: [] },
  { city: 'Columbus', state: 'OH', zip: '43217', tz: 'America/New_York', lat: 39.87, lng: -82.94, region: 'Central', policies: [] },
  { city: 'Indianapolis', state: 'IN', zip: '46241', tz: 'America/Indiana/Indianapolis', lat: 39.72, lng: -86.29, region: 'Central', policies: [] },
  { city: 'Dallas', state: 'TX', zip: '75241', tz: 'America/Chicago', lat: 32.66, lng: -96.76, region: 'South', policies: [] },
  { city: 'Aurora', state: 'CO', zip: '80011', tz: 'America/Denver', lat: 39.73, lng: -104.79, region: 'Central', policies: [{ name: 'Colorado building performance standard', type: 'BPS', year: 2021 }] },
  { city: 'Riverside', state: 'CA', zip: '92507', tz: 'America/Los_Angeles', lat: 33.98, lng: -117.37, region: 'West', policies: [{ name: 'California AB 802 benchmarking', type: 'Benchmarking', year: 2015 }] },
  { city: 'Kent', state: 'WA', zip: '98032', tz: 'America/Los_Angeles', lat: 47.38, lng: -122.23, region: 'West', policies: [{ name: 'Washington Clean Buildings Performance Standard', type: 'BPS', year: 2019 }] },
  { city: 'Reno', state: 'NV', zip: '89502', tz: 'America/Los_Angeles', lat: 39.5, lng: -119.78, region: 'West', policies: [] },
];

const OFFICE_NAMES = ['Meridian Tower', 'Harborview Center', 'Lakeshore Plaza', 'Granite Point', 'Cedar Exchange', 'Foundry Lofts', 'Northgate Commons', 'Riverbend Tower', 'Summit Place', 'Ashford Court', 'Kingsley Building', 'Market Hall', 'Orchard Commons', 'Beacon Square', 'Linden Works', 'Halcyon House'];
const STREETS = ['Alder', 'Birch', 'Commerce', 'Dock', 'Elm', 'Foundry', 'Grove', 'Harbor', 'Industrial', 'Juniper', 'Keystone', 'Logistics', 'Maple', 'Northpoint', 'Orchard', 'Pioneer', 'Quarry', 'Rail', 'Summit', 'Terminal', 'Union', 'Valley', 'Warehouse', 'Willow'];
const SUFFIX = ['St', 'Ave', 'Blvd', 'Way', 'Pkwy', 'Dr', 'Rd'];
const FIRST = ['Avery', 'Jordan', 'Morgan', 'Taylor', 'Riley', 'Casey', 'Quinn', 'Rowan', 'Jamie', 'Drew', 'Parker', 'Reese', 'Sage', 'Elliot', 'Hayden', 'Kai', 'Noor', 'Lena', 'Omar', 'Ines', 'Theo', 'Mina', 'Felix', 'Ana'];
const LAST = ['Patel', 'Nguyen', 'Garcia', 'Kim', 'Johnson', 'Okafor', 'Rossi', 'Novak', 'Haddad', 'Silva', 'Lindqvist', 'Moreau', 'Sato', 'Ibrahim', 'Brennan', 'Castillo', 'Weber', 'Adeyemi', 'Kowalski', 'Ortega'];
const TENANT_NAMES = ['Bluepeak Analytics', 'Corvid Legal', 'Driftwood Media', 'Evergreen Health Partners', 'Fieldstone Capital', 'Gallant Design', 'Helix Bio', 'Ironclad Security', 'Juniper Labs', 'Keel & Co', 'Lumen Retail', 'Mosaic Learning', 'Northbeam Foods', 'Oakline Insurance', 'Pinecrest Apparel', 'Quarry Robotics', 'Redwood Freight', 'Saltmarsh Brewing', 'Tidewater Logistics', 'Umber Furniture', 'Vantage Parcel', 'Wildflower Goods', 'Yardline Sports', 'Zephyr Electronics', 'Arcadia Cold Storage', 'Brightline Auto Parts', 'Cobalt Fulfilment', 'Delta Home Supply'];
const INDUSTRIES = ['Technology', 'Legal', 'Media', 'Healthcare', 'Finance', 'Design', 'Life sciences', 'Retail', 'Logistics', 'Food and beverage', 'Manufacturing', 'Insurance'];
const PROVIDERS: Record<Utility, string[]> = {
  electricity: ['Metro Power & Light', 'Eastern Grid Electric', 'Valley Electric Co-op', 'Pacific Energy Utility'],
  gas: ['Continental Gas', 'Northern Natural Gas Service', 'Cityline Gas'],
  water: ['Municipal Water Authority', 'Riverside Water District'],
  steam: ['District Steam Co.'],
};
const UNIT: Record<Utility, string> = { electricity: 'kWh', gas: 'therms', water: 'kgal', steam: 'Mlb' };

const GOLD_LABELS = [
  'Meters tagged to utilities',
  'Whole-building totals',
  'Landlord and tenant split',
  '12 months of history',
  'ENERGY STAR linked',
  'Portfolio hierarchy',
  'Photos and square footage',
  'Sponsor and project lead invited',
  'Building contact named',
];

interface ScenarioDef {
  name: string;
  company: Company;
  others: Company[];
  count: number;
  kind: 'office' | 'industrial';
  entitlements: Entitlements;
  seed: number;
}

const ENT_ALL: Entitlements = { energyEsg: true, carbonPlanning: true, equipmentOptimization: true, submeter: true, tenantBilling: false, maintenance: false };

export const SCENARIO_DEFS: Record<ScenarioId, ScenarioDef> = {
  'SC-1': {
    name: 'Industrial ESG portfolio',
    company: { id: 'ridgeline', name: 'Ridgeline Logistics REIT', initials: 'RL', membership: 'Admin' },
    others: [],
    count: 48,
    kind: 'industrial',
    entitlements: { energyEsg: true, carbonPlanning: false, equipmentOptimization: false, submeter: false, tenantBilling: false, maintenance: false },
    seed: 101,
  },
  'SC-2': {
    name: 'Mixed-tier office portfolio',
    company: { id: 'northwind', name: 'Northwind Holdings', initials: 'NH', membership: 'Admin' },
    others: [],
    count: 15,
    kind: 'office',
    entitlements: ENT_ALL,
    seed: 202,
  },
  'SC-3': {
    name: 'Owner with two management firms',
    company: { id: 'harbor', name: 'Harbor Point Partners', initials: 'HP', membership: 'Member' },
    others: [
      { id: 'northwind', name: 'Northwind Holdings', initials: 'NH', membership: 'Guest, 4 buildings', guest: true },
    ],
    count: 12,
    kind: 'office',
    entitlements: ENT_ALL,
    seed: 303,
  },
  'SC-4': {
    name: 'Single-property account',
    company: { id: 'lakeside', name: 'Lakeside Tower LLC', initials: 'LT', membership: 'Admin' },
    others: [],
    count: 1,
    kind: 'office',
    entitlements: { ...ENT_ALL, carbonPlanning: false },
    seed: 404,
  },
  'SC-5': {
    name: 'New account mid-setup',
    company: { id: 'summit', name: 'Summit Ridge Capital', initials: 'SR', membership: 'Admin' },
    others: [],
    count: 6,
    kind: 'office',
    entitlements: ENT_ALL,
    seed: 505,
  },
  'SC-6': {
    name: 'Demo account',
    company: { id: 'demo', name: 'Demo Company', initials: 'DC', membership: 'Admin' },
    others: [],
    count: 15,
    kind: 'office',
    entitlements: ENT_ALL,
    seed: 202,
  },
};

const person = (r: Rng) => `${r.pick(FIRST)} ${r.pick(LAST)}`;
const emailFor = (name: string, domain: string) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${domain}`;
const money = (n: number) => Math.round(n);

export function generate(scenario: ScenarioId): Dataset {
  const def = SCENARIO_DEFS[scenario];
  const r = makeRng(def.seed);
  const domain = `${def.company.id}.example`;
  const industrial = def.kind === 'industrial';
  const newAccount = scenario === 'SC-5';

  // ---------- Users first: buildings name their contacts ----------
  const standIns = {
    sl: { id: 'u-sl', name: 'Maya Chen', title: 'Head of Sustainability', persona: 'sl' as const },
    am: { id: 'u-am', name: 'David Okafor', title: 'Asset Manager', persona: 'am' as const },
    pm: { id: 'u-pm', name: 'Rosa Alvarez', title: 'Property Manager', persona: 'pm' as const },
  };

  // ---------- Management companies ----------
  const mgmt: ManagementCompany[] = [
    { id: 'mc-self', name: `${def.company.name} (self-managed)`, thirdParty: false, assignments: [] },
    { id: 'mc-crestline', name: 'Crestline Property Services', thirdParty: true, assignments: [] },
    { id: 'mc-oakmont', name: 'Oakmont Realty Management', thirdParty: true, assignments: [] },
  ];

  // ---------- Buildings ----------
  const cities = industrial ? INDUSTRIAL_CITIES : OFFICE_CITIES;
  const buildings: Building[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < def.count; i++) {
    const c = scenario === 'SC-4' ? OFFICE_CITIES[5] : industrial && i === 0 ? INDUSTRIAL_CITIES[2] : cities[i % cities.length];
    let name: string;
    const num = r.int(10, 9800);
    const street = `${r.pick(STREETS)} ${r.pick(SUFFIX)}`;
    if (industrial) {
      name = i === 0 ? 'Charlotte Gateway DC 1' : `${c.city} ${r.pick(['Logistics Center', 'Distribution Center', 'Commerce Park', 'Trade Center'])} ${Math.floor(i / cities.length) + 1}`;
    } else {
      name = OFFICE_NAMES[i % OFFICE_NAMES.length];
      if (i >= OFFICE_NAMES.length) name = `${num} ${street}`;
    }
    while (usedNames.has(name)) name = `${name} II`;
    usedNames.add(name);
    const type: Building['type'] = industrial ? 'Industrial' : i % 7 === 6 ? 'Mixed use' : i % 11 === 10 ? 'Lab' : 'Office';
    const floors = industrial ? 1 : r.int(4, 12);
    const gfa = industrial ? r.int(18, 120) * 10000 : floors * r.int(14, 28) * 1000;

    // Tiers per utility (SYS-TRUST-20, ST-T0 to ST-TMIX).
    const tierByUtility: Partial<Record<Utility, Tier>> = {};
    const sold: Building['sold'] = {};
    let elecTier: Tier = 1;
    if (scenario === 'SC-2' || scenario === 'SC-3' || scenario === 'SC-6') {
      elecTier = i < 2 ? 3 : i < 4 ? '2b' : i < 6 ? '2a' : 1;
    } else if (scenario === 'SC-4') {
      elecTier = '2b';
    } else if (scenario === 'SC-1') {
      elecTier = i === 1 || i === 7 ? '2b' : i % 13 === 12 ? 0 : 1;
    } else if (newAccount) {
      elecTier = i < 2 ? 0 : 1;
    }
    tierByUtility.electricity = elecTier;
    sold.electricity = { sold: true, stage: elecTier === 0 ? (newAccount ? 'install' : 'scoping') : 'live' };
    const gasTier: Tier = industrial && r.chance(0.4) ? 0 : elecTier === 0 ? 0 : 1;
    tierByUtility.gas = gasTier;
    sold.gas = { sold: true, stage: gasTier === 0 && newAccount ? 'schedule' : 'live' };
    if (!industrial) {
      // Water: sold in offices; still scoping in the new account (ST-D24). Never sold in SC-1 (ST-D04).
      tierByUtility.water = newAccount ? 0 : 1;
      sold.water = { sold: true, stage: newAccount ? 'scoping' : 'live' };
    } else {
      sold.water = { sold: false };
    }
    if (c.city === 'New York' && !industrial) {
      tierByUtility.steam = 1;
      sold.steam = { sold: true, stage: 'live' };
    }

    const historyMonths = newAccount ? (i < 3 ? r.int(2, 9) : r.int(13, 30)) : r.int(26, 60);
    const integrationDate = newAccount ? daysAgo(r.int(20, 80)) : addMonths(AS_OF, -r.int(14, 40));
    const siteEuiBase = industrial ? r.int(18, 45) : r.int(55, 120);
    const euiBenchmark = industrial ? 32 : 80;
    // ST-D15: one low and one high EUI flag.
    const siteEui = elecTier === 0 ? null : i === 3 && industrial ? 6 : i === 5 ? Math.round(euiBenchmark * 2.1) : siteEuiBase;
    const energyKwh = siteEui && gfa ? Math.round((siteEui * gfa) / 3.412) : 0;
    const energyCost = Math.round(energyKwh * r.float(0.11, 0.19));
    const tco2 = energyKwh * r.float(0.00025, 0.00042);
    const scope1 = Math.round(tco2 * (industrial ? 0.15 : 0.25));
    const scope2 = Math.round(tco2 * (industrial ? 0.25 : 0.55));
    const scope3 = Math.round(tco2 - scope1 - scope2);
    const bps = c.policies.some((p) => p.type === 'BPS');
    const potentialFine = bps && siteEui && siteEui > euiBenchmark * 0.9 ? money(r.int(4, 90) * 10000) : 0;
    const exposure: Building['exposure'] = {
      potentialFine,
      costAvoided: bps ? money(r.int(0, 40) * 5000) : 0,
      status: !c.policies.length ? 'Not covered' : potentialFine > 400000 ? 'Non-compliant' : potentialFine > 0 ? 'At risk' : 'Compliant',
    };

    const nnn = industrial && r.chance(0.7);
    const hasSurvey = !newAccount && (industrial ? i % 3 === 0 : i < 9);
    const id = `b-${String(i + 1).padStart(3, '0')}`;
    const mc = industrial ? (i % 2 ? mgmt[1] : mgmt[2]) : i % 3 === 0 ? mgmt[0] : i % 3 === 1 ? mgmt[1] : mgmt[2];
    // ST-U09: a management company change on one property.
    if (i === 2 && !industrial) {
      mgmt[2].assignments.push({ buildingId: id, start: '2019-01-01', end: '2025-06-30' });
      mgmt[1].assignments.push({ buildingId: id, start: '2025-07-01', end: null });
    } else {
      mc.assignments.push({ buildingId: id, start: addMonths(AS_OF, -r.int(20, 90)), end: null });
    }
    const deliverable = hasSurvey || (industrial && i === 0) ? (industrial ? r.float(1.2, 4.5) : r.float(1.5, 6)) : null;
    const powerSurveyed: Building['powerSurveyed'] = industrial && i === 0 ? 'full' : hasSurvey ? (i % 4 === 1 ? 'missing-ratings' : 'full') : 'not-surveyed';
    const interval = elecTier === '2b' || elecTier === 3;

    buildings.push({
      id,
      name,
      address: `${num} ${street}`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      country: 'United States',
      type,
      timezone: c.tz,
      lat: c.lat + r.float(-0.05, 0.05),
      lng: c.lng + r.float(-0.05, 0.05),
      gfa: newAccount && i === 4 ? null : gfa,
      yearBuilt: r.int(industrial ? 1985 : 1958, 2021),
      floors,
      integrationDate,
      managementCompanyId: i === 2 && !industrial ? mgmt[1].id : mc.id,
      groupIds: [],
      nnn,
      tierByUtility,
      sold,
      status: 'healthy',
      coverage: elecTier === 0 ? 0 : r.float(industrial ? 0.45 : 0.7, 1),
      completeness: elecTier === 0 ? 0 : r.float(0.6, 1),
      historyMonths,
      energyStarScore: elecTier === 0 || type === 'Industrial' && r.chance(0.5) ? null : r.int(38, 94),
      pmPropertyId: elecTier === 0 && newAccount ? null : String(r.int(2000000, 9999999)),
      esLastSynced: elecTier === 0 ? null : daysAgo(r.int(1, i % 9 === 4 ? 70 : 9)),
      esDirection: elecTier === 0 ? null : i % 5 === 3 ? 'Portfolio Manager → Enertiv' : 'Enertiv → Portfolio Manager',
      siteEui,
      euiBenchmark,
      energyKwh,
      energyCost,
      emissions: { scope1, scope2, scope3, landlordShare: nnn ? r.float(0.05, 0.2) : r.float(0.55, 0.9) },
      exposure,
      deliverablePowerMw: deliverable ? Math.round(deliverable * 100) / 100 : null,
      availablePowerMw: deliverable && interval ? Math.round(deliverable * r.float(0.25, 0.6) * 100) / 100 : null,
      powerSurveyed,
      hasEquipmentSurvey: hasSurvey,
      occupancyHours: newAccount && i % 2 === 0 ? null : defaultHours(industrial),
      goldStandard: [],
      contactUserId: null,
      sponsorUserId: null,
      inactive: scenario === 'SC-1' && i === def.count - 1 ? true : undefined,
      synthetic: true,
    });
  }

  // ---------- Groups (four-level hierarchy, property in two groups, empty group) ----------
  const groups: Group[] = [];
  if (buildings.length > 1) {
    const byRegion = (reg: City['region']) =>
      buildings.filter((b) => (industrial ? INDUSTRIAL_CITIES : OFFICE_CITIES).find((c) => c.city === b.city)?.region === reg).map((b) => b.id);
    if (industrial) {
      groups.push({ id: 'g-core', name: 'Core Fund', kind: 'Fund', buildingIds: [] });
      groups.push({ id: 'g-value', name: 'Value-Add Fund', kind: 'Fund', buildingIds: [] });
      (['East', 'South', 'Central', 'West'] as const).forEach((reg, k) => {
        const ids = byRegion(reg);
        const half = Math.ceil(ids.length / 2);
        groups.push({ id: `g-core-${reg.toLowerCase()}`, name: `${reg}`, kind: 'Region', parentId: 'g-core', buildingIds: ids.slice(0, half) });
        groups.push({ id: `g-value-${reg.toLowerCase()}`, name: `${reg}`, kind: 'Region', parentId: 'g-value', buildingIds: ids.slice(half) });
        void k;
      });
    } else {
      groups.push({ id: 'g-fund1', name: 'Fund I', kind: 'Fund', buildingIds: [] });
      groups.push({ id: 'g-fund2', name: 'Fund II', kind: 'Fund', buildingIds: [] });
      const east = byRegion('East').concat(byRegion('South'));
      const central = byRegion('Central');
      const west = byRegion('West');
      groups.push({ id: 'g-east', name: 'East Coast', kind: 'Region', parentId: 'g-fund1', buildingIds: east });
      groups.push({ id: 'g-west', name: 'West Coast', kind: 'Region', parentId: 'g-fund1', buildingIds: west });
      groups.push({ id: 'g-central', name: 'Central', kind: 'Region', parentId: 'g-fund2', buildingIds: central });
      groups.push({ id: 'g-flagships', name: 'Flagships', kind: 'Program', buildingIds: buildings.slice(0, 2).map((b) => b.id) });
      groups.push({ id: 'g-fund3', name: 'Fund III', kind: 'Fund', buildingIds: [] });
    }
    // Funds hold their regions' buildings.
    for (const g of groups) {
      const kids = groups.filter((k) => k.parentId === g.id);
      if (kids.length) g.buildingIds = kids.flatMap((k) => k.buildingIds);
    }
    for (const g of groups) for (const id of g.buildingIds) buildings.find((b) => b.id === id)?.groupIds.push(g.id);
  }

  // ---------- Users ----------
  const users: User[] = [];
  const allScope = { all: true, groupIds: [] as string[], buildingIds: [] as string[] };
  const admin: User = {
    id: 'u-admin', name: 'Priya Shah', email: emailFor('Priya Shah', domain), title: 'VP, Operations', persona: 'am', role: 'admin', appAccess: 'web',
    scope: allScope, teamIds: [], status: 'active', lastActive: daysAgo(1), invitedBy: null, invited: '2023-02-01', firm: null,
  };
  users.push(admin);
  for (const s of Object.values(standIns)) {
    users.push({
      id: s.id, name: s.name, email: emailFor(s.name, domain), title: s.title, persona: s.persona,
      role: s.persona === 'pm' ? 'operator' : 'admin', appAccess: 'web',
      scope: s.persona === 'pm' && groups.length ? { all: false, groupIds: [groups.find((g) => g.kind === 'Region')!.id], buildingIds: [] } : allScope,
      teamIds: [], status: newAccount && s.persona === 'sl' ? 'invited' : 'active', lastActive: daysAgo(r.int(0, 6)), invitedBy: admin.id, invited: newAccount ? daysAgo(2) : '2024-03-11', firm: null,
    });
  }
  const extraCount = Math.min(14, 4 + Math.ceil(buildings.length / 4));
  for (let k = 0; k < extraCount; k++) {
    const name = person(r);
    const kind = k % 7;
    const firm = kind === 3 ? 'Crestline Property Services' : kind === 5 ? 'Oakmont Realty Management' : null;
    const status: User['status'] = k === 1 ? 'invited' : k === 2 ? 'never' : k === 4 ? 'deactivated' : 'active';
    const engineer = kind === 6;
    const bIds = r.shuffle(buildings).slice(0, Math.min(buildings.length, r.int(1, 4))).map((b) => b.id);
    users.push({
      id: `u-${k}`, name, email: emailFor(name, firm ? `${firm.split(' ')[0].toLowerCase()}.example` : domain),
      title: engineer ? 'Chief Engineer' : firm ? 'Property Manager' : r.pick(['Sustainability Analyst', 'Portfolio Manager', 'Energy Manager', 'Director of Engineering', 'Asset Manager', 'Controller']),
      persona: engineer ? 'none' : firm ? 'pm' : r.pick(['sl', 'am', 'pm'] as const),
      role: engineer ? 'operator' : firm ? 'operator' : k === 0 ? 'billing' : r.pick(['admin', 'operator'] as const),
      appAccess: engineer ? 'survey' : 'web',
      scope: engineer || firm ? { all: false, groupIds: [], buildingIds: bIds } : r.chance(0.5) ? allScope : { all: false, groupIds: groups[0] ? [groups[0].id] : [], buildingIds: [] },
      teamIds: [], status,
      lastActive: status === 'active' ? daysAgo(r.int(0, 40)) : status === 'deactivated' ? daysAgo(r.int(90, 300)) : null,
      invitedBy: admin.id, invited: status === 'never' ? daysAgo(r.int(120, 200)) : daysAgo(r.int(5, 600)), firm,
    });
  }
  // A vendor user and a tenant user, for role testing (ST-R04, ST-R05).
  users.push({ id: 'u-vendor', name: 'Lars Novak', email: 'lars@brightwater-mechanical.example', title: 'Service Technician', persona: 'none', role: 'vendor', appAccess: 'web', scope: { all: false, groupIds: [], buildingIds: [buildings[0].id] }, teamIds: [], status: 'active', lastActive: daysAgo(12), invitedBy: admin.id, invited: '2025-01-20', firm: 'Brightwater Mechanical' });

  // ---------- Teams ----------
  const teams: Team[] = [];
  const crestlineMembers = users.filter((u) => u.firm === 'Crestline Property Services').map((u) => u.id);
  const crestBuildings = mgmt[1].assignments.filter((a) => !a.end).map((a) => a.buildingId);
  teams.push({ id: 't-crestline', name: 'Crestline Property Services', memberIds: crestlineMembers, scope: { groupIds: [], buildingIds: crestBuildings }, defaultRole: 'operator', canManageChase: true, proposed: newAccount });
  const oakMembers = users.filter((u) => u.firm === 'Oakmont Realty Management').map((u) => u.id);
  teams.push({ id: 't-oakmont', name: 'Oakmont Realty Management', memberIds: oakMembers, scope: { groupIds: [], buildingIds: mgmt[2].assignments.filter((a) => !a.end).map((a) => a.buildingId) }, defaultRole: 'operator', canManageChase: false, proposed: newAccount });
  teams.push({ id: 't-esg', name: 'Sustainability', memberIds: ['u-sl', ...users.filter((u) => u.title.includes('Sustainability') || u.title.includes('Energy')).map((u) => u.id)], scope: { groupIds: groups.filter((g) => !g.parentId && g.buildingIds.length).map((g) => g.id), buildingIds: groups.length ? [] : buildings.map((b) => b.id) }, defaultRole: 'admin', canManageChase: true });
  teams.push({ id: 't-am', name: 'Asset management', memberIds: ['u-am', 'u-admin', ...users.filter((u) => u.title === 'Asset Manager' || u.title === 'Portfolio Manager').map((u) => u.id)], scope: { groupIds: groups.filter((g) => !g.parentId && g.buildingIds.length).map((g) => g.id), buildingIds: groups.length ? [] : buildings.map((b) => b.id) }, defaultRole: 'admin', canManageChase: false });
  // The PM stand-in belongs to Crestline and has a direct grant (ST-U12).
  if (scenario === 'SC-3' || scenario === 'SC-2') {
    teams[0].memberIds.push('u-pm');
    users.find((u) => u.id === 'u-pm')!.firm = 'Crestline Property Services';
  }
  for (const t of teams) for (const m of t.memberIds) users.find((u) => u.id === m)?.teamIds.push(t.id);

  // Building contacts and sponsors (Gold Standard lines 8 and 9; ST-O09).
  buildings.forEach((b, k) => {
    const pm = users.filter((u) => u.persona === 'pm' && u.status === 'active');
    b.contactUserId = newAccount && k % 2 === 0 ? null : k % 9 === 7 ? null : (pm[k % Math.max(pm.length, 1)]?.id ?? 'u-pm');
    b.sponsorUserId = newAccount && k % 3 !== 0 ? null : 'u-am';
  });

  // ---------- Spaces and tenants ----------
  const spaces: Space[] = [];
  const tenants: Tenant[] = [];
  let tenantIdx = 0;
  const tenantFor = (b: Building, sqft: number, area: Space['areaType']): Tenant => {
    const name = TENANT_NAMES[tenantIdx % TENANT_NAMES.length] + (tenantIdx >= TENANT_NAMES.length ? ` ${Math.floor(tenantIdx / TENANT_NAMES.length) + 1}` : '');
    tenantIdx++;
    const moveIn = addMonths(AS_OF, -r.int(6, 96));
    const noContact = r.chance(0.12);
    const t: Tenant = {
      id: `tn-${tenantIdx}`,
      name,
      industry: area === 'Warehouse' ? r.pick(['Logistics', 'Manufacturing', 'Retail', 'Food and beverage']) : r.pick(INDUSTRIES),
      buildingIds: [b.id],
      spaceIds: [],
      leasedSqft: sqft,
      moveIn,
      moveOut: null,
      prior: false,
      contacts: noContact
        ? []
        : [{ name: person(r), email: `facilities@${name.split(' ')[0].toLowerCase()}.example`, phone: `(555) 01${r.int(10, 99)}-${r.int(1000, 9999)}`, role: r.pick(['Facilities manager', 'Office manager', 'Operations lead']) }],
      loa: r.chance(0.5) ? { status: 'Signed', signed: addMonths(moveIn, 1), expires: addMonths(moveIn, 61), accounts: [] } : r.chance(0.5) ? { status: 'Requested', accounts: [] } : { status: 'None', accounts: [] },
    };
    tenants.push(t);
    return t;
  };

  for (const b of buildings) {
    if (industrial) {
      const units = r.int(1, 4);
      const unitSq = Math.round((b.gfa ?? 200000) / units);
      for (let u = 0; u < units; u++) {
        const vacant = r.chance(0.12);
        const sp: Space = {
          id: `${b.id}-s${u + 1}`, buildingId: b.id, floor: 1, name: `Unit ${String.fromCharCode(65 + u)}`, areaType: 'Warehouse', sqft: unitSq, capacity: Math.round(unitSq / 900),
          tenantId: null, leaseStart: null, leaseEnd: null, fedBy: [], deliverableKw: b.deliverablePowerMw ? Math.round((b.deliverablePowerMw * 1000) / units) : null,
        };
        if (!vacant) {
          const t = tenantFor(b, unitSq, 'Warehouse');
          t.spaceIds.push(sp.id);
          sp.tenantId = t.id;
          sp.leaseStart = t.moveIn;
          sp.leaseEnd = addMonths(t.moveIn, r.pick([60, 84, 120]));
        }
        spaces.push(sp);
      }
    } else {
      const perFloor = Math.round((b.gfa ?? 100000) / b.floors);
      for (let f = 1; f <= b.floors; f++) {
        if (f === 1) {
          spaces.push({ id: `${b.id}-f1-lobby`, buildingId: b.id, floor: 1, name: 'Lobby', areaType: 'Common area', sqft: Math.round(perFloor * 0.3), capacity: 0, tenantId: null, leaseStart: null, leaseEnd: null, fedBy: [], deliverableKw: null });
          spaces.push({ id: `${b.id}-f1-retail`, buildingId: b.id, floor: 1, name: 'Retail 101', areaType: 'Retail', sqft: Math.round(perFloor * 0.7), capacity: 20, tenantId: null, leaseStart: null, leaseEnd: null, fedBy: [], deliverableKw: null });
          continue;
        }
        const splits = r.pick([1, 1, 2, 2, 3]);
        for (let s = 0; s < splits; s++) {
          spaces.push({
            id: `${b.id}-f${f}-${s + 1}`, buildingId: b.id, floor: f, name: `Suite ${f}${String(s + 1).padStart(2, '0')}`,
            areaType: b.type === 'Lab' && s === 0 ? 'Lab' : 'Office', sqft: Math.round(perFloor / splits), capacity: Math.round(perFloor / splits / 150),
            tenantId: null, leaseStart: null, leaseEnd: null, fedBy: [], deliverableKw: null,
          });
        }
      }
      // Lease most suites; a few tenants take whole floors.
      const leasable = spaces.filter((s) => s.buildingId === b.id && s.areaType !== 'Common area');
      let k = 0;
      while (k < leasable.length) {
        const take = r.pick([1, 1, 1, 2]);
        const group = leasable.slice(k, k + take);
        k += take;
        if (r.chance(0.13)) continue; // vacant (ST-D18)
        const t = tenantFor(b, group.reduce((a, s) => a + s.sqft, 0), group[0].areaType);
        for (const s of group) {
          s.tenantId = t.id;
          s.leaseStart = t.moveIn;
          s.leaseEnd = addMonths(t.moveIn, r.pick([36, 60, 84, 120]));
          t.spaceIds.push(s.id);
        }
      }
    }
  }
  // Prior tenants (ST-U07).
  const priorCount = Math.max(1, Math.round(tenants.length * 0.08));
  for (let k = 0; k < priorCount; k++) {
    const b = buildings[k % buildings.length];
    const name = `${r.pick(['Aster', 'Briar', 'Calloway', 'Dunmore', 'Everly'])} ${r.pick(['Partners', 'Group', 'Studio', 'Supply'])}`;
    tenants.push({
      id: `tn-prior-${k}`, name, industry: r.pick(INDUSTRIES), buildingIds: [b.id], spaceIds: [], leasedSqft: r.int(4, 30) * 1000,
      moveIn: addMonths(AS_OF, -r.int(60, 120)), moveOut: addMonths(AS_OF, -r.int(2, 18)), prior: true,
      contacts: [{ name: person(r), email: null, phone: null, role: 'Former facilities manager' }], loa: { status: 'Expired', accounts: [] },
    });
  }

  // ---------- Equipment and electrical gear ----------
  const equipment: Equipment[] = [];
  const EQ_TYPES: [string, string, string][] = industrial
    ? [['Rooftop unit', 'Carrier', '48FC'], ['Unit heater', 'Modine', 'PDP'], ['Exhaust fan', 'Greenheck', 'SQ'], ['Dock door heater', 'Reznor', 'UDX'], ['LED high-bay fixture bank', 'Acuity', 'IBG'], ['Air compressor', 'Atlas Copco', 'GA30'], ['EV charger', 'ChargePoint', 'CPF50'], ['Battery charger', 'Hobart', 'TR3']]
    : [['Air handling unit', 'Trane', 'Performance'], ['Chiller', 'Carrier', '30XV'], ['Boiler', 'Cleaver-Brooks', 'CBEX'], ['Cooling tower', 'BAC', 'Series 3000'], ['Rooftop unit', 'York', 'Predator'], ['Pump', 'Bell & Gossett', 'e-1510'], ['VAV box', 'Titus', 'DESV'], ['Elevator', 'Otis', 'Gen2'], ['Domestic water heater', 'A.O. Smith', 'BTH'], ['EV charger', 'ChargePoint', 'CT4000']];
  const CONDITIONS: Equipment['condition'][] = ['Good', 'Good', 'Fair', 'Fair', 'Poor', 'Critical'];
  for (const b of buildings) {
    const bSpaces = spaces.filter((s) => s.buildingId === b.id);
    const elecTier = b.tierByUtility.electricity;
    // Gear: services, transformers, panels (MOD-BI-44).
    if (b.powerSurveyed !== 'not-surveyed') {
      const fullCharlotte = b.name === 'Charlotte Gateway DC 1';
      const nServices = fullCharlotte ? 7 : industrial ? r.int(1, 3) : r.int(1, 2);
      const nTransformers = fullCharlotte ? 2 : Math.max(1, Math.ceil(nServices / 2));
      const transformers: Equipment[] = [];
      for (let t = 0; t < nTransformers; t++) {
        const missing = b.powerSurveyed === 'missing-ratings' && t === 0;
        const tr: Equipment = {
          id: `${b.id}-tx${t + 1}`, buildingId: b.id, spaceId: null, floor: industrial ? 1 : 0, name: `Transformer T${t + 1}`, description: 'Utility pad-mount transformer', type: 'Transformer', kind: 'transformer', parentId: null,
          dataSource: 'Survey', make: r.pick(['Eaton', 'ABB', 'Siemens']), model: null, capacity: missing ? null : `${r.pick([1000, 1500, 2000, 2500])} kVA`, installDate: `${r.int(1990, 2018)}-06-01`,
          condition: r.pick(CONDITIONS), expectedEol: r.int(2027, 2045), retired: false, surveyedAt: daysAgo(r.int(30, 400)), editedBy: null, components: 0,
          ratings: { kva: missing ? null : r.pick([1000, 1500, 2000, 2500]), primaryV: 12470, secondaryV: 480, provider: r.pick(PROVIDERS.electricity) },
          notObservable: fullCharlotte && t === 1 ? { field: 'Impedance', reason: 'Nameplate painted over; utility-owned unit', photo: true } : null,
        };
        transformers.push(tr);
        equipment.push(tr);
      }
      for (let s = 0; s < nServices; s++) {
        const tr = transformers[s % transformers.length];
        const amps = r.pick([800, 1200, 1600, 2000, 3000]);
        const missing = b.powerSurveyed === 'missing-ratings' && s === 0;
        const deliverableKw = missing ? null : Math.round((amps * 480 * 1.732 * 0.8) / 1000);
        const svc: Equipment = {
          id: `${b.id}-svc${s + 1}`, buildingId: b.id, spaceId: null, floor: industrial ? 1 : 0, name: `Service ${s + 1}`, description: 'Electrical service entrance', type: 'Electrical service', kind: 'service', parentId: tr.id,
          dataSource: 'Survey', make: null, model: null, capacity: missing ? null : `${amps} A`, installDate: null, condition: null, expectedEol: null, retired: false, surveyedAt: daysAgo(r.int(30, 400)), editedBy: null, components: 0,
          ratings: { amps: missing ? null : amps, voltage: '480/277 V', phases: 3, feedType: r.pick(['Underground', 'Overhead']), feeds: 1, redundancy: s === 0 && nServices > 1 ? 'N+1' : 'None', meterAccount: `••••${r.int(1000, 9999)}`, deliverableKw, availableKw: b.availablePowerMw && deliverableKw ? Math.round(deliverableKw * r.float(0.25, 0.6)) : null, provider: tr.ratings?.provider },
          notObservable: fullCharlotte && s === 4 ? { field: 'Main breaker rating', reason: 'Breaker enclosure locked; utility confirmation needed', photo: true } : null,
        };
        equipment.push(svc);
        const nPanels = r.int(1, 3);
        for (let p = 0; p < nPanels; p++) {
          const panel: Equipment = {
            id: `${svc.id}-p${p + 1}`, buildingId: b.id, spaceId: null, floor: industrial ? 1 : r.int(1, b.floors), name: `Panel ${String.fromCharCode(65 + s)}${p + 1}`, description: 'Distribution panel', type: 'Panel', kind: 'panel', parentId: svc.id,
            dataSource: 'Survey', make: r.pick(['Square D', 'Eaton', 'GE']), model: null, capacity: `${r.pick([225, 400, 600, 800])} A`, installDate: `${r.int(1990, 2020)}-03-01`, condition: r.pick(CONDITIONS), expectedEol: r.int(2028, 2050),
            retired: false, surveyedAt: daysAgo(r.int(30, 400)), editedBy: null, components: r.int(12, 42), ratings: { amps: r.pick([225, 400, 600, 800]), voltage: r.pick(['480/277 V', '208/120 V']), phases: 3 },
          };
          equipment.push(panel);
        }
        // Spaces fed by this service (a space fed by two services, ST-Q11).
        bSpaces.forEach((sp, k) => {
          if (k % nServices === s) sp.fedBy.push(svc.id);
        });
        if (fullCharlotte && s === 1 && bSpaces[0]) bSpaces[0].fedBy.push(svc.id);
      }
    }
    if (!b.hasEquipmentSurvey) continue;
    const n = industrial ? r.int(6, 12) : r.int(10, 18);
    for (let k = 0; k < n; k++) {
      const [t, make, model] = EQ_TYPES[k % EQ_TYPES.length];
      const sp = r.pick(bSpaces);
      const noType = k === n - 1 && r.chance(0.6);
      const cond = r.pick(CONDITIONS);
      const panels = equipment.filter((e) => e.buildingId === b.id && e.kind === 'panel');
      equipment.push({
        id: `${b.id}-eq${k + 1}`, buildingId: b.id, spaceId: sp?.id ?? null, floor: sp?.floor ?? null,
        name: noType ? `Unlabelled unit ${k + 1}` : `${t.replace(/ unit$/, '').split(' ').map((w) => w[0].toUpperCase()).join('')}-${k + 1}`,
        description: t, type: noType ? null : t, kind: 'equipment', parentId: panels.length ? r.pick(panels).id : null,
        dataSource: elecTier === 3 && k < 8 ? 'BMS' : elecTier === '2b' && k < 3 ? 'Enertiv sensors' : 'Survey',
        make: noType ? null : make, model: noType ? null : model, capacity: noType ? null : r.pick(['5 tons', '20 tons', '150 tons', '2.5 MMBtu/h', '7.5 hp', '15 hp', '40 kW']),
        installDate: `${r.int(1995, 2022)}-${String(r.int(1, 12)).padStart(2, '0')}-01`, condition: cond, expectedEol: cond === 'Critical' ? 2026 : cond === 'Poor' ? r.int(2026, 2029) : r.int(2029, 2045),
        retired: r.chance(0.04), surveyedAt: daysAgo(r.int(20, 500)), editedBy: r.chance(0.08) ? { who: 'Rosa Alvarez', at: daysAgo(r.int(1, 60)) } : null, components: r.int(0, 6),
      });
    }
  }

  // ---------- Utility accounts, meters, bills ----------
  const accounts: UtilityAccount[] = [];
  const meters: Meter[] = [];
  const bills: Bill[] = [];
  const health: HealthItem[] = [];
  let healthIdx = 0;
  const addHealth = (h: Omit<HealthItem, 'id' | 'status' | 'opened' | 'lastChecked'> & Partial<Pick<HealthItem, 'status' | 'opened'>>) => {
    healthIdx++;
    health.push({ id: `dh-${healthIdx}`, status: 'open', opened: daysAgo(r.int(1, 45)), lastChecked: daysAgo(r.int(0, 2)), ...h });
  };
  const frameworksFor = (b: Building) => {
    const c = [...OFFICE_CITIES, ...INDUSTRIAL_CITIES].find((x) => x.city === b.city);
    return ['GRESB', 'ENERGY STAR', ...(c?.policies.map((p) => p.name) ?? [])];
  };

  for (const b of buildings) {
    const bTenants = tenants.filter((t) => t.buildingIds.includes(b.id) && !t.prior);
    for (const u of Object.keys(b.sold) as Utility[]) {
      const s = b.sold[u]!;
      if (!s.sold) continue;
      const tier = b.tierByUtility[u] ?? 0;
      const live = s.stage === 'live';
      const holders: string[] = b.nnn && u === 'electricity' && bTenants.length ? bTenants.map((t) => t.id) : ['landlord'];
      holders.forEach((holder, hk) => {
        const pairSplit = u === 'electricity' && b.id === buildings[Math.min(4, buildings.length - 1)].id && hk === 0;
        const roles: UtilityAccount['role'][] = pairSplit ? ['Delivery', 'Supply'] : ['Bundled'];
        const ids: string[] = [];
        roles.forEach((role, rk) => {
          const id = `acct-${b.id}-${u}-${hk}-${rk}`;
          ids.push(id);
          const failed = live && (scenario === 'SC-1' ? r.chance(0.32) : r.chance(0.08));
          accounts.push({
            id, buildingId: b.id, provider: role === 'Supply' ? 'Brightway Energy Supply' : r.pick(PROVIDERS[u]), utility: u, accountNumber: `${r.int(10, 99)}-${r.int(100000, 999999)}-${r.int(10, 99)}`,
            holder, tariff: u === 'electricity' ? r.pick(['GS-2 General Service', 'LGS Large General', 'TOU-8 Time of Use']) : r.pick(['Commercial firm', 'Interruptible']),
            credentials: !live ? 'Not needed' : failed ? 'Failed' : 'Working', enrolment: live ? 'Enrolled' : 'Pending', extraction: !live ? 'Pending' : failed ? 'Failed' : 'Successful',
            lastExtracted: live ? daysAgo(r.int(0, 6)) : null, lastSuccessful: live ? daysAgo(failed ? r.int(35, 120) : r.int(0, 30)) : null, nextExpected: live ? addDays(AS_OF, r.int(2, 25)) : null,
            enabled: live, closed: false, meterIds: [], pairedWith: null, role,
          });
          if (failed) {
            addHealth({
              buildingId: b.id, utility: u, object: { kind: 'account', id, label: `${u[0].toUpperCase()}${u.slice(1)} account ${accounts[accounts.length - 1].accountNumber}` },
              problem: 'Utility login is failing', family: 'Utility logins', evidence: `Last successful extraction ${accounts[accounts.length - 1].lastSuccessful}; the utility rejected the saved login`,
              impact: 'New bills stop arriving, so coverage drops month by month', severity: 'high', frameworks: frameworksFor(b), fix: 'Update the utility login, or ask the account holder to',
              owner: holder === 'landlord' ? 'You' : 'Tenant', actions: holder === 'landlord' ? ['enertiv', 'expected'] : ['tenant', 'enertiv'], tenantId: holder === 'landlord' ? undefined : holder, state: 'ST-D09',
            });
          }
        });
        if (ids.length === 2) {
          accounts.find((a) => a.id === ids[0])!.pairedWith = ids[1];
          accounts.find((a) => a.id === ids[1])!.pairedWith = ids[0];
        }
        // Meters: one Enertiv meter per account, plus its ENERGY STAR twin.
        if (tier === 0 && !live) return;
        const holderTenant = tenants.find((t) => t.id === holder);
        const spaceId = holderTenant?.spaceIds[0] ?? null;
        const mId = `m-${b.id}-${u}-${hk}`;
        const esId = `es-${b.id}-${u}-${hk}`;
        const interval = u === 'electricity' && (tier === '2b' || tier === 3);
        const submeter = u === 'electricity' && tier === '2a';
        const offline = interval && b.id === buildings[1]?.id && hk === 0 && scenario !== 'SC-4';
        const zerosUnexpected = u === 'electricity' && b.id === buildings[2]?.id && !industrial;
        const zerosExpected = u === 'gas' && !industrial && b.id === buildings[3]?.id;
        const lowUptime = interval && b.id === buildings[0]?.id && !industrial;
        const meter: Meter = {
          id: mId, buildingId: b.id, spaceId, floor: spaceId ? spaces.find((s) => s.id === spaceId)?.floor ?? null : null,
          name: `${u === 'electricity' ? 'Electric' : u[0].toUpperCase() + u.slice(1)} meter${holders.length > 1 ? ` – ${holderTenant?.name ?? 'House'}` : ''}`,
          kind: 'enertiv', utility: u, unit: UNIT[u], dataSource: interval ? 'Interval (utility)' : submeter ? 'Submeter' : 'Utility bills', accountId: ids[0], mappedTo: b.pmPropertyId ? esId : null,
          usedForMetrics: true, reporting: !offline, daysSinceData: offline ? 19 : interval ? 0 : r.int(5, 34), uptime: interval ? (lowUptime ? 0.81 : r.float(0.97, 1)) : null,
          completeness: offline ? 0.62 : r.float(0.88, 1), zeros: zerosUnexpected ? 'unexpected' : zerosExpected ? 'expected' : 'none', feedsEquipmentId: equipment.find((e) => e.buildingId === b.id && e.kind === 'service')?.id ?? null,
          inScope: true, esFirstBillDate: null,
        };
        meters.push(meter);
        for (const id of ids) accounts.find((a) => a.id === id)!.meterIds.push(mId);
        if (b.pmPropertyId) {
          meters.push({
            id: esId, buildingId: b.id, spaceId, floor: meter.floor, name: `${meter.name} (Portfolio Manager)`, kind: 'energy-star', utility: u, unit: UNIT[u], dataSource: 'ENERGY STAR', accountId: null, mappedTo: mId,
            usedForMetrics: !(holders.length > 1 && hk > 1), reporting: true, daysSinceData: r.int(10, 40), uptime: null, completeness: r.float(0.8, 1), zeros: 'none', feedsEquipmentId: null, inScope: true,
            esFirstBillDate: addMonths(b.integrationDate, -r.int(12, 36)),
          });
        }
        if (offline) {
          addHealth({ buildingId: b.id, utility: u, object: { kind: 'meter', id: mId, label: meter.name }, problem: 'Meter stopped reporting', family: 'Meters', evidence: 'No interval data for 19 days; the last reading was normal', impact: 'Peak demand and available power are out of date for this building', severity: 'high', frameworks: [], fix: 'Enertiv checks the gateway and the utility feed', owner: 'Enertiv', actions: ['enertiv'], state: 'ST-D10' });
        }
        if (zerosUnexpected) {
          addHealth({ buildingId: b.id, utility: u, object: { kind: 'meter', id: mId, label: meter.name }, problem: 'Unexpected run of zeros', family: 'Meters', evidence: '6 consecutive days at 0 kWh on an occupied floor', impact: 'Consumption is understated for September', severity: 'medium', frameworks: ['GRESB'], fix: 'Confirm whether the space was shut down, or mark as expected', owner: 'You', actions: ['expected', 'enertiv'], state: 'ST-Q13' });
        }
        if (lowUptime) {
          addHealth({ buildingId: b.id, utility: u, object: { kind: 'meter', id: mId, label: meter.name }, problem: 'Meter uptime below 90%', family: 'Meters', evidence: 'Uptime 81% over the last 30 days; gaps of 2 to 6 hours most nights', impact: 'Load profiles have gaps; insights on this building may be delayed', severity: 'low', frameworks: [], fix: 'Enertiv checks the sensor connection', owner: 'Enertiv', actions: ['enertiv', 'expected'], state: 'ST-Q04' });
        }

        // Bills: the last 12 months. A missing month is a data health item, never a row (MOD-BI-60).
        const missingMonth = live && r.chance(scenario === 'SC-1' ? 0.25 : 0.1) ? r.int(1, 3) : -1;
        const zeroMonth = live && r.chance(0.05) ? r.int(2, 10) : -1;
        const months = Math.min(12, b.historyMonths);
        ids.forEach((acctId, rk) => {
          for (let mth = months; mth >= 1; mth--) {
            if (mth === missingMonth && !(ids.length === 2 && rk === 0)) continue;
            if (ids.length === 2 && rk === 1 && mth === 1) continue; // supply bill still to come (ST-D20)
            const start = addMonths(AS_OF.slice(0, 8) + '01', -mth);
            const end = addDays(addMonths(start, 1), -1);
            const season = u === 'gas' ? 1 + 0.8 * Math.cos(((new Date(start).getUTCMonth() + 0.5) / 12) * 2 * Math.PI) : 1 + 0.25 * Math.cos(((new Date(start).getUTCMonth() - 6.5) / 12) * 2 * Math.PI);
            const base = u === 'electricity' ? b.energyKwh / 12 / holders.length : u === 'gas' ? b.energyKwh / 12 / 29.3 / 3 : u === 'water' ? (b.gfa ?? 100000) / 1200 : 800;
            const consumption = mth === zeroMonth ? 0 : Math.max(1, Math.round(base * season * r.float(0.9, 1.1)));
            const rate = u === 'electricity' ? 0.15 : u === 'gas' ? 1.1 : u === 'water' ? 12 : 30;
            const cost = Math.round(consumption * rate * (rk === 1 ? 0.55 : ids.length === 2 ? 0.45 : 1));
            const estimated = r.chance(0.06);
            const billId = `bill-${acctId}-${mth}`;
            bills.push({
              id: billId, accountId: acctId, buildingId: b.id, start, end, issued: addDays(end, r.int(3, 12)), cost, consumption, unit: UNIT[u], estimated, source: r.chance(0.12) ? 'Uploaded' : 'Extracted',
              lines: [
                { charge: rk === 1 ? 'Generation supply' : 'Energy charge', amount: Math.round(cost * 0.62), mapsTo: 'Consumption cost' },
                { charge: 'Demand charge', amount: Math.round(cost * 0.21), mapsTo: 'Demand cost' },
                { charge: 'Distribution', amount: Math.round(cost * 0.12), mapsTo: 'Delivery cost' },
                { charge: 'Taxes and fees', amount: cost - Math.round(cost * 0.62) - Math.round(cost * 0.21) - Math.round(cost * 0.12), mapsTo: 'Taxes' },
              ],
            });
            if (mth === zeroMonth) {
              addHealth({ buildingId: b.id, utility: u, object: { kind: 'bill', id: billId, label: `${u} bill ${start.slice(0, 7)}` }, problem: '$0 bill', family: 'Bills', evidence: `Bill for ${start.slice(0, 7)} shows 0 ${UNIT[u]} and $0`, impact: 'The month counts as zero consumption in totals', severity: 'medium', frameworks: ['GRESB', 'ENERGY STAR'], fix: 'Mark as expected if the space was vacant, or upload the corrected bill', owner: 'You', actions: ['expected', 'upload', 'enertiv'], state: 'ST-D08' });
            }
          }
          if (missingMonth > 0 && !(ids.length === 2 && rk === 0)) {
            const start = addMonths(AS_OF.slice(0, 8) + '01', -missingMonth);
            const holderName = holder === 'landlord' ? null : tenants.find((t) => t.id === holder)?.name;
            addHealth({
              buildingId: b.id, utility: u, object: { kind: 'account', id: acctId, label: `${u[0].toUpperCase()}${u.slice(1)} account` },
              problem: missingMonth === 1 ? 'Bill is late' : 'Missing bill', family: 'Bills', evidence: `No ${u} bill for ${start.slice(0, 7)}${holderName ? ` on ${holderName}'s account` : ''}; bills usually arrive by day 12`,
              impact: `${start.slice(0, 7)} is missing from totals and from the ENERGY STAR push`, severity: missingMonth === 1 ? 'low' : 'medium', frameworks: frameworksFor(b),
              fix: holderName ? `Ask ${holderName} for the bill` : 'Upload the bill, or Enertiv requests it from the utility', owner: holderName ? 'Tenant' : 'You',
              actions: holderName ? ['tenant', 'upload', 'expected'] : ['upload', 'enertiv', 'expected'], tenantId: holderName ? holder : undefined, state: missingMonth === 1 ? 'ST-D05' : 'ST-D03',
            });
          }
        });
      });
    }
    // An ENERGY STAR meter outside scope (opportunity, ST-D16) and data-quality items (ST-D21).
    if (b.pmPropertyId && r.chance(0.15)) {
      meters.push({ id: `es-${b.id}-oos`, buildingId: b.id, spaceId: null, floor: null, name: 'Tenant electric (Portfolio Manager, not in Enertiv)', kind: 'energy-star', utility: 'electricity', unit: 'kWh', dataSource: 'ENERGY STAR', accountId: null, mappedTo: null, usedForMetrics: true, reporting: true, daysSinceData: 31, uptime: null, completeness: 0.9, zeros: 'none', feedsEquipmentId: null, inScope: false, esFirstBillDate: '2022-01-01' });
    }
  }

  // Building-level data health items.
  buildings.forEach((b, k) => {
    if (b.tierByUtility.electricity === 0) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'No electricity data source', family: 'Coverage', evidence: 'Electricity is sold but no bills, meters or ENERGY STAR data have arrived', impact: 'The building has no energy or emissions figures yet', severity: 'high', frameworks: frameworksFor(b), fix: 'Enertiv is connecting the utility accounts; the next step is the installation schedule', owner: 'Enertiv', actions: ['enertiv'], state: 'ST-T0' });
    }
    if (k === 6 && !industrial && buildings.length > 6) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'Electricity may be double counted', family: 'Coverage', evidence: 'Two ENERGY STAR meters cover the same whole-building load; site EUI is 2.1 times the benchmark', impact: 'Energy, emissions and EUI are overstated; GRESB like-for-like is blocked', severity: 'high', frameworks: ['GRESB', 'ENERGY STAR'], fix: 'Unmark one of the duplicate meters as "used for metrics"', owner: 'You', actions: ['expected', 'enertiv'], state: 'ST-D11' });
    }
    if (k === 5) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'Site EUI far above benchmark', family: 'Coverage', evidence: `Site EUI ${b.siteEui} kBtu/ft² against a benchmark of ${b.euiBenchmark}`, impact: 'Likely duplicated ENERGY STAR meters; exposure may be overstated', severity: 'medium', frameworks: ['ENERGY STAR'], fix: 'Check for duplicated meters in Portfolio Manager', owner: 'You', actions: ['expected', 'enertiv'], state: 'ST-D15' });
    }
    if (industrial && k === 3) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'Site EUI unusually low', family: 'Coverage', evidence: `Site EUI ${b.siteEui} kBtu/ft²; tenant-held electricity accounts are not connected`, impact: 'Tenant consumption is missing, so totals are understated', severity: 'medium', frameworks: ['GRESB', 'ENERGY STAR'], fix: 'Ask the tenants for their bills or a letter of authorisation', owner: 'Tenant', actions: ['tenant', 'expected'], state: 'ST-D14' });
    }
    if (b.pmPropertyId && k % 6 === 2) {
      addHealth({ buildingId: b.id, utility: 'gas', object: { kind: 'building', id: b.id, label: b.name }, problem: 'ENERGY STAR meter data gap', family: 'ENERGY STAR', evidence: 'Portfolio Manager reports a gap of 31 days on the gas meter in March', impact: 'The ENERGY STAR score cannot be calculated for the current year', severity: 'medium', frameworks: ['ENERGY STAR'], fix: 'Push the missing period from Enertiv, or enter it in Portfolio Manager', owner: 'You', actions: ['enertiv', 'expected'], state: 'ST-D21' });
    }
    if (b.pmPropertyId && k % 8 === 4) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'ENERGY STAR meter overlap', family: 'ENERGY STAR', evidence: 'Periods from the client and from Enertiv overlap for 2 months at the handover', impact: 'Consumption for those months is counted twice in Portfolio Manager', severity: 'high', frameworks: ['ENERGY STAR', 'GRESB'], fix: 'Remove the client-entered periods after the handover date', owner: 'You', actions: ['enertiv', 'expected'], state: 'ST-D21' });
    }
    if (b.gfa === null) {
      addHealth({ buildingId: b.id, utility: null, object: { kind: 'building', id: b.id, label: b.name }, problem: 'Square footage missing', family: 'Coverage', evidence: 'No gross floor area on the building record or in Portfolio Manager', impact: 'Intensity and compliance exposure cannot be calculated', severity: 'high', frameworks: frameworksFor(b), fix: 'Confirm the gross floor area on the building record', owner: 'You', actions: ['expected'], state: 'ST-D13' });
    }
    if (b.historyMonths < 12) {
      addHealth({ buildingId: b.id, utility: 'electricity', object: { kind: 'building', id: b.id, label: b.name }, problem: 'Less than 12 months of history', family: 'Coverage', evidence: `${b.historyMonths} months of electricity data so far`, impact: `Not scorable until ${addMonths(AS_OF, 12 - b.historyMonths).slice(0, 7)}; ENERGY STAR and GRESB readiness are blocked`, severity: 'medium', frameworks: ['GRESB', 'ENERGY STAR'], fix: 'Upload older bills to backfill history', owner: 'You', actions: ['upload', 'expected'], state: 'ST-D12' });
    }
    if (b.occupancyHours === null) {
      addHealth({ buildingId: b.id, utility: null, object: { kind: 'building', id: b.id, label: b.name }, problem: 'Occupancy hours not set', family: 'Coverage', evidence: 'No weekly schedule on the building record', impact: 'Energy baselines and after-hours insights use a default schedule', severity: 'low', frameworks: [], fix: 'Set the building\'s weekly hours on its Spaces tab', owner: 'You', actions: ['expected'], state: 'ST-D22' });
    }
  });
  // Not-observable survey values (MOD-BI-72).
  for (const e of equipment.filter((x) => x.notObservable)) {
    addHealth({ buildingId: e.buildingId, utility: 'electricity', object: { kind: 'equipment', id: e.id, label: e.name }, problem: 'Surveyed value not observable', family: 'Survey', evidence: `${e.notObservable!.field}: ${e.notObservable!.reason}`, impact: 'Deliverable power for this building is unverified', severity: 'low', frameworks: [], fix: 'Book a return survey visit, or confirm with the utility', owner: 'Utility', actions: ['enertiv', 'expected'], state: 'ST-Q09' });
  }
  // A ticket raised and an item marked as expected (ST-O13).
  const ticketItem = health.find((h) => h.actions.includes('enertiv') && h.owner === 'Enertiv');
  if (ticketItem) ticketItem.ticket = { id: 'TCK-4821', status: 'In progress', kind: 'ticket', opened: daysAgo(3) };
  const expectedItem = health.find((h) => h.problem === '$0 bill');
  if (expectedItem) {
    expectedItem.status = 'expected';
    expectedItem.expectedReason = 'Space was vacant that month';
  }
  // Older resolved items, never deleted (MOD-BI-60).
  health.slice(0, Math.min(3, health.length)).forEach((h, k) => {
    if (k === 2 && h.status === 'open') h.status = 'resolved';
  });

  // ---------- Status, coverage and Gold Standard per building ----------
  for (const b of buildings) {
    const open = health.filter((h) => h.buildingId === b.id && h.status === 'open');
    const soldOpen = open.filter((h) => !h.utility || b.sold[h.utility]?.sold);
    const elecNone = b.tierByUtility.electricity === 0;
    b.status = elecNone || b.exposure.status === 'Non-compliant' ? 'critical' : soldOpen.some((h) => h.severity !== 'low') ? 'at-risk' : 'healthy';
    const lines: GoldLine[] = GOLD_LABELS.map((label, k) => {
      const line = k + 1;
      let state: GoldLine['state'] = 'met';
      if (line === 1 && elecNone) state = 'not-met';
      if (line === 2 && b.coverage < 0.75) state = 'not-met';
      if (line === 3 && b.nnn && b.coverage < 0.6) state = 'not-met';
      if (line === 4 && b.historyMonths < 12) state = 'not-met';
      if (line === 5 && !b.pmPropertyId) state = 'not-met';
      if (line === 6 && newAccount && buildings.indexOf(b) % 2 === 1) state = 'not-met';
      if (line === 7 && b.gfa === null) state = 'not-met';
      if (line === 8 && !b.sponsorUserId) state = 'not-met';
      if (line === 9 && !b.contactUserId) state = 'not-met';
      // ST-O03: a known exception.
      if (newAccount && line === 3 && buildings.indexOf(b) === 3) state = 'exception';
      return {
        line, label, state,
        note: state === 'exception' ? 'Single-tenant building; the tenant holds every account (confirmed by the client)' : undefined,
        contact: line <= 5 ? (line === 5 ? 'Enertiv Implementation' : 'Your Enertiv account team') : 'Your account Admin, with the chase agent following up',
      };
    });
    b.goldStandard = lines;
  }

  // ---------- Policies and accolades ----------
  const policies: Policy[] = [];
  const accolades: Accolade[] = [];
  buildings.forEach((b, k) => {
    const c = [...OFFICE_CITIES, ...INDUSTRIAL_CITIES].find((x) => x.city === b.city);
    c?.policies.forEach((p, pk) => {
      const due = p.type === 'BPS' ? '2027-05-01' : '2027-05-01';
      policies.push({
        id: `pol-${b.id}-${pk}`, buildingId: b.id, name: p.name, type: p.type, city: b.city, state: b.state, yearEnacted: p.year, applicable: (b.gfa ?? 0) > 25000, verified: k % 4 !== 3,
        compliancePeriod: p.type === 'BPS' ? '2024–2029' : 'Annual', deadline: due, submission: k % 5 === 4 ? 'Overdue' : p.type === 'BPS' ? 'Due' : k % 2 ? 'Submitted' : 'Due', exposure: p.type === 'BPS' ? b.exposure.potentialFine : 0,
      });
    });
    if (!industrial && r.chance(0.5)) {
      accolades.push({ id: `acc-${b.id}-1`, buildingId: b.id, name: 'LEED O+M', type: 'LEED', level: r.pick(['Certified', 'Silver', 'Gold', 'Platinum']), score: r.int(45, 88), awarded: `${r.int(2018, 2025)}-04-15`, expiry: `${r.int(2026, 2030)}-04-15`, source: 'USGBC' });
    }
    if (b.energyStarScore && b.energyStarScore >= 75) {
      accolades.push({ id: `acc-${b.id}-es`, buildingId: b.id, name: 'ENERGY STAR certification', type: 'ENERGY STAR', level: 'Certified', score: b.energyStarScore, awarded: '2025-08-01', expiry: '2026-08-01', source: 'Portfolio Manager' });
    }
  });

  // ---------- Alerts, rules, insights (tier 3 only) ----------
  const alerts: Alert[] = [];
  const alertRules: AlertRule[] = [];
  const insights: Insight[] = [];
  const INSIGHTS: [string, Insight['category'], string][] = [
    ['AHU running outside occupied hours', 'Scheduling', 'Supply fan ran 34 hours last week while the building was unoccupied'],
    ['Simultaneous heating and cooling', 'Setpoints', 'Reheat valves open while the chiller is loaded on floors 4 to 7'],
    ['Chiller short cycling', 'Equipment faults', '11 starts per day against a design of 4'],
    ['Peak demand spike at 7am startup', 'Demand', 'All AHUs start together, setting a 340 kW peak each Monday'],
    ['Lobby lighting on overnight', 'Lighting', 'Lighting panel L1 draws 18 kW between 11pm and 5am'],
    ['Economizer stuck closed', 'Equipment faults', 'Outside air damper at 0% while outdoor air is 58 °F'],
    ['Boiler running in shoulder season', 'Scheduling', 'Boiler on with outdoor temperature above 65 °F for 9 days'],
  ];
  buildings.filter((b) => b.tierByUtility.electricity === 3).forEach((b, bk) => {
    const eq = equipment.filter((e) => e.buildingId === b.id && e.kind === 'equipment');
    INSIGHTS.forEach(([title, category, evidence], k) => {
      if ((k + bk) % 3 === 2 && k > 3) return;
      const target = eq[k % Math.max(eq.length, 1)];
      insights.push({
        id: `ins-${b.id}-${k}`, buildingId: b.id, equipmentId: target?.id ?? null, title, description: `${title} at ${b.name}.`, category, valueUsd: r.int(3, 48) * 1000, valueTco2e: r.int(4, 90),
        status: k === 0 ? 'in-progress' : k === 4 ? 'implemented' : 'new', created: daysAgo(r.int(1, 90)), evidence,
      });
    });
    eq.slice(0, 4).forEach((e, k) => {
      alerts.push({ id: `al-${e.id}`, buildingId: b.id, equipmentId: e.id, title: [`${e.name} return air above 85 °F`, `${e.name} fault: fan failure`, `Possible water leak near ${e.name}`, `${e.name} offline`][k], severity: (['Medium', 'High', 'High', 'Low'] as const)[k], category: ['Temperature', 'Equipment fault', 'Water', 'Connectivity'][k], start: daysAgo(k * 2), end: k === 3 ? daysAgo(0) : null, acknowledged: k === 0, resolved: k === 3 });
    });
    eq.slice(0, 2).forEach((e, k) => {
      alertRules.push({ id: `ar-${e.id}`, equipmentId: e.id, title: k ? `${e.name} running after hours` : `${e.name} return air above 85 °F`, threshold: k ? 'Status on between 10pm and 5am' : 'Return air temperature > 85 °F for 15 min', severity: k ? 'Low' : 'Medium', days: 'Mon–Fri', time: k ? '22:00–05:00' : 'All day', repeatMinutes: 120, sendTo: 'Rosa Alvarez', description: k ? 'Unit should be off outside occupied hours' : 'Possible economizer or cooling fault', created: daysAgo(200), modified: daysAgo(30), enabled: true });
    });
  });

  // ---------- Files ----------
  const files: FileRec[] = [];
  buildings.forEach((b, k) => {
    const items: [string, FileRec['category'], FileRec['fileType'], FileRec['attachedTo']][] = [
      [`${b.name} site plan.pdf`, 'Drawing', 'PDF', { kind: 'building', id: b.id, label: b.name }],
      [`${b.name} electrical one-line (as built).dwg`, 'Drawing', 'DWG', { kind: 'building', id: b.id, label: b.name }],
    ];
    const eq = equipment.filter((e) => e.buildingId === b.id).slice(0, 2);
    eq.forEach((e) => items.push([`${e.name} nameplate.jpg`, 'Nameplate', 'JPG', { kind: 'equipment', id: e.id, label: e.name }]));
    const acc = accolades.find((a) => a.buildingId === b.id);
    if (acc) items.push([`${acc.name} certificate.pdf`, 'Certificate', 'PDF', { kind: 'building', id: b.id, label: b.name }]);
    const t = tenants.find((x) => x.buildingIds.includes(b.id) && x.loa.status === 'Signed');
    if (t) items.push([`${t.name} LOA.pdf`, 'LOA', 'PDF', { kind: 'tenant', id: t.id, label: t.name }]);
    items.slice(0, k % 3 === 0 ? items.length : 3).forEach(([name, category, fileType, attachedTo], fk) => {
      files.push({ id: `f-${b.id}-${fk}`, buildingId: b.id, name, fileType, attachedTo, category, start: category === 'Lease' || category === 'LOA' ? addMonths(AS_OF, -r.int(5, 40)) : null, expiry: category === 'Certificate' ? acc?.expiry ?? null : category === 'LOA' ? addMonths(AS_OF, r.int(6, 40)) : null, uploaded: daysAgo(r.int(5, 700)), uploadedBy: r.pick(['Rosa Alvarez', 'Enertiv Implementation', 'Maya Chen', 'Survey App']), description: '', greenLease: category === 'LOA' ? r.chance(0.3) : undefined });
    });
  });

  // ---------- Vendors ----------
  const vendors: Vendor[] = [
    ['Brightwater Mechanical', ['HVAC', 'Plumbing'], 'Preventive maintenance, chiller service', 'Mechanical contractor', true],
    ['Volt Line Electric', ['Electrical'], 'Panel upgrades, EV charging installs', 'Electrical contractor', true],
    ['ClearView Facade Services', ['Envelope'], 'Window film, facade repairs', 'Specialty contractor', false],
    ['Northstar Controls', ['Controls', 'BMS'], 'BMS programming and sequence tuning', 'Controls integrator', false],
    ['GreenCycle Waste', ['Waste'], 'Recycling and compost hauling', 'Service provider', false],
    ['Lumen LED Retrofits', ['Lighting'], 'LED retrofits and lighting controls', 'Lighting contractor', true],
  ].map(([name, categories, offerings, classification, preferred], k) => ({
    id: `v-${k}`, name: name as string, categories: categories as string[], offerings: offerings as string, classification: classification as string,
    locality: (industrial ? INDUSTRIAL_CITIES : OFFICE_CITIES)[k % 5].city, contact: { name: person(r), email: `service@${(name as string).split(' ')[0].toLowerCase()}.example`, phone: `(555) 02${r.int(10, 99)}-${r.int(1000, 9999)}`, role: 'Account manager' },
    preferred: preferred as boolean, buildingIds: r.shuffle(buildings).slice(0, Math.min(buildings.length, r.int(1, 6))).map((b) => b.id),
  }));

  // ---------- Chase requests (MOD-PPL-10, SYS-CHASE) ----------
  const requests: ChaseRequest[] = [];
  const stages: ChaseRequest['stage'][] = ['sent', 'reminded', 'escalated', 'not-sent', 'completed', 'declined', 'contact-unknown', 'moved-out'];
  health.filter((h) => h.owner === 'Tenant' && h.tenantId).slice(0, 10).forEach((h, k) => {
    const t = tenants.find((x) => x.id === h.tenantId)!;
    const stage = t.contacts.length === 0 ? 'contact-unknown' : stages[k % stages.length];
    requests.push({
      id: `rq-${k}`, to: { kind: 'tenant', id: t.id, name: t.name }, what: h.problem === 'Utility login is failing' ? 'Updated utility login or a letter of authorisation' : `${h.utility ?? 'Utility'} bill`,
      buildingId: h.buildingId, spaceId: t.spaceIds[0] ?? null, period: h.evidence.match(/\d{4}-\d{2}/)?.[0] ?? 'Last 12 months', stage,
      lastChased: stage === 'not-sent' || stage === 'contact-unknown' ? null : daysAgo(r.int(1, 14)), channel: t.contacts.length ? 'Email' : 'None',
      needsApproval: stage === 'not-sent' ? (k % 2 ? 'escalation' : 'first-of-kind') : null, declineReason: stage === 'declined' ? 'Tenant says the landlord holds this account' : undefined,
      broughtIn: stage === 'completed' ? '12 bills uploaded through the request link' : undefined, healthItemId: h.id,
    });
  });
  // Setup requests to contacts (Gold Standard lines 8, 9).
  buildings.filter((b) => !b.contactUserId).slice(0, 3).forEach((b, k) => {
    requests.push({ id: `rq-c-${k}`, to: { kind: 'contact', id: 'u-admin', name: 'Priya Shah' }, what: 'Name the on-site building contact', buildingId: b.id, spaceId: null, period: '—', stage: k === 0 ? 'escalated' : 'sent', lastChased: daysAgo(k + 2), channel: 'Email', needsApproval: null });
  });

  // ---------- Activity ----------
  const activity: ActivityItem[] = [];
  const whoList = ['Rosa Alvarez', 'Maya Chen', 'Enertiv Implementation', 'Chase agent', 'Survey App', 'David Okafor', 'Priya Shah'];
  for (let k = 0; k < Math.min(140, buildings.length * 8); k++) {
    const b = buildings[k % buildings.length];
    const pickKind = k % 5;
    const eq = equipment.filter((e) => e.buildingId === b.id);
    const mt = meters.filter((m) => m.buildingId === b.id);
    const ac = accounts.filter((a) => a.buildingId === b.id);
    const obj =
      pickKind === 0 && eq.length ? { kind: 'equipment' as const, id: eq[k % eq.length].id, label: eq[k % eq.length].name }
      : pickKind === 1 && mt.length ? { kind: 'meter' as const, id: mt[k % mt.length].id, label: mt[k % mt.length].name }
      : pickKind === 2 && ac.length ? { kind: 'account' as const, id: ac[k % ac.length].id, label: `Account ${ac[k % ac.length].accountNumber}` }
      : { kind: 'building' as const, id: b.id, label: b.name };
    const what = obj.kind === 'equipment' ? r.pick(['Condition changed from Good to Fair', 'Nameplate photo added', 'Surveyed', 'Model corrected']) : obj.kind === 'meter' ? r.pick(['Mapped to ENERGY STAR meter', 'Marked as used for metrics', 'Renamed']) : obj.kind === 'account' ? r.pick(['Bill extracted', 'Login updated', 'Extraction failed']) : r.pick(['Occupancy hours updated', 'Gross floor area confirmed', 'ENERGY STAR sync completed', 'Tenant moved in']);
    activity.push({ id: `act-${k}`, at: `${daysAgo(Math.floor(k / 3))}T${String(8 + (k % 10)).padStart(2, '0')}:${String((k * 7) % 60).padStart(2, '0')}:00`, who: r.pick(whoList), what, object: obj, buildingId: b.id });
  }

  // ---------- Plans, projects, goals ----------
  const plans: Plan[] = [];
  const projects: Project[] = [];
  if (def.entitlements.carbonPlanning && !newAccount && buildings.length > 1) {
    const planDefs: [string, Plan['status'], string, number][] = [
      ['Net zero 2030 — Fund I', 'under-review', 'Decarbonise fastest at lowest capital cost', 0],
      ['LL97 compliance 2030', 'approved', 'Avoid BPS fines first', 1],
      ['Electrification pilot', 'declined', 'Electrify heating at end of life', 2],
    ];
    planDefs.forEach(([name, status, strategy, k]) => {
      const bIds = k === 1 ? buildings.filter((b) => b.city === 'New York').map((b) => b.id) : buildings.slice(k, k + 6).map((b) => b.id);
      if (!bIds.length) bIds.push(buildings[0].id);
      const id = `plan-${k + 1}`;
      plans.push({
        id, name, status, strategy, conditions: ['Replace at end of life', 'Budget cap $4M per year', 'Keep tenants in place'], buildingIds: bIds, targetYear: k === 1 ? 2030 : 2030, reductionPct: k === 1 ? 40 : 55,
        narrative: `This plan reaches a ${k === 1 ? 40 : 55}% emissions reduction by 2030 across ${bIds.length} buildings. The largest gains come from replacing end-of-life heating plant with heat pumps and from controls work on the two flagships; together they cover about two thirds of the reduction at under a third of the capital. Buildings without an equipment survey use building-level estimates, marked as estimated.`,
        created: daysAgo(30 + k * 40),
      });
      bIds.forEach((bid, bk) => {
        const eq = equipment.filter((e) => e.buildingId === bid && e.kind === 'equipment' && (e.condition === 'Poor' || e.condition === 'Critical'));
        const types: Project['type'][] = ['HVAC', 'Lighting', 'Electrification', 'Controls', 'Envelope', 'Solar'];
        for (let p = 0; p < 2 + (bk % 2); p++) {
          const type = types[(p + bk) % types.length];
          const capex = r.int(4, 120) * 10000;
          const savings = Math.round(capex * r.float(0.06, 0.22));
          const target = eq[p];
          projects.push({
            id: `pr-${id}-${bid}-${p}`, planId: id, buildingId: bid, equipmentId: target?.id ?? null, name: target ? `Replace ${target.name} (${target.description})` : `${type} upgrade`, type,
            status: status === 'approved' ? r.pick(['Approved', 'In progress', 'Complete'] as const) : 'Proposed', priority: r.pick(['High', 'Medium', 'Low'] as const), capex, savingsUsd: savings, tco2e: r.int(10, 400),
            paybackYears: Math.round((capex / savings) * 10) / 10, year: r.int(2026, 2030), estimated: !target,
          });
        }
      });
    });
  }
  const goals: Goal[] = newAccount ? [] : [{ id: 'goal-1', name: 'Operational carbon −50% by 2030', baselineYear: 2019, targetYear: 2030, reductionPct: 50, pathway: 'CRREM 1.5°C' }];

  // ---------- Notifications ----------
  const notices: Notice[] = [];
  insights.slice(0, 6).forEach((ins, k) => notices.push({ id: `n-ins-${k}`, group: 'insights', title: ins.title, body: `${buildings.find((b) => b.id === ins.buildingId)?.name}: worth about $${ins.valueUsd.toLocaleString()} a year`, at: `${ins.created}T09:00:00`, read: k > 2, insightId: ins.id, buildingId: ins.buildingId }));
  alerts.filter((a) => !a.resolved).slice(0, 6).forEach((a, k) => notices.push({ id: `n-al-${k}`, group: 'building-alerts', title: a.title, body: `${a.severity} severity · ${buildings.find((b) => b.id === a.buildingId)?.name}`, at: `${a.start}T07:${String(10 + k).padStart(2, '0')}:00`, read: a.acknowledged, link: `/building-info/equipment/${a.equipmentId}?tab=alerts`, buildingId: a.buildingId }));
  health.filter((h) => h.status === 'open').slice(0, 10).forEach((h, k) => notices.push({ id: `n-dh-${k}`, group: 'data-alerts', title: h.problem, body: `${buildings.find((b) => b.id === h.buildingId)?.name} · ${h.object.label}`, at: `${h.opened}T08:00:00`, read: k > 3, link: `/building-info/data-health?item=${h.id}`, buildingId: h.buildingId }));
  activity.slice(0, 8).forEach((a, k) => notices.push({ id: `n-act-${k}`, group: 'activity', title: `${a.who}: ${a.what}`, body: a.object.label, at: a.at, read: k > 1, buildingId: a.buildingId }));
  requests.filter((q) => q.stage === 'completed' || q.stage === 'escalated').forEach((q, k) => notices.push({ id: `n-rq-${k}`, group: 'activity', title: q.stage === 'completed' ? `${q.to.name} completed a request` : `Request to ${q.to.name} escalated`, body: q.what, at: `${q.lastChased ?? AS_OF}T10:00:00`, read: false, link: '/people/tenants?filter=requests', buildingId: q.buildingId }));
  notices.push({ id: 'n-app-1', group: 'app-updates', title: 'Workspaces can now be scheduled', body: 'Set a cadence and recipients on any report workspace.', at: `${daysAgo(4)}T12:00:00`, read: false });
  notices.push({ id: 'n-app-2', group: 'app-updates', title: 'Data Health replaces the data inbox', body: 'Every data problem in scope, with its fix and owner, in one list.', at: `${daysAgo(11)}T12:00:00`, read: true });

  return {
    scenario,
    scenarioName: def.name,
    company: def.company,
    companies: [def.company, ...def.others],
    entitlements: def.entitlements,
    groups,
    buildings,
    spaces,
    tenants,
    equipment,
    meters,
    accounts,
    bills,
    files,
    health,
    policies,
    accolades,
    alerts,
    alertRules,
    insights,
    activity: activity.sort((a, b) => b.at.localeCompare(a.at)),
    users,
    teams,
    vendors,
    managementCompanies: mgmt,
    requests,
    notices: notices.sort((a, b) => b.at.localeCompare(a.at)),
    plans,
    projects,
    goals,
    standIns: { sl: 'u-sl', am: 'u-am', pm: 'u-pm', none: 'u-sl' },
    source: 'Synthetic',
    asOf: AS_OF,
  };
}

function defaultHours(industrial: boolean) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days.map((day, k) => ({
    day,
    from: industrial ? '06:00' : k < 5 ? '07:00' : k === 5 ? '09:00' : null,
    to: industrial ? '22:00' : k < 5 ? '19:00' : k === 5 ? '14:00' : null,
    semiFrom: !industrial && k < 5 ? '19:00' : null,
    semiTo: !industrial && k < 5 ? '21:00' : null,
  }));
}
