/** OWNED BY THE WORKSPACE BUILD. The assistant drawer (SYS-AI-01 to 21). */
export function AssistantDrawer({ onClose }: { phone: boolean; onClose: () => void }) {
  return <aside className="drawer" aria-label="Assistant"><button type="button" onClick={onClose}>Close</button></aside>;
}
