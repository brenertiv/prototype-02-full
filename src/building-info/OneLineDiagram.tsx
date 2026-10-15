/**
 * The one-line diagram (MOD-BI-70, 76 to 82), generated from the record, never drawn: utility at
 * the top, then transformers and their bus troughs, services (with their utility meter), panels,
 * equipment below panels at full depth, and the spaces each service serves at the bottom. One
 * column per service branch. Deterministic layout, fit to width, zoom and pan by pointer, buttons
 * and keyboard, collapsible branches, two depths, two modes, path highlight, a legend, a tree
 * exposed to assistive technology with roving focus in flow order, and a collapsible tree list
 * at phone width.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData, useLookup } from '../data/store';
import type { Building, Equipment, Space } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { PHONE_QUERY, useMediaQuery } from '../state/media';
import { fmtArea, fmtDate } from '../ui/format';
import { fmtKw, isInterval, spacePower } from './shared';

type NodeKind = 'utility' | 'transformer' | 'service' | 'panel' | 'equipment' | 'space';

export interface DNode {
  key: string;
  kind: NodeKind;
  recordId: string | null;
  name: string;
  lines: string[];
  verified: string | null;
  notObservable: { field: string; reason: string; photo: boolean } | null;
  missing: boolean;
  capacityOnly: boolean;
  meter?: { id: string | null; account: string } | null;
  spaceId?: string;
  children: DNode[];
  parent: DNode | null;
  hiddenCount: number;
  // layout
  level: number;
  width: number;
  x: number;
  y: number;
}

const SLOT = 176;
const NODE_W = 160;
const NODE_H = 76;
const LEVEL_H = 124;
const TOP = 20;
const SIDE = 16;

const KIND_TEXT: Record<NodeKind, string> = { utility: 'Utility', transformer: 'Transformer', service: 'Service', panel: 'Panel', equipment: 'Equipment', space: 'Space' };

interface BuildOpts {
  depth: 'services' | 'full';
  mode: 'capacity' | 'available';
  collapsed: Set<string>;
}

function ratingLines(e: Equipment, mode: BuildOpts['mode'], interval: boolean): { lines: string[]; missing: boolean; capacityOnly: boolean } {
  const r = e.ratings ?? {};
  if (e.kind === 'transformer') {
    const kva = r.kva != null ? `${r.kva.toLocaleString('en-US')} kVA` : 'kVA rating missing';
    const v = r.primaryV && r.secondaryV ? `${(r.primaryV / 1000).toFixed(2)} kV → ${r.secondaryV} V` : 'Voltages missing';
    return { lines: [kva, v], missing: r.kva == null, capacityOnly: false };
  }
  if (e.kind === 'service') {
    const amps = r.amps != null ? `${r.amps.toLocaleString('en-US')} A · ${r.voltage ?? ''} · ${r.phases ?? 3}φ` : 'Amperage missing';
    if (mode === 'available') {
      if (interval && r.availableKw != null) return { lines: [amps, `Available ${fmtKw(r.availableKw)}`], missing: r.amps == null, capacityOnly: false };
      return { lines: [amps, r.deliverableKw != null ? `${fmtKw(r.deliverableKw)}, capacity only` : 'Not verified'], missing: r.amps == null, capacityOnly: true };
    }
    return { lines: [amps, r.deliverableKw != null ? `Deliverable ${fmtKw(r.deliverableKw)}` : 'Deliverable not verified'], missing: r.amps == null, capacityOnly: false };
  }
  if (e.kind === 'panel') {
    return { lines: [`${r.voltage ?? '—'}, ${r.phases ?? 3}φ, ${r.amps ?? '—'} A`, e.make ?? 'Make not recorded'], missing: r.amps == null, capacityOnly: false };
  }
  return { lines: [e.type ?? 'No type', e.capacity ?? 'Capacity not recorded'], missing: false, capacityOnly: false };
}

/** The tree, from the record. Same record, same tree: the layout is deterministic. */
export function buildTree(b: Building, equipment: Equipment[], spaces: Space[], meters: { id: string; feedsEquipmentId: string | null }[], eqMap: Map<string, Equipment>, opts: BuildOpts): DNode {
  const interval = isInterval(b.tierByUtility.electricity);
  const mine = equipment.filter((e) => e.buildingId === b.id && !e.retired);
  const transformers = mine.filter((e) => e.kind === 'transformer').sort((x, y) => x.name.localeCompare(y.name));
  const bSpaces = spaces.filter((s) => s.buildingId === b.id);
  const mk = (p: Partial<DNode> & Pick<DNode, 'key' | 'kind' | 'name'>, parent: DNode | null): DNode => ({
    recordId: null,
    lines: [],
    verified: null,
    notObservable: null,
    missing: false,
    capacityOnly: false,
    children: [],
    parent,
    hiddenCount: 0,
    level: 0,
    width: 1,
    x: 0,
    y: 0,
    ...p,
  });
  const providers = [...new Set(transformers.map((t) => t.ratings?.provider).filter(Boolean))] as string[];
  const root = mk({ key: 'utility', kind: 'utility', name: 'Utility power', lines: [providers.join(', ') || 'Provider not recorded', `${transformers.length} ${transformers.length === 1 ? 'transformer' : 'transformers'}`] }, null);
  const fromEq = (e: Equipment, parent: DNode): DNode => {
    const r = ratingLines(e, opts.mode, interval);
    return mk({ key: e.id, kind: e.kind === 'equipment' ? 'equipment' : e.kind, recordId: e.id, name: e.name, lines: r.lines, missing: r.missing, capacityOnly: r.capacityOnly, verified: e.editedBy ? e.editedBy.at : e.surveyedAt, notObservable: e.notObservable ?? null }, parent);
  };
  const countDesc = (n: DNode): number => n.children.reduce((a, c) => a + 1 + countDesc(c), 0);
  for (const tx of transformers) {
    const tn = fromEq(tx, root);
    const services = mine.filter((e) => e.kind === 'service' && e.parentId === tx.id).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
    for (const svc of services) {
      const sn = fromEq(svc, tn);
      const meter = meters.find((m) => m.feedsEquipmentId === svc.id);
      sn.meter = svc.ratings?.meterAccount ? { id: meter?.id ?? null, account: svc.ratings.meterAccount } : null;
      const panels = mine.filter((e) => e.kind === 'panel' && e.parentId === svc.id);
      for (const p of panels) {
        const pn = fromEq(p, sn);
        const eq = mine.filter((e) => e.kind === 'equipment' && e.parentId === p.id);
        if (opts.depth === 'full') for (const e of eq) pn.children.push(fromEq(e, pn));
        else pn.hiddenCount = eq.length;
        sn.children.push(pn);
      }
      for (const s of bSpaces.filter((x) => x.fedBy.includes(svc.id))) {
        const pw = spacePower(s, spaces, eqMap, interval);
        const power = opts.mode === 'available' ? (pw.availableKw != null ? `Available ${fmtKw(pw.availableKw)}` : pw.deliverableKw != null ? `${fmtKw(pw.deliverableKw)}, capacity only` : 'Power not verified') : pw.deliverableKw != null ? `Deliverable ${fmtKw(pw.deliverableKw)}` : 'Power not verified';
        sn.children.push(mk({ key: `${svc.id}:${s.id}`, kind: 'space', recordId: s.id, spaceId: s.id, name: s.name, lines: [`${s.areaType} · ${fmtArea(s.sqft)}`, power], capacityOnly: opts.mode === 'available' && pw.availableKw == null }, sn));
      }
      tn.children.push(sn);
    }
    root.children.push(tn);
  }
  // Collapse: hide descendants of collapsed nodes, keeping the count.
  const prune = (n: DNode) => {
    if (opts.collapsed.has(n.key) && n.children.length) {
      n.hiddenCount = countDesc(n);
      n.children = [];
      return;
    }
    n.children.forEach(prune);
  };
  prune(root);
  layout(root, opts.depth);
  return root;
}

function layout(root: DNode, depth: BuildOpts['depth']) {
  const levelOf = (n: DNode) => (n.kind === 'utility' ? 0 : n.kind === 'transformer' ? 1 : n.kind === 'service' ? 2 : n.kind === 'panel' ? 3 : n.kind === 'equipment' ? 4 : depth === 'full' ? 5 : 4);
  const measure = (n: DNode): number => {
    n.level = levelOf(n);
    if (n.kind === 'service') {
      const panels = n.children.filter((c) => c.kind === 'panel');
      const spaces = n.children.filter((c) => c.kind === 'space');
      const pw = panels.reduce((a, c) => a + measure(c), 0);
      spaces.forEach(measure);
      n.width = Math.max(1, pw, spaces.length);
    } else {
      const w = n.children.reduce((a, c) => a + measure(c), 0);
      n.width = Math.max(1, w);
    }
    return n.width;
  };
  const place = (n: DNode, x0: number) => {
    n.x = x0 + (n.width * SLOT) / 2;
    n.y = TOP + n.level * LEVEL_H;
    if (n.kind === 'service') {
      const panels = n.children.filter((c) => c.kind === 'panel');
      const spaces = n.children.filter((c) => c.kind === 'space');
      const pw = panels.reduce((a, c) => a + c.width, 0);
      let x = x0 + ((n.width - pw) * SLOT) / 2;
      for (const p of panels) {
        place(p, x);
        x += p.width * SLOT;
      }
      let sx = x0 + ((n.width - spaces.length) * SLOT) / 2;
      for (const s of spaces) {
        place(s, sx);
        sx += SLOT;
      }
    } else {
      let x = x0;
      for (const c of n.children) {
        place(c, x);
        x += c.width * SLOT;
      }
    }
  };
  measure(root);
  place(root, SIDE);
}

function flatten(n: DNode, out: DNode[] = []) {
  out.push(n);
  n.children.forEach((c) => flatten(c, out));
  return out;
}

function nodeLabel(n: DNode) {
  const state = n.notObservable ? `, not observable: ${n.notObservable.field}` : n.missing ? ', rating missing' : '';
  const ver = n.verified ? `, verified ${fmtDate(n.verified)}` : '';
  const meter = n.meter ? `, utility meter ${n.meter.account}` : '';
  return `${KIND_TEXT[n.kind]} ${n.name}: ${n.lines.join(', ')}${meter}${ver}${state}`;
}

const trunc = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ---------- Symbols (engineers' conventions, drawn once) ---------- */

function Symbol({ kind, x, y }: { kind: NodeKind; x: number; y: number }) {
  const s = 'var(--text-secondary)';
  switch (kind) {
    case 'utility':
      return <path d={`M${x + 8} ${y} L${x + 2} ${y + 9} H${x + 7} L${x + 5} ${y + 16} L${x + 13} ${y + 6} H${x + 8} Z`} fill="none" stroke={s} strokeWidth={1.4} />;
    case 'transformer':
      return (
        <g fill="none" stroke={s} strokeWidth={1.4}>
          <circle cx={x + 8} cy={y + 5} r={5} />
          <circle cx={x + 8} cy={y + 12} r={5} />
        </g>
      );
    case 'service':
      return (
        <g fill="none" stroke={s} strokeWidth={1.4}>
          <line x1={x + 8} y1={y} x2={x + 8} y2={y + 5} />
          <line x1={x + 8} y1={y + 5} x2={x + 14} y2={y + 11} />
          <line x1={x + 8} y1={y + 12} x2={x + 8} y2={y + 16} />
          <circle cx={x + 8} cy={y + 5} r={1.2} fill={s} />
        </g>
      );
    case 'panel':
      return (
        <g fill="none" stroke={s} strokeWidth={1.4}>
          <rect x={x + 2} y={y + 1} width={12} height={15} rx={1} />
          <line x1={x + 5} y1={y + 6} x2={x + 11} y2={y + 6} />
          <line x1={x + 5} y1={y + 10} x2={x + 11} y2={y + 10} />
        </g>
      );
    case 'equipment':
      return <circle cx={x + 8} cy={y + 8} r={6} fill="none" stroke={s} strokeWidth={1.4} />;
    case 'space':
      return <rect x={x + 2} y={y + 2} width={12} height={12} fill="none" stroke={s} strokeWidth={1.4} strokeDasharray="2 2" />;
  }
}

/* ---------- The diagram ---------- */

export function OneLineDiagram({ b }: { b: Building }) {
  const { data } = useData();
  const { equipment: eqMap } = useLookup();
  const phone = useMediaQuery(PHONE_QUERY);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { to } = useNav();
  const [depth, setDepth] = useState<BuildOpts['depth']>('services');
  const [mode, setMode] = useState<BuildOpts['mode']>('capacity');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(true);
  const [drawnOnPhone, setDrawnOnPhone] = useState(false);
  const interval = isInterval(b.tierByUtility.electricity);
  const spaceParam = params.get('space');

  const root = useMemo(() => buildTree(b, data.equipment, data.spaces, data.meters, eqMap, { depth, mode, collapsed }), [b, data.equipment, data.spaces, data.meters, eqMap, depth, mode, collapsed]);
  const flat = useMemo(() => flatten(root), [root]);
  const byKey = useMemo(() => new Map(flat.map((n) => [n.key, n])), [flat]);
  const contentW = root.width * SLOT + SIDE * 2;
  const maxLevel = flat.reduce((a, n) => Math.max(a, n.level), 0);
  const contentH = TOP + maxLevel * LEVEL_H + NODE_H + 24;

  // Path highlight: a selected node, or the selected space (in either view), up to the utility.
  const path = useMemo(() => {
    const set = new Set<string>();
    const climb = (n: DNode | null) => {
      for (let p = n; p; p = p.parent) set.add(p.key);
    };
    if (selectedKey) climb(byKey.get(selectedKey) ?? null);
    if (spaceParam) flat.filter((n) => n.spaceId === spaceParam).forEach(climb);
    return set;
  }, [selectedKey, spaceParam, byKey, flat]);
  const dimming = highlight && path.size > 0;

  const select = (n: DNode) => {
    setSelectedKey((k) => (k === n.key ? null : n.key));
    if (n.kind === 'space') {
      const next = new URLSearchParams(params);
      if (spaceParam === n.spaceId) next.delete('space');
      else next.set('space', n.spaceId!);
      setParams(next, { replace: true });
    }
  };
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const hrefFor = (n: DNode) => (n.kind === 'space' ? to(`/building-info/buildings/${b.id}?tab=spaces&space=${n.spaceId}`) : n.recordId ? to(`/building-info/equipment/${n.recordId}`) : to(`/building-info/bills?view=accounts&building=${b.id}`));

  const selected = selectedKey ? byKey.get(selectedKey) : spaceParam ? flat.find((n) => n.spaceId === spaceParam) : undefined;
  const clear = () => {
    setSelectedKey(null);
    if (spaceParam) {
      const next = new URLSearchParams(params);
      next.delete('space');
      setParams(next, { replace: true });
    }
  };

  if (phone && !drawnOnPhone) {
    return (
      <div className="bi-old">
        <DiagramControls depth={depth} setDepth={setDepth} mode={mode} setMode={setMode} interval={interval} />
        <TreeList root={root} hrefFor={hrefFor} collapsed={collapsed} toggle={toggle} />
        <button type="button" className="btn btn--ghost btn--sm bi-gap-top" onClick={() => setDrawnOnPhone(true)}>
          <Icon name="fullscreen" /> Show the drawn diagram
        </button>
        <DiagramLegend />
      </div>
    );
  }

  return (
    <div className="bi-old">
      <DiagramControls depth={depth} setDepth={setDepth} mode={mode} setMode={setMode} interval={interval} />
      {mode === 'available' && !interval && (
        <p className="banner banner--neutral bi-banner-tight">
          <Icon name="info" />
          <span>This building has no interval data, so it shows capacity only. Whole-building interval data would add measured peak demand and available power.</span>
        </p>
      )}
      <Canvas
        root={root}
        flat={flat}
        contentW={contentW}
        contentH={contentH}
        path={path}
        dimming={dimming}
        selectedKey={selected?.key ?? null}
        onSelect={select}
        onToggle={toggle}
        onOpen={(n) => navigate(hrefFor(n))}
        collapsed={collapsed}
        toolbarExtra={
          <>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCollapsed(new Set(root.children.flatMap((t) => t.children.map((s) => s.key))))}>
              <Icon name="unfold_less" /> Collapse all
            </button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={collapsed.size === 0} onClick={() => setCollapsed(new Set())}>
              <Icon name="unfold_more" /> Expand all
            </button>
            <label className="check bi-inline-check">
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
              <span>Highlight path</span>
            </label>
            {phone && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDrawnOnPhone(false)}>
                <Icon name="fullscreen_exit" /> Tree list
              </button>
            )}
          </>
        }
      />
      {selected && <NodeDetail n={selected} href={hrefFor(selected)} onClear={clear} />}
      <DiagramLegend />
    </div>
  );
}

function DiagramControls({ depth, setDepth, mode, setMode, interval }: { depth: BuildOpts['depth']; setDepth: (d: BuildOpts['depth']) => void; mode: BuildOpts['mode']; setMode: (m: BuildOpts['mode']) => void; interval: boolean }) {
  return (
    <div className="bi-toolbar">
      <div className="bi-seg" role="group" aria-label="Depth">
        <button type="button" aria-pressed={depth === 'services'} onClick={() => setDepth('services')}>
          Services only
        </button>
        <button type="button" aria-pressed={depth === 'full'} onClick={() => setDepth('full')}>
          Full, with equipment
        </button>
      </div>
      <div className="bi-seg" role="group" aria-label="Mode">
        <button type="button" aria-pressed={mode === 'capacity'} onClick={() => setMode('capacity')}>
          Capacity
        </button>
        <button type="button" aria-pressed={mode === 'available'} onClick={() => setMode('available')}>
          Available power{interval ? '' : ' (capacity only here)'}
        </button>
      </div>
    </div>
  );
}

function Canvas({
  root,
  flat,
  contentW,
  contentH,
  path,
  dimming,
  selectedKey,
  onSelect,
  onToggle,
  onOpen,
  collapsed,
  toolbarExtra,
}: {
  root: DNode;
  flat: DNode[];
  contentW: number;
  contentH: number;
  path: Set<string>;
  dimming: boolean;
  selectedKey: string | null;
  onSelect: (n: DNode) => void;
  onToggle: (key: string) => void;
  onOpen: (n: DNode) => void;
  collapsed: Set<string>;
  toolbarExtra: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(800);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [focusKey, setFocusKey] = useState<string>(root.key);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const viewH = Math.max(280, Math.min(640, Math.round(contentH * Math.min(1, cw / contentW)) + 24));

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setCw(Math.max(240, Math.floor(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const k = Math.min(1, cw / contentW);
    setView({ k, tx: Math.max(0, (cw - contentW * k) / 2), ty: 8 });
  }, [cw, contentW]);
  useEffect(() => fit(), [fit, contentH]);
  useEffect(() => {
    if (!flat.some((n) => n.key === focusKey)) setFocusKey(root.key);
  }, [flat, focusKey, root.key]);

  const zoom = (f: number) =>
    setView((v) => {
      const k = Math.max(0.2, Math.min(2.5, v.k * f));
      const cx = cw / 2;
      const cy = viewH / 2;
      return { k, tx: cx - ((cx - v.tx) / v.k) * k, ty: cy - ((cy - v.ty) / v.k) * k };
    });
  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));

  const ensureVisible = (n: DNode) =>
    setView((v) => {
      const sx = v.tx + n.x * v.k;
      const sy = v.ty + n.y * v.k;
      let { tx, ty } = v;
      const hw = (NODE_W / 2) * v.k + 12;
      if (sx - hw < 0) tx += hw - sx;
      if (sx + hw > cw) tx -= sx + hw - cw;
      if (sy < 8) ty += 8 - sy;
      if (sy + NODE_H * v.k + 12 > viewH) ty -= sy + NODE_H * v.k + 12 - viewH;
      return tx === v.tx && ty === v.ty ? v : { ...v, tx, ty };
    });

  const focusNode = (n: DNode | undefined) => {
    if (!n) return;
    setFocusKey(n.key);
    ensureVisible(n);
    window.requestAnimationFrame(() => nodeRefs.current.get(n.key)?.focus());
  };

  const onNodeKey = (e: ReactKeyboardEvent, n: DNode) => {
    const i = flat.indexOf(n);
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        focusNode(flat[i + 1]);
        break;
      case 'ArrowUp':
        focusNode(flat[i - 1]);
        break;
      case 'ArrowRight':
        if (collapsed.has(n.key)) onToggle(n.key);
        else focusNode(n.children[0]);
        break;
      case 'ArrowLeft':
        if (n.children.length && !collapsed.has(n.key) && n.kind !== 'utility') onToggle(n.key);
        else focusNode(n.parent ?? undefined);
        break;
      case 'Home':
        focusNode(flat[0]);
        break;
      case 'End':
        focusNode(flat[flat.length - 1]);
        break;
      case 'Enter':
        onOpen(n);
        break;
      case ' ':
        onSelect(n);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onCanvasKey = (e: ReactKeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 60;
    const map: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      '+': () => zoom(1.25),
      '=': () => zoom(1.25),
      '-': () => zoom(0.8),
      '0': fit,
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // Edges: bus bars per parent, with the spaces' feed routed down the column gutter.
  const edges = useMemo(() => {
    const out: { key: string; d: string; bus?: boolean; feed?: boolean; on: boolean }[] = [];
    for (const n of flat) {
      const kids = n.children.filter((c) => c.kind !== 'space');
      const bottom = n.y + NODE_H;
      if (kids.length) {
        const busY = bottom + (LEVEL_H - NODE_H) / 2;
        const xs = kids.map((c) => c.x);
        const on = kids.some((c) => path.has(c.key)) && path.has(n.key);
        out.push({ key: `${n.key}-v`, d: `M${n.x} ${bottom} V${busY}`, on });
        out.push({ key: `${n.key}-bus`, d: `M${Math.min(n.x, ...xs)} ${busY} H${Math.max(n.x, ...xs)}`, bus: n.kind === 'transformer' || n.kind === 'utility', on });
        for (const c of kids) out.push({ key: `${n.key}-${c.key}`, d: `M${c.x} ${busY} V${c.y}`, on: path.has(c.key) && path.has(n.key) });
      }
      const spaces = n.children.filter((c) => c.kind === 'space');
      if (spaces.length) {
        const busY = bottom + (LEVEL_H - NODE_H) / 2;
        const laneY = spaces[0].y - 14;
        const gutter = n.x - (n.width * SLOT) / 2 + 4;
        const on = spaces.some((s) => path.has(s.key));
        const xs = spaces.map((s) => s.x);
        out.push({ key: `${n.key}-feed`, d: `M${n.x} ${bottom} V${busY} H${gutter} V${laneY} H${Math.max(...xs)} M${Math.min(gutter, ...xs)} ${laneY} H${Math.max(...xs)}`, feed: true, on });
        for (const s of spaces) out.push({ key: `${s.key}-drop`, d: `M${s.x} ${laneY} V${s.y}`, feed: true, on: path.has(s.key) });
      }
    }
    return out;
  }, [flat, path]);

  const renderNode = (n: DNode): JSX.Element => {
    const on = path.has(n.key);
    const dim = dimming && !on;
    const x = n.x - NODE_W / 2;
    const h = n.kind === 'space' || n.kind === 'equipment' ? NODE_H - 10 : NODE_H;
    const hasKids = n.children.length > 0 || collapsed.has(n.key);
    const expanded = n.children.length > 0;
    const isSel = selectedKey === n.key;
    return (
      <g
        key={n.key}
        role="treeitem"
        aria-level={n.level + 1}
        aria-expanded={hasKids && n.kind !== 'utility' ? expanded : undefined}
        aria-selected={isSel}
        aria-label={nodeLabel(n)}
        tabIndex={focusKey === n.key ? 0 : -1}
        data-node={n.key}
        ref={(el) => {
          if (el) nodeRefs.current.set(n.key, el);
          else nodeRefs.current.delete(n.key);
        }}
        className={`bi-node bi-node--${n.kind} ${on && dimming ? 'is-on' : ''} ${dim ? 'is-dim' : ''} ${isSel ? 'is-selected' : ''} ${n.notObservable ? 'is-no' : ''} ${n.missing ? 'is-missing' : ''}`}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setFocusKey(n.key);
        }}
        onKeyDown={(e) => onNodeKey(e, n)}
        onClick={(e) => {
          e.stopPropagation();
          setFocusKey(n.key);
          onSelect(n);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpen(n);
        }}
      >
        <title>{nodeLabel(n)}</title>
        <rect className="bi-node-box" x={x} y={n.y} width={NODE_W} height={h} rx={6} />
        <Symbol kind={n.kind} x={x + 8} y={n.y + 9} />
        <text className="bi-node-name" x={x + 30} y={n.y + 21}>
          {trunc(n.name, 19)}
        </text>
        {n.lines.slice(0, 2).map((l, k) => (
          <text key={k} className={`bi-node-line ${n.capacityOnly && k === 1 ? 'is-capacity' : ''} ${n.missing && k === 0 ? 'is-warn' : ''}`} x={x + 10} y={n.y + 38 + k * 14}>
            {trunc(l, 27)}
          </text>
        ))}
        {(n.kind === 'transformer' || n.kind === 'service' || n.kind === 'panel') && (
          <text className="bi-node-meta" x={x + 10} y={n.y + h - 6}>
            {n.notObservable ? trunc(`N/O: ${n.notObservable.field}`, 28) : n.meter ? trunc(`Meter ${n.meter.account}${n.verified ? ` · ${fmtDate(n.verified)}` : ''}`, 30) : n.verified ? `Verified ${fmtDate(n.verified)}` : 'Not verified'}
          </text>
        )}
        {n.notObservable && (
          <g className="bi-node-marker" aria-hidden="true">
            <circle cx={x + NODE_W - 12} cy={n.y + 12} r={9} />
            <text x={x + NODE_W - 12} y={n.y + 15.5} textAnchor="middle">
              N/O
            </text>
          </g>
        )}
        {hasKids && n.kind !== 'utility' && (
          <g
            className="bi-node-toggle"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(n.key);
            }}
          >
            <circle cx={n.x} cy={n.y + h} r={8} />
            <text x={n.x} y={n.y + h + 4} textAnchor="middle">
              {expanded ? '−' : '+'}
            </text>
          </g>
        )}
        {!expanded && n.hiddenCount > 0 && (
          <text className="bi-node-hidden" x={x + NODE_W - 8} y={n.y + h + 14} textAnchor="end" aria-hidden="true">
            +{n.hiddenCount} hidden
          </text>
        )}
        {n.children.length > 0 && <g role="group">{n.children.map(renderNode)}</g>}
      </g>
    );
  };

  return (
    <div className="bi-canvas-block">
      <div className="bi-toolbar bi-canvas-tools">
        <div className="bi-seg" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)}>
            <Icon name="remove" />
          </button>
          <button type="button" onClick={fit}>
            Fit
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)}>
            <Icon name="add" />
          </button>
        </div>
        {toolbarExtra}
      </div>
      <div
        ref={wrapRef}
        className="bi-canvas"
        tabIndex={0}
        role="region"
        aria-label="One-line diagram canvas. Arrow keys pan, plus and minus zoom, 0 fits. Tab into the diagram to move between nodes with arrow keys; Enter opens a node's record, Space highlights its path."
        onKeyDown={onCanvasKey}
        style={{ height: viewH }}
      >
        <svg width={cw} height={viewH} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="bi-canvas-svg" xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            <g aria-hidden="true">
              {edges.map((e) => (
                <path key={e.key} d={e.d} className={`bi-edge ${e.bus ? 'bi-edge--bus' : ''} ${e.feed ? 'bi-edge--feed' : ''} ${dimming ? (e.on ? 'is-on' : 'is-dim') : ''}`} />
              ))}
            </g>
            <g role="tree" aria-label="Electrical hierarchy, from the utility to the spaces">
              {renderNode(root)}
            </g>
          </g>
        </svg>
      </div>
      <p className="cell-sub bi-gap-top">Drag to pan. Select a node to highlight its path to the utility; double-click or press Enter to open its record.</p>
    </div>
  );
}

function NodeDetail({ n, href, onClear }: { n: DNode; href: string; onClear: () => void }) {
  const { to } = useNav();
  return (
    <div className="card bi-node-detail" aria-live="polite">
      <div className="bi-space-detail-head">
        <div>
          <div className="eyebrow">{KIND_TEXT[n.kind]}</div>
          <h3>{n.name}</h3>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Clear selection" onClick={onClear}>
          <Icon name="close" />
        </button>
      </div>
      <dl className="dl">
        {n.lines.map((l, k) => (
          <FragmentRow key={k} label={k === 0 ? 'Rating' : n.kind === 'space' || n.kind === 'service' ? 'Power' : 'Detail'} value={l} />
        ))}
        {n.meter && <FragmentRow label="Utility meter" value={n.meter.id ? <Link to={to(`/building-info/meters/${n.meter.id}`)}>{n.meter.account}</Link> : n.meter.account} />}
        {n.kind !== 'utility' && n.kind !== 'space' && <FragmentRow label="Verified" value={n.verified ? fmtDate(n.verified) : 'Not verified'} />}
        {n.notObservable && <FragmentRow label="Not observable" value={`${n.notObservable.field}: ${n.notObservable.reason}${n.notObservable.photo ? ' (photo on file)' : ''}`} />}
        {n.parent && <FragmentRow label="Fed from" value={`${KIND_TEXT[n.parent.kind]} ${n.parent.name}`} />}
      </dl>
      {n.kind !== 'utility' && (
        <Link className="btn btn--ghost btn--sm bi-gap-top" to={href}>
          {n.kind === 'space' ? 'Show in the stacking plan' : 'Open record'}
        </Link>
      )}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function DiagramLegend() {
  const items: { kind: NodeKind; label: string }[] = [
    { kind: 'utility', label: 'Utility' },
    { kind: 'transformer', label: 'Transformer' },
    { kind: 'service', label: 'Service and disconnect' },
    { kind: 'panel', label: 'Panel' },
    { kind: 'equipment', label: 'Equipment' },
    { kind: 'space', label: 'Space' },
  ];
  return (
    <ul className="legend bi-old-legend" aria-label="Diagram legend">
      {items.map((i) => (
        <li key={i.kind}>
          <svg width="18" height="18" aria-hidden="true">
            <Symbol kind={i.kind} x={1} y={1} />
          </svg>
          {i.label}
        </li>
      ))}
      <li>
        <svg width="26" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="26" y2="5" className="bi-edge bi-edge--bus" />
        </svg>
        Bus trough
      </li>
      <li>
        <svg width="26" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="26" y2="5" className="bi-edge bi-edge--feed" />
        </svg>
        Serves the space
      </li>
      <li>
        <span className="bi-legend-no">N/O</span>
        Not observable in the field (dashed outline)
      </li>
      <li>
        <span className="bi-capacity-only">Capacity only</span>
        No measured demand
      </li>
    </ul>
  );
}

/* ---------- Phone: a collapsible tree list (MOD-BI-82) ---------- */

function TreeList({ root, hrefFor, collapsed, toggle }: { root: DNode; hrefFor: (n: DNode) => string; collapsed: Set<string>; toggle: (k: string) => void }) {
  const item = (n: DNode): JSX.Element => {
    const has = n.children.length > 0 || collapsed.has(n.key);
    const open = n.children.length > 0;
    return (
      <li key={n.key} role="treeitem" aria-expanded={has ? open : undefined} aria-level={n.level + 1} className={`bi-tree-item ${n.notObservable ? 'is-no' : ''}`}>
        <div className="bi-tree-row">
          {has ? (
            <button type="button" className="icon-btn icon-btn--sm" aria-label={`${open ? 'Collapse' : 'Expand'} ${n.name}`} onClick={() => toggle(n.key)}>
              <Icon name={open ? 'expand_more' : 'chevron_right'} />
            </button>
          ) : (
            <span className="bi-tree-spacer" />
          )}
          <span className="bi-tree-text">
            <span className="bi-tree-kind">{KIND_TEXT[n.kind]}</span>{' '}
            {n.kind === 'utility' ? <strong>{n.name}</strong> : <Link to={hrefFor(n)}>{n.name}</Link>}
            <span className="cell-sub">
              {n.lines.join(' · ')}
              {n.meter ? ` · meter ${n.meter.account}` : ''}
              {n.kind !== 'utility' && n.kind !== 'space' ? ` · ${n.verified ? `verified ${fmtDate(n.verified)}` : 'not verified'}` : ''}
            </span>
            {n.notObservable && (
              <span className="bi-tree-no">
                <Icon name="visibility_off" /> Not observable: {n.notObservable.field}, {n.notObservable.reason}
              </span>
            )}
            {!open && n.hiddenCount > 0 && <span className="cell-sub">{n.hiddenCount} below, collapsed</span>}
          </span>
        </div>
        {open && <ul role="group">{n.children.map(item)}</ul>}
      </li>
    );
  };
  return (
    <ul className="bi-tree" role="tree" aria-label="Electrical hierarchy, from the utility to the spaces">
      {item(root)}
    </ul>
  );
}
