/**
 * Workspace's hooks into the rest of the app. OWNED BY THE WORKSPACE BUILD: the shell and other
 * sections import these names, so their signatures stay fixed.
 */
import { useCallback, type ReactNode } from 'react';
import { useData } from '../data/store';
import type { PersonaId } from '../data/types';
import { composeFromJobs } from './catalog';
import { msg, RuntimeProvider, useRuntime } from './runtime';

export { WorkspacePanelList } from './PanelList';

export type WorkspaceFilter = 'all' | 'dashboard' | 'report' | 'plan' | 'scheduled' | 'received';

/** Wraps the shell (canvas and assistant drawer) so both share workspace runtime state. */
export function WorkspaceRuntimeProvider({ children }: { children: ReactNode }) {
  return <RuntimeProvider>{children}</RuntimeProvider>;
}

/** The rail dot while a workspace generates in the background, then ready until opened (MOD-WS-50, SYS-AI-10). */
export function useWorkspaceIndicator(): 'running' | 'ready' | null {
  const rt = useRuntime();
  if (rt.custom.some((w) => w.status === 'generating')) return 'running';
  if (rt.unseen.some((id) => id !== rt.openId && rt.custom.some((w) => w.id === id))) return 'ready';
  return null;
}

/**
 * First App Onboarding builds the user's first workspace from the jobs they chose (SYS-ONB-01, 07, 09).
 * Returns a function that creates it (generating, in the background) and returns its id.
 */
export function useCreateFirstWorkspace(): (jobs: string[], persona: PersonaId) => string {
  const rt = useRuntime();
  const { data } = useData();
  return useCallback(
    (jobs: string[], persona: PersonaId) => {
      const { name, components } = composeFromJobs(jobs, persona, data.entitlements.carbonPlanning);
      const brief = jobs.length ? `Build my first workspace around: ${jobs.map((j) => j.replace(/-/g, ' ')).join(', ')}` : 'Build my first workspace from what the account holds';
      const ws = rt.create({ name, kind: 'dashboard', scopeId: 'portfolio', components, brief }, { messages: [msg('user', 'text', brief)] });
      rt.setLastOpened(ws.id);
      return ws.id;
    },
    [rt, data.entitlements.carbonPlanning],
  );
}
