/** One insight in the detail drawer (MOD-WS-31, SYS-NAVPAT-23). OWNED BY THE WORKSPACE BUILD; keep the signature. */
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import type { Insight } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { EmptyState, Pill, Traced } from '../ui/bits';
import { DetailDrawer } from '../ui/DetailDrawer';
import { fmtDate, fmtMoney, fmtNum } from '../ui/format';
import { useToast } from '../ui/Toast';

const STATUS: { id: Insight['status']; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'implemented', label: 'Implemented' },
];

export function InsightDrawer({ insightId, onClose }: { insightId: string; onClose: () => void }) {
  const { data, patch, accessible } = useData();
  const { to } = useNav();
  const toast = useToast();
  const insight = data.insights.find((i) => i.id === insightId);
  if (!insight || !accessible.has(insight.buildingId)) {
    return (
      <DetailDrawer title="Insight not available" eyebrow="Insight" onClose={onClose}>
        <EmptyState icon="lightbulb" title="This insight isn’t available" body="It may have been withdrawn, or its building is outside your access." />
      </DetailDrawer>
    );
  }
  const b = data.buildings.find((x) => x.id === insight.buildingId);
  const eq = insight.equipmentId ? data.equipment.find((e) => e.id === insight.equipmentId) : undefined;
  const info = {
    builtFrom: [eq ? `Sensor and BMS data on ${eq.name}` : `Interval and sensor data at ${b?.name}`, `${b?.name} tariff for the dollar value`, 'Grid emission factor for tCO₂e'],
    period: 'Projected over 12 months',
    calculation: 'Estimated annual value if the change is made and held.',
    estimated: true,
  };
  const setStatus = (s: Insight['status']) => {
    patch('insights', insight.id, { status: s });
    toast(`Marked ${STATUS.find((x) => x.id === s)!.label.toLowerCase()}.`);
  };
  return (
    <DetailDrawer title={insight.title} eyebrow={`Insight · ${insight.category}`} onClose={onClose}>
      <dl className="dl ws-insight-dl">
        <dt>Building</dt>
        <dd>{b ? <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link> : '—'}</dd>
        <dt>Equipment</dt>
        <dd>{eq ? <Link to={to(`/building-info/equipment/${eq.id}`)}>{eq.name}</Link> : <span className="muted">Whole building</span>}</dd>
        <dt>Found</dt>
        <dd>{fmtDate(insight.created)}</dd>
      </dl>
      <div className="ws-insight-values">
        <div>
          <span className="kpi-label">Value a year</span>
          <span className="ws-big"><Traced info={info}>{fmtMoney(insight.valueUsd)}</Traced></span>
        </div>
        <div>
          <span className="kpi-label">Emissions a year</span>
          <span className="ws-big"><Traced info={info}>{`${fmtNum(insight.valueTco2e, 1)} tCO₂e`}</Traced></span>
        </div>
      </div>
      <p>{insight.description}</p>
      <h3 className="ws-mini-title">Evidence</h3>
      <p>{insight.evidence}</p>
      <fieldset className="ws-fieldset">
        <legend>Status</legend>
        <div className="filters" role="group" aria-label="Insight status">
          {STATUS.map((s) => (
            <button key={s.id} type="button" className="filter-chip" aria-pressed={insight.status === s.id} onClick={() => setStatus(s.id)}>
              {insight.status === s.id && <Icon name="check" />}
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>
      {insight.status === 'implemented' && (
        <p className="muted">
          <Pill tone="neutral" icon="info">Estimated value</Pill> Verified savings after the change aren’t measured, so this stays the estimate.
        </p>
      )}
    </DetailDrawer>
  );
}
