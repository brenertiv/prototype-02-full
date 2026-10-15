/** OWNED BY THE PEOPLE BUILD. Routes under /{company}/{scope}/people/* (`02-building/modules/people.md`). */
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AgentsPage } from './AgentsPage';
import { ContactsPage } from './ContactsPage';
import { MemberPage } from './MemberPage';
import { MgmtPage, PartnersPage, VendorPage } from './PartnersPage';
import { TeamDetail } from './TeamDetail';
import { TeamPage } from './TeamPage';
import { TenantPage, TenantsPage } from './TenantsPage';
import { useData } from '../data/store';
import './people.css';

/** /people/team/{id}: a team (t-…) or a person. */
function TeamObject() {
  const { id = '' } = useParams();
  const { data } = useData();
  if (data.teams.some((t) => t.id === id)) return <TeamDetail id={id} />;
  return <MemberPage id={id} />;
}

/** /people/partners/{id}: a vendor, a management company or a guest (MOD-PPL-13). */
function PartnerObject() {
  const { id = '' } = useParams();
  const { data } = useData();
  if (data.vendors.some((v) => v.id === id)) return <VendorPage id={id} />;
  if (data.managementCompanies.some((m) => m.id === id)) return <MgmtPage id={id} />;
  return <MemberPage id={id} guest />;
}

function TenantObject() {
  const { id = '' } = useParams();
  return <TenantPage key={id} id={id} />;
}

export function PeopleSection() {
  return (
    <Routes>
      <Route index element={<Navigate to="team" replace />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="team/:id" element={<TeamObject />} />
      <Route path="tenants" element={<TenantsPage />} />
      <Route path="tenants/:id" element={<TenantObject />} />
      <Route path="partners" element={<PartnersPage />} />
      <Route path="partners/:id" element={<PartnerObject />} />
      <Route path="contacts" element={<ContactsPage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="*" element={<Navigate to="team" replace />} />
    </Routes>
  );
}
