/**
 * Building Info (`02-building/modules/building-info.md`): seven flat pages that work at every
 * scope (MOD-BI-40, 41) and a detail page for every object (MOD-BI-42). Routes under
 * /{company}/{scope}/building-info/*; the index lands on the Stacking plan (MOD-BI-45).
 */
import { Fragment } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { NotFoundPage } from '../pages/NotFoundPage';
import './building-info.css';
import { BillsPage, BillOrAccountDetail } from './BillsPages';
import { BuildingDetail } from './BuildingDetail';
import { BuildingsPage } from './BuildingsPage';
import { DataHealthPage } from './DataHealthPage';
import { EquipmentDetail, EquipmentPage } from './EquipmentPages';
import { FileDetail, FilesPage } from './FilesPages';
import { MeterDetail, MetersPage } from './MeterPages';
import { StackingPlanPage } from './StackingPlanPage';

export function BuildingInfoSection() {
  return (
    <Routes>
      <Route index element={<Navigate to="stacking-plan" replace />} />
      <Route path="stacking-plan" element={<StackingPlanPage />} />
      <Route path="data-health" element={<DataHealthPage />} />
      <Route path="buildings" element={<BuildingsPage />} />
      <Route path="buildings/:id" element={<Keyed el={(id) => <BuildingDetail id={id} />} />} />
      <Route path="equipment" element={<EquipmentPage />} />
      <Route path="equipment/:id" element={<Keyed el={(id) => <EquipmentDetail id={id} />} />} />
      <Route path="meters" element={<MetersPage />} />
      <Route path="meters/:id" element={<Keyed el={(id) => <MeterDetail id={id} />} />} />
      <Route path="bills" element={<BillsPage />} />
      <Route path="bills/:id" element={<Keyed el={(id) => <BillOrAccountDetail id={id} />} />} />
      <Route path="files" element={<FilesPage />} />
      <Route path="files/:id" element={<Keyed el={(id) => <FileDetail id={id} />} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/** Remounts a detail page when its object changes, so local state never leaks between objects. */
function Keyed({ el }: { el: (id: string) => JSX.Element }) {
  const { id = '' } = useParams();
  return <Fragment key={id}>{el(id)}</Fragment>;
}
