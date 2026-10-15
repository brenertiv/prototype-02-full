/**
 * The Workspace model (MOD-WS-45 to 54): one canvas holding a live dashboard, a report or a
 * carbon plan, built from the component library below. Pre-built workspaces are code; custom
 * ones, their threads and schedules live in the overlay through `setApp`.
 */
import type { ProvenanceInfo } from '../ui/bits';

export type WsKind = 'dashboard' | 'report' | 'plan';

export type CompType =
  | 'readiness-kpis'
  | 'framework-readiness'
  | 'coverage-gaps'
  | 'es-sync'
  | 'exposure-kpis'
  | 'exposure-ranked'
  | 'asset-figures'
  | 'data-problems'
  | 'capital-projects'
  | 'equipment-eol'
  | 'insights-ranked'
  | 'emissions-split'
  | 'energy-monthly'
  | 'goal-progress'
  | 'eui-ranked'
  | 'load-profiles'
  | 'buildings-overview'
  | 'setup-progress'
  | 'templates'
  | 'report-cover'
  | 'gresb-table'
  | 'summary-table'
  | 'business-case'
  | 'plan-overview'
  | 'plan-narrative'
  | 'plan-pathway'
  | 'plan-projects';

export type RuleId = 'worst-exposure' | 'worst-eui' | 'worst-coverage' | 'most-emissions';

/** How a component picks its buildings within the workspace's scope (MOD-WS-51). */
export type Binding = { kind: 'scope' } | { kind: 'rule'; rule: RuleId; n: number } | { kind: 'pinned'; buildingIds: string[] };

export interface CompSpec {
  id: string;
  type: CompType;
  title?: string;
  view?: 'chart' | 'table';
  period?: 'monthly' | 'annual';
  years?: number[];
  metric?: 'kwh' | 'cost' | 'tco2e';
  utility?: 'electricity' | 'gas';
  binding?: Binding;
  /** Equipment end of life: the window in years. */
  window?: number;
}

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type RunPeriod = 'previous-day' | 'previous-week' | 'previous-month' | 'previous-quarter' | 'year-to-date' | 'last-12-months';

export interface Schedule {
  enabled: boolean;
  cadence: Cadence;
  period: RunPeriod;
  /** Team member ids or email addresses. */
  recipients: string[];
  createdAt: string;
}

export interface Run {
  id: string;
  at: string;
  period: string;
  status: 'sent' | 'incomplete' | 'failed';
  recipients: number;
  note?: string;
}

export interface ReportPeriod {
  id: string;
  label: string;
  /** YYYY-MM, inclusive. */
  from: string;
  to: string;
}

export interface Workspace {
  id: string;
  name: string;
  kind: WsKind;
  /** A user id, or 'enertiv' for pre-built workspaces. */
  ownerId: string;
  scopeId: string;
  createdAt: string;
  updatedAt: string;
  components: CompSpec[];
  prebuilt?: boolean;
  /** What a pre-built workspace answers, shown under its title. */
  question?: string;
  period?: ReportPeriod;
  framework?: string;
  status: 'generating' | 'waiting' | 'ready' | 'failed';
  genStep?: number;
  failedStep?: number;
  retried?: boolean;
  brief?: string;
  templateId?: string;
  schedule?: Schedule;
  runs?: Run[];
  generatedAt?: string;
  receivedFrom?: { userId: string; name: string; at: string };
  planId?: string;
  /** What the assistant asked before generating (MOD-WS-49). */
  ask?: 'period' | 'framework';
}

export type MsgKind = 'text' | 'question' | 'steps' | 'confirm' | 'not-bought' | 'edit' | 'created' | 'note';

export interface Chip {
  compId: string;
  label: string;
}

export interface Msg {
  id: string;
  role: 'user' | 'assistant';
  kind: MsgKind;
  text: string;
  at: string;
  chips?: Chip[];
  options?: string[];
  answered?: string;
  /** Inner paths (section-relative) the answer rests on. */
  sources?: { label: string; to: string }[];
  facts?: { label: string; value: string; info: ProvenanceInfo }[];
  items?: { label: string; detail?: string; to?: string }[];
  confirm?: { action: 'ack-alert' | 'schedule-report'; targetId: string; label: string; state: 'pending' | 'done' | 'cancelled' };
  /** For 'steps' and 'created': the workspace it is about. */
  wsId?: string;
  /** For 'edit': the component changed. */
  compId?: string;
  tone?: 'low-confidence' | 'no-data' | 'scope';
  /** A follow-up action rendered as a button. */
  action?: { label: string; kind: 'edit-copy' | 'open'; wsId: string };
}
