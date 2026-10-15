/**
 * Workspace's hooks into the rest of the app. OWNED BY THE WORKSPACE BUILD: replace the stubs,
 * keeping every exported name and signature, because the shell and other sections import them.
 */
import type { ReactNode } from 'react';
import type { PersonaId } from '../data/types';

export type WorkspaceFilter = 'all' | 'dashboard' | 'report' | 'plan' | 'scheduled' | 'received';

/** Wraps the shell (canvas and assistant drawer) so both share workspace runtime state. */
export function WorkspaceRuntimeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** The panel's two groups, Workspaces and Custom Workspaces (MOD-WS-46). Rendered inside the panel's `ul.groups`. */
export function WorkspacePanelList(_props: { onNavigate?: () => void; query: string; filter: WorkspaceFilter }) {
  return null;
}

/** The rail dot while a workspace generates in the background, then ready (MOD-WS-50, SYS-AI-10). */
export function useWorkspaceIndicator(): 'running' | 'ready' | null {
  return null;
}

/**
 * First App Onboarding builds the user's first workspace from the jobs they chose (SYS-ONB-01, 07, 09).
 * Returns a function that creates it (generating, in the background) and returns its id.
 */
export function useCreateFirstWorkspace(): (jobs: string[], persona: PersonaId) => string {
  return () => 'role-default';
}
