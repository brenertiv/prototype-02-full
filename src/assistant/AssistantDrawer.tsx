/** OWNED BY THE WORKSPACE BUILD. The assistant drawer (SYS-AI-01 to 21, CMP-DRAWER-01 to 07). */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { navForInner } from '../nav/sections';
import { useNav, useScopeInfo } from '../nav/route';
import { Icon } from '../shell/Icon';
import { useToast } from '../ui/Toast';
import { PREBUILT_DEFS } from '../workspace/catalog';
import { DEFAULT_PERIOD, nowIso } from '../workspace/logic';
import { msg, useRuntime } from '../workspace/runtime';
import type { Cadence, Msg, RunPeriod } from '../workspace/types';
import { findBuilding, respond } from './engine';
import { MessageView } from './Message';
import './assistant.css';

const RUN_FOR: Record<Cadence, RunPeriod> = { daily: 'previous-day', weekly: 'previous-week', monthly: 'previous-month', quarterly: 'previous-quarter' };

export function AssistantDrawer({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  const rt = useRuntime();
  const { data, user, accessible, patch } = useData();
  const { inner, scopeId, to } = useNav();
  const navigate = useNavigate();
  const toast = useToast();
  const globalScope = useScopeInfo();
  const ws = rt.openId && rt.openId !== 'new' ? rt.get(rt.openId) : undefined;
  const wsScope = useScopeInfo(ws ? (ws.prebuilt ? scopeId : ws.scopeId) : scopeId);
  const scope = ws ? wsScope : globalScope;
  const key = ws ? ws.id : `page:${inner.split('?')[0]}`;
  const thread = rt.thread(key);
  const chips = ws ? rt.selection.filter((s) => s.wsId === ws.id) : [];
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const nav = navForInner(inner);
  const pageLabel = inner.startsWith('/workspace/new') ? 'New workspace' : nav?.page?.label ?? nav?.section.label ?? 'This page';
  const bound = ws ? ws.components.filter((c) => c.binding && c.binding.kind !== 'scope').length : 0;

  // Focus goes to the composer on open and back to the toggle on close (CMP-DRAWER-07).
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      document.querySelector<HTMLButtonElement>('.topbar-right button[aria-label="Assistant"]')?.focus();
    };
  }, []);
  useEffect(() => {
    if (expanded) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [thread.length, typing, expanded, key]);
  useEffect(() => {
    if (!phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, expanded]);

  const suggestions = useMemo(() => {
    if (ws && chips.length) return ['Make this monthly', 'Show this as a table', 'Only my three worst buildings', 'Where does this come from?'];
    if (ws?.prebuilt) return ['Where do these numbers come from?', 'Make me a dashboard of this for the West region', 'How do I edit this?'];
    const alertAt = data.alerts.find((a) => accessible.has(a.buildingId) && !a.acknowledged && !a.resolved);
    const alertB = alertAt ? data.buildings.find((b) => b.id === alertAt.buildingId)?.name : undefined;
    const west = data.groups.find((g) => /west/i.test(g.name));
    const byPersona: Record<string, string[]> = {
      sl: ['What blocks GRESB this year?', 'Which accounts can’t we get data from?', 'How do I get an energy summary by email every month?'],
      am: ['Which asset has the highest exposure?', `Make me a dashboard of exposure for the ${west ? west.name : 'portfolio'}`, 'Which building used the most energy per square foot?'],
      pm: ['What should I fix first?', alertB ? `Acknowledge the alert at ${alertB}` : 'How complete is my data?', 'How do I schedule a report?'],
      none: ['What can I do here?', 'How complete is our data?', 'How do I make a new dashboard?'],
    };
    return byPersona[user.persona] ?? byPersona.none;
  }, [ws, chips.length, data, accessible, user.persona]);

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || typing) return;
    setText('');
    if (ws && ws.status === 'waiting' && !ws.prebuilt) {
      rt.answer(ws.id, t);
      return;
    }
    const chipList = chips.map((c) => ({ compId: c.compId, label: c.label }));
    rt.push(key, [msg('user', 'text', t, { chips: chipList.length ? chipList : undefined })]);
    setTyping(true);
    window.setTimeout(() => {
      const out = respond({ text: t, data, user, accessible, scope, ws, chips: chipList, pageLabel, inner });
      if (out.edits && ws) out.edits.forEach((ed) => rt.updateComponent(ws.id, ed.compId, ed.partial));
      const replies = [...out.reply];
      if (out.create) {
        const c = out.create;
        const nw = rt.create({ name: c.name, kind: c.kind, scopeId: c.scopeId, components: c.components, brief: c.brief, period: c.period, framework: c.framework }, { messages: [msg('user', 'text', c.brief)], ask: c.ask });
        replies.push(
          msg('assistant', 'created', c.ask ? `I’ve started ${c.name}. It needs one answer before it builds: ${c.ask.text.toLowerCase()} Open it to answer.` : `I’m building ${c.name} in the background, scoped to ${c.scopeName}. It goes in Custom Workspaces and the Workspace rail shows when it’s ready. Nothing on this page changes.`, { wsId: nw.id }),
        );
      }
      if (replies.length) rt.push(key, replies);
      setTyping(false);
    }, 650);
  };

  const onConfirm = (m: Msg) => {
    if (!m.confirm) return;
    rt.patchMsg(key, m.id, { confirm: { ...m.confirm, state: 'done' } });
    if (m.confirm.action === 'ack-alert') {
      const al = data.alerts.find((x) => x.id === m.confirm!.targetId);
      if (!al) return;
      patch('alerts', al.id, { acknowledged: true });
      rt.push(key, [msg('assistant', 'text', `Acknowledged “${al.title}”. It stays open until the condition clears; the Alerts tab shows who acknowledged it.`, { sources: [{ label: 'The alert on its equipment', to: `/building-info/equipment/${al.equipmentId}?tab=alerts` }] })]);
      toast('Alert acknowledged.');
    } else {
      const [cadence, sId, sName] = m.confirm.targetId.split('|') as [Cadence, string, string];
      const def = PREBUILT_DEFS.find((d) => d.id === 'energy-esg-summary')!;
      const nw = rt.create(
        { name: `Energy summary, ${cadence} · ${sName}`, kind: 'report', scopeId: sId, components: def.components, period: DEFAULT_PERIOD, templateId: def.id, brief: `Email me an energy summary ${cadence}`, schedule: { enabled: true, cadence, period: RUN_FOR[cadence], recipients: [user.id], createdAt: nowIso() } },
        { messages: [msg('user', 'text', `Email me an energy summary for ${sName}, ${cadence}`)] },
      );
      rt.push(key, [msg('assistant', 'created', `Scheduled. Your copy of the energy summary for ${sName} goes to you ${cadence}; its Schedule control adds colleagues or outside addresses.`, { wsId: nw.id })]);
    }
  };
  const onCancel = (m: Msg) => {
    if (!m.confirm) return;
    rt.patchMsg(key, m.id, { confirm: { ...m.confirm, state: 'cancelled' } });
  };
  const onEditCopy = (wsId: string) => {
    const nid = rt.editCopy(wsId);
    if (nid) navigate(to(`/workspace/${nid}`));
  };
  const onAnswer = (o: string) => {
    if (ws && ws.status === 'waiting') rt.answer(ws.id, o);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  const lastSteps = new Map<string, string>();
  thread.forEach((m) => m.kind === 'steps' && m.wsId && lastSteps.set(m.wsId, m.id));
  const last = [...thread].reverse().find((m) => m.role === 'assistant');
  const bindingText = ws ? `${ws.name} thread` : `${pageLabel}, ${globalScope.name}`;
  const waitingHere = ws?.status === 'waiting';
  const mentionedOutside = findBuilding(text, data.buildings);

  if (phone && !expanded) {
    return (
      <aside className="drawer drawer--sheet as-drawer as-drawer--collapsed" aria-label={`Assistant, ${bindingText}`}>
        <button type="button" className="sheet-bar" aria-expanded="false" onClick={() => setExpanded(true)}>
          <Icon name="auto_awesome" />
          <span className="sheet-bar-text">{typing ? 'Typing…' : last ? last.text : `Ask about ${pageLabel.toLowerCase()}`}</span>
          <Icon name="expand_less" />
        </button>
        <button type="button" className="icon-btn sheet-close" aria-label="Close assistant" onClick={onClose}>
          <Icon name="close" />
        </button>
      </aside>
    );
  }

  return (
    <aside className={`drawer as-drawer ${phone ? 'drawer--sheet as-drawer--sheet' : ''}`} aria-label={`Assistant, ${bindingText}`}>
      <header className="drawer-header as-header">
        <div className="as-header-text">
          <h2>{ws ? 'Workspace thread' : 'Assistant'}</h2>
          {ws ? (
            <>
              <p className="drawer-binding as-binding">
                <Icon name="lock" /> <span>{ws.name}. Locked to this workspace while it’s open.</span>
              </p>
              <p className="drawer-binding">Scope: {wsScope.name}{bound ? `; ${bound} ${bound === 1 ? 'card pins buildings or follows a rule' : 'cards pin buildings or follow a rule'}` : ''}</p>
            </>
          ) : (
            <p className="drawer-binding">On {pageLabel} · {globalScope.name}</p>
          )}
        </div>
        <div className="as-header-actions">
          {phone && (
            <button type="button" className="icon-btn" aria-label="Collapse assistant" onClick={() => setExpanded(false)}>
              <Icon name="expand_more" />
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Close assistant" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      <ol className="as-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
        {thread.length === 0 && (
          <li className="as-msg as-msg--assistant as-intro">
            <p>{ws ? `This is ${ws.name}’s own thread. Ask about anything on it, or select a card with its + button and tell me what to change.` : `Ask about ${pageLabel.toLowerCase()} in ${globalScope.name}. Answers come from the platform’s data, with the source for every number.`}</p>
          </li>
        )}
        {thread.map((m) => (
          <MessageView key={m.id} m={m} liveSteps={m.kind === 'steps' && m.wsId ? lastSteps.get(m.wsId) === m.id : false} onConfirm={onConfirm} onCancel={onCancel} onAnswer={onAnswer} onEditCopy={onEditCopy} />
        ))}
        {typing && (
          <li className="as-msg as-msg--assistant as-typing" aria-label="The assistant is typing">
            <span /><span /><span />
          </li>
        )}
      </ol>

      {thread.length <= 2 && !typing && (
        <div className="as-suggest" role="group" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="as-suggestion" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form className="as-composer-wrap" onSubmit={submit}>
        {chips.length > 0 && (
          <div className="as-chips">
            <ul aria-label="Selected as context">
              {chips.map((c) => (
                <li key={c.compId} className="as-chip">
                  <Icon name="widgets" />
                  <span>{c.label}</span>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={`Remove ${c.label} from the message`} onClick={() => rt.removeSel(c.compId)}>
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="text-btn" onClick={rt.clearSel}>Clear</button>
          </div>
        )}
        <div className="composer as-composer">
          <label htmlFor="as-input" className="sr-only">Message the assistant</label>
          <textarea
            id="as-input"
            ref={inputRef}
            rows={1}
            value={text}
            placeholder={waitingHere ? 'Answer the question above' : chips.length ? `What should change on ${chips.length === 1 ? chips[0].label : 'these'}?` : ws ? 'Ask about this workspace' : 'Ask, or ask me to build something'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            aria-describedby={mentionedOutside && !accessible.has(mentionedOutside.id) ? 'as-outside' : undefined}
          />
          <button type="submit" className="icon-btn as-send" aria-label="Send" disabled={!text.trim() || typing}>
            <Icon name="arrow_upward" />
          </button>
        </div>
        {mentionedOutside && !accessible.has(mentionedOutside.id) && <p id="as-outside" className="as-hint">{mentionedOutside.name} is outside your access; I’ll answer for what you can see.</p>}
      </form>
    </aside>
  );
}
