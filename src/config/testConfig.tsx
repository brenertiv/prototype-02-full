/**
 * The test configuration contract (`skills/kilowatt-prototype-testing/test-config.md`,
 * JNY-DATA-09 to 12). Read once from the URL or a named preset, kept in sessionStorage under
 * `kw.test`, and locked in session mode so participants see no test control.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import presetsJson from '../../test-presets.json';
import statesJson from '../../test-states.json';
import type { PersonaId, RoleId, ScenarioId } from '../data/types';

export interface TestConfig {
  scenario: ScenarioId;
  persona: PersonaId;
  role: RoleId;
  start?: string;
  latencyMs: number;
  fail: string[];
  genDelayMs: number;
  genFail: boolean;
  state?: string;
  /** Prototype extension: show First App Onboarding (ST-P07). */
  firstLogin?: boolean;
}

export type Mode = 'review' | 'session';

interface Stored {
  config: TestConfig;
  locked: boolean;
  preset?: string;
  participant?: string;
}

type PresetEntry = Partial<TestConfig> & { scenario: ScenarioId; persona: PersonaId; role: RoleId };
export const PRESETS = presetsJson as Record<string, PresetEntry>;
export const STATES = statesJson as Record<string, Partial<TestConfig>>;

export const DEFAULT_CONFIG: TestConfig = {
  scenario: 'SC-2',
  persona: 'sl',
  role: 'admin',
  latencyMs: 0,
  fail: [],
  genDelayMs: 4500,
  genFail: false,
};

const KEY = 'kw.test';
const TEST_PARAMS = ['session', 'p', 'review', 'scenario', 'persona', 'role', 'start', 'latency', 'fail', 'gen-delay', 'gen-fail', 'state'];

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(s: Stored) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked storage: the config still applies for this page load */
  }
}

/** Resolve the config at startup. Returns the start route to open, if the link asked for one. */
function resolve(): { stored: Stored; startRoute: string | null } {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const existing = readStored();

  // Session mode: once locked, every other parameter is ignored until /reset.
  if (existing?.locked) {
    stripParams(url);
    return { stored: existing, startRoute: null };
  }

  const presetName = params.get('session');
  if (presetName && PRESETS[presetName]) {
    const stored: Stored = { config: { ...DEFAULT_CONFIG, ...PRESETS[presetName] }, locked: true, preset: presetName, participant: params.get('p') ?? undefined };
    writeStored(stored);
    stripParams(url);
    return { stored, startRoute: stored.config.start ?? '/workspace' };
  }

  let config: TestConfig = { ...DEFAULT_CONFIG, ...(existing?.config ?? {}) };
  let startRoute: string | null = null;
  const stateId = params.get('state');
  if (stateId && STATES[stateId]) {
    config = { ...DEFAULT_CONFIG, ...STATES[stateId], state: stateId };
    startRoute = config.start ?? null;
  }
  else if (TEST_PARAMS.some((p) => params.has(p))) {
    // A plain link starts clean: a state's one-off settings don't carry over.
    config = { ...config, state: undefined, firstLogin: false, start: undefined };
  }
  const scenario = params.get('scenario');
  if (scenario && /^SC-[1-6]$/.test(scenario)) config.scenario = scenario as ScenarioId;
  const persona = params.get('persona');
  if (persona && ['am', 'sl', 'pm', 'none'].includes(persona)) config.persona = persona as PersonaId;
  const role = params.get('role');
  if (role && ['admin', 'billing', 'operator', 'vendor', 'tenant'].includes(role)) config.role = role as RoleId;
  if (params.get('latency')) config.latencyMs = Number(params.get('latency')) || 0;
  if (params.get('fail')) config.fail = params.get('fail')!.split(',');
  if (params.get('gen-delay')) config.genDelayMs = Number(params.get('gen-delay')) || 0;
  if (params.has('gen-fail')) config.genFail = params.get('gen-fail') !== '0';
  if (params.get('start')) startRoute = params.get('start');

  const touched = TEST_PARAMS.some((p) => params.has(p));
  const stored: Stored = { config, locked: false };
  writeStored(stored);
  if (touched) stripParams(url);
  return { stored, startRoute };
}

function stripParams(url: URL) {
  let changed = false;
  for (const p of TEST_PARAMS) {
    if (url.searchParams.has(p)) {
      url.searchParams.delete(p);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
}

interface Ctx {
  config: TestConfig;
  mode: Mode;
  preset?: string;
  participant?: string;
  /** A start route the link asked for, consumed once by the router. */
  startRoute: string | null;
  consumeStart: () => void;
  update: (patch: Partial<TestConfig>) => void;
  buildCommit: string;
}

const TestContext = createContext<Ctx | null>(null);

const initial = resolve();

export function TestConfigProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(initial.stored);
  const [startRoute, setStartRoute] = useState<string | null>(initial.startRoute);

  const update = useCallback((patch: Partial<TestConfig>) => {
    setStored((s) => {
      if (s.locked) return s;
      const next = { ...s, config: { ...s.config, ...patch } };
      writeStored(next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      config: stored.config,
      mode: stored.locked ? 'session' : 'review',
      preset: stored.preset,
      participant: stored.participant,
      startRoute,
      consumeStart: () => setStartRoute(null),
      update,
      buildCommit: (import.meta.env.VITE_BUILD_COMMIT as string | undefined)?.slice(0, 7) || 'local',
    }),
    [stored, startRoute, update],
  );
  return <TestContext.Provider value={value}>{children}</TestContext.Provider>;
}

export function useTestConfig() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error('useTestConfig outside TestConfigProvider');
  return ctx;
}

/** JNY-DATA-11: clear the overlay and everything stored in the browser, then reopen the start page. */
export function resetEverything() {
  const s = readStored();
  const start = s?.config.start ?? '/workspace';
  const preset = s?.locked ? s.preset : undefined;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* nothing stored */
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  window.location.replace(`${base}/${preset ? `?session=${preset}` : ''}${preset ? '' : `?start=${encodeURIComponent(start)}`}`);
}
