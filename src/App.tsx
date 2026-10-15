import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AccountSection } from './account/AccountSection';
import { BuildingInfoSection } from './building-info/BuildingInfoSection';
import { resetEverything, TestConfigProvider, useTestConfig } from './config/testConfig';
import { DataProvider, useData } from './data/store';
import { findSection } from './nav/sections';
import { lastScope } from './nav/route';
import { NotificationsSection } from './notifications/NotificationsSection';
import { NotFoundPage } from './pages/NotFoundPage';
import { UpgradePage } from './pages/UpgradePage';
import { PeopleSection } from './people/PeopleSection';
import { Shell } from './shell/Shell';
import { PrefsProvider } from './state/preferences';
import { ToastProvider } from './ui/Toast';
import { WorkspaceSection } from './workspace/WorkspaceSection';

/** The subpath the app is served under ('/' locally). */
const BASENAME = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

/** `/` opens Workspace, the app's home, in the Company and the last scope. */
function Home() {
  const { data } = useData();
  const { startRoute } = useTestConfig();
  if (startRoute) return null; // StartRoute opens it
  return <Navigate to={`/${data.company.id}/${lastScope()}/workspace`} replace />;
}

/** A link's start route (preset, state or `?start=`) opens once, inside the scenario's Company. */
function StartRoute() {
  const { startRoute, consumeStart } = useTestConfig();
  const { data } = useData();
  const navigate = useNavigate();
  useEffect(() => {
    if (!startRoute) return;
    const [p, qs] = startRoute.split('?');
    const first = p.split('/').filter(Boolean)[0];
    const noScope = findSection(first)?.noScope;
    navigate(`/${data.company.id}${noScope ? '' : '/portfolio'}${p}${qs ? `?${qs}` : ''}`, { replace: true });
    consumeStart();
  }, [startRoute, consumeStart, data.company.id, navigate]);
  return null;
}

/** A route for another Company than the scenario's (an old link after switching scenario) lands in the current one. */
function CompanyGuard({ children }: { children: React.ReactNode }) {
  const { data } = useData();
  const { pathname, search } = useLocation();
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && seg !== data.company.id) {
    const rest = pathname.split('/').slice(2).join('/');
    return <Navigate to={`/${data.company.id}/${rest}${search}`} replace />;
  }
  return <>{children}</>;
}

function Reset() {
  useEffect(() => resetEverything(), []);
  return null;
}

export default function App() {
  const tenantBilling = findSection('tenant-billing')!;
  const maintenance = findSection('maintenance')!;
  return (
    <BrowserRouter basename={BASENAME}>
      <TestConfigProvider>
        <DataProvider>
          <PrefsProvider>
            <ToastProvider>
              <StartRoute />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/reset" element={<Reset />} />
                <Route
                  path="/:company"
                  element={
                    <CompanyGuard>
                      <Shell />
                    </CompanyGuard>
                  }
                >
                  <Route index element={<Navigate to="portfolio/workspace" replace />} />
                  <Route path="account/*" element={<AccountSection />} />
                  <Route path="tenant-billing" element={<UpgradePage section={tenantBilling} />} />
                  <Route path="maintenance" element={<UpgradePage section={maintenance} />} />
                  <Route path=":scope">
                    <Route index element={<Navigate to="workspace" replace />} />
                    <Route path="workspace/*" element={<WorkspaceSection />} />
                    <Route path="building-info/*" element={<BuildingInfoSection />} />
                    <Route path="people/*" element={<PeopleSection />} />
                    <Route path="notifications/*" element={<NotificationsSection />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </ToastProvider>
          </PrefsProvider>
        </DataProvider>
      </TestConfigProvider>
    </BrowserRouter>
  );
}
