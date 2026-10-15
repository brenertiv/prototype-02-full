/** The scope a new workspace keeps (MOD-WS-44): the portfolio, a group or a property, from accessible data. */
import { useData } from '../data/store';
import { resolveScope } from '../nav/route';

export function ScopeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, accessible } = useData();
  const groups = data.groups.filter((g) => g.buildingIds.some((b) => accessible.has(b)));
  const props = data.buildings.filter((b) => accessible.has(b.id));
  const single = data.buildings.length === 1;
  const info = resolveScope(value, data.buildings, data.groups, accessible);
  return (
    <label className="field ws-scope-field">
      <span>Scope</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-describedby="ws-scope-help">
        {!single && <option value="portfolio">Portfolio ({props.length} buildings)</option>}
        {groups.length > 0 && (
          <optgroup label="Groups">
            {groups.map((g) => (
              <option key={g.id} value={`group-${g.id}`}>{g.kind}: {g.name} ({g.buildingIds.filter((b) => accessible.has(b)).length})</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Properties">
          {props.map((b) => (
            <option key={b.id} value={single ? 'portfolio' : `property-${b.id}`}>{b.name}</option>
          ))}
        </optgroup>
      </select>
      <span id="ws-scope-help" className="muted ws-help">The workspace keeps this scope ({info.buildingIds.length} {info.buildingIds.length === 1 ? 'building' : 'buildings'}), whatever scope you browse in later.</span>
    </label>
  );
}
