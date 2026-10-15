import { useState } from 'react';
import type { SectionDef } from '../nav/types';
import { Icon } from '../shell/Icon';
import { useToast } from '../ui/Toast';

/** The upgrade page for a Missing section (SYS-NAVPAT-04, 09): what it does, benefits, how to get it. ST-N02. */
export function UpgradePage({ section }: { section: SectionDef }) {
  const toast = useToast();
  const [requested, setRequested] = useState(false);
  return (
    <article className="page">
      <p className="eyebrow">
        {section.label} <span className="chip chip--missing">Not in your account</span>
      </p>
      <h1>{section.label}</h1>
      <p className="lede">{section.pitch}</p>
      <section className="upgrade-grid" aria-label="What you would get">
        <div className="upgrade-card">
          <h2>What it does</h2>
          <p className="muted">{section.pitch}</p>
        </div>
        <div className="upgrade-card">
          <h2>Benefits</h2>
          <ul className="bullets">
            {section.benefits?.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
        <div className="upgrade-card">
          <h2>How to get it</h2>
          <p className="muted">Your Enertiv account team sets it up with you. Nothing changes on your bill until you agree a quote.</p>
          <button
            type="button"
            className="btn"
            disabled={requested}
            onClick={() => {
              setRequested(true);
              toast('Request sent to your Enertiv account team. They usually reply within two working days.');
            }}
          >
            <Icon name={requested ? 'check' : 'mail'} />
            {requested ? 'Requested' : 'Ask the account team'}
          </button>
        </div>
      </section>
    </article>
  );
}
