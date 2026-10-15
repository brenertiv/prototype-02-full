/**
 * Workspace's hooks into the shell. OWNED BY THE WORKSPACE BUILD: replace the stubs.
 * - WorkspacePanelList: the panel's two groups, Workspaces and Custom Workspaces (MOD-WS-46).
 * - useWorkspaceIndicator: the rail dot while a workspace generates in the background (MOD-WS-50).
 */
export type WorkspaceFilter = 'all' | 'dashboard' | 'report' | 'plan' | 'scheduled' | 'received';

export function WorkspacePanelList(_props: { onNavigate?: () => void; query: string; filter: WorkspaceFilter }) {
  return null;
}

export function useWorkspaceIndicator(): 'running' | 'ready' | null {
  return null;
}
