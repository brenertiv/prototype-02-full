/** Account › Preferences: theme and units (SYS-PERS-06). Applied at once and kept for this browser. */
import { usePrefs, type Prefs } from '../state/preferences';
import { Icon } from '../shell/Icon';
import { PageHeader, Section } from '../ui/bits';
import { fmtArea } from '../ui/format';

function Choice<K extends 'theme' | 'units'>({ k, value, options, label }: { k: K; value: Prefs[K]; label: string; options: { id: Prefs[K]; label: string; detail: string; icon: string }[] }) {
  const { set } = usePrefs();
  return (
    <div className="acc-choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={String(o.id)} className={`acc-choice ${value === o.id ? 'is-on' : ''}`}>
          <input type="radio" name={k} checked={value === o.id} onChange={() => set(k, o.id)} />
          <Icon name={o.icon} />
          <span>
            <strong>{o.label}</strong>
            <span className="muted">{o.detail}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function PreferencesPage() {
  const { prefs } = usePrefs();
  return (
    <article className="page acc-page">
      <PageHeader title="Preferences" subtitle="How the app looks and measures things for you." />
      <Section title="Theme" id="theme">
        <Choice
          k="theme"
          label="Theme"
          value={prefs.theme}
          options={[
            { id: 'system', label: 'Match my device', detail: 'Light or dark, following your system setting', icon: 'contrast' },
            { id: 'light', label: 'Light', detail: 'Always light', icon: 'light_mode' },
            { id: 'dark', label: 'Dark', detail: 'Always dark', icon: 'dark_mode' },
          ]}
        />
      </Section>
      <Section title="Units" description={`Areas show as ${fmtArea(100000, prefs.units)} for a 100,000 ft² building.`} id="units">
        <Choice
          k="units"
          label="Units"
          value={prefs.units}
          options={[
            { id: 'imperial', label: 'Imperial', detail: 'Square feet, kBtu/ft²', icon: 'straighten' },
            { id: 'metric', label: 'Metric', detail: 'Square metres, kWh/m²', icon: 'square_foot' },
          ]}
        />
      </Section>
    </article>
  );
}
