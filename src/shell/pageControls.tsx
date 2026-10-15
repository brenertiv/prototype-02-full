import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Page controls are supplied by the page and shown in the top bar's right slot, before the
 * assistant toggle (CMP-TOPBAR-02): at most one labelled button and one more-actions menu.
 */
const SlotCtx = createContext<{ node: ReactNode; setNode: (n: ReactNode) => void } | null>(null);

export function PageControlsProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  return <SlotCtx.Provider value={{ node, setNode }}>{children}</SlotCtx.Provider>;
}

/** Call from a page to put its controls in the top bar. `deps` re-render the slot. */
export function usePageControls(node: ReactNode, deps: unknown[]) {
  const ctx = useContext(SlotCtx);
  useEffect(() => {
    ctx?.setNode(node);
    return () => ctx?.setNode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function usePageControlsNode() {
  return useContext(SlotCtx)?.node ?? null;
}
