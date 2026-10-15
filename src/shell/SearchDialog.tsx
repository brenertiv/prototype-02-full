import { useMemo, useState } from 'react';
import { useData } from '../data/store';
import { useNav, useScopeInfo } from '../nav/route';
import { Modal } from '../ui/Modal';
import { Icon } from './Icon';

/** The panel header's search across a section's objects in scope (Building Info, People, Notifications). */
export function SearchDialog({ section, onClose, onNavigate }: { section: string; onClose: () => void; onNavigate?: () => void }) {
  const { data } = useData();
  const scope = useScopeInfo();
  const { to, navigate } = useNav();
  const [q, setQ] = useState('');
  const inScope = useMemo(() => new Set(scope.buildingIds), [scope.buildingIds]);
  const bName = (id: string) => data.buildings.find((b) => b.id === id)?.name ?? '';

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const hit = (...s: (string | null | undefined)[]) => s.some((x) => x?.toLowerCase().includes(needle));
    const out: { icon: string; kind: string; label: string; sub: string; path: string }[] = [];
    if (section === 'building-info') {
      data.buildings.filter((b) => inScope.has(b.id) && hit(b.name, b.address, b.city)).forEach((b) => out.push({ icon: 'apartment', kind: 'Building', label: b.name, sub: `${b.address}, ${b.city}`, path: `/building-info/buildings/${b.id}` }));
      data.equipment.filter((e) => inScope.has(e.buildingId) && hit(e.name, e.type, e.description)).slice(0, 15).forEach((e) => out.push({ icon: 'hvac', kind: 'Equipment', label: e.name, sub: `${e.type ?? 'No type'} · ${bName(e.buildingId)}`, path: `/building-info/equipment/${e.id}` }));
      data.meters.filter((m) => inScope.has(m.buildingId) && hit(m.name)).slice(0, 10).forEach((m) => out.push({ icon: 'speed', kind: 'Meter', label: m.name, sub: bName(m.buildingId), path: `/building-info/meters/${m.id}` }));
      data.accounts.filter((a) => inScope.has(a.buildingId) && hit(a.accountNumber, a.provider)).slice(0, 10).forEach((a) => out.push({ icon: 'account_balance', kind: 'Utility account', label: `${a.provider} ${a.accountNumber}`, sub: bName(a.buildingId), path: `/building-info/bills/${a.id}` }));
      data.files.filter((f) => inScope.has(f.buildingId) && hit(f.name)).slice(0, 10).forEach((f) => out.push({ icon: 'description', kind: 'File', label: f.name, sub: bName(f.buildingId), path: `/building-info/files/${f.id}` }));
    } else if (section === 'people') {
      data.users.filter((u) => hit(u.name, u.email, u.title)).forEach((u) => out.push({ icon: 'person', kind: 'Team member', label: u.name, sub: u.title, path: `/people/team/${u.id}` }));
      data.tenants.filter((t) => t.buildingIds.some((b) => inScope.has(b)) && hit(t.name, t.industry)).forEach((t) => out.push({ icon: 'storefront', kind: 'Tenant', label: t.name, sub: t.buildingIds.map(bName).join(', '), path: `/people/tenants/${t.id}` }));
      data.vendors.filter((v) => hit(v.name, v.categories.join(' '))).forEach((v) => out.push({ icon: 'handshake', kind: 'Vendor', label: v.name, sub: v.categories.join(', '), path: `/people/partners/${v.id}?filter=vendors` }));
    } else {
      data.notices.filter((n) => hit(n.title, n.body)).slice(0, 20).forEach((n) => out.push({ icon: 'notifications', kind: n.group.replace('-', ' '), label: n.title, sub: n.body, path: `/notifications/${n.group}` }));
    }
    return out.slice(0, 40);
  }, [q, section, data, inScope]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title="Search" onClose={onClose}>
      <label className="search-field" style={{ maxWidth: 'none', width: '100%' }}>
        <Icon name="search" />
        <span className="sr-only">Search</span>
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={section === 'building-info' ? 'Buildings, equipment, meters, accounts, files' : section === 'people' ? 'People, tenants and vendors' : 'Notifications'} />
      </label>
      <p className="muted" style={{ margin: '8px 0' }}>
        Searching {scope.kind === 'portfolio' ? 'the whole portfolio' : scope.name}
      </p>
      <ul className="search-results">
        {q.trim().length >= 2 && results.length === 0 && <li className="muted">Nothing matches “{q}” in this scope.</li>}
        {results.map((r, k) => (
          <li key={k}>
            <button
              type="button"
              className="search-result"
              onClick={() => {
                navigate(to(r.path));
                onClose();
                onNavigate?.();
              }}
            >
              <Icon name={r.icon} />
              <span>
                <span className="search-result-label">{r.label}</span>
                <span className="muted">
                  {r.kind} · {r.sub}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
