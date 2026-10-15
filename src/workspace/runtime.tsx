/**
 * Workspace runtime shared by the canvas, the panel and the assistant drawer: custom workspaces,
 * their threads, background generation (MOD-WS-50, SYS-AI-10) and the selection the composer
 * shows as chips (SYS-AI-20). Everything persists through `setApp`, keyed by user.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTestConfig } from '../config/testConfig';
import { useData } from '../data/store';
import type { Notice } from '../data/types';
import { parsePath } from '../nav/route';
import { failStepFor, genSteps, prebuiltList, seedCustom, seedThreads } from './catalog';
import { newId, nowIso, PERIODS } from './logic';
import type { CompSpec, Msg, Workspace } from './types';

export interface Sel {
  wsId: string;
  compId: string;
  label: string;
}

interface CreateOpts {
  messages?: Msg[];
  generate?: boolean;
  ask?: { field: 'period' | 'framework'; text: string; options: string[] };
}

export interface Runtime {
  custom: Workspace[];
  prebuilt: Workspace[];
  get: (id: string) => Workspace | undefined;
  thread: (key: string) => Msg[];
  push: (key: string, msgs: Msg[]) => void;
  patchMsg: (key: string, msgId: string, partial: Partial<Msg>) => void;
  create: (ws: Pick<Workspace, 'name' | 'kind' | 'scopeId' | 'components'> & Partial<Workspace>, opts?: CreateOpts) => Workspace;
  update: (id: string, partial: Partial<Workspace>) => void;
  updateComponent: (wsId: string, compId: string, partial: Partial<CompSpec>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | null;
  editCopy: (id: string) => string | null;
  sendCopy: (id: string, recipientId: string) => void;
  regenerate: (id: string) => void;
  retry: (id: string) => void;
  answer: (id: string, text: string) => void;
  lastOpened: string | null;
  setLastOpened: (id: string) => void;
  unseen: string[];
  markSeen: (id: string) => void;
  selection: Sel[];
  toggleSel: (s: Sel) => void;
  removeSel: (compId: string) => void;
  clearSel: () => void;
  /** The workspace open in the canvas, if any. */
  openId: string | null;
}

const Ctx = createContext<Runtime | null>(null);

export function useRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRuntime outside WorkspaceRuntimeProvider');
  return ctx;
}

export const msg = (role: Msg['role'], kind: Msg['kind'], text: string, extra: Partial<Msg> = {}): Msg => ({ id: newId('m'), role, kind, text, at: nowIso(), ...extra });

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const { data, user, getApp, setApp, add } = useData();
  const { config } = useTestConfig();
  const { pathname } = useLocation();
  const parsed = parsePath(pathname);
  const wsMatch = parsed.inner.match(/^\/workspace\/([^/?]+)/);
  const openId = wsMatch ? decodeURIComponent(wsMatch[1]) : null;
  const scopeId = parsed.scopeId ?? 'portfolio';

  const kCustom = `ws.custom.${user.id}`;
  const kThreads = `ws.threads.${user.id}`;
  const kLast = `ws.last.${user.id}`;
  const kUnseen = `ws.unseen.${user.id}`;

  const seed = useMemo(() => seedCustom(data, user), [data.scenario, user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const seededThreads = useMemo(() => seedThreads(data, seed), [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const custom = getApp<Workspace[]>(kCustom, seed);
  const threads = getApp<Record<string, Msg[]>>(kThreads, seededThreads);
  const lastOpened = getApp<string | null>(kLast, null);
  const unseen = getApp<string[]>(kUnseen, []);
  const prebuilt = useMemo(() => prebuiltList(scopeId, user.persona), [scopeId, user.persona]);

  // Latest values for writes that follow each other within one tick.
  const ref = useRef({ custom, threads, unseen });
  ref.current = { custom, threads, unseen };
  const openRef = useRef(openId);
  openRef.current = openId;

  const writeCustom = useCallback((next: Workspace[]) => {
    ref.current.custom = next;
    setApp(kCustom, next);
  }, [kCustom, setApp]);
  const writeThreads = useCallback((next: Record<string, Msg[]>) => {
    ref.current.threads = next;
    setApp(kThreads, next);
  }, [kThreads, setApp]);

  const get = useCallback((id: string) => ref.current.custom.find((w) => w.id === id) ?? prebuilt.find((w) => w.id === id), [prebuilt]);

  const thread = useCallback(
    (key: string) => {
      const t = threads[key];
      if (t) return t;
      const pre = prebuilt.find((w) => w.id === key);
      if (pre) return [msg('assistant', 'note', `${pre.name} is a ready-made workspace that Enertiv maintains, so it's read-only. Ask me about anything on it, or edit a copy to change it; the copy becomes yours.`, { id: `intro-${key}`, at: pre.updatedAt, action: { label: 'Edit a copy', kind: 'edit-copy', wsId: key } })];
      return [];
    },
    [threads, prebuilt],
  );

  const push = useCallback((key: string, msgs: Msg[]) => {
    const cur = ref.current.threads;
    const existing = cur[key] ?? thread(key);
    writeThreads({ ...cur, [key]: [...existing, ...msgs] });
  }, [thread, writeThreads]);

  const patchMsg = useCallback((key: string, msgId: string, partial: Partial<Msg>) => {
    const cur = ref.current.threads;
    writeThreads({ ...cur, [key]: (cur[key] ?? thread(key)).map((x) => (x.id === msgId ? { ...x, ...partial } : x)) });
  }, [thread, writeThreads]);

  const update = useCallback((id: string, partial: Partial<Workspace>) => {
    writeCustom(ref.current.custom.map((w) => (w.id === id ? { ...w, ...partial } : w)));
  }, [writeCustom]);

  const updateComponent = useCallback((wsId: string, compId: string, partial: Partial<CompSpec>) => {
    writeCustom(ref.current.custom.map((w) => (w.id === wsId ? { ...w, updatedAt: nowIso(), components: w.components.map((x) => (x.id === compId ? { ...x, ...partial } : x)) } : w)));
  }, [writeCustom]);

  const create = useCallback<Runtime['create']>((input, opts = {}) => {
    const at = nowIso();
    const ws: Workspace = {
      id: newId('ws'),
      ownerId: user.id,
      createdAt: at,
      updatedAt: at,
      status: opts.ask ? 'waiting' : opts.generate === false ? 'ready' : 'generating',
      genStep: 0,
      ask: opts.ask?.field,
      ...input,
      prebuilt: false,
    };
    if (ws.status === 'ready') ws.generatedAt = at;
    writeCustom([ws, ...ref.current.custom]);
    const msgs = [...(opts.messages ?? [])];
    if (opts.ask) msgs.push(msg('assistant', 'question', opts.ask.text, { options: opts.ask.options }));
    else if (ws.status === 'generating') msgs.push(msg('assistant', 'steps', ws.kind === 'plan' ? 'Building the plan from the strategy, conditions and properties you chose.' : 'Building it from the component library. Every number comes from the platform, with its source.', { wsId: ws.id }));
    if (msgs.length) writeThreads({ ...ref.current.threads, [ws.id]: msgs });
    return ws;
  }, [user.id, writeCustom, writeThreads]);

  const remove = useCallback((id: string) => {
    writeCustom(ref.current.custom.filter((w) => w.id !== id));
    if (lastOpened === id) setApp(kLast, null);
  }, [writeCustom, lastOpened, setApp, kLast]);

  const copyOf = useCallback((id: string, name: (n: string) => string) => {
    const src = get(id);
    if (!src) return null;
    const at = nowIso();
    const copy: Workspace = { ...src, id: newId('ws'), name: name(src.name), ownerId: user.id, prebuilt: false, createdAt: at, updatedAt: at, receivedFrom: undefined, runs: undefined, schedule: undefined, status: 'ready', generatedAt: at, templateId: src.prebuilt ? src.id : src.templateId, question: undefined };
    writeCustom([copy, ...ref.current.custom]);
    writeThreads({ ...ref.current.threads, [copy.id]: [msg('assistant', 'note', src.prebuilt ? `Your own copy of ${src.name}, with the same scope (${src.scopeId === 'portfolio' ? 'the portfolio' : 'the scope it was opened in'}). Select any card and tell me what to change.` : `A copy of ${src.name}. Its thread starts here.`)] });
    return copy.id;
  }, [get, user.id, writeCustom, writeThreads]);

  const duplicate = useCallback((id: string) => copyOf(id, (n) => `${n} (copy)`), [copyOf]);
  const editCopy = useCallback((id: string) => copyOf(id, (n) => `${n} (my copy)`), [copyOf]);

  const sendCopy = useCallback((id: string, recipientId: string) => {
    const src = get(id);
    const recipient = data.users.find((u) => u.id === recipientId);
    if (!src || !recipient) return;
    const key = `ws.custom.${recipientId}`;
    const theirs = getApp<Workspace[]>(key, seedCustom(data, recipient));
    const at = nowIso();
    const copy: Workspace = { ...src, id: newId('ws'), ownerId: recipientId, prebuilt: false, createdAt: at, updatedAt: at, runs: undefined, schedule: undefined, status: 'ready', generatedAt: at, receivedFrom: { userId: user.id, name: user.name, at }, question: undefined };
    setApp(key, [copy, ...theirs]);
    const tKey = `ws.threads.${recipientId}`;
    const theirThreads = getApp<Record<string, Msg[]>>(tKey, {});
    setApp(tKey, { ...theirThreads, [copy.id]: [msg('assistant', 'note', `${user.name} sent you this copy. It's yours to change; the conversation that built it stays with ${user.name.split(' ')[0]}, so this thread starts clean.`)] });
  }, [get, data, getApp, setApp, user.id, user.name]);

  const startGen = useCallback((id: string, note: string, extra: Partial<Workspace> = {}) => {
    writeCustom(ref.current.custom.map((w) => (w.id === id ? { ...w, ...extra, status: 'generating', genStep: 0, failedStep: undefined, updatedAt: nowIso() } : w)));
    push(id, [msg('assistant', 'steps', note, { wsId: id })]);
  }, [writeCustom, push]);

  const regenerate = useCallback((id: string) => startGen(id, 'Regenerating against the current data. The period and scope stay as they were.'), [startGen]);
  const retry = useCallback((id: string) => startGen(id, 'Trying again from the start.', { retried: true }), [startGen]);

  const answer = useCallback((id: string, text: string) => {
    const w = ref.current.custom.find((x) => x.id === id);
    if (!w) return;
    const q = [...(ref.current.threads[id] ?? [])].reverse().find((x) => x.kind === 'question' && !x.answered);
    const msgs = ref.current.threads[id] ?? [];
    writeThreads({ ...ref.current.threads, [id]: [...msgs.map((x) => (q && x.id === q.id ? { ...x, answered: text } : x)), msg('user', 'text', text)] });
    const extra: Partial<Workspace> = { ask: undefined };
    if (w.ask === 'period') {
      const t = text.toLowerCase();
      extra.period = PERIODS.find((p) => p.label.toLowerCase() === t) ?? PERIODS.find((p) => t.includes(p.from.slice(0, 4)) && p.id.startsWith('cy')) ?? (/12|last|trailing/.test(t) ? PERIODS[1] : /date|ytd/.test(t) ? PERIODS[2] : /q3|quarter/.test(t) ? PERIODS[3] : PERIODS[1]);
    } else if (w.ask === 'framework') {
      const fw = ['GRESB', 'TCFD', 'CSRD'].find((f) => text.toUpperCase().includes(f));
      extra.framework = fw;
      if (fw === 'GRESB') extra.components = w.components.map((x) => (x.type === 'summary-table' ? { ...x, type: 'gresb-table' } : x));
    }
    startGen(id, `Thanks. Building it for ${extra.period ? extra.period.label.toLowerCase() : extra.framework ?? 'a plain summary'}.`, extra);
  }, [writeThreads, startGen]);

  const setLastOpened = useCallback((id: string) => {
    if (getApp<string | null>(kLast, null) !== id) setApp(kLast, id);
  }, [getApp, setApp, kLast]);

  const markSeen = useCallback((id: string) => {
    if (ref.current.unseen.includes(id)) {
      const next = ref.current.unseen.filter((x) => x !== id);
      ref.current.unseen = next;
      setApp(kUnseen, next);
    }
  }, [setApp, kUnseen]);

  // Background generation: one timer per running workspace, stepping through its steps.
  const running = custom.filter((w) => w.status === 'generating').map((w) => `${w.id}:${w.genStep ?? 0}`).join('|');
  useEffect(() => {
    const gens = ref.current.custom.filter((w) => w.status === 'generating');
    if (!gens.length) return;
    const timers = gens.map((w) => {
      const steps = genSteps(w);
      const per = Math.max(200, config.genDelayMs / steps.length);
      return window.setTimeout(() => {
        const cur = ref.current.custom.find((x) => x.id === w.id);
        if (!cur || cur.status !== 'generating') return;
        const step = (cur.genStep ?? 0) + 1;
        if (config.genFail && !cur.retried && step === failStepFor(cur)) {
          writeCustom(ref.current.custom.map((x) => (x.id === w.id ? { ...x, status: 'failed', failedStep: step } : x)));
          return;
        }
        if (step >= steps.length) {
          const at = nowIso();
          writeCustom(ref.current.custom.map((x) => (x.id === w.id ? { ...x, status: 'ready', genStep: step, generatedAt: at, updatedAt: at } : x)));
          if (openRef.current !== w.id) {
            const next = [...ref.current.unseen.filter((x) => x !== w.id), w.id];
            ref.current.unseen = next;
            setApp(kUnseen, next);
            const notice: Notice = { id: newId('n-ws'), group: 'activity', title: `${cur.name} is ready`, body: 'Your workspace finished generating in the background.', at, read: false, link: `/workspace/${w.id}` };
            add('notices', notice);
          }
          return;
        }
        writeCustom(ref.current.custom.map((x) => (x.id === w.id ? { ...x, genStep: step } : x)));
      }, per);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [running, config.genDelayMs, config.genFail, writeCustom, setApp, kUnseen, add]);

  // Selection belongs to the open workspace; leaving it clears the chips.
  const [selection, setSelection] = useState<Sel[]>([]);
  useEffect(() => {
    setSelection((s) => (s.length && s.some((x) => x.wsId !== openId) ? s.filter((x) => x.wsId === openId) : s));
  }, [openId]);
  const toggleSel = useCallback((s: Sel) => setSelection((cur) => (cur.some((x) => x.compId === s.compId && x.wsId === s.wsId) ? cur.filter((x) => !(x.compId === s.compId && x.wsId === s.wsId)) : [...cur, s])), []);
  const removeSel = useCallback((compId: string) => setSelection((cur) => cur.filter((x) => x.compId !== compId)), []);
  const clearSel = useCallback(() => setSelection([]), []);

  const value = useMemo<Runtime>(
    () => ({ custom, prebuilt, get, thread, push, patchMsg, create, update, updateComponent, remove, duplicate, editCopy, sendCopy, regenerate, retry, answer, lastOpened, setLastOpened, unseen, markSeen, selection, toggleSel, removeSel, clearSel, openId }),
    [custom, prebuilt, get, thread, push, patchMsg, create, update, updateComponent, remove, duplicate, editCopy, sendCopy, regenerate, retry, answer, lastOpened, setLastOpened, unseen, markSeen, selection, toggleSel, removeSel, clearSel, openId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
