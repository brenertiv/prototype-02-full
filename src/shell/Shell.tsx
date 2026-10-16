import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { AssistantDrawer } from '../assistant/AssistantDrawer';
import { useTestConfig } from '../config/testConfig';
import { useData } from '../data/store';
import { findSection, sectionForInner } from '../nav/sections';
import { rememberScope, useNav } from '../nav/route';
import { FirstLogin } from '../onboarding/FirstLogin';
import { NoAccessPage } from '../pages/NoAccessPage';
import { PHONE_QUERY, useMediaQuery } from '../state/media';
import { usePrefs } from '../state/preferences';
import { WorkspaceRuntimeProvider } from '../workspace/registry';
import { useSectionAccess } from './access';
import { CompanyModal } from './CompanyModal';
import { Icon } from './Icon';
import { PageControlsProvider } from './pageControls';
import { Panel } from './Panel';
import { Rail } from './Rail';
import { ResizeHandle } from './ResizeHandle';
import { TestPanel } from './TestPanel';
import { TopBar } from './TopBar';

/** The three-region shell: rail, panel, canvas (SYS-NAVPAT-01), with the assistant drawer beside the canvas. */
export const PANEL_LIMITS = { min: 220, max: 440, default: 281 };
export const CHAT_LIMITS = { min: 280, max: 560, default: 320 };

export function Shell() {
  const { prefs, set } = usePrefs();
  const { data, user } = useData();
  const { config } = useTestConfig();
  const phone = useMediaQuery(PHONE_QUERY);
  const { inner, scopeId } = useNav();
  const activeSection = sectionForInner(inner);
  const canAccess = useSectionAccess();

  const [peekId, setPeekId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const peekTimer = useRef<number | undefined>(undefined);
  const mainRef = useRef<HTMLElement>(null);

  const docked = prefs.panelDocked;
  const peekSection = peekId ? findSection(peekId) : undefined;

  useEffect(() => {
    if (scopeId) rememberScope(scopeId);
  }, [scopeId]);

  // Each route change starts the canvas at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [inner]);

  const openPeek = useCallback((id: string) => {
    window.clearTimeout(peekTimer.current);
    setPeekId(findSection(id)?.missing ? null : id);
  }, []);
  const closePeekSoon = useCallback(() => {
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeekId(null), 300);
  }, []);
  const holdPeek = useCallback(() => window.clearTimeout(peekTimer.current), []);

  useEffect(() => {
    if (docked || phone) setPeekId(null);
  }, [docked, phone]);
  useEffect(() => {
    if (!phone) setMobileOpen(false);
  }, [phone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPeekId(null);
      setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closeCompany = useCallback(() => setCompanyOpen(false), []);

  // Tenants only ever use the Tenant Portal (MOD-PPL-17, ST-R05).
  if (config.role === 'tenant') {
    return (
      <div className="full-message">
        <Icon name="storefront" />
        <h1>This sign-in is for the Tenant Portal</h1>
        <p className="muted">Tenant users don't sign in to the web app. In the real product this account opens the Tenant Portal, which isn't part of this prototype.</p>
        <TestPanel />
      </div>
    );
  }

  const blocked = activeSection && !canAccess(activeSection.id);

  return (
    <PageControlsProvider>
      <WorkspaceRuntimeProvider>
      <div
        className="shell"
        data-phone={phone || undefined}
        data-docked={docked}
        data-drawer={prefs.drawerOpen || undefined}
        style={{ '--panel-w': `${prefs.panelWidth}px`, '--chat-w': `${prefs.chatWidth}px` } as CSSProperties}
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        {!phone && (
          <div className="sidebar" onMouseEnter={holdPeek} onMouseLeave={docked ? undefined : closePeekSoon}>
            <Rail
              activeId={activeSection?.id}
              docked={docked}
              onHoverSection={docked ? undefined : openPeek}
              onClickSection={docked ? undefined : openPeek}
              onOpenCompany={() => setCompanyOpen(true)}
            />
            {!docked && peekSection && <Panel section={peekSection} mode="peek" onClose={() => setPeekId(null)} onNavigate={() => setPeekId(null)} />}
          </div>
        )}

        {/* One rounded frame holds the panel, the canvas column and the assistant (Figma app shell). */}
        <div className="shell-frame">
        {!phone && docked && activeSection && !activeSection.missing && (
          <>
            <Panel section={activeSection} mode="docked" />
            <ResizeHandle
              label="Resize the panel"
              value={prefs.panelWidth}
              min={PANEL_LIMITS.min}
              max={PANEL_LIMITS.max}
              defaultValue={PANEL_LIMITS.default}
              direction={1}
              onChange={(w) => set('panelWidth', w)}
            />
          </>
        )}
        <div className="canvas-wrap" onMouseDown={() => setPeekId(null)}>
          <TopBar phone={phone} onOpenMenu={() => setMobileOpen(true)} />
          <main id="main" ref={mainRef} className="canvas" tabIndex={-1}>
            {data.scenario === 'SC-6' && (
              <div className="banner banner--neutral demo-banner">
                <Icon name="science" />
                <div>
                  <strong>Demo account.</strong> Sample data for demonstrations (ST-E05). Nothing here belongs to a client.
                </div>
              </div>
            )}
            {blocked ? <NoAccessPage section={activeSection} role={user.role} /> : <Outlet />}
          </main>
        </div>

        {prefs.drawerOpen && !phone && (
          <ResizeHandle
            label="Resize the assistant"
            value={prefs.chatWidth}
            min={CHAT_LIMITS.min}
            max={CHAT_LIMITS.max}
            defaultValue={CHAT_LIMITS.default}
            direction={-1}
            onChange={(w) => set('chatWidth', w)}
          />
        )}
        {prefs.drawerOpen && <AssistantDrawer phone={phone} onClose={() => set('drawerOpen', false)} />}
        </div>

        {phone && mobileOpen && (
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="mobile-drawer-backdrop" onClick={() => setMobileOpen(false)} />
            <div className={`mobile-drawer-body ${activeSection?.missing ? 'mobile-drawer-body--rail-only' : ''}`}>
              <Rail
                activeId={activeSection?.id}
                phone
                onClickSection={(id) => {
                  if (findSection(id)?.missing) setMobileOpen(false);
                }}
                onOpenCompany={() => setCompanyOpen(true)}
              />
              {activeSection && !activeSection.missing ? (
                <Panel section={activeSection} mode="phone" onClose={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
              ) : (
                <div className="mobile-drawer-close">
                  <button type="button" className="icon-btn" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                    <Icon name="close" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {companyOpen && <CompanyModal onClose={closeCompany} />}
        <FirstLogin />
        <TestPanel />
      </div>
      </WorkspaceRuntimeProvider>
    </PageControlsProvider>
  );
}
