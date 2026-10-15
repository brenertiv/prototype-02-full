import type { SectionDef } from '../nav/types';
import { Icon } from '../shell/Icon';

/** A section the user can't access (ST-N03, ST-E06). Say why and the next step (SYS-ACCESS-06). */
export function NoAccessPage({ section, role }: { section: SectionDef; role: string }) {
  return (
    <article className="page">
      <p className="eyebrow">{section.label}</p>
      <h1>You don't have access to {section.label}</h1>
      <div className="notice">
        <Icon name="lock" />
        <div>
          <p>Your role ({role}) in this Company doesn't include {section.label}. An Admin can change your role from People › Team.</p>
        </div>
      </div>
    </article>
  );
}
