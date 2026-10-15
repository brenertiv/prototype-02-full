/** One insight in the detail drawer (MOD-WS-31, SYS-NAVPAT-23). OWNED BY THE WORKSPACE BUILD; keep the signature. */
import { useData } from '../data/store';
import { DetailDrawer } from '../ui/DetailDrawer';

export function InsightDrawer({ insightId, onClose }: { insightId: string; onClose: () => void }) {
  const { data } = useData();
  const insight = data.insights.find((i) => i.id === insightId);
  return (
    <DetailDrawer title={insight?.title ?? 'Insight'} eyebrow="Insight" onClose={onClose}>
      <p>{insight?.evidence}</p>
    </DetailDrawer>
  );
}
