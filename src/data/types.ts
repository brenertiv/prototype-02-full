/**
 * The prototype's data model. Shapes follow today's entities where they exist
 * (`02-building/system/data-model.md`, `reference/enertiv-taxonomy-audit.md`);
 * every record here is synthetic scenario data (JNY-DATA-04), labelled as such
 * in the test panel. No real client names, addresses or identifiers.
 */

export type ScenarioId = 'SC-1' | 'SC-2' | 'SC-3' | 'SC-4' | 'SC-5' | 'SC-6';
export type PersonaId = 'am' | 'sl' | 'pm' | 'none';
export type RoleId = 'admin' | 'billing' | 'operator' | 'vendor' | 'tenant';

export type Utility = 'electricity' | 'gas' | 'water' | 'steam';
export const UTILITIES: Utility[] = ['electricity', 'gas', 'water', 'steam'];

/** Data tier per utility, derived from the data actually flowing (SYS-TRUST-20). */
export type Tier = 0 | 1 | '2a' | '2b' | 3;

/** Building data status, never a score (SYS-TRUST-35). */
export type DataStatus = 'healthy' | 'at-risk' | 'critical';

/** Onboarding stage of a sold utility (SYS-ACCESS-29). */
export type OnboardingStage = 'scoping' | 'install' | 'schedule' | 'ops' | 'training' | 'live';

export interface ObjectRef {
  kind: 'building' | 'equipment' | 'meter' | 'account' | 'bill' | 'file' | 'space' | 'tenant' | 'user' | 'plan' | 'workspace' | 'insight';
  id: string;
  label: string;
}

export interface Company {
  id: string;
  name: string;
  initials: string;
  /** The current user's relationship to it (ST-N04). */
  membership: string;
  guest?: boolean;
}

export interface Group {
  id: string;
  name: string;
  /** Client-labelled level name (Fund, Region, …). */
  kind: string;
  parentId?: string;
  buildingIds: string[];
}

export interface UtilitySold {
  sold: boolean;
  stage?: OnboardingStage;
}

/** One of the nine Gold Standard lines (SYS-GOLD-01). */
export interface GoldLine {
  line: number;
  label: string;
  state: 'met' | 'not-met' | 'exception';
  note?: string;
  /** Who acts on it when the user can't (MOD-BI-07). */
  contact: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  type: 'Office' | 'Industrial' | 'Retail' | 'Multifamily' | 'Mixed use' | 'Lab';
  timezone: string;
  lat: number;
  lng: number;
  gfa: number | null;
  yearBuilt: number;
  floors: number;
  integrationDate: string;
  managementCompanyId: string;
  groupIds: string[];
  /** Tenant-controlled (NNN) consumption (ST-TNNN). */
  nnn: boolean;
  tierByUtility: Partial<Record<Utility, Tier>>;
  sold: Partial<Record<Utility, UtilitySold>>;
  status: DataStatus;
  coverage: number;
  completeness: number;
  historyMonths: number;
  energyStarScore: number | null;
  pmPropertyId: string | null;
  esLastSynced: string | null;
  esDirection: 'Enertiv → Portfolio Manager' | 'Portfolio Manager → Enertiv' | null;
  siteEui: number | null;
  euiBenchmark: number;
  /** Annual energy (kWh-equivalent) and cost, last 12 months. */
  energyKwh: number;
  energyCost: number;
  /** tCO2e, last 12 months, split by operational control. */
  emissions: { scope1: number; scope2: number; scope3: number; landlordShare: number };
  /** Compliance exposure from Portfolio Diagnostics (MOD-WS-14). */
  exposure: { potentialFine: number; costAvoided: number; status: 'Compliant' | 'At risk' | 'Non-compliant' | 'Not covered' };
  deliverablePowerMw: number | null;
  /** Only where interval data exists (MOD-BI-71). */
  availablePowerMw: number | null;
  powerSurveyed: 'full' | 'missing-ratings' | 'not-surveyed';
  hasEquipmentSurvey: boolean;
  occupancyHours: OccupancyDay[] | null;
  goldStandard: GoldLine[];
  contactUserId: string | null;
  sponsorUserId: string | null;
  inactive?: boolean;
  synthetic: true;
}

export interface OccupancyDay {
  day: string;
  from: string | null;
  to: string | null;
  semiFrom?: string | null;
  semiTo?: string | null;
}

export interface Space {
  id: string;
  buildingId: string;
  floor: number;
  name: string;
  areaType: 'Office' | 'Warehouse' | 'Retail' | 'Common area' | 'Lab' | 'Residential';
  sqft: number;
  capacity: number;
  tenantId: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  /** Equipment ids of the services and panels that feed it (MOD-BI-73). */
  fedBy: string[];
  deliverableKw: number | null;
}

export interface Contact {
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  buildingIds: string[];
  spaceIds: string[];
  leasedSqft: number;
  moveIn: string;
  moveOut: string | null;
  prior: boolean;
  contacts: Contact[];
  loa: { status: 'Signed' | 'Requested' | 'Expired' | 'None'; signed?: string; expires?: string; accounts: string[] };
}

export type EquipmentKind = 'equipment' | 'service' | 'transformer' | 'panel';

export interface Equipment {
  id: string;
  buildingId: string;
  spaceId: string | null;
  floor: number | null;
  name: string;
  description: string;
  /** Derived from the primary tag; null when there is none (SYS-DATA-04, ST-Q06). */
  type: string | null;
  kind: EquipmentKind;
  parentId: string | null;
  dataSource: 'Survey' | 'BMS' | 'Enertiv sensors' | 'None';
  make: string | null;
  model: string | null;
  capacity: string | null;
  installDate: string | null;
  condition: 'Good' | 'Fair' | 'Poor' | 'Critical' | null;
  expectedEol: number | null;
  retired: boolean;
  surveyedAt: string | null;
  editedBy: { who: string; at: string } | null;
  /** Gear ratings (register row 8). */
  ratings?: {
    kva?: number | null;
    primaryV?: number | null;
    secondaryV?: number | null;
    amps?: number | null;
    voltage?: string | null;
    phases?: number | null;
    provider?: string;
    feedType?: string;
    feeds?: number;
    redundancy?: string;
    meterAccount?: string;
    deliverableKw?: number | null;
    availableKw?: number | null;
  };
  notObservable?: { field: string; reason: string; photo: boolean } | null;
  components: number;
}

export interface Meter {
  id: string;
  buildingId: string;
  spaceId: string | null;
  floor: number | null;
  name: string;
  kind: 'enertiv' | 'energy-star';
  utility: Utility;
  unit: string;
  dataSource: 'Utility bills' | 'Interval (utility)' | 'Submeter' | 'Manual reads' | 'ENERGY STAR' | 'BMS';
  accountId: string | null;
  /** The ENERGY STAR meter this Enertiv meter maps to, or vice versa. */
  mappedTo: string | null;
  usedForMetrics: boolean;
  reporting: boolean;
  daysSinceData: number | null;
  uptime: number | null;
  completeness: number | null;
  zeros: 'none' | 'expected' | 'unexpected';
  feedsEquipmentId: string | null;
  inScope: boolean;
  esFirstBillDate: string | null;
}

export interface UtilityAccount {
  id: string;
  buildingId: string;
  provider: string;
  utility: Utility;
  accountNumber: string;
  /** 'landlord' or a tenant id (MOD-BI-69). */
  holder: string;
  tariff: string;
  credentials: 'Working' | 'Failed' | 'Not needed';
  enrolment: 'Enrolled' | 'Pending' | 'Not enrolled';
  extraction: 'Successful' | 'Failed' | 'Pending' | 'Paused';
  lastExtracted: string | null;
  lastSuccessful: string | null;
  nextExpected: string | null;
  enabled: boolean;
  closed: boolean;
  meterIds: string[];
  /** Supply and delivery pairs (MOD-BI-12). */
  pairedWith: string | null;
  role: 'Bundled' | 'Supply' | 'Delivery';
}

export interface BillLine {
  charge: string;
  amount: number;
  mapsTo: string;
}

export interface Bill {
  id: string;
  accountId: string;
  buildingId: string;
  start: string;
  end: string;
  issued: string;
  cost: number;
  consumption: number;
  unit: string;
  estimated: boolean;
  source: 'Extracted' | 'Uploaded';
  lines: BillLine[];
}

export interface FileRec {
  id: string;
  buildingId: string;
  name: string;
  fileType: 'PDF' | 'JPG' | 'XLSX' | 'DWG' | 'PNG';
  attachedTo: ObjectRef;
  category: 'Lease' | 'Drawing' | 'Survey photo' | 'Certificate' | 'LOA' | 'Nameplate' | 'Report' | 'Other';
  start: string | null;
  expiry: string | null;
  uploaded: string;
  uploadedBy: string;
  description: string;
  greenLease?: boolean;
}

export type HealthFamily = 'Bills' | 'Utility logins' | 'Meters' | 'Coverage' | 'ENERGY STAR' | 'Survey';
export type HealthStatus = 'open' | 'expected' | 'resolved';

export interface HealthItem {
  id: string;
  buildingId: string;
  utility: Utility | null;
  object: ObjectRef;
  problem: string;
  family: HealthFamily;
  evidence: string;
  impact: string;
  severity: 'low' | 'medium' | 'high';
  frameworks: string[];
  fix: string;
  owner: 'You' | 'Enertiv' | 'Tenant' | 'Client admin' | 'Utility';
  status: HealthStatus;
  opened: string;
  lastChecked: string;
  expectedReason?: string;
  ticket?: { id: string; status: 'Open' | 'In progress' | 'Resolved'; kind: 'ticket' | 'rep'; opened: string } | null;
  /** Which actions fit this item (MOD-BI-17). */
  actions: ('expected' | 'upload' | 'tenant' | 'enertiv')[];
  tenantId?: string;
  state?: string;
}

export interface Policy {
  id: string;
  buildingId: string;
  name: string;
  type: 'Benchmarking' | 'BPS';
  city: string;
  state: string;
  yearEnacted: number;
  applicable: boolean;
  verified: boolean;
  compliancePeriod: string;
  deadline: string;
  submission: 'Submitted' | 'Due' | 'Overdue' | 'Not required';
  exposure: number;
}

export interface Accolade {
  id: string;
  buildingId: string;
  name: string;
  type: 'LEED' | 'ENERGY STAR' | 'BREEAM' | 'Fitwel' | 'WELL';
  level: string;
  score: number | null;
  awarded: string;
  expiry: string | null;
  source: string;
}

export interface Alert {
  id: string;
  buildingId: string;
  equipmentId: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
  category: string;
  start: string;
  end: string | null;
  acknowledged: boolean;
  resolved: boolean;
}

export interface AlertRule {
  id: string;
  equipmentId: string;
  title: string;
  threshold: string;
  severity: 'Low' | 'Medium' | 'High';
  days: string;
  time: string;
  repeatMinutes: number;
  sendTo: string;
  description: string;
  created: string;
  modified: string;
  enabled: boolean;
}

export interface Insight {
  id: string;
  buildingId: string;
  equipmentId: string | null;
  title: string;
  description: string;
  category: 'Scheduling' | 'Setpoints' | 'Equipment faults' | 'Demand' | 'Lighting';
  valueUsd: number;
  valueTco2e: number;
  status: 'new' | 'in-progress' | 'implemented';
  created: string;
  evidence: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  who: string;
  what: string;
  object: ObjectRef;
  buildingId: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  persona: PersonaId;
  role: RoleId;
  appAccess: 'web' | 'survey';
  /** Direct grants; teams add their own scope (MOD-PPL-14). */
  scope: { all: boolean; groupIds: string[]; buildingIds: string[] };
  teamIds: string[];
  status: 'invited' | 'active' | 'never' | 'deactivated';
  lastActive: string | null;
  invitedBy: string | null;
  invited: string | null;
  firm: string | null;
  chaseRules?: { maxPerWeek: number; channels: string[] };
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
  scope: { groupIds: string[]; buildingIds: string[] };
  defaultRole: RoleId;
  canManageChase: boolean;
  proposed?: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  categories: string[];
  offerings: string;
  classification: string;
  locality: string;
  contact: Contact;
  preferred: boolean;
  buildingIds: string[];
}

export interface ManagementCompany {
  id: string;
  name: string;
  thirdParty: boolean;
  assignments: { buildingId: string; start: string; end: string | null }[];
}

export type ChaseStage = 'not-sent' | 'sent' | 'reminded' | 'escalated' | 'completed' | 'declined' | 'contact-unknown' | 'moved-out';

export interface ChaseRequest {
  id: string;
  to: { kind: 'tenant' | 'contact'; id: string; name: string };
  what: string;
  buildingId: string;
  spaceId: string | null;
  period: string;
  stage: ChaseStage;
  lastChased: string | null;
  channel: 'Email' | 'SMS' | 'None';
  needsApproval: 'first-of-kind' | 'escalation' | null;
  declineReason?: string;
  broughtIn?: string;
  healthItemId?: string;
}

export interface Notice {
  id: string;
  group: 'insights' | 'activity' | 'building-alerts' | 'data-alerts' | 'app-updates';
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Route inside the company/scope, or an insight id for the drawer. */
  link?: string;
  insightId?: string;
  buildingId?: string | null;
}

export interface Project {
  id: string;
  planId: string;
  buildingId: string;
  equipmentId: string | null;
  name: string;
  type: 'HVAC' | 'Lighting' | 'Electrification' | 'Envelope' | 'Controls' | 'Solar';
  status: 'Proposed' | 'Approved' | 'In progress' | 'Complete';
  priority: 'High' | 'Medium' | 'Low';
  capex: number;
  savingsUsd: number;
  tco2e: number;
  paybackYears: number;
  year: number;
  estimated: boolean;
}

export interface Plan {
  id: string;
  name: string;
  status: 'under-review' | 'approved' | 'declined';
  strategy: string;
  conditions: string[];
  buildingIds: string[];
  targetYear: number;
  reductionPct: number;
  narrative: string;
  created: string;
}

export interface Goal {
  id: string;
  name: string;
  baselineYear: number;
  targetYear: number;
  reductionPct: number;
  pathway: 'CRREM 1.5°C' | 'SBTi' | 'Custom';
}

export interface Entitlements {
  energyEsg: boolean;
  carbonPlanning: boolean;
  equipmentOptimization: boolean;
  submeter: boolean;
  tenantBilling: boolean;
  maintenance: boolean;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  kwh: number | null;
  cost: number | null;
  tco2e: number | null;
  estimated: boolean;
  /** Who wrote the period to ENERGY STAR (MOD-BI-63). */
  writer: 'client' | 'enertiv' | 'both' | 'missing';
}

export interface Dataset {
  scenario: ScenarioId;
  scenarioName: string;
  company: Company;
  companies: Company[];
  entitlements: Entitlements;
  groups: Group[];
  buildings: Building[];
  spaces: Space[];
  tenants: Tenant[];
  equipment: Equipment[];
  meters: Meter[];
  accounts: UtilityAccount[];
  bills: Bill[];
  files: FileRec[];
  health: HealthItem[];
  policies: Policy[];
  accolades: Accolade[];
  alerts: Alert[];
  alertRules: AlertRule[];
  insights: Insight[];
  activity: ActivityItem[];
  users: User[];
  teams: Team[];
  vendors: Vendor[];
  managementCompanies: ManagementCompany[];
  requests: ChaseRequest[];
  notices: Notice[];
  plans: Plan[];
  projects: Project[];
  goals: Goal[];
  /** The scenario's stand-in user per persona (JNY-DATA-05). */
  standIns: Partial<Record<PersonaId, string>>;
  /** Snapshot version, or 'Synthetic'. */
  source: string;
  asOf: string;
}
