/** OWNED BY THE WORKSPACE BUILD. Routes under /{company}/{scope}/workspace/*. */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useData } from '../data/store';
import { useNav } from '../nav/route';
import { ROLE_DEFAULT } from './catalog';
import { NewPicker } from './NewPicker';
import { useRuntime } from './runtime';
import { WorkspacePage } from './WorkspacePage';
import './workspace.css';

/** `/workspace` opens the last workspace the user had open, else their role default (MOD-WS-54, ST-W15). */
function Landing() {
  const rt = useRuntime();
  const { user } = useData();
  const { to } = useNav();
  const last = rt.lastOpened && rt.get(rt.lastOpened) ? rt.lastOpened : null;
  return <Navigate to={to(`/workspace/${last ?? ROLE_DEFAULT[user.persona]}`)} replace />;
}

export function WorkspaceSection() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="new" element={<NewPicker />} />
      <Route path=":id" element={<WorkspacePage />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
