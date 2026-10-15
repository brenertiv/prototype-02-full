import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRESETS, STATES, resetEverything, useTestConfig, type TestConfig } from '../config/testConfig';
import { SCENARIO_DEFS } from '../data/generate';
import { useData } from '../data/store';
import type { PersonaId, RoleId, ScenarioId } from '../data/types';
import { usePrefs } from '../state/preferences';
import { Icon } from './Icon';

/**
 * Review mode's test panel (JNY-DATA-10): the configuration, the data the build runs on and the
 * build commit, every field changeable live. Never rendered in session mode.
 */
export function TestPanel() {
  const { config, mode, update, buildCommit } = useTestConfig();
  const { data, user } = useData();
  const { prefs, set } = usePrefs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (mode === 'session') return null;

  const applyAndGo = (patch: Partial<TestConfig>, start?: string) => {
    update(patch);
    const scenario = (patch.scenario ?? config.scenario) as ScenarioId;
    const company = SCENARIO_DEFS[scenario].company.id;
    const path = start ?? patch.start ?? '/workspace';
    const [p, qs] = path.split('?');
    const first = p.split('/').filter(Boolean)[0];
    const noScope = first === 'account' || first === 'tenant-billing' || first === 'maintenance';
    navigate(`/${company}${noScope ? '' : '/portfolio'}${p}${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="proto">
      {open && (
        <div className="proto-panel" role="dialog" aria-label="Test panel">
          <header>
            <strong>Test panel</strong>
            <span className="muted">review mode</span>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Close test panel" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </header>
          <div className="proto-meta">
            <span>
              Data: <strong>{data.source}</strong> · as of {data.asOf}
            </span>
            <span>
              Build: <code>{buildCommit}</code>
            </span>
            <span>
              Signed in as <strong>{user.name}</strong> ({user.role})
            </span>
          </div>
          <label className="proto-row">
            <span>Scenario</span>
            <select value={config.scenario} onChange={(e) => applyAndGo({ scenario: e.target.value as ScenarioId })}>
              {(Object.keys(SCENARIO_DEFS) as ScenarioId[]).map((s) => (
                <option key={s} value={s}>
                  {s} · {SCENARIO_DEFS[s].name}
                </option>
              ))}
            </select>
          </label>
          <label className="proto-row">
            <span>Persona</span>
            <select value={config.persona} onChange={(e) => update({ persona: e.target.value as PersonaId })}>
              <option value="sl">Sustainability Lead (Maya Chen)</option>
              <option value="am">Asset Manager (David Okafor)</option>
              <option value="pm">Property Manager (Rosa Alvarez)</option>
              <option value="none">Not set</option>
            </select>
          </label>
          <label className="proto-row">
            <span>Role</span>
            <select value={config.role} onChange={(e) => update({ role: e.target.value as RoleId })}>
              {(['admin', 'billing', 'operator', 'vendor', 'tenant'] as RoleId[]).map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="proto-row proto-row--check">
            <input type="checkbox" checked={Boolean(config.firstLogin)} onChange={(e) => update({ firstLogin: e.target.checked })} />
            <span>First login (ST-P07)</span>
          </label>
          <label className="proto-row">
            <span>API delay (ms)</span>
            <input type="number" min={0} step={250} value={config.latencyMs} onChange={(e) => update({ latencyMs: Number(e.target.value) || 0 })} />
          </label>
          <label className="proto-row proto-row--check">
            <input type="checkbox" checked={config.fail.includes('*')} onChange={(e) => update({ fail: e.target.checked ? ['*'] : [] })} />
            <span>API errors (ST-X02)</span>
          </label>
          <label className="proto-row">
            <span>Generation time (ms)</span>
            <input type="number" min={0} step={500} value={config.genDelayMs} onChange={(e) => update({ genDelayMs: Number(e.target.value) || 0 })} />
          </label>
          <label className="proto-row proto-row--check">
            <input type="checkbox" checked={config.genFail} onChange={(e) => update({ genFail: e.target.checked })} />
            <span>Generation fails at a step (ST-W04)</span>
          </label>
          <label className="proto-row">
            <span>Theme</span>
            <select value={prefs.theme} onChange={(e) => set('theme', e.target.value as typeof prefs.theme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="proto-row">
            <span>Open a state</span>
            <select
              value=""
              onChange={(e) => {
                const s = STATES[e.target.value];
                if (s) applyAndGo({ ...s, state: e.target.value }, s.start);
              }}
            >
              <option value="">Choose a state ID…</option>
              {Object.keys(STATES).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="proto-row">
            <span>Load a preset</span>
            <select
              value=""
              onChange={(e) => {
                const p = PRESETS[e.target.value];
                if (p) applyAndGo({ ...p }, p.start);
              }}
            >
              <option value="">Choose a preset…</option>
              {Object.keys(PRESETS).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <div className="proto-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => resetEverything()}>
              <Icon name="restart_alt" /> Reset session
            </button>
          </div>
          <p className="proto-hint muted">Session links: <code>?session=r1-sl&amp;p=P01</code> locks the preset and hides this panel.</p>
        </div>
      )}
      <button type="button" className="proto-fab" aria-label="Test panel" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="science" />
      </button>
    </div>
  );
}
