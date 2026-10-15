/** Who the chase agent may contact and how often, for one person or tenant (MOD-PPL-08, SYS-CHASE-06). */
import { useEffect, useState } from 'react';
import { ReadOnlyNote } from './common';

export interface ContactRules {
  maxPerWeek: number;
  channels: string[];
  paused?: boolean;
}

export function ContactRulesEditor({ value, onSave, canEdit, channels, smsAvailable, smsNote }: { value: ContactRules; onSave: (v: ContactRules) => void; canEdit: boolean; channels: string[]; smsAvailable: boolean; smsNote?: string }) {
  const [draft, setDraft] = useState<ContactRules>(value);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const toggle = (c: string) => setDraft((d) => ({ ...d, channels: d.channels.includes(c) ? d.channels.filter((x) => x !== c) : [...d.channels, c] }));

  if (!canEdit) {
    return (
      <div className="card card--sunken">
        <p>
          {value.paused ? 'The chase agent is paused for this contact.' : `Up to ${value.maxPerWeek} ${value.maxPerWeek === 1 ? 'message' : 'messages'} a week, by ${value.channels.join(', ').toLowerCase() || 'no channel'}.`}
        </p>
        <ReadOnlyNote>Changing contact rules needs permission to run the chase agent.</ReadOnlyNote>
      </div>
    );
  }
  return (
    <form
      className="card ppl-rules"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <label className="check">
        <input type="checkbox" checked={!draft.paused} onChange={(e) => setDraft((d) => ({ ...d, paused: !e.target.checked }))} />
        <span>The chase agent may contact them</span>
      </label>
      <fieldset className="ppl-fieldset" disabled={draft.paused}>
        <legend>Channels</legend>
        <div className="ppl-checks ppl-checks--row">
          {channels.map((c) => {
            const disabled = c === 'SMS' && !smsAvailable;
            return (
              <label key={c} className="check">
                <input type="checkbox" checked={draft.channels.includes(c)} disabled={disabled} onChange={() => toggle(c)} />
                <span>
                  {c}
                  {disabled && <span className="muted"> · {smsNote ?? 'no consented phone number on record'}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="field ppl-field-narrow">
        <span>Most messages a week</span>
        <input type="number" min={1} max={7} value={draft.maxPerWeek} disabled={draft.paused} onChange={(e) => setDraft((d) => ({ ...d, maxPerWeek: Math.max(1, Math.min(7, Number(e.target.value) || 1)) }))} />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn btn--sm" disabled={!dirty}>
          Save rules
        </button>
        {dirty && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDraft(value)}>
            Undo changes
          </button>
        )}
      </div>
    </form>
  );
}
