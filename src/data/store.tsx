/**
 * The prototype API. Serves the scenario dataset with the per-session write overlay laid on top
 * (`04-handoff/technical-approach/stack-and-architecture.md`, Data approach): every change a
 * tester makes is a patch kept in the browser, never a write anywhere else (JNY-DATA-01).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTestConfig } from '../config/testConfig';
import { generate } from './generate';
import type { Building, Dataset, PersonaId, RoleId, User } from './types';

type CollectionKey = {
  [K in keyof Dataset]: Dataset[K] extends Array<{ id: string }> ? K : never;
}[keyof Dataset];

export interface Overlay {
  patches: Partial<Record<CollectionKey, Record<string, Record<string, unknown>>>>;
  added: Partial<Record<CollectionKey, { id: string }[]>>;
  /** Feature-owned state: custom workspaces, threads, last workspace, onboarding, hints. */
  app: Record<string, unknown>;
}

const EMPTY: Overlay = { patches: {}, added: {}, app: {} };
const keyFor = (scenario: string) => `kw.overlay.${scenario}`;

function loadOverlay(scenario: string): Overlay {
  try {
    const raw = localStorage.getItem(keyFor(scenario));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Overlay) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function applyOverlay(base: Dataset, overlay: Overlay): Dataset {
  const out = { ...base } as Record<string, unknown>;
  const keys = new Set([...Object.keys(overlay.patches), ...Object.keys(overlay.added)]) as Set<CollectionKey>;
  for (const k of keys) {
    const list = base[k] as unknown as { id: string }[];
    const patches = overlay.patches[k] ?? {};
    const added = overlay.added[k] ?? [];
    const merged = [...added, ...list].map((item) => (patches[item.id] ? { ...item, ...patches[item.id] } : item));
    out[k] = merged;
  }
  return out as unknown as Dataset;
}

export interface CurrentUser extends User {
  /** The persona in effect: the test config's, or the user's own after Profile changes it. */
  persona: PersonaId;
  role: RoleId;
}

interface Ctx {
  data: Dataset;
  user: CurrentUser;
  /** Buildings this user can access (SYS-ACCESS-23). */
  accessible: Set<string>;
  overlay: Overlay;
  patch: <K extends CollectionKey>(collection: K, id: string, partial: Record<string, unknown>) => void;
  add: <K extends CollectionKey>(collection: K, record: { id: string }) => void;
  setApp: (key: string, value: unknown) => void;
  getApp: <T>(key: string, fallback: T) => T;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { config } = useTestConfig();
  const base = useMemo(() => generate(config.scenario), [config.scenario]);
  const [overlay, setOverlay] = useState<Overlay>(() => loadOverlay(config.scenario));
  const scenarioRef = useRef(config.scenario);

  useEffect(() => {
    if (scenarioRef.current !== config.scenario) {
      scenarioRef.current = config.scenario;
      setOverlay(loadOverlay(config.scenario));
    }
  }, [config.scenario]);

  useEffect(() => {
    try {
      localStorage.setItem(keyFor(scenarioRef.current), JSON.stringify(overlay));
    } catch {
      /* the overlay still lives for this page load */
    }
  }, [overlay]);

  const data = useMemo(() => applyOverlay(base, overlay), [base, overlay]);

  const user = useMemo<CurrentUser>(() => {
    const id = base.standIns[config.persona] ?? 'u-sl';
    const record = data.users.find((u) => u.id === id) ?? data.users[0];
    const personaOverride = overlay.app.personaOverride as PersonaId | undefined;
    const persona = personaOverride ?? config.persona;
    if (config.role === 'vendor') {
      const v = data.users.find((u) => u.role === 'vendor')!;
      return { ...v, persona: 'none', role: 'vendor' };
    }
    return { ...record, persona, role: config.role };
  }, [base, data.users, config.persona, config.role, overlay.app.personaOverride]);

  const accessible = useMemo(() => {
    const set = new Set<string>();
    const add = (scope: { groupIds: string[]; buildingIds: string[] }) => {
      scope.buildingIds.forEach((b) => set.add(b));
      scope.groupIds.forEach((g) => data.groups.find((x) => x.id === g)?.buildingIds.forEach((b) => set.add(b)));
    };
    if (user.role === 'admin' || user.role === 'billing' || user.scope.all) {
      data.buildings.forEach((b) => set.add(b.id));
      return set;
    }
    add(user.scope);
    for (const t of data.teams) if (t.memberIds.includes(user.id)) add(t.scope);
    if (!set.size) data.buildings.slice(0, 1).forEach((b) => set.add(b.id));
    return set;
  }, [data, user]);

  const patch = useCallback((collection: CollectionKey, id: string, partial: Record<string, unknown>) => {
    setOverlay((o) => ({
      ...o,
      patches: { ...o.patches, [collection]: { ...(o.patches[collection] ?? {}), [id]: { ...(o.patches[collection]?.[id] ?? {}), ...partial } } },
    }));
  }, []);

  const add = useCallback((collection: CollectionKey, record: { id: string }) => {
    setOverlay((o) => ({ ...o, added: { ...o.added, [collection]: [record, ...(o.added[collection] ?? [])] } }));
  }, []);

  const setApp = useCallback((key: string, value: unknown) => {
    setOverlay((o) => ({ ...o, app: { ...o.app, [key]: value } }));
  }, []);

  const getApp = useCallback(<T,>(key: string, fallback: T): T => (key in overlay.app ? (overlay.app[key] as T) : fallback), [overlay.app]);

  const value = useMemo<Ctx>(() => ({ data, user, accessible, overlay, patch, add, setApp, getApp }), [data, user, accessible, overlay, patch, add, setApp, getApp]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}

/** Lookup helpers used across sections. */
export function useLookup() {
  const { data } = useData();
  return useMemo(() => {
    const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    return {
      building: byId(data.buildings),
      space: byId(data.spaces),
      tenant: byId(data.tenants),
      equipment: byId(data.equipment),
      meter: byId(data.meters),
      account: byId(data.accounts),
      bill: byId(data.bills),
      file: byId(data.files),
      user: byId(data.users),
      team: byId(data.teams),
      vendor: byId(data.vendors),
      mgmt: byId(data.managementCompanies),
      group: byId(data.groups),
      insight: byId(data.insights),
      plan: byId(data.plans),
      health: byId(data.health),
    };
  }, [data]);
}

/**
 * Simulated API latency and failures from the test configuration (ST-X01, ST-X02).
 * `path` is matched against `fail` entries; '*' fails everything.
 */
export function useApi<T>(path: string, select: () => T, deps: unknown[] = []): { status: 'loading' | 'error' | 'ready'; data: T | null; retry: () => void } {
  const { config } = useTestConfig();
  const failing = config.fail.includes('*') || config.fail.some((f) => f && path.includes(f));
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(config.latencyMs > 0 || failing ? 'loading' : 'ready');
  const value = useMemo(select, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (config.latencyMs <= 0 && !failing) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    const t = window.setTimeout(() => setStatus(failing ? 'error' : 'ready'), Math.max(config.latencyMs, failing ? 400 : 0));
    return () => window.clearTimeout(t);
  }, [path, attempt, config.latencyMs, failing]);

  return { status, data: status === 'ready' ? value : null, retry: () => setAttempt((a) => a + 1) };
}

export function buildingLabel(b: Building | undefined) {
  return b ? b.name : 'Unknown building';
}
