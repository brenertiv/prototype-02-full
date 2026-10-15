/** The component library a workspace is arranged from (MOD-WS-41). */
import type { ComponentType } from 'react';
import type { CompSpec, CompType } from '../types';
import { BusinessCase, GresbTable, ReportCover, SummaryTable } from './reports';
import { EmissionsSplit, EnergyMonthly, EuiRanked, GoalProgress } from './energy';
import { AssetFigures, ExposureKpis, ExposureRanked } from './exposure';
import { CompFrame, type CompCtx } from './frame';
import { BuildingsOverview, SetupProgress, Templates } from './neutral';
import { CapitalProjects, DataProblems, EquipmentEol, InsightsRanked, LoadProfiles } from './operations';
import { PlanNarrative, PlanOverview, PlanPathway, PlanProjects } from './plan';
import { CoverageGaps, EsSync, FrameworkReadiness, ReadinessKpis } from './readiness';

type Renderer = ComponentType<{ spec: CompSpec; ctx: CompCtx }>;

const RENDER: Record<CompType, Renderer> = {
  'readiness-kpis': ReadinessKpis,
  'framework-readiness': FrameworkReadiness,
  'coverage-gaps': CoverageGaps,
  'es-sync': EsSync,
  'exposure-kpis': ExposureKpis,
  'exposure-ranked': ExposureRanked,
  'asset-figures': AssetFigures,
  'data-problems': DataProblems,
  'capital-projects': CapitalProjects,
  'equipment-eol': EquipmentEol,
  'insights-ranked': InsightsRanked,
  'emissions-split': EmissionsSplit,
  'energy-monthly': EnergyMonthly,
  'goal-progress': GoalProgress,
  'eui-ranked': EuiRanked,
  'load-profiles': LoadProfiles,
  'buildings-overview': BuildingsOverview,
  'setup-progress': SetupProgress,
  templates: Templates,
  'report-cover': ReportCover,
  'gresb-table': GresbTable,
  'summary-table': SummaryTable,
  'business-case': BusinessCase,
  'plan-overview': PlanOverview,
  'plan-narrative': PlanNarrative,
  'plan-pathway': PlanPathway,
  'plan-projects': PlanProjects,
};

/** Components that take the full row; the rest pair up on wide canvases. */
const WIDE = new Set<CompType>(['readiness-kpis', 'framework-readiness', 'exposure-kpis', 'exposure-ranked', 'asset-figures', 'data-problems', 'capital-projects', 'equipment-eol', 'insights-ranked', 'emissions-split', 'energy-monthly', 'load-profiles', 'buildings-overview', 'report-cover', 'gresb-table', 'summary-table', 'business-case', 'plan-overview', 'plan-pathway', 'plan-projects']);

export function WorkspaceComponent({ spec, ctx, state }: { spec: CompSpec; ctx: CompCtx; state: 'pending' | 'building' | 'ready' }) {
  const R = RENDER[spec.type];
  return (
    <CompFrame spec={spec} ctx={ctx} state={state} wide={WIDE.has(spec.type)}>
      {R ? <R spec={spec} ctx={ctx} /> : null}
    </CompFrame>
  );
}
